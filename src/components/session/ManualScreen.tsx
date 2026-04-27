"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePhraseStore } from "@/stores/usePhraseStore";
import { useChordStore } from "@/stores/useChordStore";
import { ChordParser, ParsedChord } from "@/audio/ChordParser";
import { KeyDetector } from "@/audio/KeyDetector";
import { Transposer } from "@/audio/Transposer";

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
    manualInput, parsedChords, detectedOriginalKey, transposedChords,
    tempManualData, recordingState, timingMode, tapTimestamps,
    setManualInput, setParsedChords, setDetectedOriginalKey,
    setTransposedChords, setTimingMode, addTapTimestamp, resetTapTimestamps,
    setSession,
  } = usePhraseStore();
  const { detectedKey } = useChordStore();

  const [step, setStep] = useState<1 | 2>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse chords on input change
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

  // Compute transposition when tempManualData arrives
  useEffect(() => {
    if (tempManualData && parsedChords.length > 0) {
      const origKey = detectedOriginalKey;
      const singKey = tempManualData.singingKey;
      if (origKey && singKey) {
        const offset = Transposer.computeOffset(origKey.key, singKey.key);
        const transposed = ChordParser.transposeAll(parsedChords, offset);
        setTransposedChords(transposed);
      }
    }
  }, [tempManualData, parsedChords, detectedOriginalKey, setTransposedChords]);

  const handleRecordToggle = useCallback(() => {
    if (recordingState === "idle") onStartRecording();
    else if (recordingState === "recording") onStopRecording();
  }, [recordingState, onStartRecording, onStopRecording]);

  const handleUseChords = useCallback(() => {
    if (!tempManualData || transposedChords.length === 0) return;
    const duration = tempManualData.duration;

    let timeline = [];
    if (timingMode === "tap" && tapTimestamps.length > 0) {
      timeline = Transposer.applyTapTimestamps(transposedChords, tapTimestamps, duration);
    } else {
      timeline = Transposer.autoDistribute(transposedChords, duration);
    }

    setSession({
      id: crypto.randomUUID(),
      duration,
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
  }, [tempManualData, transposedChords, timingMode, tapTimestamps, setSession]);

  const validChords = parsedChords.filter((c) => c.root !== "");
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", width: "100%", height: "calc(100vh - 48px)" }}>
      {/* Left Panel */}
      <div style={{ width: "55%", padding: 40, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.05)", overflowY: "auto" }}>
        {step === 1 ? (
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "var(--muted)", marginBottom: 20 }}>
              ENTER YOUR CHORDS
            </div>
            <textarea
              className="manual-textarea"
              placeholder="Am G F C"
              value={manualInput}
              onChange={(e) => handleInput(e.target.value)}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0", minHeight: 32 }}>
              {parsedChords.map((c, i) => (
                <div
                  key={`${c.display}-${i}`}
                  className={`parsed-pill ${c.root ? "valid" : "invalid"}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {c.display || c.root || "?"}
                </div>
              ))}
            </div>
            {detectedOriginalKey && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--muted)" }}>
                <span>Detected key:</span>
                <span style={{ color: "var(--white)" }}>{detectedOriginalKey.key} {detectedOriginalKey.mode}</span>
              </div>
            )}
            {validChords.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <button className="btn-gradient" onClick={() => setStep(2)} style={{ padding: "16px 40px", fontSize: 13 }}>
                  NOW SING THE MELODY
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "var(--muted)", marginBottom: 16 }}>
              NOW SING YOUR MELODY
            </div>
            <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 300, fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 32, maxWidth: 320 }}>
              Sing the melody of your song.<br />VoxChord will match your voice<br />to the chord progression.
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div
                className={`record-btn ${recordingState === "recording" ? "recording" : recordingState === "analyzing" ? "analyzing" : ""}`}
                onClick={handleRecordToggle}
              >
                <div className="record-btn-inner" />
              </div>
              <div className="record-label" style={{ color: recordingState === "recording" ? "var(--red)" : "var(--muted)" }}>
                {recordingState === "idle" ? "TAP TO SING" : recordingState === "recording" ? "STOP" : "ANALYZING…"}
              </div>
              {recordingState === "recording" && <div className="record-duration">{formatDuration(recordingDuration)}</div>}
            </div>
            <button onClick={() => setStep(1)} style={{
              marginTop: 32, background: "none", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 2, padding: "8px 20px", cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.2em", color: "var(--muted)",
            }}>
              RE-SING PHRASE
            </button>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div style={{ width: "45%", padding: 40, display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "var(--muted)", marginBottom: 20 }}>
          TRANSPOSED TO YOUR KEY
        </div>

        {transposedChords.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            {[80, 60, 70].map((w, i) => (
              <div key={i} style={{ width: `${w}%`, height: 2, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", borderRadius: 1 }} />
            ))}
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.15em", marginTop: 8 }}>
              Chord analysis will appear here
            </div>
          </div>
        ) : (
          <div>
            {transposedChords.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
                <span style={{ color: "var(--muted)", textDecoration: parsedChords[i]?.display !== c.display ? "line-through" : "none" }}>
                  {parsedChords[i]?.display || ""}
                </span>
                {parsedChords[i]?.display !== c.display && (
                  <>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>
                    <span style={{ background: "linear-gradient(135deg, var(--violet), var(--cyan))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 400 }}>
                      {c.display}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {transposedChords.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 8, margin: "20px 0" }}>
              <button className={`mode-pill ${timingMode === "auto" ? "active" : ""}`} onClick={() => setTimingMode("auto")}>AUTO SPACE</button>
              <button className={`mode-pill ${timingMode === "tap" ? "active" : ""}`} onClick={() => setTimingMode("tap")}>TAP TO TIME</button>
            </div>
            {timingMode === "tap" && (
              <div>
                <button onClick={() => addTapTimestamp(Date.now() / 1000)} style={{
                  width: "100%", padding: 20, background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.3)", borderRadius: 8, cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: "0.2em", color: "rgba(124,58,237,0.8)",
                }}>
                  TAP HERE
                </button>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
                  {tapTimestamps.length} tap{tapTimestamps.length !== 1 ? "s" : ""} recorded
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <button
            className="btn-gradient"
            disabled={!tempManualData || transposedChords.length === 0}
            onClick={handleUseChords}
            style={{ width: "100%", padding: 16, borderRadius: 8, opacity: (!tempManualData || transposedChords.length === 0) ? 0.4 : 1 }}
          >
            USE THESE CHORDS
          </button>
        </div>
      </div>
    </div>
  );
}
