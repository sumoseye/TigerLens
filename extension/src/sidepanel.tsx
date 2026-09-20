/**
 * SidePanel — Active Page Assistant
 *
 * Features:
 * - Chocolate/Yellow/Ice-Blue theme
 * - Floating "Snap & Link" action button
 * - 3-column streaming RAG comparison cards (Vanilla vs GraphRAG vs Agentic)
 * - Query input with intent routing display
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Brain,
  Zap,
  Server,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import ComparisonCard from "./components/ComparisonCard";
import SnapButton from "./components/SnapButton";
import { useCompare, useRoute, useHealth } from "./hooks/useApi";
import type { CompareResponse, RouteResponse } from "./lib/api";
import "./styles/globals.css";

function SidePanel() {
  const [query, setQuery] = useState("");
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteResponse | null>(null);
  const [snapCount, setSnapCount] = useState(0);

  const compare = useCompare();
  const route = useRoute();
  const health = useHealth();

  // Health check on mount
  useEffect(() => {
    health.execute();
  }, []);

  const handleQuery = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || compare.loading) return;

      // Route intent in parallel with comparison
      const [routeResult, compareResult] = await Promise.all([
        route.execute(query.trim()),
        compare.execute(query.trim()),
      ]);

      if (routeResult) setRouteInfo(routeResult);
      if (compareResult) setComparison(compareResult);
    },
    [query, compare, route]
  );

  const handleSnap = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      chrome.runtime?.sendMessage?.(
        { type: "CAPTURE_SCREENSHOT", sourceUrl: "" },
        (response) => {
          if (response?.success) {
            setSnapCount((c) => c + 1);
            resolve();
          } else {
            reject(new Error(response?.error || "Capture failed"));
          }
        }
      );
      // Fallback resolve after timeout if chrome.runtime is not available
      setTimeout(resolve, 1000);
    });
  }, []);

  return (
    <div className="min-h-screen bg-chocolate flex flex-col">
      {/* Header */}
      <header className="bg-chocolate-100 border-b border-chocolate-400 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-butter-yellow" />
            <h1 className="text-sm font-bold text-cream">
              BrowseGraph{" "}
              <span className="text-butter-yellow-300">TigerLens</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {snapCount > 0 && (
              <span className="badge-ice text-[10px]">{snapCount} snaps</span>
            )}
            <div
              className={`w-2 h-2 rounded-full ${
                health.data?.status === "healthy"
                  ? "bg-green-400"
                  : health.loading
                  ? "bg-butter-yellow animate-pulse"
                  : "bg-red-400"
              }`}
              title={health.data?.status || "checking..."}
            />
          </div>
        </div>

        {/* Health info */}
        {health.data && (
          <div className="flex items-center gap-3 mt-2 text-[10px] text-cream-300">
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3" />
              {health.data.node_count} nodes
            </span>
            <span>{health.data.edge_count} edges</span>
            {health.data.mock_mode && (
              <span className="badge-butter text-[9px]">Mock Mode</span>
            )}
          </div>
        )}
      </header>

      {/* Query Input */}
      <div className="px-4 py-3 border-b border-chocolate-400">
        <form onSubmit={handleQuery} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your browsing knowledge..."
            className="input-dark flex-1 text-sm"
            disabled={compare.loading}
          />
          <button
            type="submit"
            disabled={compare.loading || !query.trim()}
            className="btn-butter text-xs whitespace-nowrap disabled:opacity-50"
          >
            {compare.loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
          </button>
        </form>

        {/* Route Info */}
        {routeInfo && (
          <div className="flex items-center gap-2 mt-2 text-[10px] text-cream-300 animate-fade-in">
            <Activity className="w-3 h-3 text-ice-blue" />
            <span>
              Intent:{" "}
              <span className="badge-ice text-[9px]">{routeInfo.intent}</span>
            </span>
            <span>
              Confidence: {(routeInfo.confidence * 100).toFixed(0)}%
            </span>
            <span>{routeInfo.processing_time_ms.toFixed(0)}ms</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {compare.error && (
        <div className="mx-4 mt-3 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-red-300">Connection Error</p>
            <p className="text-[10px] text-red-400 mt-0.5">{compare.error}</p>
            <p className="text-[10px] text-red-400 mt-1">
              Make sure the backend is running: cd backend && uvicorn
              backend.main:app --reload --port 8741
            </p>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 animate-slide-up">
          {/* Total time badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-cream-300">
              Comparison Results
            </span>
            <span className="badge-butter text-[9px]">
              Total: {comparison.total_time_ms.toFixed(0)}ms
            </span>
          </div>

          {/* Three comparison cards */}
          <ComparisonCard
            result={comparison.vanilla}
            pipelineLabel="Vanilla RAG"
            accentColor="butter"
          />
          <ComparisonCard
            result={comparison.graph_rag}
            pipelineLabel="GraphRAG"
            accentColor="ice"
          />
          <ComparisonCard
            result={comparison.agentic}
            pipelineLabel="Agentic RAG"
            accentColor="cream"
          />
        </div>
      )}

      {/* Empty State */}
      {!comparison && !compare.loading && !compare.error && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <Brain className="w-12 h-12 text-chocolate-400 mb-4" />
          <h2 className="text-sm font-semibold text-cream-300 mb-2">
            Ready to Explore
          </h2>
          <p className="text-xs text-chocolate-500 leading-relaxed">
            Ask a question to compare Vanilla RAG, GraphRAG, and Agentic RAG
            side-by-side. Use the{" "}
            <span className="text-butter-yellow-300">Snap & Link</span> button
            to capture and index page content.
          </p>
        </div>
      )}

      {/* Loading State */}
      {compare.loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-chocolate-400 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-2 border-butter-yellow-300 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xs text-cream-300">
            Running 3 RAG pipelines in parallel...
          </p>
        </div>
      )}

      {/* Snap & Link FAB */}
      <SnapButton onSnap={handleSnap} />
    </div>
  );
}

export default SidePanel;