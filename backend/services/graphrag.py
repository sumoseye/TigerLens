"""
GraphRAG Pipeline — Groq Llama Integration

Provides:
- Intent routing (sub-50ms with llama-3.1-8b-instant)
- Entity extraction and co-reference resolution (llama-3.3-70b-versatile)
- 2-hop graph synthesis for RAG answers
- Vanilla RAG (no graph) for comparison
- Agentic RAG (multi-step reasoning) for comparison
"""

from __future__ import annotations

import json
import time
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Any

from backend.config import GroqConfig
from backend.db.tigergraph_interface import TigerGraphClient, SubGraph, GraphNode, NodeType

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False


class QueryIntent(str, Enum):
    FACTUAL = "factual"
    EXPLORATORY = "exploratory"
    COMPARATIVE = "comparative"
    NAVIGATIONAL = "navigational"


@dataclass
class RouteResult:
    """Result from intent routing."""
    intent: QueryIntent
    confidence: float
    processing_time_ms: float
    model_used: str


@dataclass
class RAGResult:
    """Result from any RAG pipeline variant."""
    answer: str
    sources: list[dict[str, Any]]
    subgraph: Optional[dict] = None
    entities_used: list[str] = field(default_factory=list)
    reasoning_steps: list[str] = field(default_factory=list)
    processing_time_ms: float = 0.0
    token_count: int = 0
    model_used: str = ""
    pipeline_type: str = ""


@dataclass
class ComparisonResult:
    """Side-by-side comparison of three RAG approaches."""
    vanilla: RAGResult
    graph_rag: RAGResult
    agentic: RAGResult
    total_time_ms: float = 0.0


class GraphRAGService:
    """
    Orchestrates all RAG pipelines using Groq for LLM inference
    and TigerGraphClient for graph operations.
    """

    def __init__(self, graph_client: TigerGraphClient) -> None:
        self._config = GroqConfig()
        self._graph = graph_client
        self._groq: Optional[Any] = None
        if GROQ_AVAILABLE and self._config.API_KEY:
            self._groq = Groq(api_key=self._config.API_KEY)

    def _chat(self, model: str, messages: list[dict], temperature: float = 0.1, max_tokens: int = 4096) -> tuple[str, int]:
        """Synchronous Groq chat completion. Returns (text, token_count)."""
        if self._groq is not None:
            try:
                response = self._groq.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                text = response.choices[0].message.content or ""
                tokens = response.usage.total_tokens if response.usage else 0
                return text, tokens
            except Exception as e:
                return f"[Groq error: {str(e)}]", 0
        else:
            return self._mock_chat(model, messages)

    def _mock_chat(self, model: str, messages: list[dict]) -> tuple[str, int]:
        """Generate mock LLM responses for offline development."""
        import random
        import hashlib

        user_msg = ""
        for m in messages:
            if m.get("role") == "user":
                user_msg = m.get("content", "")

        msg_hash = hashlib.md5(user_msg.encode()).hexdigest()
        random.seed(msg_hash)

        # Detect what kind of response is expected
        content_lower = user_msg.lower()

        if "intent" in content_lower or "classify" in content_lower or "route" in content_lower:
            intents = ["factual", "exploratory", "comparative", "navigational"]
            chosen = random.choice(intents)
            return json.dumps({"intent": chosen, "confidence": round(random.uniform(0.82, 0.98), 2)}), random.randint(50, 120)

        if "entities" in content_lower or "extract" in content_lower:
            entity_pools = [
                ["GraphRAG", "Knowledge Graph", "TigerGraph"],
                ["React", "JavaScript", "Plasmo", "Chromium"],
                ["Groq", "Llama 3.3", "Inference"],
                ["FastAPI", "Python", "REST API"],
                ["Gemini", "OCR", "Vision", "Bounding Box"],
            ]
            chosen = random.choice(entity_pools)
            return json.dumps({"entities": chosen, "coreferences": {}}), random.randint(200, 500)

        # Default: generate an answer
        answers = [
            "GraphRAG enhances traditional retrieval-augmented generation by incorporating structured knowledge graph traversals. "
            "Instead of relying solely on vector similarity, it performs multi-hop reasoning across entity relationships, yielding "
            "answers grounded in verified factual connections. In our TigerGraph-backed implementation, a 2-hop neighborhood "
            "expansion retrieves contextually relevant entities, document chunks, and facts that inform the final synthesized response.",

            "The browser extension captures screenshots via `chrome.tabs.captureVisibleTab`, processes them through the Gemini Flash "
            "vision pipeline for OCR and entity extraction, then ingests the extracted knowledge into the graph database. This creates "
            "a persistent, queryable knowledge base from your browsing activity that supports semantic search and graph-based reasoning.",

            "TigerGraph's native parallel processing enables real-time traversal of billions of edges, making it ideal for GraphRAG "
            "workloads where multi-hop queries must return within interactive latencies. Combined with Groq's sub-50ms LLM inference, "
            "the system achieves end-to-end response times suitable for browser extension side panels.",

            "Comparing the three RAG approaches: Vanilla RAG retrieves context via embedding similarity alone. GraphRAG adds structured "
            "graph traversals for multi-hop reasoning. Agentic RAG introduces iterative planning where the LLM decides what additional "
            "information to retrieve at each step, potentially executing multiple graph queries before synthesizing a final answer.",
        ]
        answer = random.choice(answers)
        return answer, random.randint(300, 900)

    async def route_intent(self, query: str) -> RouteResult:
        """Classify the user's query intent using the fast router model."""
        start = time.time()

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a query intent classifier. Classify the user query into exactly one category.\n"
                    "Categories: factual, exploratory, comparative, navigational\n"
                    "Respond ONLY with JSON: {\"intent\": \"<category>\", \"confidence\": <0.0-1.0>}"
                ),
            },
            {"role": "user", "content": query},
        ]

        text, tokens = self._chat(
            model=self._config.ROUTER_MODEL,
            messages=messages,
            temperature=self._config.TEMPERATURE_ROUTER,
            max_tokens=self._config.MAX_TOKENS_ROUTER,
        )

        elapsed = (time.time() - start) * 1000

        try:
            clean_text = text.strip()
            if clean_text.startswith("```"):
                clean_text = clean_text.split("\n", 1)[1]
                if clean_text.endswith("```"):
                    clean_text = clean_text[:-3]
            parsed = json.loads(clean_text)
            intent = QueryIntent(parsed.get("intent", "factual"))
            confidence = float(parsed.get("confidence", 0.5))
        except (json.JSONDecodeError, ValueError):
            intent = QueryIntent.FACTUAL
            confidence = 0.5

        return RouteResult(
            intent=intent,
            confidence=confidence,
            processing_time_ms=round(elapsed, 1),
            model_used=self._config.ROUTER_MODEL,
        )

    async def extract_entities(self, text: str) -> tuple[list[str], dict[str, str], int]:
        """Extract entities and resolve co-references from text."""
        messages = [
            {
                "role": "system",
                "content": (
                    "Extract all named entities from the text. Resolve co-references "
                    "(e.g., 'it' -> 'TigerGraph'). Respond ONLY with JSON:\n"
                    "{\"entities\": [\"Entity1\", \"Entity2\"], "
                    "\"coreferences\": {\"pronoun_or_alias\": \"canonical_entity\"}}"
                ),
            },
            {"role": "user", "content": text},
        ]

        text_resp, tokens = self._chat(
            model=self._config.EXTRACTION_MODEL,
            messages=messages,
            temperature=self._config.TEMPERATURE_EXTRACTION,
            max_tokens=1024,
        )

        try:
            clean_text = text_resp.strip()
            if clean_text.startswith("```"):
                clean_text = clean_text.split("\n", 1)[1]
                if clean_text.endswith("```"):
                    clean_text = clean_text[:-3]
            parsed = json.loads(clean_text)
            entities = parsed.get("entities", [])
            corefs = parsed.get("coreferences", {})
        except (json.JSONDecodeError, ValueError):
            # Fallback: simple capitalized word extraction
            words = text.split()
            entities = list(set(w.strip(".,;:!?") for w in words if w[0:1].isupper() and len(w) > 2))[:10]
            corefs = {}

        return entities, corefs, tokens

    async def vanilla_rag(self, query: str) -> RAGResult:
        """Vanilla RAG: search nodes, concatenate text, ask LLM."""
        start = time.time()

        # Search for relevant nodes
        search_results = await self._graph.search_nodes(query, limit=10)

        # Build context from search results
        context_parts = []
        sources = []
        for node in search_results:
            text = node.properties.get("text", node.label)
            context_parts.append(f"[{node.node_type.value}] {node.label}: {text}")
            sources.append({
                "id": node.id,
                "type": node.node_type.value,
                "label": node.label,
                "relevance": "keyword_match",
            })

        context = "\n".join(context_parts) if context_parts else "No relevant context found."

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant. Answer the user's question using ONLY the provided context. "
                    "If the context doesn't contain enough information, say so. Be concise but thorough."
                ),
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {query}",
            },
        ]

        answer, tokens = self._chat(
            model=self._config.EXTRACTION_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=self._config.MAX_TOKENS_EXTRACTION,
        )

        elapsed = (time.time() - start) * 1000

        return RAGResult(
            answer=answer,
            sources=sources,
            entities_used=[n.label for n in search_results[:5]],
            reasoning_steps=["Search nodes by keyword", "Concatenate context", "Generate answer"],
            processing_time_ms=round(elapsed, 1),
            token_count=tokens,
            model_used=self._config.EXTRACTION_MODEL,
            pipeline_type="vanilla",
        )

    async def graph_rag(self, query: str) -> RAGResult:
        """GraphRAG: extract entities, traverse 2-hop neighborhoods, synthesize."""
        start = time.time()

        # Step 1: Extract entities from query
        entities, corefs, entity_tokens = await self.extract_entities(query)

        # Step 2: Find matching nodes in graph
        all_subgraph_nodes: list[GraphNode] = []
        all_subgraph_edges = []
        matched_nodes = []

        for entity in entities:
            results = await self._graph.search_nodes(entity, limit=3)
            for node in results:
                if node.id not in {n.id for n in matched_nodes}:
                    matched_nodes.append(node)

        # Step 3: Expand 2-hop neighborhoods for top matches
        combined_subgraph = SubGraph()
        seen_node_ids: set[str] = set()
        for node in matched_nodes[:5]:
            sub = await self._graph.get_2hop_neighborhood(node.id)
            for n in sub.nodes:
                if n.id not in seen_node_ids:
                    combined_subgraph.nodes.append(n)
                    seen_node_ids.add(n.id)
            combined_subgraph.edges.extend(sub.edges)

        # Step 4: Build rich context from subgraph
        context_parts = []
        for node in combined_subgraph.nodes:
            text = node.properties.get("text", node.label)
            neighbors = []
            for edge in combined_subgraph.edges:
                if edge.source_id == node.id:
                    target = next((n for n in combined_subgraph.nodes if n.id == edge.target_id), None)
                    if target:
                        neighbors.append(f"--[{edge.edge_type.value}]--> {target.label}")
                elif edge.target_id == node.id:
                    source = next((n for n in combined_subgraph.nodes if n.id == edge.source_id), None)
                    if source:
                        neighbors.append(f"<--[{edge.edge_type.value}]-- {source.label}")

            entry = f"[{node.node_type.value}] {node.label}: {text}"
            if neighbors:
                entry += f"\n  Connections: {', '.join(neighbors[:5])}"
            context_parts.append(entry)

        context = "\n\n".join(context_parts) if context_parts else "No graph context available."

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a GraphRAG assistant. You have access to a knowledge graph with entities, "
                    "documents, facts, and their relationships. Use the structured graph context below to "
                    "provide a well-reasoned answer. Reference specific entities and their connections. "
                    "Explain the reasoning path through the graph."
                ),
            },
            {
                "role": "user",
                "content": f"Graph Context:\n{context}\n\nQuestion: {query}",
            },
        ]

        answer, answer_tokens = self._chat(
            model=self._config.EXTRACTION_MODEL,
            messages=messages,
            temperature=0.15,
            max_tokens=self._config.MAX_TOKENS_EXTRACTION,
        )

        elapsed = (time.time() - start) * 1000

        sources = []
        for node in combined_subgraph.nodes[:10]:
            sources.append({
                "id": node.id,
                "type": node.node_type.value,
                "label": node.label,
                "relevance": "graph_traversal",
            })

        return RAGResult(
            answer=answer,
            sources=sources,
            subgraph=combined_subgraph.to_dict(),
            entities_used=entities,
            reasoning_steps=[
                f"Extracted entities: {entities}",
                f"Co-references resolved: {corefs}",
                f"Matched {len(matched_nodes)} nodes in graph",
                f"Expanded 2-hop neighborhoods: {len(combined_subgraph.nodes)} nodes, {len(combined_subgraph.edges)} edges",
                "Synthesized answer from graph context",
            ],
            processing_time_ms=round(elapsed, 1),
            token_count=entity_tokens + answer_tokens,
            model_used=self._config.EXTRACTION_MODEL,
            pipeline_type="graph_rag",
        )

    async def agentic_rag(self, query: str) -> RAGResult:
        """Agentic RAG: multi-step reasoning with iterative graph queries."""
        start = time.time()
        all_reasoning_steps: list[str] = []
        all_sources: list[dict] = []
        all_entities: list[str] = []
        total_tokens = 0

        # Step 1: Plan the retrieval strategy
        plan_messages = [
            {
                "role": "system",
                "content": (
                    "You are a research planning agent. Given a question, break it down into 2-3 "
                    "specific sub-questions that need to be answered. Respond ONLY with JSON:\n"
                    "{\"sub_questions\": [\"question1\", \"question2\"], "
                    "\"search_terms\": [\"term1\", \"term2\", \"term3\"]}"
                ),
            },
            {"role": "user", "content": query},
        ]

        plan_text, plan_tokens = self._chat(
            model=self._config.EXTRACTION_MODEL,
            messages=plan_messages,
            temperature=0.1,
            max_tokens=512,
        )
        total_tokens += plan_tokens

        try:
            clean_plan = plan_text.strip()
            if clean_plan.startswith("```"):
                clean_plan = clean_plan.split("\n", 1)[1]
                if clean_plan.endswith("```"):
                    clean_plan = clean_plan[:-3]
            plan = json.loads(clean_plan)
            sub_questions = plan.get("sub_questions", [query])
            search_terms = plan.get("search_terms", [query])
        except (json.JSONDecodeError, ValueError):
            sub_questions = [query]
            search_terms = query.split()[:3]

        all_reasoning_steps.append(f"Planning: decomposed into {len(sub_questions)} sub-questions")
        all_reasoning_steps.append(f"Search terms identified: {search_terms}")

        # Step 2: Execute searches for each term
        accumulated_context_parts: list[str] = []
        seen_node_ids: set[str] = set()

        for term in search_terms[:4]:
            nodes = await self._graph.search_nodes(term, limit=5)
            for node in nodes:
                if node.id not in seen_node_ids:
                    seen_node_ids.add(node.id)
                    text = node.properties.get("text", node.label)
                    accumulated_context_parts.append(f"[{node.node_type.value}] {node.label}: {text}")
                    all_sources.append({
                        "id": node.id,
                        "type": node.node_type.value,
                        "label": node.label,
                        "relevance": "agentic_search",
                        "search_term": term,
                    })

                    # Expand 1 hop for key nodes
                    if node.node_type == NodeType.ENTITY:
                        sub = await self._graph.get_2hop_neighborhood(node.id)
                        for sn in sub.nodes[:5]:
                            if sn.id not in seen_node_ids:
                                seen_node_ids.add(sn.id)
                                sn_text = sn.properties.get("text", sn.label)
                                accumulated_context_parts.append(f"  -> [{sn.node_type.value}] {sn.label}: {sn_text}")
                        all_entities.append(node.label)

            all_reasoning_steps.append(f"Searched '{term}': found {len(nodes)} nodes")

        # Step 3: Iterative refinement — check if we need more info
        intermediate_context = "\n".join(accumulated_context_parts[:20])

        eval_messages = [
            {
                "role": "system",
                "content": (
                    "Given the question and the context gathered so far, determine if you have enough "
                    "information to answer comprehensively. Respond ONLY with JSON:\n"
                    "{\"sufficient\": true/false, \"missing\": \"description of what's missing\"}"
                ),
            },
            {
                "role": "user",
                "content": f"Question: {query}\n\nContext gathered:\n{intermediate_context}",
            },
        ]

        eval_text, eval_tokens = self._chat(
            model=self._config.ROUTER_MODEL,
            messages=eval_messages,
            temperature=0.0,
            max_tokens=256,
        )
        total_tokens += eval_tokens

        try:
            clean_eval = eval_text.strip()
            if clean_eval.startswith("```"):
                clean_eval = clean_eval.split("\n", 1)[1]
                if clean_eval.endswith("```"):
                    clean_eval = clean_eval[:-3]
            evaluation = json.loads(clean_eval)
            is_sufficient = evaluation.get("sufficient", True)
            missing = evaluation.get("missing", "")
        except (json.JSONDecodeError, ValueError):
            is_sufficient = True
            missing = ""

        if not is_sufficient and missing:
            all_reasoning_steps.append(f"Evaluation: insufficient context — {missing}")
            # Do one more targeted search
            extra_nodes = await self._graph.search_nodes(missing, limit=5)
            for node in extra_nodes:
                if node.id not in seen_node_ids:
                    seen_node_ids.add(node.id)
                    text = node.properties.get("text", node.label)
                    accumulated_context_parts.append(f"[{node.node_type.value}] {node.label}: {text}")
                    all_sources.append({
                        "id": node.id,
                        "type": node.node_type.value,
                        "label": node.label,
                        "relevance": "agentic_refinement",
                    })
            all_reasoning_steps.append(f"Refinement search for '{missing}': found {len(extra_nodes)} additional nodes")
        else:
            all_reasoning_steps.append("Evaluation: context is sufficient")

        # Step 4: Final synthesis
        final_context = "\n".join(accumulated_context_parts[:30])

        synth_messages = [
            {
                "role": "system",
                "content": (
                    "You are an agentic GraphRAG assistant that performs multi-step reasoning. "
                    "You have already planned sub-questions, searched a knowledge graph iteratively, "
                    "and evaluated information sufficiency. Now synthesize a comprehensive answer.\n\n"
                    "Structure your response as:\n"
                    "1. Direct answer to the main question\n"
                    "2. Supporting evidence from the graph\n"
                    "3. Connections and insights discovered through multi-hop traversal"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Original question: {query}\n\n"
                    f"Sub-questions investigated: {json.dumps(sub_questions)}\n\n"
                    f"Gathered context:\n{final_context}"
                ),
            },
        ]

        answer, answer_tokens = self._chat(
            model=self._config.EXTRACTION_MODEL,
            messages=synth_messages,
            temperature=0.2,
            max_tokens=self._config.MAX_TOKENS_EXTRACTION,
        )
        total_tokens += answer_tokens
        all_reasoning_steps.append("Final synthesis complete")

        elapsed = (time.time() - start) * 1000

        return RAGResult(
            answer=answer,
            sources=all_sources,
            entities_used=all_entities,
            reasoning_steps=all_reasoning_steps,
            processing_time_ms=round(elapsed, 1),
            token_count=total_tokens,
            model_used=self._config.EXTRACTION_MODEL,
            pipeline_type="agentic",
        )

    async def compare(self, query: str) -> ComparisonResult:
        """Run all three RAG pipelines in parallel and return comparison."""
        start = time.time()

        vanilla_task = asyncio.create_task(self.vanilla_rag(query))
        graph_task = asyncio.create_task(self.graph_rag(query))
        agentic_task = asyncio.create_task(self.agentic_rag(query))

        vanilla, graph, agentic = await asyncio.gather(vanilla_task, graph_task, agentic_task)

        total = (time.time() - start) * 1000

        return ComparisonResult(
            vanilla=vanilla,
            graph_rag=graph,
            agentic=agentic,
            total_time_ms=round(total, 1),
        )