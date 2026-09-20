/**
 * SearchBar — Dual-mode search bar.
 * Enter = Web search, Shift+Enter = GraphRAG query.
 */

import React, { useState, useRef, type KeyboardEvent } from "react";
import { Search, GitBranch, Globe } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string, mode: "web" | "graphrag") => void;
  placeholder?: string;
  loading?: boolean;
}

export default function SearchBar({
  onSearch,
  placeholder = "Search your knowledge graph...",
  loading = false,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"web" | "graphrag">("web");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      if (e.shiftKey) {
        onSearch(value.trim(), "graphrag");
      } else {
        onSearch(value.trim(), "web");
      }
    }
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSearch(value.trim(), mode);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        {/* Mode indicator */}
        <button
          onClick={() => setMode(mode === "web" ? "graphrag" : "web")}
          className={`absolute left-3 z-10 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            mode === "graphrag"
              ? "bg-ice-blue-200/20 text-ice-blue-200"
              : "bg-butter-yellow-300/20 text-butter-yellow-300"
          }`}
          title={`Mode: ${mode === "graphrag" ? "GraphRAG" : "Web"}. Click to toggle.`}
        >
          {mode === "graphrag" ? (
            <GitBranch className="w-3 h-3" />
          ) : (
            <Globe className="w-3 h-3" />
          )}
          {mode === "graphrag" ? "Graph" : "Web"}
        </button>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          className="w-full bg-chocolate-200 border border-chocolate-400 rounded-xl pl-24 pr-12 py-3.5 text-cream placeholder-chocolate-500 focus:outline-none focus:ring-2 focus:ring-butter-yellow-300 focus:border-transparent transition-all duration-150 text-sm"
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          className="absolute right-3 p-1.5 rounded-lg bg-butter-yellow-300/20 text-butter-yellow-300 hover:bg-butter-yellow-300/30 transition-colors disabled:opacity-30"
        >
          <Search className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
        </button>
      </div>

      {/* Hint text */}
      <div className="flex justify-center gap-4 mt-2 text-[10px] text-chocolate-500">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-chocolate-50 text-cream-300 font-mono">
            Enter
          </kbd>{" "}
          Web Search
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-chocolate-50 text-cream-300 font-mono">
            Shift+Enter
          </kbd>{" "}
          GraphRAG
        </span>
      </div>
    </div>
  );
}