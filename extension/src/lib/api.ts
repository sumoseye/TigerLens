/**
 * API client for communicating with the BrowseGraph & TigerLens backend.
 */

import { API_BASE_URL } from "./constants";

// ─── Types ───────────────────────────────────────────────

export interface RouteResponse {
  intent: string;
  confidence: number;
  processing_time_ms: number;
  model_used: string;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    id: string;
    type: string;
    label: string;
    relevance: string;
  }>;
  subgraph?: {
    nodes: Array<{
      id: string;
      node_type: string;
      label: string;
      properties: Record<string, any>;
    }>;
    edges: Array<{
      source_id: string;
      target_id: string;
      edge_type: string;
      weight: number;
    }>;
  };
  entities_used: string[];
  reasoning_steps: string[];
  processing_time_ms: number;
  token_count: number;
  model_used: string;
  pipeline_type: string;
}

export interface CompareResponse {
  vanilla: RAGResponse;
  graph_rag: RAGResponse;
  agentic: RAGResponse;
  total_time_ms: number;
}

export interface ImageIngestResponse {
  ocr_text: string;
  description: string;
  bounding_boxes: Array<{
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  entities_detected: string[];
  nodes_created: number;
  edges_created: number;
  processing_time_ms: number;
}

export interface TextIngestResponse {
  entities_extracted: string[];
  nodes_created: number;
  edges_created: number;
  processing_time_ms: number;
}

export interface GraphNode {
  id: string;
  node_type: string;
  label: string;
  properties: Record<string, any>;
  created_at: number;
}

export interface GraphEdge {
  source_id: string;
  target_id: string;
  edge_type: string;
  properties: Record<string, any>;
  weight: number;
}

export interface HealthResponse {
  status: string;
  mock_mode: boolean;
  node_count: number;
  edge_count: number;
  uptime_ms: number;
}

// ─── API Functions ──────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export async function healthCheck(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function routeQuery(query: string): Promise<RouteResponse> {
  return request<RouteResponse>("/query/route", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function compareQuery(query: string): Promise<CompareResponse> {
  return request<CompareResponse>("/query/compare", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function ingestImage(
  imageBase64: string,
  sourceUrl: string = "",
  context: string = ""
): Promise<ImageIngestResponse> {
  return request<ImageIngestResponse>("/ingest/image", {
    method: "POST",
    body: JSON.stringify({
      image_base64: imageBase64,
      source_url: sourceUrl,
      context,
    }),
  });
}

export async function ingestText(
  text: string,
  sourceUrl: string = "",
  title: string = ""
): Promise<TextIngestResponse> {
  return request<TextIngestResponse>("/ingest/text", {
    method: "POST",
    body: JSON.stringify({ text, source_url: sourceUrl, title }),
  });
}

export async function getGraphNodes(
  limit: number = 100
): Promise<{ nodes: GraphNode[]; count: number }> {
  return request(`/graph/nodes?limit=${limit}`);
}

export async function getGraphEdges(
  limit: number = 200
): Promise<{ edges: GraphEdge[]; count: number }> {
  return request(`/graph/edges?limit=${limit}`);
}

export async function getNeighborhood(
  nodeId: string
): Promise<{
  center_node: GraphNode;
  subgraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  node_count: number;
  edge_count: number;
}> {
  return request(`/graph/neighborhood/${encodeURIComponent(nodeId)}`);
}

export async function searchGraph(
  query: string,
  nodeType?: string,
  limit: number = 20
): Promise<{ results: GraphNode[]; count: number }> {
  return request("/graph/search", {
    method: "POST",
    body: JSON.stringify({ query, node_type: nodeType, limit }),
  });
}