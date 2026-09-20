/**
 * React hooks for API operations with loading/error state management.
 */

import { useState, useCallback } from "react";
import {
  compareQuery,
  routeQuery,
  ingestImage,
  ingestText,
  healthCheck,
  getGraphNodes,
  getGraphEdges,
  searchGraph,
  type CompareResponse,
  type RouteResponse,
  type ImageIngestResponse,
  type TextIngestResponse,
  type HealthResponse,
  type GraphNode,
  type GraphEdge,
} from "../lib/api";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useCompare() {
  const [state, setState] = useState<ApiState<CompareResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (query: string) => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await compareQuery(query);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err: any) {
      setState({ data: null, loading: false, error: err.message });
      return null;
    }
  }, []);

  return { ...state, execute };
}

export function useRoute() {
  const [state, setState] = useState<ApiState<RouteResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (query: string) => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await routeQuery(query);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err: any) {
      setState({ data: null, loading: false, error: err.message });
      return null;
    }
  }, []);

  return { ...state, execute };
}

export function useImageIngest() {
  const [state, setState] = useState<ApiState<ImageIngestResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (imageBase64: string, sourceUrl: string = "", context: string = "") => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await ingestImage(imageBase64, sourceUrl, context);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err: any) {
        setState({ data: null, loading: false, error: err.message });
        return null;
      }
    },
    []
  );

  return { ...state, execute };
}

export function useTextIngest() {
  const [state, setState] = useState<ApiState<TextIngestResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (text: string, sourceUrl: string = "", title: string = "") => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await ingestText(text, sourceUrl, title);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err: any) {
        setState({ data: null, loading: false, error: err.message });
        return null;
      }
    },
    []
  );

  return { ...state, execute };
}

export function useHealth() {
  const [state, setState] = useState<ApiState<HealthResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await healthCheck();
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err: any) {
      setState({ data: null, loading: false, error: err.message });
      return null;
    }
  }, []);

  return { ...state, execute };
}

export function useGraphData() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        getGraphNodes(200),
        getGraphEdges(500),
      ]);
      setNodes(nodesRes.nodes);
      setEdges(edgesRes.edges);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(
    async (query: string, nodeType?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await searchGraph(query, nodeType);
        setNodes(result.results);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { nodes, edges, loading, error, fetchAll, search };
}