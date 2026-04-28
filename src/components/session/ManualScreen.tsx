"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePhraseStore } from "@/stores/usePhraseStore";
import { ChordParser } from "@/audio/ChordParser";
import { KeyDetector } from "@/audio/KeyDetector";
import { Transposer } from "@/audio/Transposer";

/* ── CLAUDE.md Motion Constants ── */
const OSMO     = [0.625, 0.05, 0, 1] as const;   // text reveal
const ENTRANCE = [0.16, 1, 0.3, 1]   as const;   // scroll reveal / modal open
const EXIT_E   = [0.55, 0, 1, 0.45]  as const;   // exit — fast, don't linger
const MICRO    = [0.34, 1.56, 0.64, 1] as const;  // hover / tap overshoot

interface ManualScreenProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordingDuration: number;
  audioContext: AudioContext | null;
  onSwitchMode: (mode: "algorithm" | "manual") => void;
  onBackToModes: () => void;
}

export default function ManualScreen({
  onStartRecording, onStopRecording, recordingDuration,
  audioContext, onSwitchMode, onBackToModes,
}: ManualScreenProps) {
  const {
    manualInput, parsedChords, detectedOriginalKey,
    tempManualData, transposedChords, recordingState,
    tapTimestamps, timingMode,
    setManualInput, setParsedChords, setDetectedOriginalKey,
    setTransposedChords, addTapTimestamp, resetTapTimestamps, setTimingMode,
    setSession, setTempManualData,
  } = usePhraseStore();

  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Phase 2 → 3 auto-advance when recording completes ── */
  useEffect(() => {
    if (phase === 2 && tempManualData?.audioBuffer) setPhase(3);
  }, [phase, tempManualData]);

  /* ── Phase 3 → 4: compute transposition when user finalises timing ── */
  const proceedToTransposition = useCallback(() => {
    if (!tempManualData || !detectedOriginalKey) return;
    const offset = Transposer.computeOffset(detectedOriginalKey.key, tempManualData.singingKey.key);
    const transposed = ChordParser.transposeAll(parsedChords, offset);
    setTransposedChords(transposed);
    setTimingMode("tap");
    setPhase(4);
  }, [tempManualData, detectedOriginalKey, parsedChords, setTransposedChords, setTimingMode]);

  /* ── Chord input parser (debounced 300ms) ── */
  const handleInput = useCallback((text: string) => {
    setManualInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = ChordParser.parse(text);
      setParsedChords(parsed);
      if (parsed.length > 0) {
        const detected = KeyDetector.detectKeyFromChords(parsed);
        if (detected) setDetectedOriginalKey(detected);
      } else {
        setDetectedOriginalKey(null);
      }
    }, 300);
  }, [setManualInput, setParsedChords, setDetectedOriginalKey]);

  const handleRecordToggle = useCallback(() => {
    if (recordingState === "idle") onStartRecording();
    else if (recordingState === "recording") onStopRecording();
  }, [recordingState, onStartRecording, onStopRecording]);

  /* ── Phase 3: spacebar marker drop ── */
  useEffect(() => {
    if (phase !== 3) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (tapTimestamps.length < parsedChords.length && tempManualData) {
          const now = tapTimestamps.length === 0 ? 0 : tapTimestamps[tapTimestamps.length - 1] + 0.3;
          addTapTimestamp(Math.min(now, tempManualData.duration));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, tapTimestamps, parsedChords.length, tempManualData, addTapTimestamp]);

  /* ── Phase 4: finalise and push to Results ── */
  const handleUseChords = useCallback(() => {
    if (!tempManualData || transposedChords.length === 0) return;
    const timeline = Transposer.applyTapTimestamps(transposedChords, tapTimestamps, tempManualData.duration);
    setSession({
      id: crypto.randomUUID(),
      duration: tempManualData.duration,
      capturedAt: Date.now(),
      notes: tempManualData.notes,
      audioBuffer: tempManualData.audioBuffer,
      candidates: [{
        key: tempManualData.singingKey.key,
        mode: tempManualData.singingKey.mode,
        probability: 100,
        chordTimeline: timeline,
      }],
      selectedCandidate: 0,
      source: "manual",
    });
  }, [tempManualData, transposedChords, tapTimestamps, setSession]);

  const validChords = parsedChords.filter((c) => c.root !== "");
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  /* ════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════ */
  return (
    <div style={{
      width: "100%", height: "calc(100vh - 48px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* Living gradient background — CLAUDE.md Layer 0 */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(6,182,212,0.04) 0%, transparent 50%)",
      }} />

      <AnimatePresence mode="wait">

        {/* ═══════════════ PHASE 1 — THE FOUNDATION ═══════════════ */}
        {phase === 1 && (
          <motion.div key="p1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(12px)" }}
            transition={{ duration: 0.8, ease: ENTRANCE }}
            style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, padding: "0 32px" }}
          >
            {/* Overline */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: OSMO, delay: 0.1 }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "var(--muted)", marginBottom: 48, textTransform: "uppercase" }}
            >
              Phase 01 — The Foundation
            </motion.div>

            {/* Input */}
            <motion.textarea
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: ENTRANCE, delay: 0.2 }}
              className="manual-textarea"
              placeholder="Am   G   F   C"
              value={manualInput}
              onChange={(e) => handleInput(e.target.value)}
              style={{ textAlign: "center", fontSize: 18, minHeight: 96, marginBottom: 32, background: "transparent", borderColor: "rgba(255,255,255,0.06)" }}
            />

            {/* Parsed pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", minHeight: 40, marginBottom: 40 }}>
              <AnimatePresence>
                {parsedChords.map((c, i) => (
                  <motion.div key={`${c.display}-${i}`}
                    initial={{ opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.35, ease: MICRO, delay: i * 0.04 }}
                    className={`parsed-pill ${c.root ? "valid" : "invalid"}`}
                  >
                    {c.display || "?"}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Detected key whisper */}
            <AnimatePresence>
              {detectedOriginalKey && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.2em", marginBottom: 32 }}
                >
                  DETECTED KEY: <span style={{ color: "var(--white)" }}>{detectedOriginalKey.key} {detectedOriginalKey.mode}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Proceed CTA */}
            <AnimatePresence>
              {validChords.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.6, ease: ENTRANCE }}
                  onClick={() => setPhase(2)}
                  className="end-session-btn"
                  style={{ padding: "14px 48px", letterSpacing: "0.25em", fontSize: 10, borderColor: "rgba(124,58,237,0.3)" }}
                >
                  PROCEED TO VOCALS →
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══════════════ PHASE 2 — THE PERFORMANCE ═══════════════ */}
        {phase === 2 && (
          <motion.div key="p2"
            initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.9, ease: ENTRANCE }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, maxWidth: 480, padding: "0 32px" }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "var(--muted)", marginBottom: 64, textTransform: "uppercase" }}>
              Phase 02 — The Performance
            </div>

            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 100, fontSize: "clamp(2rem, 5vw, 3rem)", color: "var(--white)", lineHeight: 1.1, marginBottom: 16 }}>
                Sing the melody.
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--muted)", letterSpacing: "0.15em", lineHeight: 1.8 }}>
                Take your time. VoxChord will follow you.
              </div>
            </div>

            {/* Record button */}
            <motion.div
              onClick={handleRecordToggle}
              whileTap={{ scale: 0.94 }}
              style={{ position: "relative", cursor: "pointer" }}
            >
              {recordingState === "recording" && (
                <motion.div
                  animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", inset: -16, borderRadius: "50%", background: "rgba(239,68,68,0.15)", filter: "blur(16px)" }}
                />
              )}
              <div className={`record-btn ${recordingState === "recording" ? "recording" : recordingState === "analyzing" ? "analyzing" : ""}`}>
                <div className="record-btn-inner" />
              </div>
            </motion.div>

            {/* Status label */}
            <div style={{ marginTop: 16, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AnimatePresence mode="wait">
                <motion.div key={recordingState}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="record-label"
                  style={{ color: recordingState === "recording" ? "var(--red)" : "var(--muted)" }}
                >
                  {recordingState === "idle" ? "TAP TO RECORD" : recordingState === "recording" ? fmt(recordingDuration) : "ANALYZING…"}
                </motion.div>
              </AnimatePresence>
            </div>

            <button onClick={() => setPhase(1)} className="end-session-btn" style={{ marginTop: 48, padding: "8px 24px", fontSize: 9 }}>
              ← BACK TO CHORDS
            </button>
          </motion.div>
        )}

        {/* ═══════════════ PHASE 3 — SYNCHRONIZATION ═══════════════ */}
        {phase === 3 && (
          <motion.div key="p3"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.9, ease: ENTRANCE }}
            style={{ width: "100%", maxWidth: 800, display: "flex", flexDirection: "column", zIndex: 1, padding: "0 32px", height: "100%", justifyContent: "center" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                  Phase 03 — Synchronization
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 100, fontSize: "clamp(1.5rem, 4vw, 2.2rem)", color: "var(--white)" }}>
                  Drop the markers.
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--white)", letterSpacing: "0.15em" }}>
                  {tapTimestamps.length} / {parsedChords.length}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(6,182,212,0.8)", letterSpacing: "0.2em", marginTop: 4 }}>
                  PRESS SPACEBAR
                </div>
              </div>
            </div>

            {/* Chord queue */}
            <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
              {parsedChords.map((c, i) => {
                const done = i < tapTimestamps.length;
                const active = i === tapTimestamps.length;
                return (
                  <motion.div key={i}
                    animate={{ scale: active ? 1.12 : 1, opacity: done ? 0.3 : active ? 1 : 0.5 }}
                    transition={{ duration: 0.4, ease: ENTRANCE }}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: active ? "var(--cyan)" : "var(--white)" }}>
                      {c.display}
                    </span>
                    {done && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cyan)" }} />}
                    {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--white)", animation: "statusPulse 1.5s infinite" }} />}
                  </motion.div>
                );
              })}
            </div>

            {/* Waveform placeholder — rendered via WaveSurfer when available */}
            <div style={{
              width: "100%", height: 120, background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 32, position: "relative", overflow: "hidden",
            }}>
              {/* Simple amplitude bars as visual feedback */}
              <div style={{ display: "flex", gap: 3, alignItems: "center", height: "60%" }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} style={{
                    width: 2, borderRadius: 1,
                    height: `${20 + Math.sin(i * 0.4) * 60 + Math.random() * 20}%`,
                    background: i < (tapTimestamps.length / parsedChords.length) * 40
                      ? "rgba(6,182,212,0.6)" : "rgba(255,255,255,0.12)",
                    transition: "background 0.3s",
                  }} />
                ))}
              </div>
              {/* Marker lines */}
              {tapTimestamps.map((t, i) => (
                <div key={i} style={{
                  position: "absolute", top: 0, bottom: 0, width: 1,
                  background: "rgba(6,182,212,0.6)",
                  left: `${(t / (tempManualData?.duration || 1)) * 100}%`,
                }}>
                  <div style={{
                    position: "absolute", top: 8, left: 4,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                    color: "var(--cyan)", background: "rgba(5,5,8,0.8)",
                    padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap",
                  }}>
                    {parsedChords[i]?.display}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => resetTapTimestamps()} className="end-session-btn" style={{ padding: "10px 24px", fontSize: 9, borderColor: "rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.7)" }}>
                  RESET MARKERS
                </button>
                <button onClick={() => { setTempManualData(null); resetTapTimestamps(); setPhase(2); }} className="end-session-btn" style={{ padding: "10px 24px", fontSize: 9 }}>
                  RE-RECORD
                </button>
              </div>
              <button
                onClick={proceedToTransposition}
                disabled={tapTimestamps.length < parsedChords.length}
                className="btn-gradient"
                style={{
                  padding: "12px 40px", fontSize: 11, borderRadius: 2,
                  opacity: tapTimestamps.length >= parsedChords.length ? 1 : 0.3,
                  cursor: tapTimestamps.length >= parsedChords.length ? "pointer" : "not-allowed",
                }}
              >
                FINALIZE TIMING →
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ PHASE 4 — TRANSPOSITION ═══════════════ */}
        {phase === 4 && (
          <motion.div key="p4"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.9, ease: ENTRANCE }}
            style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, padding: "0 32px" }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "rgba(6,182,212,0.8)", marginBottom: 48, textTransform: "uppercase" }}>
              Phase 04 — Transposition
            </div>

            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 100, fontSize: "clamp(1.5rem, 4vw, 2.5rem)", color: "var(--white)", marginBottom: 16 }}>
                Aligned to your voice.
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--muted)", letterSpacing: "0.15em", lineHeight: 2 }}>
                {detectedOriginalKey?.key} {detectedOriginalKey?.mode} → <span style={{ color: "var(--cyan)" }}>{tempManualData?.singingKey.key} {tempManualData?.singingKey.mode}</span>
              </div>
            </div>

            {/* Transposition table */}
            <div style={{ width: "100%", marginBottom: 48 }}>
              {parsedChords.map((orig, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: OSMO, delay: i * 0.06 }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 16,
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>{orig.display}</span>
                  <span style={{ color: "rgba(255,255,255,0.15)" }}>→</span>
                  <span style={{ color: "var(--white)", fontWeight: 500 }}>{transposedChords[i]?.display}</span>
                </motion.div>
              ))}
            </div>

            <motion.button
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: ENTRANCE, delay: parsedChords.length * 0.06 + 0.2 }}
              onClick={handleUseChords}
              className="btn-gradient"
              style={{ width: "100%", padding: 18, borderRadius: 2, fontSize: 13, letterSpacing: "0.15em" }}
            >
              PROCEED TO PLAYBACK
            </motion.button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
