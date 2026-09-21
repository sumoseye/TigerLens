/**
 * Benchmark Page — Standalone full-screen evaluation tab.
 *
 * Runs up to 50 automated evaluation queries with:
 * - Live latency distribution charts
 * - Token tracking per pipeline
 * - Pass/fail tallying
 * - Summary statistics
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Play,
  Square,
  BarChart3,
  Clock,
  Coins,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
} from "lucide-react";
import BenchmarkChart from "../components/BenchmarkChart";
import { compareQuery } from "../lib/api";
import type { CompareResponse } from "../lib/api";
import { BENCHMARK_QUERIES } from "../lib/constants";
import "../styles/globals.css";

interface BenchmarkResult {
  queryIndex: number;
  query: string;
  result: CompareResponse | null;
  error: string | null;
  timestamp: number;
}

interface AggregateStats {
  totalQueries: number;
  completed: number;
  failed: number;
  avgLatency: { vanilla: number; graphRag: number; agentic: number };
  avgTokens: { vanilla: number; graphRag: number; agentic: number };
  totalTokens: { vanilla: number; graphRag: number; agentic: number };
  p50Latency: { vanilla: number; graphRag: number; agentic: number };
  p95Latency: { vanilla: number; graphRag: number; agentic: number };
}

function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(results: BenchmarkResult[]): AggregateStats {
  const completed = results.filter((r) => r.result !== null);
  const failed = results.filter((r) => r.error !== null);

  const vanillaLatencies = completed.map(
    (r) => r.result!.vanilla.processing_time_ms
  );
  const graphRagLatencies = completed.map(
    (r) => r.result!.graph_rag.processing_time_ms
  );
  const agenticLatencies = completed.map(
    (r) => r.result!.agentic.processing_time_ms
  );

  const vanillaTokens = completed.map((r) => r.result!.vanilla.token_count);
  const graphRagTokens = completed.map((r) => r.result!.graph_rag.token_count);
  const agenticTokens = completed.map((r) => r.result!.agentic.token_count);

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return {
    totalQueries: results.length,
    completed: completed.length,
    failed: failed.length,
    avgLatency: {
      vanilla: Math.round(avg(vanillaLatencies)),
      graphRag: Math.round(avg(graphRagLatencies)),
      agentic: Math.round(avg(agenticLatencies)),
    },
    avgTokens: {
      vanilla: Math.round(avg(vanillaTokens)),
      graphRag: Math.round(avg(graphRagTokens)),
      agentic: Math.round(avg(agenticTokens)),
    },
    totalTokens: {
      vanilla: sum(vanillaTokens),
      graphRag: sum(graphRagTokens),
      agentic: sum(agenticTokens),
    },
    p50Latency: {
      vanilla: Math.round(computePercentile(vanillaLatencies, 50)),
      graphRag: Math.round(computePercentile(graphRagLatencies, 50)),
      agentic: Math.round(computePercentile(agenticLatencies, 50)),
    },
    p95Latency: {
      vanilla: Math.round(computePercentile(vanillaLatencies, 95)),
      graphRag: Math.round(computePercentile(graphRagLatencies, 95)),
      agentic: Math.round(computePercentile(agenticLatencies, 95)),
    },
  };
}

function BenchmarkPage() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queryCount, setQueryCount] = useState(10);
  const abortRef = useRef(false);

  const stats = computeStats(results);

  const latencyChartData = results
    .filter((r) => r.result)
    .map((r, i) => ({
      label: `Q${r.queryIndex + 1}`,
      vanilla: Math.round(r.result!.vanilla.processing_time_ms),
      graphRag: Math.round(r.result!.graph_rag.processing_time_ms),
      agentic: Math.round(r.result!.agentic.processing_time_ms),
    }));

  const tokenChartData = results
    .filter((r) => r.result)
    .map((r, i) => ({
      label: `Q${r.queryIndex + 1}`,
      vanilla: r.result!.vanilla.token_count,
      graphRag: r.result!.graph_rag.token_count,
      agentic: r.result!.agentic.token_count,
    }));

  const runBenchmark = useCallback(async () => {
    setRunning(true);
    setResults([]);
    abortRef.current = false;

    const queriesToRun = BENCHMARK_QUERIES.slice(0, queryCount);

    for (let i = 0; i < queriesToRun.length; i++) {
      if (abortRef.current) break;

      setCurrentIndex(i);
      const query = queriesToRun[i];

      try {
        const result = await compareQuery(query);
        const benchResult: BenchmarkResult = {
          queryIndex: i,
          query,
          result,
          error: null,
          timestamp: Date.now(),
        };
        setResults((prev) => [...prev, benchResult]);
      } catch (err: any) {
        const benchResult: BenchmarkResult = {
          queryIndex: i,
          query,
          result: null,
          error: err.message,
          timestamp: Date.now(),
        };
        setResults((prev) => [...prev, benchResult]);
      }

      // Small delay between queries to avoid overwhelming the backend
      if (i < queriesToRun.length - 1 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    setRunning(false);
  }, [queryCount]);

  const stopBenchmark = useCallback(() => {
    abortRef.current = true;
    setRunning(false);
  }, []);

  const exportResults = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      queryCount: results.length,
      stats,
      results: results.map((r) => ({
        query: r.query,
        error: r.error,
        vanilla: r.result
          ? {
              latency: r.result.vanilla.processing_time_ms,
              tokens: r.result.vanilla.token_count,
            }
          : null,
        graphRag: r.result
          ? {
              latency: r.result.graph_rag.processing_time_ms,
              tokens: r.result.graph_rag.token_count,
            }
          : null,
        agentic: r.result
          ? {
              latency: r.result.agentic.processing_time_ms,
              tokens: r.result.agentic.token_count,
            }
          : null,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benchmark-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, stats]);

  return (
    <div className="min-h-screen bg-chocolate text-cream">
      {/* Header */}
      <header className="bg-chocolate-100 border-b border-chocolate-400 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-butter-yellow" />
              <div>
                <h1 className="text-xl font-bold">
                  RAG Pipeline Benchmark
                </h1>
                <p className="text-xs text-chocolate-500 mt-0.5">
                  Automated evaluation across Vanilla, GraphRAG, and Agentic
                  pipelines
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Query count selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-cream-300">Queries:</label>
                <select
                  value={queryCount}
                  onChange={(e) => setQueryCount(Number(e.target.value))}
                  disabled={running}
                  className="bg-chocolate-200 border border-chocolate-400 rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:ring-1 focus:ring-butter-yellow-300"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Control buttons */}
              {running ? (
                <button onClick={stopBenchmark} className="btn-butter flex items-center gap-2">
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              ) : (
                <button onClick={runBenchmark} className="btn-butter flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Run Benchmark
                </button>
              )}

              {results.length > 0 && (
                <button
                  onClick={exportResults}
                  className="btn-ice flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {running && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-cream-300 mb-1">
                <span>
                  Running query {currentIndex + 1} of {queryCount}
                </span>
                <span>
                  {Math.round(((currentIndex + 1) / queryCount) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-chocolate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-butter-yellow-300 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / queryCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Stats Cards */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard
              label="Completed"
              value={stats.completed}
              icon={CheckCircle}
              color="text-green-400"
            />
            <StatCard
              label="Failed"
              value={stats.failed}
              icon={XCircle}
              color="text-red-400"
            />
            <StatCard
              label="Avg Vanilla"
              value={`${stats.avgLatency.vanilla}ms`}
              icon={Clock}
              color="text-butter-yellow"
            />
            <StatCard
              label="Avg GraphRAG"
              value={`${stats.avgLatency.graphRag}ms`}
              icon={Clock}
              color="text-ice-blue"
            />
            <StatCard
              label="Avg Agentic"
              value={`${stats.avgLatency.agentic}ms`}
              icon={Clock}
              color="text-butter-yellow-300"
            />
            <StatCard
              label="Total Tokens"
              value={(
                stats.totalTokens.vanilla +
                stats.totalTokens.graphRag +
                stats.totalTokens.agentic
              ).toLocaleString()}
              icon={Coins}
              color="text-cream"
            />
          </div>
        )}

        {/* Percentile Stats */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-chocolate">
              <h3 className="text-sm font-semibold text-cream mb-3">
                Latency Percentiles (ms)
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-cream-300 border-b border-chocolate-400">
                    <th className="text-left py-2">Pipeline</th>
                    <th className="text-right py-2">P50</th>
                    <th className="text-right py-2">P95</th>
                    <th className="text-right py-2">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-chocolate-400/50">
                    <td className="py-2 text-butter-yellow">Vanilla</td>
                    <td className="text-right py-2">
                      {stats.p50Latency.vanilla}
                    </td>
                    <td className="text-right py-2">
                      {stats.p95Latency.vanilla}
                    </td>
                    <td className="text-right py-2">
                      {stats.avgLatency.vanilla}
                    </td>
                  </tr>
                  <tr className="border-b border-chocolate-400/50">
                    <td className="py-2 text-ice-blue">GraphRAG</td>
                    <td className="text-right py-2">
                      {stats.p50Latency.graphRag}
                    </td>
                    <td className="text-right py-2">
                      {stats.p95Latency.graphRag}
                    </td>
                    <td className="text-right py-2">
                      {stats.avgLatency.graphRag}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-butter-yellow-300">Agentic</td>
                    <td className="text-right py-2">
                      {stats.p50Latency.agentic}
                    </td>
                    <td className="text-right py-2">
                      {stats.p95Latency.agentic}
                    </td>
                    <td className="text-right py-2">
                      {stats.avgLatency.agentic}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card-chocolate">
              <h3 className="text-sm font-semibold text-cream mb-3">
                Token Usage Summary
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-cream-300 border-b border-chocolate-400">
                    <th className="text-left py-2">Pipeline</th>
                    <th className="text-right py-2">Avg/Query</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-chocolate-400/50">
                    <td className="py-2 text-butter-yellow">Vanilla</td>
                    <td className="text-right py-2">
                      {stats.avgTokens.vanilla}
                    </td>
                    <td className="text-right py-2">
                      {stats.totalTokens.vanilla.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-b border-chocolate-400/50">
                    <td className="py-2 text-ice-blue">GraphRAG</td>
                    <td className="text-right py-2">
                      {stats.avgTokens.graphRag}
                    </td>
                    <td className="text-right py-2">
                      {stats.totalTokens.graphRag.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-butter-yellow-300">Agentic</td>
                    <td className="text-right py-2">
                      {stats.avgTokens.agentic}
                    </td>
                    <td className="text-right py-2">
                      {stats.totalTokens.agentic.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Charts */}
        {latencyChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BenchmarkChart
              data={latencyChartData}
              chartType="latency"
              title="Latency Distribution (ms)"
            />
            <BenchmarkChart
              data={tokenChartData}
              chartType="tokens"
              title="Token Usage Per Query"
            />
          </div>
        )}

        {/* Individual Results Table */}
        {results.length > 0 && (
          <div className="card-chocolate overflow-x-auto">
            <h3 className="text-sm font-semibold text-cream mb-3">
              Individual Query Results
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-cream-300 border-b border-chocolate-400">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Query</th>
                  <th className="text-right py-2 px-2">Vanilla</th>
                  <th className="text-right py-2 px-2">GraphRAG</th>
                  <th className="text-right py-2 px-2">Agentic</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-chocolate-400/30 hover:bg-chocolate-50 transition-colors"
                  >
                    <td className="py-2 px-2 text-cream-300">{r.queryIndex + 1}</td>
                    <td className="py-2 px-2 text-cream max-w-xs truncate" title={r.query}>
                      {r.query}
                    </td>
                    <td className="text-right py-2 px-2 text-butter-yellow font-mono">
                      {r.result
                        ? `${r.result.vanilla.processing_time_ms.toFixed(0)}ms`
                        : "—"}
                    </td>
                    <td className="text-right py-2 px-2 text-ice-blue font-mono">
                      {r.result
                        ? `${r.result.graph_rag.processing_time_ms.toFixed(0)}ms`
                        : "—"}
                    </td>
                    <td className="text-right py-2 px-2 text-butter-yellow-300 font-mono">
                      {r.result
                        ? `${r.result.agentic.processing_time_ms.toFixed(0)}ms`
                        : "—"}
                    </td>
                    <td className="text-center py-2 px-2">
                      {r.result ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 inline" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center py-24">
            <BarChart3 className="w-16 h-16 text-chocolate-400 mb-6" />
            <h2 className="text-lg font-semibold text-cream-300 mb-2">
              Ready to Benchmark
            </h2>
            <p className="text-sm text-chocolate-500 text-center max-w-md leading-relaxed">
              Select the number of queries and click{" "}
              <span className="text-butter-yellow">Run Benchmark</span> to
              evaluate all three RAG pipelines with automated queries. Results
              include latency distributions, token usage, and per-query
              breakdowns.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Helper Component ───────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="card-chocolate flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
      <div>
        <p className="text-[10px] text-chocolate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-bold text-cream">{value}</p>
      </div>
    </div>
  );
}

export default BenchmarkPage;