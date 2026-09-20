/**
 * ComparisonCard — Displays a single RAG pipeline result in the comparison view.
 * Styled with the Chocolate/Butter-Yellow/Ice-Blue theme.
 */

import React, { useState } from "react";
import {
  Clock,
  Coins,
  ChevronDown,
  ChevronUp,
  BookOpen,
  GitBranch,
  Cpu,
} from "lucide-react";
import type { RAGResponse } from "../lib/api";

interface ComparisonCardProps {
  result: RAGResponse;
  pipelineLabel: string;
  accentColor: "butter" | "ice" | "cream";
}

const ACCENT_CLASSES = {
  butter: {
    border: "border-butter-yellow-300",
    badge: "bg-butter-yellow-300 text-butter-yellow-dark",
    icon: "text-butter-yellow-300",
    header: "bg-butter-yellow-300/10",
  },
  ice: {
    border: "border-ice-blue-200",
    badge: "bg-ice-blue-200 text-chocolate",
    icon: "text-ice-blue-200",
    header: "bg-ice-blue-200/10",
  },
  cream: {
    border: "border-cream-300",
    badge: "bg-cream-300 text-chocolate",
    icon: "text-cream-200",
    header: "bg-cream-200/10",
  },
};

const PIPELINE_ICONS = {
  vanilla: BookOpen,
  graph_rag: GitBranch,
  agentic: Cpu,
};

export default function ComparisonCard({
  result,
  pipelineLabel,
  accentColor,
}: ComparisonCardProps) {
  const [showSources, setShowSources] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const classes = ACCENT_CLASSES[accentColor];
  const IconComponent =
    PIPELINE_ICONS[result.pipeline_type as keyof typeof PIPELINE_ICONS] ||
    BookOpen;

  return (
    <div
      className={`flex flex-col rounded-xl border ${classes.border} bg-chocolate-100 overflow-hidden animate-fade-in`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3 ${classes.header}`}>
        <IconComponent className={`w-4 h-4 ${classes.icon}`} />
        <span className="text-sm font-semibold text-cream">{pipelineLabel}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${classes.badge}`}>
          {result.pipeline_type}
        </span>
      </div>

      {/* Answer */}
      <div className="px-4 py-3 flex-1">
        <p className="text-sm text-cream-200 leading-relaxed whitespace-pre-wrap">
          {result.answer}
        </p>
      </div>

      {/* Metrics Bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-chocolate-400 text-xs text-cream-300">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {result.processing_time_ms.toFixed(0)}ms
        </span>
        <span className="flex items-center gap-1">
          <Coins className="w-3 h-3" />
          {result.token_count} tokens
        </span>
        <span className="ml-auto text-chocolate-500 font-mono text-[10px]">
          {result.model_used}
        </span>
      </div>

      {/* Entities */}
      {result.entities_used.length > 0 && (
        <div className="px-4 py-2 border-t border-chocolate-400">
          <div className="flex flex-wrap gap-1">
            {result.entities_used.map((entity, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-ice-blue-200/20 text-ice-blue-200"
              >
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sources Toggle */}
      {result.sources.length > 0 && (
        <div className="border-t border-chocolate-400">
          <button
            onClick={() => setShowSources(!showSources)}
            className="flex items-center gap-1 w-full px-4 py-2 text-xs text-cream-300 hover:bg-chocolate-50 transition-colors"
          >
            {showSources ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {result.sources.length} source{result.sources.length !== 1 ? "s" : ""}
          </button>
          {showSources && (
            <div className="px-4 pb-3 space-y-1 animate-slide-up">
              {result.sources.map((source, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[10px] text-cream-300"
                >
                  <span className="px-1 py-0.5 rounded bg-chocolate-50 text-cream-300">
                    {source.type}
                  </span>
                  <span className="truncate">{source.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reasoning Steps Toggle */}
      {result.reasoning_steps.length > 0 && (
        <div className="border-t border-chocolate-400">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="flex items-center gap-1 w-full px-4 py-2 text-xs text-cream-300 hover:bg-chocolate-50 transition-colors"
          >
            {showSteps ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {result.reasoning_steps.length} reasoning step
            {result.reasoning_steps.length !== 1 ? "s" : ""}
          </button>
          {showSteps && (
            <div className="px-4 pb-3 space-y-1 animate-slide-up">
              {result.reasoning_steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[10px] text-cream-300"
                >
                  <span className="text-butter-yellow-300 font-mono mt-0.5">
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}