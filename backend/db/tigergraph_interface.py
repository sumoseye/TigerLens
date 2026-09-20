"""
TigerGraph Interface — Abstract Base Class + MockTigerGraphDriver

The MockTigerGraphDriver provides a complete in-memory graph simulation
with entities, document chunks, image chunks, facts, and edges. It supports
2-hop neighborhood lookups and idempotent node/edge writes so the system
runs 100% offline without TigerGraph Savanna.
"""

from __future__ import annotations

import hashlib
import random
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


# ──────────────────────────────────────────────────────────
# Domain Models
# ──────────────────────────────────────────────────────────

class NodeType(str, Enum):
    ENTITY = "Entity"
    DOCUMENT_CHUNK = "DocumentChunk"
    IMAGE_CHUNK = "ImageChunk"
    FACT = "Fact"


class EdgeType(str, Enum):
    MENTIONS = "MENTIONS"
    CONTAINS_IMAGE = "CONTAINS_IMAGE"
    CONNECTED_TO = "CONNECTED_TO"


@dataclass
class GraphNode:
    """Represents a node in the knowledge graph."""
    id: str
    node_type: NodeType
    label: str
    properties: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "node_type": self.node_type.value,
            "label": self.label,
            "properties": self.properties,
            "created_at": self.created_at,
        }


@dataclass
class GraphEdge:
    """Represents a directed edge in the knowledge graph."""
    source_id: str
    target_id: str
    edge_type: EdgeType
    properties: dict[str, Any] = field(default_factory=dict)
    weight: float = 1.0

    def to_dict(self) -> dict:
        return {
            "source_id": self.source_id,
            "target_id": self.target_id,
            "edge_type": self.edge_type.value,
            "properties": self.properties,
            "weight": self.weight,
        }


@dataclass
class SubGraph:
    """A subgraph result from a neighborhood query."""
    nodes: list[GraphNode] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
        }


# ──────────────────────────────────────────────────────────
# Abstract Base Class
# ──────────────────────────────────────────────────────────

class TigerGraphClient(ABC):
    """Abstract interface for all TigerGraph operations."""

    @abstractmethod
    async def upsert_node(self, node: GraphNode) -> bool:
        """Insert or update a node (idempotent by node.id)."""
        ...

    @abstractmethod
    async def upsert_edge(self, edge: GraphEdge) -> bool:
        """Insert or update an edge (idempotent by source+target+type)."""
        ...

    @abstractmethod
    async def get_node(self, node_id: str) -> Optional[GraphNode]:
        """Retrieve a single node by ID."""
        ...

    @abstractmethod
    async def get_2hop_neighborhood(self, node_id: str) -> SubGraph:
        """Retrieve all nodes and edges within 2 hops of the given node."""
        ...

    @abstractmethod
    async def search_nodes(self, query: str, node_type: Optional[NodeType] = None, limit: int = 20) -> list[GraphNode]:
        """Text-based search across node labels and properties."""
        ...

    @abstractmethod
    async def get_all_nodes(self, limit: int = 100) -> list[GraphNode]:
        """Retrieve all nodes up to a limit."""
        ...

    @abstractmethod
    async def get_all_edges(self, limit: int = 200) -> list[GraphEdge]:
        """Retrieve all edges up to a limit."""
        ...


# ──────────────────────────────────────────────────────────
# Mock Implementation
# ──────────────────────────────────────────────────────────

# Seed data for realistic simulation
_SEED_ENTITIES = [
    ("ent_python", "Python", {"domain": "programming", "type": "language"}),
    ("ent_javascript", "JavaScript", {"domain": "programming", "type": "language"}),
    ("ent_react", "React", {"domain": "frontend", "type": "framework"}),
    ("ent_fastapi", "FastAPI", {"domain": "backend", "type": "framework"}),
    ("ent_tigergraph", "TigerGraph", {"domain": "database", "type": "graph_db"}),
    ("ent_groq", "Groq", {"domain": "ai", "type": "inference_provider"}),
    ("ent_gemini", "Google Gemini", {"domain": "ai", "type": "model"}),
    ("ent_graphrag", "GraphRAG", {"domain": "ai", "type": "technique"}),
    ("ent_llama", "Llama 3.3", {"domain": "ai", "type": "model"}),
    ("ent_tailwind", "Tailwind CSS", {"domain": "frontend", "type": "framework"}),
    ("ent_plasmo", "Plasmo", {"domain": "frontend", "type": "extension_framework"}),
    ("ent_chromium", "Chromium", {"domain": "browser", "type": "engine"}),
    ("ent_knowledge_graph", "Knowledge Graph", {"domain": "data", "type": "concept"}),
    ("ent_vector_db", "Vector Database", {"domain": "data", "type": "concept"}),
    ("ent_rag", "RAG", {"domain": "ai", "type": "technique"}),
    ("ent_transformer", "Transformer", {"domain": "ai", "type": "architecture"}),
    ("ent_attention", "Attention Mechanism", {"domain": "ai", "type": "concept"}),
    ("ent_embeddings", "Embeddings", {"domain": "ai", "type": "concept"}),
    ("ent_websocket", "WebSocket", {"domain": "networking", "type": "protocol"}),
    ("ent_rest_api", "REST API", {"domain": "networking", "type": "protocol"}),
]

_SEED_DOC_CHUNKS = [
    ("doc_graphrag_intro", "GraphRAG combines knowledge graphs with retrieval-augmented generation to provide structured, multi-hop reasoning over interconnected facts."),
    ("doc_tigergraph_overview", "TigerGraph is a native parallel graph database that supports real-time deep link analytics across billions of entities and relationships."),
    ("doc_groq_speed", "Groq's LPU inference engine delivers sub-50ms token generation for models like Llama 3, making real-time AI applications feasible."),
    ("doc_gemini_vision", "Google Gemini 2.5 Flash offers multimodal understanding including OCR, visual grounding with bounding boxes, and image description."),
    ("doc_react_components", "React's component model enables building complex UIs from isolated, reusable pieces with predictable state management."),
    ("doc_plasmo_extension", "Plasmo is a browser extension framework that brings React, TypeScript, and modern tooling to extension development."),
    ("doc_rag_basics", "Retrieval-Augmented Generation retrieves relevant context from a knowledge base before generating an answer, reducing hallucination."),
    ("doc_knowledge_graph_def", "A knowledge graph represents real-world entities and their interrelations in a structured graph format."),
]

_SEED_IMAGE_CHUNKS = [
    ("img_graph_visualization", "Screenshot of a force-directed graph showing entity relationships", {"width": 1920, "height": 1080, "format": "png"}),
    ("img_dashboard_metrics", "Dashboard showing latency distribution and token usage metrics", {"width": 1440, "height": 900, "format": "png"}),
    ("img_architecture_diagram", "System architecture diagram showing extension, API, and graph database", {"width": 1600, "height": 1000, "format": "svg"}),
]

_SEED_FACTS = [
    ("fact_graphrag_uses_kg", "GraphRAG uses Knowledge Graphs for multi-hop reasoning"),
    ("fact_groq_llama", "Groq accelerates Llama 3.3 inference to sub-50ms latency"),
    ("fact_gemini_ocr", "Gemini Flash performs OCR and visual grounding on screenshots"),
    ("fact_tigergraph_parallel", "TigerGraph supports native parallel graph traversal"),
    ("fact_react_ui", "React powers the extension's side panel and new tab UI"),
    ("fact_plasmo_chromium", "Plasmo builds Chromium-compatible browser extensions"),
    ("fact_rag_reduces_hallucination", "RAG reduces LLM hallucination by grounding in retrieved facts"),
    ("fact_transformer_attention", "Transformers use attention mechanisms for sequence modeling"),
    ("fact_embeddings_similarity", "Embeddings enable semantic similarity search in vector databases"),
]


class MockTigerGraphDriver(TigerGraphClient):
    """
    Complete in-memory mock of a TigerGraph database.

    Generates a realistic seed graph on initialization and supports
    all CRUD and traversal operations defined by TigerGraphClient.
    """

    def __init__(self) -> None:
        self._nodes: dict[str, GraphNode] = {}
        self._edges: list[GraphEdge] = []
        self._adjacency: dict[str, list[str]] = {}  # node_id -> list of neighbor node_ids
        self._edge_index: dict[str, GraphEdge] = {}  # "src|tgt|type" -> edge
        self._seed_graph()

    def _make_edge_key(self, source: str, target: str, etype: EdgeType) -> str:
        return f"{source}|{target}|{etype.value}"

    def _seed_graph(self) -> None:
        """Populate the mock graph with seed data and interconnections."""
        # Add entity nodes
        for eid, label, props in _SEED_ENTITIES:
            node = GraphNode(id=eid, node_type=NodeType.ENTITY, label=label, properties=props)
            self._nodes[eid] = node
            self._adjacency.setdefault(eid, [])

        # Add document chunk nodes
        for did, text in _SEED_DOC_CHUNKS:
            node = GraphNode(
                id=did,
                node_type=NodeType.DOCUMENT_CHUNK,
                label=did.replace("doc_", "").replace("_", " ").title(),
                properties={"text": text, "token_count": len(text.split())},
            )
            self._nodes[did] = node
            self._adjacency.setdefault(did, [])

        # Add image chunk nodes
        for iid, description, props in _SEED_IMAGE_CHUNKS:
            node = GraphNode(
                id=iid,
                node_type=NodeType.IMAGE_CHUNK,
                label=iid.replace("img_", "").replace("_", " ").title(),
                properties={**props, "description": description},
            )
            self._nodes[iid] = node
            self._adjacency.setdefault(iid, [])

        # Add fact nodes
        for fid, text in _SEED_FACTS:
            node = GraphNode(
                id=fid,
                node_type=NodeType.FACT,
                label=text,
                properties={"text": text, "confidence": round(random.uniform(0.75, 0.99), 2)},
            )
            self._nodes[fid] = node
            self._adjacency.setdefault(fid, [])

        # Create MENTIONS edges: documents mention entities
        mentions_pairs = [
            ("doc_graphrag_intro", "ent_graphrag"),
            ("doc_graphrag_intro", "ent_knowledge_graph"),
            ("doc_graphrag_intro", "ent_rag"),
            ("doc_tigergraph_overview", "ent_tigergraph"),
            ("doc_groq_speed", "ent_groq"),
            ("doc_groq_speed", "ent_llama"),
            ("doc_gemini_vision", "ent_gemini"),
            ("doc_react_components", "ent_react"),
            ("doc_plasmo_extension", "ent_plasmo"),
            ("doc_plasmo_extension", "ent_react"),
            ("doc_rag_basics", "ent_rag"),
            ("doc_rag_basics", "ent_knowledge_graph"),
            ("doc_knowledge_graph_def", "ent_knowledge_graph"),
        ]
        for src, tgt in mentions_pairs:
            self._add_edge_internal(src, tgt, EdgeType.MENTIONS)

        # Create CONTAINS_IMAGE edges
        image_pairs = [
            ("doc_graphrag_intro", "img_graph_visualization"),
            ("doc_tigergraph_overview", "img_architecture_diagram"),
            ("doc_groq_speed", "img_dashboard_metrics"),
        ]
        for src, tgt in image_pairs:
            self._add_edge_internal(src, tgt, EdgeType.CONTAINS_IMAGE)

        # Create CONNECTED_TO edges between entities
        connected_pairs = [
            ("ent_graphrag", "ent_knowledge_graph"),
            ("ent_graphrag", "ent_rag"),
            ("ent_graphrag", "ent_tigergraph"),
            ("ent_rag", "ent_vector_db"),
            ("ent_rag", "ent_embeddings"),
            ("ent_rag", "ent_transformer"),
            ("ent_groq", "ent_llama"),
            ("ent_gemini", "ent_transformer"),
            ("ent_transformer", "ent_attention"),
            ("ent_embeddings", "ent_vector_db"),
            ("ent_react", "ent_javascript"),
            ("ent_react", "ent_tailwind"),
            ("ent_plasmo", "ent_react"),
            ("ent_plasmo", "ent_chromium"),
            ("ent_fastapi", "ent_python"),
            ("ent_fastapi", "ent_rest_api"),
            ("ent_tigergraph", "ent_knowledge_graph"),
            ("ent_websocket", "ent_rest_api"),
            ("ent_python", "ent_javascript"),
        ]
        for src, tgt in connected_pairs:
            self._add_edge_internal(src, tgt, EdgeType.CONNECTED_TO)

        # Connect facts to entities
        fact_connections = [
            ("fact_graphrag_uses_kg", "ent_graphrag"),
            ("fact_graphrag_uses_kg", "ent_knowledge_graph"),
            ("fact_groq_llama", "ent_groq"),
            ("fact_groq_llama", "ent_llama"),
            ("fact_gemini_ocr", "ent_gemini"),
            ("fact_tigergraph_parallel", "ent_tigergraph"),
            ("fact_react_ui", "ent_react"),
            ("fact_plasmo_chromium", "ent_plasmo"),
            ("fact_plasmo_chromium", "ent_chromium"),
            ("fact_rag_reduces_hallucination", "ent_rag"),
            ("fact_transformer_attention", "ent_transformer"),
            ("fact_transformer_attention", "ent_attention"),
            ("fact_embeddings_similarity", "ent_embeddings"),
            ("fact_embeddings_similarity", "ent_vector_db"),
        ]
        for src, tgt in fact_connections:
            self._add_edge_internal(src, tgt, EdgeType.CONNECTED_TO)

    def _add_edge_internal(self, source: str, target: str, edge_type: EdgeType, properties: dict[str, Any] | None = None, weight: float = 1.0) -> None:
        """Internal helper to add an edge without async."""
        key = self._make_edge_key(source, target, edge_type)
        if key in self._edge_index:
            return
        edge = GraphEdge(
            source_id=source,
            target_id=target,
            edge_type=edge_type,
            properties=properties or {},
            weight=weight,
        )
        self._edges.append(edge)
        self._edge_index[key] = edge
        self._adjacency.setdefault(source, []).append(target)
        self._adjacency.setdefault(target, []).append(source)

    async def upsert_node(self, node: GraphNode) -> bool:
        """Insert or update a node (idempotent by node.id)."""
        existing = self._nodes.get(node.id)
        if existing:
            existing.label = node.label
            existing.properties.update(node.properties)
            return True
        self._nodes[node.id] = node
        self._adjacency.setdefault(node.id, [])
        return True

    async def upsert_edge(self, edge: GraphEdge) -> bool:
        """Insert or update an edge (idempotent by source+target+type)."""
        key = self._make_edge_key(edge.source_id, edge.target_id, edge.edge_type)
        if key in self._edge_index:
            self._edge_index[key].properties.update(edge.properties)
            self._edge_index[key].weight = edge.weight
            return True
        self._edges.append(edge)
        self._edge_index[key] = edge
        self._adjacency.setdefault(edge.source_id, []).append(edge.target_id)
        self._adjacency.setdefault(edge.target_id, []).append(edge.source_id)
        return True

    async def get_node(self, node_id: str) -> Optional[GraphNode]:
        """Retrieve a single node by ID."""
        return self._nodes.get(node_id)

    async def get_2hop_neighborhood(self, node_id: str) -> SubGraph:
        """Retrieve all nodes and edges within 2 hops of the given node."""
        if node_id not in self._nodes:
            return SubGraph()

        visited_nodes: set[str] = set()
        hop1_neighbors: set[str] = set()

        # Hop 0: the node itself
        visited_nodes.add(node_id)

        # Hop 1
        for neighbor in self._adjacency.get(node_id, []):
            if neighbor in self._nodes:
                visited_nodes.add(neighbor)
                hop1_neighbors.add(neighbor)

        # Hop 2
        for h1_node in hop1_neighbors:
            for neighbor in self._adjacency.get(h1_node, []):
                if neighbor in self._nodes:
                    visited_nodes.add(neighbor)

        # Collect nodes
        result_nodes = [self._nodes[nid] for nid in visited_nodes if nid in self._nodes]

        # Collect edges that connect any two visited nodes
        result_edges = []
        for edge in self._edges:
            if edge.source_id in visited_nodes and edge.target_id in visited_nodes:
                result_edges.append(edge)

        return SubGraph(nodes=result_nodes, edges=result_edges)

    async def search_nodes(self, query: str, node_type: Optional[NodeType] = None, limit: int = 20) -> list[GraphNode]:
        """Text-based search across node labels and properties."""
        query_lower = query.lower()
        results: list[tuple[float, GraphNode]] = []

        for node in self._nodes.values():
            if node_type and node.node_type != node_type:
                continue

            score = 0.0
            label_lower = node.label.lower()

            # Exact match
            if query_lower == label_lower:
                score = 1.0
            # Contains
            elif query_lower in label_lower:
                score = 0.7
            # Word overlap
            else:
                query_words = set(query_lower.split())
                label_words = set(label_lower.split())
                overlap = query_words & label_words
                if overlap:
                    score = 0.4 * len(overlap) / max(len(query_words), 1)

                # Check properties
                for value in node.properties.values():
                    val_str = str(value).lower()
                    if query_lower in val_str:
                        score = max(score, 0.5)
                        break
                    val_words = set(val_str.split())
                    prop_overlap = query_words & val_words
                    if prop_overlap:
                        score = max(score, 0.3 * len(prop_overlap) / max(len(query_words), 1))

            if score > 0:
                results.append((score, node))

        results.sort(key=lambda x: x[0], reverse=True)
        return [node for _, node in results[:limit]]

    async def get_all_nodes(self, limit: int = 100) -> list[GraphNode]:
        """Retrieve all nodes up to a limit."""
        all_nodes = list(self._nodes.values())
        return all_nodes[:limit]

    async def get_all_edges(self, limit: int = 200) -> list[GraphEdge]:
        """Retrieve all edges up to a limit."""
        return self._edges[:limit]


# ──────────────────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────────────────

def create_graph_client() -> TigerGraphClient:
    """Factory that returns the appropriate TigerGraph client based on config."""
    from backend.config import USE_MOCK_TG
    if USE_MOCK_TG:
        return MockTigerGraphDriver()
    # Future: implement LiveTigerGraphDriver here
    raise NotImplementedError("Live TigerGraph driver not yet implemented. Set USE_MOCK_TG=true.")