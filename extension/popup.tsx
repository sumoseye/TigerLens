/**
 * Popup — Quick access menu for the extension.
 * Provides links to the side panel, knowledge canvas, and benchmark.
 */

import React from "react";
import { Brain, Network, BarChart3, Camera, ExternalLink } from "lucide-react";
import "./styles/globals.css";

function Popup() {
  const openNewTab = (path: string) => {
    chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  };

  const openSidePanel = () => {
    chrome.sidePanel?.open?.({ windowId: undefined as any }).catch(() => {
      // Fallback: some Chrome versions don't support programmatic open
      console.log("Side panel must be opened via the toolbar icon");
    });
  };

  const captureScreenshot = () => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT", sourceUrl: "" },
      (response) => {
        if (response?.success) {
          window.close();
        }
      }
    );
  };

  return (
    <div className="w-72 bg-chocolate p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-chocolate-400">
        <Brain className="w-5 h-5 text-butter-yellow" />
        <div>
          <h1 className="text-sm font-bold text-cream">BrowseGraph</h1>
          <p className="text-[10px] text-chocolate-500">TigerLens Extension</p>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={captureScreenshot}
        className="w-full btn-butter flex items-center gap-2 justify-center"
      >
        <Camera className="w-4 h-4" />
        Snap & Link Current Page
      </button>

      <div className="space-y-1">
        <MenuButton
          icon={Network}
          label="Knowledge Canvas"
          description="Interactive graph explorer"
          onClick={() => openNewTab("newtab.html")}
        />
        <MenuButton
          icon={BarChart3}
          label="Run Benchmark"
          description="Evaluate RAG pipelines"
          onClick={() => openNewTab("pages/benchmark.html")}
        />
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-chocolate-400 text-[10px] text-chocolate-500 text-center">
        v1.0.0 • GraphRAG + TigerGraph + Groq + Gemini
      </div>
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-chocolate-50 transition-colors text-left group"
    >
      <Icon className="w-4 h-4 text-ice-blue flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-cream">{label}</p>
        <p className="text-[10px] text-chocolate-500">{description}</p>
      </div>
      <ExternalLink className="w-3 h-3 text-chocolate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export default Popup;