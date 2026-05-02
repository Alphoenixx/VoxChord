"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePhraseStore } from "@/stores/usePhraseStore";
import { ChordParser, ParsedChord } from "@/audio/ChordParser";
import { KeyDetector } from "@/audio/KeyDetector";
import { Transposer } from "@/audio/Transposer";
import { ChordEvent } from "@/audio/ChordMapper";

const OSMO = [0.625, 0.05, 0, 1] as const;
const ENTRANCE = [0.16, 1, 0.3, 1] as const;
const MICRO = [0.34, 1.56, 0.64, 1] as const;

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
    chordMarkers,
    setManualInput, setParsedChords, setDetectedOriginalKey,
    setTransposedChords,
    addChordMarker, removeLastChordMarker, resetChordMarkers, updateChordMarkerTime,
    setSession, setTempManualData,
  } = usePhraseStore();

  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 3 audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (phase === 2 && tempManualData?.audioBuffer) setPhase(3);
  }, [phase, tempManualData]);

  // Cleanup audio on unmount
  useEffect(() => () => {
    try { sourceRef.current?.stop(); } catch {}
    cancelAnimationFrame(rafRef.current);
  }, []);

  const handleInput = useCallback((text: string) => {
    setManualInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const parsed = ChordParser.parse(text);
      setParsedChords(parsed);
      if (parsed.length > 0) {
        const detected = KeyDetector.detectKeyFromChords(parsed);
        if (detected) setDetectedOriginalKey(detected);
      } else setDetectedOriginalKey(null);
    }, 300);
  }, [setManualInput, setParsedChords, setDetectedOriginalKey]);

  const handleRecordToggle = useCallback(() => {
    if (recordingState === "idle") onStartRecording();
    else if (recordingState === "recording") onStopRecording();
  }, [recordingState, onStartRecording, onStopRecording]);

  /* ── Phase 3: Play/pause recorded voice ── */
  const playVoice = useCallback(() => {
    if (!audioContext || !tempManualData?.audioBuffer) return;
    if (isPlaying) {
      try { sourceRef.current?.stop(); } catch {}
      cancelAnimationFrame(rafRef.current);
      offsetRef.current = playTime;
      setIsPlaying(false);
      return;
    }
    const src = audioContext.createBufferSource();
    src.buffer = tempManualData.audioBuffer;
    
    // Master Limiter to prevent distortion/clipping if played rapidly
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -1.0; 
    limiter.knee.value = 40;
    limiter.ratio.value = 12;
    limiter.attack.value = 0;
    limiter.release.value = 0.25;
    limiter.connect(audioContext.destination);

    src.connect(limiter);
    
    src.onended = () => {
      cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
      setPlayTime(0);
      offsetRef.current = 0;
    };
    const off = offsetRef.current;
    src.start(0, off);
    startTimeRef.current = audioContext.currentTime - off;
    sourceRef.current = src;
    setIsPlaying(true);
    const tick = () => {
      const t = audioContext.currentTime - startTimeRef.current;
      setPlayTime(Math.min(t, tempManualData.duration));
      if (t < tempManualData.duration) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [audioContext, tempManualData, isPlaying, playTime]);

  /* ── Phase 3: Click a chord to drop marker at current playback time ── */
  const dropChordMarker = useCallback((chord: ParsedChord) => {
    if (!tempManualData) return;
    const time = Math.min(playTime, tempManualData.duration);
    addChordMarker({ chord, time });
  }, [playTime, tempManualData, addChordMarker]);

  /* ── Phase 3→4: build timeline from markers and transpose ── */
  const proceedToTransposition = useCallback(() => {
    if (!tempManualData || !detectedOriginalKey || chordMarkers.length === 0) return;
    const offset = Transposer.computeOffset(detectedOriginalKey.key, tempManualData.singingKey.key);
    // Transpose the unique chords from Phase 1
    const transposed = ChordParser.transposeAll(parsedChords, offset);
    setTransposedChords(transposed);
    setPhase(4);
  }, [tempManualData, detectedOriginalKey, parsedChords, chordMarkers, setTransposedChords]);

  /* ── Phase 4: finalise — build ChordEvent[] from markers ── */
  /* +2s buffer for the last chord so it actually rings out */
  const LAST_CHORD_BUFFER = 2;
  const handleUseChords = useCallback(() => {
    if (!tempManualData || chordMarkers.length === 0 || !detectedOriginalKey) return;
    const dur = tempManualData.duration;
    const offset = Transposer.computeOffset(detectedOriginalKey.key, tempManualData.singingKey.key);
    const sorted = [...chordMarkers].sort((a, b) => a.time - b.time);
    const timeline: ChordEvent[] = sorted.map((m, i) => {
      const transposed = ChordParser.transposeChord(m.chord, offset);
      const isLast = i === sorted.length - 1;
      const endTime = isLast ? dur + LAST_CHORD_BUFFER : sorted[i + 1].time;
      return {
        time: m.time,
        endTime,
        chord: {
          root: transposed.root,
          type: transposed.type === "minor" || transposed.type === "dim" ? transposed.type : "major",
          display: transposed.display,
        },
      };
    });
    setSession({
      id: crypto.randomUUID(),
      duration: dur + LAST_CHORD_BUFFER,
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
  }, [tempManualData, chordMarkers, detectedOriginalKey, setSession]);

  const validChords = parsedChords.filter((c) => c.root !== "");
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  const fmtMs = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
  const totalDur = tempManualData?.duration || 1;

  return (
    <div style={{ width: "100%", height: "calc(100vh - 48px)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(6,182,212,0.04) 0%, transparent 50%)" }} />

      <AnimatePresence mode="wait">

        {/* ═══ PHASE 1 — THE FOUNDATION ═══ */}
        {phase === 1 && (
          <motion.div key="p1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(12px)" }} transition={{ duration: 0.8, ease: ENTRANCE }}
            style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, padding: "0 32px" }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: OSMO, delay: 0.1 }}
              className="phase-overline" style={{ marginBottom: 48 }}>
              Phase 01 — The Foundation
            </motion.div>
            <motion.textarea initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: ENTRANCE, delay: 0.2 }}
              className="phase1-textarea" placeholder="Am   G   F   C" value={manualInput} onChange={(e) => handleInput(e.target.value)}
              style={{ marginBottom: 32 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", minHeight: 40, marginBottom: 40 }}>
              <AnimatePresence>
                {parsedChords.map((c, i) => (
                  <motion.div key={`${c.display}-${i}`} initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.35, ease: MICRO, delay: i * 0.04 }} className={`chord-pill ${c.root ? "valid" : "invalid"}`}>
                    {c.display || "?"}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {detectedOriginalKey && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                  className="key-badge" style={{ marginBottom: 32 }}>
                  DETECTED KEY: <span className="key-value">{detectedOriginalKey.key} {detectedOriginalKey.mode}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {validChords.length > 0 && (
                <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.6, ease: ENTRANCE }}
                  onClick={() => setPhase(2)} className="proceed-btn">
                  PROCEED TO VOCALS →
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ PHASE 2 — THE PERFORMANCE ═══ */}
        {phase === 2 && (
          <motion.div key="p2" initial={{ opacity: 0, y: 24, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.9, ease: ENTRANCE }} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, maxWidth: 480, padding: "0 32px" }}>
            <div className="phase-overline" style={{ marginBottom: 64 }}>Phase 02 — The Performance</div>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 100, fontSize: "clamp(2rem, 5vw, 3rem)", color: "var(--white)", lineHeight: 1.1, marginBottom: 16, letterSpacing: "-0.03em" }}>Sing the melody.</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--muted)", letterSpacing: "0.15em", lineHeight: 1.8 }}>Take your time. VoxChord will follow you.</div>
            </div>
            <motion.div onClick={handleRecordToggle} whileTap={{ scale: 0.94 }} style={{ position: "relative", cursor: "pointer", marginBottom: 24 }}>
              {/* Ambient glow + orbital ring (recording only) */}
              {recordingState === "recording" && (
                <>
                  <div className="record-orb-glow" />
                  <div className="record-orb-ring" />
                </>
              )}
              <div className={`record-orb ${recordingState === "recording" ? "is-recording" : recordingState === "analyzing" ? "is-analyzing" : ""}`}>
                <div className="record-orb-inner" />
              </div>
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.div key={recordingState} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}
                className="record-timer" style={{ color: recordingState === "recording" ? "var(--red)" : "var(--muted)", marginBottom: 8 }}>
                {recordingState === "idle" ? "TAP TO RECORD" : recordingState === "recording" ? fmt(recordingDuration) : "ANALYZING…"}
              </motion.div>
            </AnimatePresence>
            <button onClick={() => setPhase(1)} className="end-session-btn" style={{ marginTop: 40, padding: "8px 24px", fontSize: 9 }}>← BACK TO CHORDS</button>
          </motion.div>
        )}

        {/* ═══ PHASE 3 — SYNCHRONIZATION ═══ */}
        {phase === 3 && (
          <motion.div key="p3" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.9, ease: ENTRANCE }}
            style={{ width: "100%", maxWidth: 960, display: "flex", flexDirection: "row", zIndex: 1, height: "100%", alignItems: "stretch", position: "relative" }}>

            {/* Living atmosphere */}
            <div className="sync-atmosphere" />

            {/* Left: Chord palette */}
            <div className="chord-palette">
              <div className="phase-overline" style={{ marginBottom: 16 }}>Tap a chord</div>
              {parsedChords.filter(c => c.root).map((c, i) => (
                <motion.button key={`${c.display}-${i}`} whileTap={{ scale: 0.93 }}
                  onClick={() => dropChordMarker(c)}
                  disabled={!isPlaying}
                  className={`chord-palette-btn ${chordMarkers.length > 0 && chordMarkers[chordMarkers.length - 1].chord.display === c.display ? 'active-chord' : ''}`}>
                  {c.display}
                </motion.button>
              ))}
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "var(--muted)", marginTop: "auto", lineHeight: 1.8, letterSpacing: "0.08em", paddingTop: 16 }}>
                Play your voice, then click each chord when you hear it. Same chord can be clicked multiple times.
              </div>
            </div>

            {/* Right: playback + timeline */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 40px" }}>
              <div className="phase-overline" style={{ marginBottom: 32 }}>Phase 03 — Synchronization</div>

              {/* Play/pause + time */}
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
                <motion.button whileTap={{ scale: 0.92 }} onClick={playVoice}
                  className={`sync-play-btn ${isPlaying ? "is-playing" : ""}`}>
                  {isPlaying ? "⏸" : "▶"}
                </motion.button>
                <div>
                  <div className="sync-time-display">{fmtMs(playTime)}</div>
                  <div className="sync-time-total">/ {fmt(Math.ceil(totalDur))}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--cyan)", fontVariantNumeric: "tabular-nums" }}>
                    {chordMarkers.length}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--muted)", marginLeft: 6, letterSpacing: "0.15em" }}>
                    MARKER{chordMarkers.length !== 1 ? "S" : ""}
                  </span>
                </div>
              </div>

              {/* Timeline track */}
              <div className="sync-timeline-track" style={{ marginBottom: 32 }}>
                {/* Progress fill */}
                <div className="sync-progress-fill" style={{ width: `${(playTime / totalDur) * 100}%` }} />
                {/* Playhead */}
                <div className="sync-playhead" style={{ left: `${(playTime / totalDur) * 100}%` }} />
                {/* Markers */}
                {chordMarkers.map((m, i) => (
                  <div key={i} className="sync-marker" style={{ left: `${(m.time / totalDur) * 100}%` }}>
                    <div className="sync-marker-line" />
                    <div className="sync-marker-label">{m.chord.display}</div>
                  </div>
                ))}
              </div>

              {/* Marker chips */}
              {chordMarkers.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
                  {chordMarkers.map((m, i) => (
                    <div key={i} className="marker-chip">
                      {m.chord.display}
                      <span className="marker-chip-time">@ {fmtMs(m.time)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => removeLastChordMarker()} className="end-session-btn" disabled={chordMarkers.length === 0}
                    style={{ padding: "10px 20px", fontSize: 9, opacity: chordMarkers.length > 0 ? 1 : 0.3 }}>UNDO LAST</button>
                  <button onClick={() => resetChordMarkers()} className="end-session-btn"
                    style={{ padding: "10px 20px", fontSize: 9, borderColor: "rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.7)" }}>RESET ALL</button>
                  <button onClick={() => {
                    try { sourceRef.current?.stop(); } catch {}
                    cancelAnimationFrame(rafRef.current);
                    setIsPlaying(false); setPlayTime(0); offsetRef.current = 0;
                    setTempManualData(null); resetChordMarkers(); setPhase(2);
                  }} className="end-session-btn" style={{ padding: "10px 20px", fontSize: 9 }}>RE-RECORD</button>
                </div>
                <button onClick={proceedToTransposition} disabled={chordMarkers.length === 0} className="btn-gradient"
                  style={{ padding: "12px 40px", fontSize: 11, borderRadius: 2, opacity: chordMarkers.length > 0 ? 1 : 0.3, cursor: chordMarkers.length > 0 ? "pointer" : "not-allowed" }}>
                  FINALIZE →
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ PHASE 4 — FINE-TUNE + TRANSPOSITION ═══ */}
        {phase === 4 && (
          <motion.div key="p4" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.9, ease: ENTRANCE }}
            style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", zIndex: 1, padding: "32px 40px", height: "100%", justifyContent: "center", position: "relative" }}>

            {/* Living atmosphere */}
            <div className="sync-atmosphere" />

            <div className="phase-overline accent" style={{ marginBottom: 24 }}>Phase 04 — Fine-tune &amp; Transpose</div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 100, fontSize: "clamp(1.3rem, 3vw, 2rem)", color: "var(--white)", marginBottom: 8, letterSpacing: "-0.02em" }}>Drag markers to fine-tune.</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.15em" }}>
                {detectedOriginalKey?.key} {detectedOriginalKey?.mode} → <span style={{ color: "var(--cyan)" }}>{tempManualData?.singingKey.key} {tempManualData?.singingKey.mode}</span>
              </div>
            </div>

            {/* Play voice */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
              <motion.button whileTap={{ scale: 0.92 }} onClick={playVoice}
                className={`sync-play-btn ${isPlaying ? "is-playing" : ""}`}
                style={{ width: 48, height: 48, fontSize: 16 }}>
                {isPlaying ? "⏸" : "▶"}
              </motion.button>
              <div className="sync-time-display" style={{ fontSize: 18 }}>{fmtMs(playTime)}</div>
              <div className="sync-time-total">/ {fmt(Math.ceil(totalDur))}</div>
            </div>

            {/* Draggable timeline */}
            <div className="sync-timeline-track"
              style={{ marginBottom: 40 }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const t = pct * totalDur;
                setPlayTime(t);
                offsetRef.current = t;
                if (isPlaying) {
                  try { sourceRef.current?.stop(); } catch {}
                  cancelAnimationFrame(rafRef.current);
                  setIsPlaying(false);
                  setTimeout(() => playVoice(), 50);
                }
              }}
            >
              <div className="sync-progress-fill" style={{ width: `${(playTime / totalDur) * 100}%` }} />
              <div className="sync-playhead" style={{ left: `${(playTime / totalDur) * 100}%` }} />

              {/* Draggable markers */}
              {chordMarkers.map((m, i) => {
                const offset = detectedOriginalKey && tempManualData ? Transposer.computeOffset(detectedOriginalKey.key, tempManualData.singingKey.key) : 0;
                const transposed = ChordParser.transposeChord(m.chord, offset);
                return (
                  <div key={i}
                    className="sync-marker draggable"
                    style={{ left: `${(m.time / totalDur) * 100}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const bar = e.currentTarget.parentElement!;
                      const rect = bar.getBoundingClientRect();
                      const onMove = (ev: MouseEvent) => {
                        const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                        updateChordMarkerTime(i, pct * totalDur);
                      };
                      const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                  >
                    <div className="sync-marker-line" />
                    <div className="sync-marker-handle" />
                    <div className="sync-marker-drag-label">{transposed.display} {fmtMs(m.time)}</div>
                  </div>
                );
              })}
            </div>

            {/* Transposed chord chips */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
              {chordMarkers.map((m, i) => {
                const offset = detectedOriginalKey && tempManualData ? Transposer.computeOffset(detectedOriginalKey.key, tempManualData.singingKey.key) : 0;
                const transposed = ChordParser.transposeChord(m.chord, offset);
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: OSMO, delay: i * 0.03 }}
                    className="marker-chip">
                    <span style={{ color: "var(--muted)" }}>{m.chord.display}</span>
                    <span style={{ color: "rgba(255,255,255,0.12)" }}>→</span>
                    <span style={{ color: "var(--white)" }}>{transposed.display}</span>
                    <span className="marker-chip-time">@ {fmtMs(m.time)}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setPhase(3)} className="end-session-btn" style={{ padding: "10px 24px", fontSize: 9 }}>← BACK TO MARKERS</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleUseChords} className="btn-gradient"
                style={{ padding: "14px 48px", fontSize: 12, borderRadius: 2, letterSpacing: "0.15em" }}>
                PROCEED TO PLAYBACK
              </motion.button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
