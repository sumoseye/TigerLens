/**
 * BenchmarkChart — Renders latency distribution and token tracking charts
 * using pure SVG (no external chart library needed).
 */

import React from "react";
import { THEME } from "../lib/constants";

interface DataPoint {
  label: string;
  vanilla: number;
  graphRag: number;
  agentic: number;
}

interface BenchmarkChartProps {
  data: DataPoint[];
  chartType: "latency" | "tokens";
  title: string;
}

export default function BenchmarkChart({
  data,
  chartType,
  title,
}: BenchmarkChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-chocolate-100 rounded-xl border border-chocolate-400">
        <span className="text-chocolate-500 text-sm">No data yet</span>
      </div>
    );
  }

  const allValues = data.flatMap((d) => [d.vanilla, d.graphRag, d.agentic]);
  const maxValue = Math.max(...allValues, 1);

  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barGroupWidth = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.min(barGroupWidth * 0.25, 20);
  const barGap = 3;

  const colors = {
    vanilla: THEME.accentPrimary,
    graphRag: THEME.nodeColor,
    agentic: THEME.accentSecondary,
  };

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxValue * i) / yTicks)
  );

  return (
    <div className="bg-chocolate-100 rounded-xl border border-chocolate-400 p-4">
      <h3 className="text-sm font-semibold text-cream mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ minWidth: 500 }}
        >
          {/* Y-axis grid lines and labels */}
          {yTickValues.map((val, i) => {
            const y = padding.top + chartHeight - (val / maxValue) * chartHeight;
            return (
              <g key={`y-${i}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={THEME.bgSecondary}
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill={THEME.textLight}
                  opacity={0.6}
                >
                  {val}
                  {chartType === "latency" ? "ms" : ""}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const groupX =
              padding.left + i * barGroupWidth + barGroupWidth / 2;
            const barStartX = groupX - (barWidth * 3 + barGap * 2) / 2;

            const vanillaH =
              (d.vanilla / maxValue) * chartHeight;
            const graphRagH =
              (d.graphRag / maxValue) * chartHeight;
            const agenticH =
              (d.agentic / maxValue) * chartHeight;

            return (
              <g key={`bar-${i}`}>
                {/* Vanilla */}
                <rect
                  x={barStartX}
                  y={padding.top + chartHeight - vanillaH}
                  width={barWidth}
                  height={vanillaH}
                  fill={colors.vanilla}
                  rx={2}
                  opacity={0.85}
                >
                  <title>
                    Vanilla: {d.vanilla}
                    {chartType === "latency" ? "ms" : " tokens"}
                  </title>
                </rect>

                {/* GraphRAG */}
                <rect
                  x={barStartX + barWidth + barGap}
                  y={padding.top + chartHeight - graphRagH}
                  width={barWidth}
                  height={graphRagH}
                  fill={colors.graphRag}
                  rx={2}
                  opacity={0.85}
                >
                  <title>
                    GraphRAG: {d.graphRag}
                    {chartType === "latency" ? "ms" : " tokens"}
                  </title>
                </rect>

                {/* Agentic */}
                <rect
                  x={barStartX + (barWidth + barGap) * 2}
                  y={padding.top + chartHeight - agenticH}
                  width={barWidth}
                  height={agenticH}
                  fill={colors.agentic}
                  rx={2}
                  opacity={0.85}
                >
                  <title>
                    Agentic: {d.agentic}
                    {chartType === "latency" ? "ms" : " tokens"}
                  </title>
                </rect>

                {/* X-axis label */}
                <text
                  x={groupX}
                  y={height - padding.bottom + 16}
                  textAnchor="middle"
                  fontSize={8}
                  fill={THEME.textLight}
                  opacity={0.5}
                  transform={`rotate(-45, ${groupX}, ${height - padding.bottom + 16})`}
                >
                  Q{i + 1}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke={THEME.textLight}
            strokeWidth={1}
            opacity={0.3}
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke={THEME.textLight}
            strokeWidth={1}
            opacity={0.3}
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: colors.vanilla }}
          />
          <span className="text-xs text-cream-300">Vanilla</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: colors.graphRag }}
          />
          <span className="text-xs text-cream-300">GraphRAG</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: colors.agentic }}
          />
          <span className="text-xs text-cream-300">Agentic</span>
        </div>
      </div>
    </div>
  );
}