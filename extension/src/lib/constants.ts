/**
 * Application-wide constants for BrowseGraph & TigerLens.
 */

export const API_BASE_URL = "http://localhost:8741";

export const THEME = {
  bgPrimary: "#2A1810",
  bgSecondary: "#3D2317",
  accentPrimary: "#FFF3B0",
  accentSecondary: "#FFE680",
  nodeColor: "#A2CFFE",
  textLight: "#FAF6EE",
  textDark: "#1A0F0A",
} as const;

export const NODE_TYPE_COLORS: Record<string, string> = {
  Entity: "#A2CFFE",
  DocumentChunk: "#FFF3B0",
  ImageChunk: "#FFE680",
  Fact: "#73B7FD",
};

export const EDGE_TYPE_COLORS: Record<string, string> = {
  MENTIONS: "#FFF3B0",
  CONTAINS_IMAGE: "#FFE680",
  CONNECTED_TO: "#A2CFFE",
};

export const BENCHMARK_QUERIES = [
  "What is GraphRAG and how does it differ from standard RAG?",
  "How does TigerGraph handle parallel graph traversal?",
  "What role does Groq play in real-time AI inference?",
  "Explain the relationship between embeddings and vector databases",
  "How do browser extensions capture and process screenshots?",
  "What is the attention mechanism in transformer architectures?",
  "Compare React and vanilla JavaScript for UI development",
  "How does Plasmo simplify browser extension development?",
  "What are knowledge graphs used for in AI systems?",
  "Explain multi-hop reasoning in graph-based retrieval",
  "How does Gemini Flash perform visual grounding?",
  "What is co-reference resolution in NLP?",
  "Describe the FastAPI framework and its async capabilities",
  "How do WebSockets differ from REST APIs?",
  "What is Tailwind CSS and why is it popular?",
  "Explain the concept of retrieval-augmented generation",
  "How does TigerGraph Cloud differ from on-premise deployment?",
  "What are the advantages of Llama 3.3 70B for extraction tasks?",
  "How do bounding boxes work in visual object detection?",
  "What is an IndexedDB and how is it used in extensions?",
  "Explain force-directed graph layouts",
  "How does entity extraction improve search quality?",
  "What is the role of OCR in document processing?",
  "Compare graph databases to relational databases",
  "How do side panels work in Chromium extensions?",
  "What is semantic search and how does it use embeddings?",
  "Explain the concept of idempotent operations in APIs",
  "How does debouncing improve performance in event handlers?",
  "What is a 2-hop neighborhood in graph theory?",
  "How does parallel execution improve RAG pipeline performance?",
  "What are the benefits of mock drivers in development?",
  "Explain the publisher-subscriber pattern",
  "How does Groq LPU architecture achieve low latency?",
  "What is visual grounding in multimodal AI?",
  "How do React hooks manage side effects?",
  "Explain the concept of graph synthesis in RAG",
  "What is intent routing and why is speed critical?",
  "How do agentic AI systems plan and iterate?",
  "What is a knowledge canvas in information management?",
  "Explain the role of confidence scores in entity extraction",
  "How does token counting affect LLM cost management?",
  "What are normalized bounding box coordinates?",
  "How does Plasmo handle hot module replacement?",
  "Explain the concept of graph clustering",
  "What is the difference between sync and async graph traversal?",
  "How do browser extensions communicate with backend APIs?",
  "What are the security implications of host permissions?",
  "Explain latency distribution in benchmarking",
  "How does ReactFlow render interactive node graphs?",
  "What is the role of PostCSS in modern CSS toolchains?",
];