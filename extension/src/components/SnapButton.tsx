/**
 * SnapButton — Floating action button for capturing screenshots.
 */

import React, { useState } from "react";
import { Camera, Loader2, Check, X } from "lucide-react";

interface SnapButtonProps {
  onSnap: () => Promise<void>;
}

type SnapState = "idle" | "capturing" | "success" | "error";

export default function SnapButton({ onSnap }: SnapButtonProps) {
  const [state, setState] = useState<SnapState>("idle");

  const handleClick = async () => {
    if (state === "capturing") return;
    setState("capturing");
    try {
      await onSnap();
      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  const stateConfig = {
    idle: {
      icon: Camera,
      label: "Snap & Link",
      className: "btn-butter shadow-lg hover:shadow-xl hover:scale-105",
    },
    capturing: {
      icon: Loader2,
      label: "Capturing...",
      className:
        "bg-butter-yellow-300 text-butter-yellow-dark px-4 py-2 rounded-lg opacity-80 cursor-wait",
    },
    success: {
      icon: Check,
      label: "Linked!",
      className:
        "bg-ice-blue-200 text-chocolate px-4 py-2 rounded-lg",
    },
    error: {
      icon: X,
      label: "Failed",
      className:
        "bg-red-500/80 text-white px-4 py-2 rounded-lg",
    },
  };

  const config = stateConfig[state];
  const IconEl = config.icon;

  return (
    <button
      onClick={handleClick}
      disabled={state === "capturing"}
      className={`fixed bottom-6 right-6 flex items-center gap-2 z-50 transition-all duration-200 ${config.className}`}
    >
      <IconEl
        className={`w-4 h-4 ${state === "capturing" ? "animate-spin" : ""}`}
      />
      <span className="text-sm font-semibold">{config.label}</span>
    </button>
  );
}