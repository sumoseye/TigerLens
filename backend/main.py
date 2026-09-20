"""
BrowseGraph & TigerLens — FastAPI Application

Endpoints:
  POST /query/route    — Classify query intent
  POST /query/compare  — Run parallel 3-way RAG comparison
  POST /ingest/image   — Analyze and ingest a screenshot
  POST /ingest/text    — Extract entities and ingest text into graph
  GET  /graph/nodes    — Retrieve all graph nodes
  GET  /graph/edges    — Retrieve all graph edges
  GET  /graph/neighborhood/{node_id} — Get 2-hop neighborhood
  GET  /graph/search   — Search nodes
  GET  /health         — Health check
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.config import ServerConfig, USE_MOCK_TG
from backend.db.tigergraph_interface import (
    MockTigerGraphDriver,
    TigerGraphClient,
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
)
from backend.services.graphrag import GraphRAGService, QueryIntent
from backend.services.multimodal import MultimodalService


# ──────────────────────────────────────────────────────────
# Global service instances
# ──────────────────────────────────────────────────────────

graph_client: TigerGraphClient
graphrag_service: GraphRAGService
multimodal_service: MultimodalService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    global graph_client, graphrag_service, multimodal_service

    if USE_MOCK_TG:
        graph_client = MockTigerGraphDriver()
        print("[STARTUP] Using MockTigerGraphDriver (offline mode)")
    else:
        raise NotImplementedError("Live TigerGraph driver not implemented yet")

    graphrag_service = GraphRAGService(graph_client)
    multimodal_service = MultimodalService()

    print("[STARTUP] All services initialized")
    yield
    print("[SHUTDOWN] Cleaning up")


app = FastAPI(
    title="BrowseGraph & TigerLens API",
    description="Real-time GraphRAG, comparative evaluation, and visual screenshot extraction",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ServerConfig.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User query text")


class RouteResponse(BaseModel):
    intent: str
    confidence: float
    processing_time_ms: float
    model_used: str


class RAGResponse(BaseModel):
    answer: str
    sources: list[dict]
    subgraph: Optional[dict] = None
    entities_used: list[str]
    reasoning_steps: list[str]
    processing_time_ms: float
    token_count: int
    model_used: str
    pipeline_type: str


class CompareResponse(BaseModel):
    vanilla: RAGResponse
    graph_rag: RAGResponse
    agentic: RAGResponse
    total_time_ms: float


class ImageIngestRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded screenshot image")
    source_url: str = Field(default="", description="URL of the page the screenshot was taken from")
    context: str = Field(default="", description="Additional context about the page")


class ImageIngestResponse(BaseModel):
    ocr_text: str
    description: str
    bounding_boxes: list[dict]
    entities_detected: list[str]
    nodes_created: int
    edges_created: int
    processing_time_ms: float


class TextIngestRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    source_url: str = Field(default="")
    title: str = Field(default="")


class TextIngestResponse(BaseModel):
    entities_extracted: list[str]
    nodes_created: int
    edges_created: int
    processing_time_ms: float


class GraphSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    node_type: Optional[str] = None
    limit: int = Field(default=20, le=100)


class HealthResponse(BaseModel):
    status: str
    mock_mode: bool
    node_count: int
    edge_count: int
    uptime_ms: float


# ──────────────────────────────────────────────────────────
# Track uptime
# ──────────────────────────────────────────────────────────

_start_time = time.time()


# ──────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """System health check."""
    nodes = await graph_client.get_all_nodes(limit=10000)
    edges = await graph_client.get_all_edges(limit=10000)
    return HealthResponse(
        status="healthy",
        mock_mode=USE_MOCK_TG,
        node_count=len(nodes),
        edge_count=len(edges),
        uptime_ms=round((time.time() - _start_time) * 1000, 1),
    )


@app.post("/query/route", response_model=RouteResponse)
async def route_query(request: QueryRequest):
    """Classify the intent of a user query."""
    result = await graphrag_service.route_intent(request.query)
    return RouteResponse(
        intent=result.intent.value,
        confidence=result.confidence,
        processing_time_ms=result.processing_time_ms,
        model_used=result.model_used,
    )


@app.post("/query/compare", response_model=CompareResponse)
async def compare_query(request: QueryRequest):
    """Run all three RAG pipelines in parallel and return comparison."""
    result = await graphrag_service.compare(request.query)

    def rag_to_response(r) -> RAGResponse:
        return RAGResponse(
            answer=r.answer,
            sources=r.sources,
            subgraph=r.subgraph,
            entities_used=r.entities_used,
            reasoning_steps=r.reasoning_steps,
            processing_time_ms=r.processing_time_ms,
            token_count=r.token_count,
            model_used=r.model_used,
            pipeline_type=r.pipeline_type,
        )

    return CompareResponse(
        vanilla=rag_to_response(result.vanilla),
        graph_rag=rag_to_response(result.graph_rag),
        agentic=rag_to_response(result.agentic),
        total_time_ms=result.total_time_ms,
    )


@app.post("/ingest/image", response_model=ImageIngestResponse)
async def ingest_image(request: ImageIngestRequest):
    """Analyze a screenshot and ingest extracted knowledge into the graph."""
    start = time.time()

    # Analyze the image
    analysis = await multimodal_service.analyze_screenshot(request.image_base64, request.context)

    nodes_created = 0
    edges_created = 0

    # Create an ImageChunk node
    import hashlib
    img_id = f"img_{hashlib.md5(request.image_base64[:200].encode()).hexdigest()[:12]}"
    img_node = GraphNode(
        id=img_id,
        node_type=NodeType.IMAGE_CHUNK,
        label=analysis.description[:100] if analysis.description else "Screenshot",
        properties={
            "description": analysis.description,
            "ocr_text": analysis.ocr_text,
            "source_url": request.source_url,
            "bounding_boxes": [
                {"label": bb.label, "x": bb.x, "y": bb.y, "w": bb.width, "h": bb.height, "conf": bb.confidence}
                for bb in analysis.bounding_boxes
            ],
        },
    )
    await graph_client.upsert_node(img_node)
    nodes_created += 1

    # Create entity nodes and edges from detected entities
    for entity_name in analysis.entities_detected:
        ent_id = f"ent_{entity_name.lower().replace(' ', '_').replace('-', '_')}"
        ent_node = GraphNode(
            id=ent_id,
            node_type=NodeType.ENTITY,
            label=entity_name,
            properties={"source": "screenshot_extraction"},
        )
        await graph_client.upsert_node(ent_node)
        nodes_created += 1

        edge = GraphEdge(
            source_id=img_id,
            target_id=ent_id,
            edge_type=EdgeType.MENTIONS,
            properties={"extraction_method": "gemini_vision"},
        )
        await graph_client.upsert_edge(edge)
        edges_created += 1

    # If we have OCR text, create a DocumentChunk
    if analysis.ocr_text and len(analysis.ocr_text) > 10:
        doc_id = f"doc_{hashlib.md5(analysis.ocr_text[:100].encode()).hexdigest()[:12]}"
        doc_node = GraphNode(
            id=doc_id,
            node_type=NodeType.DOCUMENT_CHUNK,
            label=f"OCR from {request.source_url or 'screenshot'}",
            properties={
                "text": analysis.ocr_text,
                "source_url": request.source_url,
                "token_count": len(analysis.ocr_text.split()),
            },
        )
        await graph_client.upsert_node(doc_node)
        nodes_created += 1

        # Link image to document
        edge = GraphEdge(
            source_id=img_id,
            target_id=doc_id,
            edge_type=EdgeType.CONTAINS_IMAGE,
        )
        await graph_client.upsert_edge(edge)
        edges_created += 1

    elapsed = (time.time() - start) * 1000

    return ImageIngestResponse(
        ocr_text=analysis.ocr_text,
        description=analysis.description,
        bounding_boxes=[
            {"label": bb.label, "x": bb.x, "y": bb.y, "width": bb.width, "height": bb.height, "confidence": bb.confidence}
            for bb in analysis.bounding_boxes
        ],
        entities_detected=analysis.entities_detected,
        nodes_created=nodes_created,
        edges_created=edges_created,
        processing_time_ms=round(elapsed, 1),
    )


@app.post("/ingest/text", response_model=TextIngestResponse)
async def ingest_text(request: TextIngestRequest):
    """Extract entities from text and ingest into the graph."""
    start = time.time()
    nodes_created = 0
    edges_created = 0

    # Extract entities using Groq
    entities, corefs, tokens = await graphrag_service.extract_entities(request.text)

    # Create DocumentChunk
    import hashlib
    doc_id = f"doc_{hashlib.md5(request.text[:200].encode()).hexdigest()[:12]}"
    doc_node = GraphNode(
        id=doc_id,
        node_type=NodeType.DOCUMENT_CHUNK,
        label=request.title or f"Document from {request.source_url or 'input'}",
        properties={
            "text": request.text[:5000],
            "source_url": request.source_url,
            "title": request.title,
            "token_count": len(request.text.split()),
        },
    )
    await graph_client.upsert_node(doc_node)
    nodes_created += 1

    # Create entity nodes and MENTIONS edges
    for entity_name in entities:
        ent_id = f"ent_{entity_name.lower().replace(' ', '_').replace('-', '_')}"
        ent_node = GraphNode(
            id=ent_id,
            node_type=NodeType.ENTITY,
            label=entity_name,
            properties={"source": "text_extraction"},
        )
        await graph_client.upsert_node(ent_node)
        nodes_created += 1

        edge = GraphEdge(
            source_id=doc_id,
            target_id=ent_id,
            edge_type=EdgeType.MENTIONS,
            properties={"extraction_method": "groq_llama"},
        )
        await graph_client.upsert_edge(edge)
        edges_created += 1

    # Connect co-referenced entities
    resolved_entities = list(set(corefs.values()))
    for i in range(len(resolved_entities)):
        for j in range(i + 1, len(resolved_entities)):
            src_id = f"ent_{resolved_entities[i].lower().replace(' ', '_').replace('-', '_')}"
            tgt_id = f"ent_{resolved_entities[j].lower().replace(' ', '_').replace('-', '_')}"
            edge = GraphEdge(
                source_id=src_id,
                target_id=tgt_id,
                edge_type=EdgeType.CONNECTED_TO,
                properties={"relation": "co-reference"},
            )
            await graph_client.upsert_edge(edge)
            edges_created += 1

    elapsed = (time.time() - start) * 1000

    return TextIngestResponse(
        entities_extracted=entities,
        nodes_created=nodes_created,
        edges_created=edges_created,
        processing_time_ms=round(elapsed, 1),
    )


@app.get("/graph/nodes")
async def get_graph_nodes(limit: int = 100):
    """Retrieve all graph nodes."""
    nodes = await graph_client.get_all_nodes(limit=limit)
    return {"nodes": [n.to_dict() for n in nodes], "count": len(nodes)}


@app.get("/graph/edges")
async def get_graph_edges(limit: int = 200):
    """Retrieve all graph edges."""
    edges = await graph_client.get_all_edges(limit=limit)
    return {"edges": [e.to_dict() for e in edges], "count": len(edges)}


@app.get("/graph/neighborhood/{node_id}")
async def get_neighborhood(node_id: str):
    """Get 2-hop neighborhood of a node."""
    node = await graph_client.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
    subgraph = await graph_client.get_2hop_neighborhood(node_id)
    return {
        "center_node": node.to_dict(),
        "subgraph": subgraph.to_dict(),
        "node_count": len(subgraph.nodes),
        "edge_count": len(subgraph.edges),
    }


@app.post("/graph/search")
async def search_graph(request: GraphSearchRequest):
    """Search nodes by text query."""
    node_type = None
    if request.node_type:
        try:
            node_type = NodeType(request.node_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid node type: {request.node_type}")

    nodes = await graph_client.search_nodes(request.query, node_type=node_type, limit=request.limit)
    return {"results": [n.to_dict() for n in nodes], "count": len(nodes)}


# ──────────────────────────────────────────────────────────
# Entry point for direct execution
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=ServerConfig.HOST,
        port=ServerConfig.PORT,
        reload=True,
    )