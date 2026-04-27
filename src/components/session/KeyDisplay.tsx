"use client";

import { useChordStore } from "@/stores/useChordStore";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { formatChordDisplay } from "@/utils/formatters";

const KEYS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export default function KeyDisplay() {
  const { detectedKey, manualKeyOverride, overrideKey } = useChordStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  let activeKeyName = "C";
  let activeMode = "major";
  let isOverride = false;
  let confidence = 0;

  if (manualKeyOverride) {
    isOverride = true;
    const parts = manualKeyOverride.split(" ");
    if (parts.length === 2) {
      activeKeyName = parts[0];
      activeMode = parts[1];
    }
  } else if (detectedKey) {
    activeKeyName = detectedKey.key;
    activeMode = detectedKey.mode;
    confidence = detectedKey.confidence;
  }

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (k: string, m: string) => {
    overrideKey(`${k} ${m}`);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-4 px-5 py-2.5 rounded-full backdrop-blur-md transition-all duration-300",
          "border bg-white/[0.02] hover:bg-white/[0.05]",
          isOverride
            ? "border-amber-500/20 text-amber-100"
            : "border-white/[0.06] text-white"
        )}
      >
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">Key</span>
        <span className="font-display font-bold text-2xl tracking-tight text-white/90">
          {formatChordDisplay(activeKeyName)}
        </span>

        {isOverride ? (
          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-[9px] font-mono text-amber-300/70 border border-amber-500/10">
            MANUAL
          </span>
        ) : (
          <div className="w-10 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-500",
                confidence > 0.6 ? "bg-emerald-500/60" : "bg-blue-500/40"
              )}
              style={{ width: `${Math.max(10, confidence * 100)}%` }}
            />
          </div>
        )}

        <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 12 12">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-3 left-0 w-72 glass-card-strong p-6 grid grid-cols-2 gap-6">
          {(["major", "minor"] as const).map((mode) => (
            <div key={mode}>
              <h3 className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20 mb-4">
                {mode}
              </h3>
              <div className="grid grid-cols-3 gap-1">
                {KEYS.map((k) => (
                  <button
                    key={`${k}-${mode}`}
                    onClick={() => handleSelect(k, mode)}
                    className={clsx(
                      "text-xs py-1.5 rounded-lg font-display font-medium transition-all duration-200",
                      "hover:bg-white/[0.08] text-white/50 hover:text-white"
                    )}
                  >
                    {formatChordDisplay(k + (mode === "minor" ? "m" : ""))}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {isOverride && (
            <button
              onClick={(e) => { e.stopPropagation(); overrideKey(null); setIsOpen(false); }}
              className="col-span-2 mt-2 py-2 text-[11px] font-mono text-amber-400/60 border border-amber-400/10 rounded-lg
                         hover:bg-amber-400/[0.05] transition-colors"
            >
              Resume Auto-Detection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
