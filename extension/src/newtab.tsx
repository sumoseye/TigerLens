/**
 * NewTab — Knowledge Canvas
 *
 * Features:
 * - Interactive ReactFlow force-clustered graph with Ice Blue nodes
 * - Dual-mode search bar (Enter = Web, Shift+Enter = GraphRAG)
 * - Node detail panel on click
 * - Graph statistics header
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Network,
  RefreshCw,
  Info,
  X,
  ExternalLink,
} from "lucide-react";
import GraphCanvas from "./components/GraphCanvas";
import SearchBar from "./components/SearchBar";
import { useGraphData, useCompare } from "./hooks/useApi";
import { getNeighborhood } from "./lib/api";
import type { GraphNode, GraphEdge, CompareResponse } from "./lib/api";
import { NODE_TYPE_COLORS } from "./lib/constants";
import ComparisonCard from "./components/ComparisonCard";
import "./styles/globals.css";

interface NodeDetail {
  node: GraphNode;
  neighborCount: number;
  edgeCount: number;
}

function NewTab() {
  const graphData = useGraphData();
  const compare = useCompare();
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [searchMode, setSearchMode] = useState<"web" | "graphrag">("web");

  // Load graph on mount
  useEffect(() => {
    graphData.fetchAll();
  }, []);

  const handleNodeClick = useCallback(async (nodeId: string) => {
    try {
      const result = await getNeighborhood(nodeId);
      setSelectedNode({
        node: result.center_node,
        neighborCount: result.node_count,
        edgeCount: result.edge_count,
      });
    } catch (err) {
      console.error("Failed to fetch neighborhood:", err);
    }
  }, []);

  const handleSearch = useCallback(
    async (query: string, mode: "web" | "graphrag") => {
      setSearchMode(mode);

      if (mode === "graphrag") {
        const result = await compare.execute(query);
        if (result) {
          setComparison(result);
          // Also update graph to show relevant nodes
          if (result.graph_rag.subgraph) {
            // Optionally highlight the subgraph nodes
          }
        }
      } else {
        // Filter/search the graph
        await graphData.search(query);
        setComparison(null);
      }
    },
    [compare, graphData]
  );

  // Count nodes by type
  const typeCounts = graphData.nodes.reduce<Record<string, number>>(
    (acc, n) => {
      acc[n.node_type] = (acc[n.node_type] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="h-screen w-screen bg-chocolate flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="bg-chocolate-100 border-b border-chocolate-400 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-butter-yellow" />
            <div>
              <h1 className="text-lg font-bold text-cream">
                TIGERLENS
              </h1>
              <p className="text-[10px] text-chocolate-500">
                
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Node type badges */}
            {Object.entries(typeCounts).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                style={{
                  backgroundColor: `${NODE_TYPE_COLORS[type] || "#A2CFFE"}22`,
                  color: NODE_TYPE_COLORS[type] || "#A2CFFE",
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: NODE_TYPE_COLORS[type] || "#A2CFFE",
                  }}
                />
                {type}: {count}
              </div>
            ))}

            {/* Refresh button */}
            <button
              onClick={() => graphData.fetchAll()}
              disabled={graphData.loading}
              className="p-2 rounded-lg bg-chocolate-50 text-cream-300 hover:bg-chocolate-400 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${graphData.loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar
          onSearch={handleSearch}
          loading={compare.loading || graphData.loading}
          placeholder="Search your browsing knowledge graph... (Enter=Filter, Shift+Enter=GraphRAG)"
        />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph Visualization */}
        <div
          className={`flex-1 relative ${
            comparison || selectedNode ? "w-1/2" : "w-full"
          } transition-all duration-300`}
        >
          {graphData.loading && graphData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-butter-yellow animate-spin mx-auto mb-3" />
                <p className="text-sm text-cream-300">Loading graph...</p>
              </div>
            </div>
          ) : graphData.error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-8">
                <Network className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <p className="text-sm text-red-300 mb-2">
                  Failed to load graph
                </p>
                <p className="text-xs text-red-400">{graphData.error}</p>
                <p className="text-xs text-cream-300 mt-3">
                  Start the backend:{" "}
                  <code className="bg-chocolate-50 px-1 py-0.5 rounded">
                    cd backend && python -m uvicorn backend.main:app --reload
                    --port 8741
                  </code>
                </p>
              </div>
            </div>
          ) : (
            <GraphCanvas
              graphNodes={graphData.nodes}
              graphEdges={graphData.edges}
              onNodeClick={handleNodeClick}
            />
          )}

          {/* Graph Stats Overlay */}
          <div className="absolute bottom-4 left-4 bg-chocolate-100/90 backdrop-blur border border-chocolate-400 rounded-lg px-3 py-2">
            <div className="flex items-center gap-3 text-[10px] text-cream-300">
              <span>{graphData.nodes.length} nodes</span>
              <span>{graphData.edges.length} edges</span>
            </div>
          </div>
        </div>

        {/* Side Panel — Node Detail or Comparison */}
        {(comparison || selectedNode) && (
          <div className="w-1/2 max-w-xl border-l border-chocolate-400 bg-chocolate overflow-y-auto animate-fade-in">
            {/* Comparison Results */}
            {comparison && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-cream">
                    RAG Comparison
                  </h2>
                  <button
                    onClick={() => setComparison(null)}
                    className="p-1 rounded hover:bg-chocolate-50 text-cream-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <span className="badge-butter text-[9px]">
                  Total: {comparison.total_time_ms.toFixed(0)}ms
                </span>

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

            {/* Node Detail */}
            {selectedNode && !comparison && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-cream flex items-center gap-2">
                    <Info className="w-4 h-4 text-ice-blue" />
                    Node Details
                  </h2>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded hover:bg-chocolate-50 text-cream-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="card-chocolate space-y-3">
                  <div>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${
                          NODE_TYPE_COLORS[selectedNode.node.node_type] ||
                          "#A2CFFE"
                        }22`,
                        color:
                          NODE_TYPE_COLORS[selectedNode.node.node_type] ||
                          "#A2CFFE",
                      }}
                    >
                      {selectedNode.node.node_type}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-cream">
                    {selectedNode.node.label}
                  </h3>

                  <div className="flex gap-3 text-xs text-cream-300">
                    <span>{selectedNode.neighborCount} neighbors</span>
                    <span>{selectedNode.edgeCount} connections</span>
                  </div>

                  {/* Properties */}
                  {Object.keys(selectedNode.node.properties).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-semibold text-cream-300 uppercase tracking-wider">
                        Properties
                      </h4>
                      {Object.entries(selectedNode.node.properties).map(
                        ([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-butter-yellow-300 font-mono">
                              {key}:
                            </span>{" "}
                            <span className="text-cream-300">
                              {typeof value === "object"
                                ? JSON.stringify(value).slice(0, 200)
                                : String(value).slice(0, 300)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-chocolate-500 font-mono">
                    ID: {selectedNode.node.id}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default NewTab;