"use client";

import { useRef, useEffect, useCallback } from "react";
import { useAudioStore } from "@/stores/useAudioStore";
import { useChordStore } from "@/stores/useChordStore";
import { usePhraseStore } from "@/stores/usePhraseStore";

interface AlgoScreenProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordingDuration: number;
  sessionMode: "algorithm" | "manual" | null;
  onSwitchMode: (mode: "algorithm" | "manual") => void;
  onBackToModes: () => void;
}

export default function AlgoScreen({
  onStartRecording, onStopRecording, recordingDuration,
  sessionMode, onSwitchMode, onBackToModes,
}: AlgoScreenProps) {
  const { voiced, noteName, cents, frequency, octave, stable } = useAudioStore();
  const { suggestions, history } = useChordStore();
  const { recordingState } = usePhraseStore();

  // RAF-driven cents interpolation
  const centsDisplayRef = useRef(0);
  const centsIndicatorRef = useRef<HTMLDivElement>(null);
  const centsLabelRef = useRef<HTMLDivElement>(null);
  const freqLabelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      centsDisplayRef.current += (cents - centsDisplayRef.current) * 0.12;
      const pct = 50 + (centsDisplayRef.current / 50) * 50;
      if (centsIndicatorRef.current) {
        centsIndicatorRef.current.style.left = `${pct}%`;
        const ac = Math.abs(centsDisplayRef.current);
        centsIndicatorRef.current.style.background =
          ac < 8 ? "var(--green)" : centsDisplayRef.current > 8 ? "var(--amber)" : "var(--blue-note)";
      }
      if (centsLabelRef.current && voiced) {
        const sign = centsDisplayRef.current >= 0 ? "+" : "−";
        centsLabelRef.current.textContent = `${sign}${Math.abs(Math.round(centsDisplayRef.current))}¢`;
      }
      if (freqLabelRef.current && voiced) {
        freqLabelRef.current.textContent = `${frequency.toFixed(1)} Hz`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cents, frequency, voiced]);

  const handleRecordToggle = useCallback(() => {
    if (recordingState === "idle") onStartRecording();
    else if (recordingState === "recording") onStopRecording();
  }, [recordingState, onStartRecording, onStopRecording]);

  const statusClass = !voiced ? "listening" : !stable ? "adjusting" : "locked";
  const statusText = !voiced ? "LISTENING" : !stable ? "ADJUSTING" : "LOCKED ●";
  const statusColor = !voiced ? "var(--muted)" : !stable ? "var(--amber)" : "var(--green)";

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <>
      <div className="algo-main">
        {/* Pitch Indicator */}
        <div className="pitch-indicator">
          <div style={{ position: "relative", display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <div className={`pitch-note ${!voiced ? "silent" : ""}`}>
              {voiced ? noteName : "—"}
            </div>
            {voiced && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "var(--muted)", opacity: 0.6, alignSelf: "flex-start", marginTop: 16 }}>
                {octave}
              </div>
            )}
          </div>

          <div className="pitch-status">
            <div className={`status-dot ${statusClass}`} style={{ background: statusColor }} />
            <div className="status-label" style={{ color: statusColor }}>{statusText}</div>
          </div>

          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div className="cents-bar">
              <div className="cents-center" />
              <div className="cents-indicator" ref={centsIndicatorRef} />
            </div>
            <div ref={centsLabelRef} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--muted)", minHeight: 13 }}>
              {!voiced ? "" : ""}
            </div>
            <div ref={freqLabelRef} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--muted)", minHeight: 13 }} />
          </div>
        </div>

        {/* Chord Cards Panel */}
        <div className="chord-panel">
          <div className="chord-panel-header">CHORD SUGGESTIONS</div>
          <div style={{ flex: 1, overflow: "hidden", padding: "0 0 8px" }}>
            {suggestions.map((s, i) => (
              <div key={`${s.chord}-${i}`} className="chord-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div className="chord-card-name">{s.chord}</div>
                  <div className="chord-card-role">{s.role}</div>
                </div>
                {s.resolvesTo && (
                  <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                    → {s.resolvesTo}
                  </div>
                )}
                <div className="chord-stability">
                  <div className="chord-stability-fill" style={{ width: `${s.stability * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 20px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.3em", color: "var(--muted)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            RECENT
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            {history.slice(-5).reverse().map((h, i) => (
              <div key={`${h.chord}-${h.timestamp}`} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", marginBottom: 2, borderRadius: 6,
                opacity: [1, 0.7, 0.5, 0.3, 0.15][i] ?? 0.1,
                borderLeft: i === 0 ? "2px solid var(--violet)" : undefined,
                paddingLeft: i === 0 ? 10 : undefined,
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--white)" }}>{h.chord}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--muted)" }}>
                  {Math.round((Date.now() - h.timestamp) / 1000)}s ago
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="control-bar">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.2em", color: "var(--muted)" }}>INPUT</div>
          <canvas id="oscilloscope" width="160" height="48" style={{ display: "block" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div
            className={`record-btn ${recordingState === "recording" ? "recording" : recordingState === "analyzing" ? "analyzing" : ""}`}
            onClick={handleRecordToggle}
          >
            <div className="pulse-ring" />
            <div className="pulse-ring" />
            <div className="pulse-ring" />
            <div className="record-btn-inner" />
          </div>
          <div className={`record-label ${recordingState === "analyzing" ? "analyzing" : ""}`}
            style={{ color: recordingState === "recording" ? "var(--red)" : "var(--muted)" }}>
            {recordingState === "idle" ? "TAP TO SING" : recordingState === "recording" ? "STOP" : "ANALYZING…"}
          </div>
          <div className="record-duration">
            {recordingState === "recording" ? formatDuration(recordingDuration) : ""}
          </div>
        </div>

        <div className="mode-pills">
          <button className={`mode-pill ${sessionMode === "algorithm" ? "active" : ""}`} onClick={() => onSwitchMode("algorithm")}>
            AUTO DETECT
          </button>
          <button className={`mode-pill ${sessionMode === "manual" ? "active" : ""}`} onClick={() => onSwitchMode("manual")}>
            I HAVE CHORDS
          </button>
        </div>
      </div>
    </>
  );
}
