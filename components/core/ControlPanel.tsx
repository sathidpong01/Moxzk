"use client";

import { useAppStore } from "@/stores/useAppStore";
import { Settings, Eye, EyeOff, LayoutGrid, Download } from "lucide-react";

export function ControlPanel() {
  const { viewMode, setViewMode, scale, setScale, result, isProcessing } =
    useAppStore();

  if (!result && !isProcessing) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 p-4 shadow-lg flex justify-between items-center z-50">
      {/* Left: Status */}
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-5 h-5 text-secondary" />
        <span className="font-bold hidden sm:inline">
          {result?.bubbles
            ? `${result.bubbles.length} Bubbles Detected`
            : "Ready"}
        </span>
      </div>

      {/* Center: View Controls */}
      <div className="join">
        <button
          className={`btn join-item ${viewMode === "original" ? "btn-active" : ""}`}
          onClick={() => setViewMode("original")}
        >
          <EyeOff className="w-4 h-4" />
          Original
        </button>
        <button
          className={`btn join-item ${viewMode === "translated" ? "btn-active btn-primary" : ""}`}
          onClick={() => setViewMode("translated")}
          disabled={!result}
        >
          <Eye className="w-4 h-4" />
          Translated
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Scale Slider (Optional, Konva handles zoom usually, but good for UI control) */}
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="range range-xs w-24 hidden md:block"
        />

        <button className="btn btn-circle btn-ghost">
          <Settings className="w-5 h-5" />
        </button>
        <button
          className="btn btn-circle btn-ghost"
          disabled={!result}
          onClick={() => useAppStore.getState().triggerDownload()}
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
