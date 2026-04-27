"use client";

import { useState, useRef, useEffect } from "react";
import { useAudioStore } from "@/stores/useAudioStore";
import { useChordStore } from "@/stores/useChordStore";

const KEY_ROOTS = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

interface TopBarProps {
  visible: boolean;
  onEndSession: () => void;
}

export default function TopBar({ visible, onEndSession }: TopBarProps) {
  const { latency, isActive } = useAudioStore();
  const { detectedKey, manualKeyOverride, overrideKey } = useChordStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [keyMode, setKeyMode] = useState<"major" | "minor">("minor");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayKey = manualKeyOverride ?? (detectedKey ? `${detectedKey.key} ${detectedKey.mode}` : "—");
  const confidence = detectedKey?.confidence ?? 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const selectKey = (root: string) => {
    overrideKey(`${root} ${keyMode}`);
    setDropdownOpen(false);
  };

  return (
    <div className={`session-topbar ${visible ? "visible" : ""}`}>
      <div className="topbar-wordmark">VOXCHORD</div>

      <div className="flex flex-col items-center relative" ref={dropdownRef}>
        <div className="key-display-pill" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(124,58,237,0.9)" }}>
            {displayKey}
          </span>
          <span style={{ fontSize: 10, color: "rgba(124,58,237,0.6)" }}>▾</span>
        </div>
        <div className="key-confidence-bar">
          <div className="key-confidence-fill" style={{ width: `${confidence * 100}%` }} />
        </div>

        <div className={`key-dropdown ${dropdownOpen ? "open" : ""}`}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["major", "minor"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setKeyMode(m)}
                style={{
                  flex: 1, padding: 6, borderRadius: 6,
                  border: `1px solid ${keyMode === m ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}`,
                  background: keyMode === m ? "rgba(124,58,237,0.2)" : "transparent",
                  color: keyMode === m ? "var(--white)" : "var(--muted)",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.15em",
                  cursor: "pointer",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="key-grid">
            {KEY_ROOTS.map((root) => (
              <button key={root} className="key-option" onClick={() => selectKey(root)}>
                {root}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div className={`latency-monitor ${isActive ? "visible" : ""}`}>
          <div className="latency-dot" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--green)" }}>
            {latency.total > 0 ? `${Math.round(latency.total)}ms` : "—"}
          </span>
        </div>
        <button className="end-session-btn" onClick={onEndSession}>END SESSION</button>
      </div>
    </div>
  );
}
