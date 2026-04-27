"use client";

/**
 * Session Page — Updated UI Integration
 *
 * Screen-based state machine:
 *   micoff → mode → algo | manual → results
 * All backend engines wired through Zustand stores.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useAudioStore } from "@/stores/useAudioStore";
import { useChordStore } from "@/stores/useChordStore";
import { usePhraseStore } from "@/stores/usePhraseStore";
import { AudioEngine } from "@/audio/AudioEngine";
import { ChordEngine } from "@/audio/ChordEngine";
import { KeyDetector } from "@/audio/KeyDetector";
import { NoteBuffer } from "@/audio/NoteBuffer";
import { AudioRecorder } from "@/audio/AudioRecorder";
import { ChordMapper } from "@/audio/ChordMapper";
import { Transposer } from "@/audio/Transposer";

import SessionScene from "@/components/session/SessionScene";
import TopBar from "@/components/session/TopBar";
import MicOffScreen from "@/components/session/MicOffScreen";
import ModeSelectScreen from "@/components/session/ModeSelectScreen";
import AlgoScreen from "@/components/session/AlgoScreen";
import ManualScreen from "@/components/session/ManualScreen";
import ResultsScreen from "@/components/session/ResultsScreen";

import "./session.css";

type ScreenId = "micoff" | "mode" | "algo" | "manual" | "results";

export default function SessionPage() {
  const { isActive, setIsActive, handleAudioEvent, setLatency } = useAudioStore();
  const { setDetectedKey, setSuggestions } = useChordStore();
  const {
    currentSession, recordingState, setRecordingState, setSession,
    clearSession, clearRecordingData, tempManualData,
  } = usePhraseStore();

  const [screen, setScreen] = useState<ScreenId>("micoff");
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [sessionMode, setSessionModeLocal] = useState<"algorithm" | "manual" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const chordEngineRef = useRef<ChordEngine | null>(null);
  const keyDetectorRef = useRef<KeyDetector | null>(null);
  const noteBufferRef = useRef<NoteBuffer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const transposerRef = useRef<Transposer | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize engines on mount
  useEffect(() => {
    chordEngineRef.current = new ChordEngine();
    keyDetectorRef.current = new KeyDetector();
    noteBufferRef.current = new NoteBuffer();
    transposerRef.current = new Transposer();

    const keyInterval = setInterval(() => {
      if (keyDetectorRef.current && isActive) {
        const newKey = keyDetectorRef.current.detectKey();
        if (newKey) setDetectedKey(newKey);
      }
    }, 2000);

    return () => clearInterval(keyInterval);
  }, [isActive, setDetectedKey]);

  // Auto-transition to results when session is ready
  useEffect(() => {
    if (currentSession && screen !== "results") {
      setScreen("results");
    }
  }, [currentSession, screen]);

  // ── Start Session (Mic Init) ──
  const handleStart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!audioEngineRef.current) audioEngineRef.current = new AudioEngine();

      const latencyInfo = await audioEngineRef.current.init((event) => {
        handleAudioEvent(event);
        if (event.type === "SilenceEvent") return;

        const pitchClass = ((event.midi % 12) + 12) % 12;

        if (event.midi > 0) transposerRef.current?.trackNote(event.midi);

        if (noteBufferRef.current?.isRecording()) {
          noteBufferRef.current.push(
            { pitch: event.frequency, midi: event.midi, pitchClass, cents: event.cents },
            event.timestamp
          );
        }

        keyDetectorRef.current?.addObservation(pitchClass);

        const state = useChordStore.getState();
        let keyName = "C";
        let mode: "major" | "minor" = "major";
        if (state.manualKeyOverride) {
          const parts = state.manualKeyOverride.split(" ");
          keyName = parts[0]; mode = parts[1] as "major" | "minor";
        } else if (state.detectedKey) {
          keyName = state.detectedKey.key; mode = state.detectedKey.mode;
        }

        if (chordEngineRef.current) {
          const suggestions = chordEngineRef.current.suggest(keyName, mode, pitchClass);
          setSuggestions(suggestions);
          if (suggestions.length > 0) useChordStore.getState().addToHistory(suggestions[0].chord);
        }
      });

      setLatency(latencyInfo);
      setIsActive(true);
      setScreen("mode");
    } catch (err) {
      console.error(err);
      setError("Microphone access denied. Please grant permission and try again.");
    }
    setLoading(false);
  }, [handleAudioEvent, setLatency, setIsActive, setSuggestions, setDetectedKey]);

  const handleStop = useCallback(async () => {
    if (audioEngineRef.current) await audioEngineRef.current.stop();
    setIsActive(false);
    clearSession();
    setSessionModeLocal(null);
    setScreen("micoff");
    setError(null);
  }, [setIsActive, clearSession]);

  // ── Mode Selection ──
  const handleSetSessionMode = useCallback((mode: "algorithm" | "manual") => {
    setSessionModeLocal(mode);
    setScreen(mode === "algorithm" ? "algo" : "manual");
  }, []);

  const handleBackToModes = useCallback(() => {
    setSessionModeLocal(null);
    clearRecordingData();
    setScreen("mode");
  }, [clearRecordingData]);

  // ── Phrase Recording ──
  const handleStartRecording = useCallback(() => {
    const ctx = audioEngineRef.current?.getContext();
    const stream = audioEngineRef.current?.getStream();
    if (!ctx || !stream) return;

    clearRecordingData();
    audioRecorderRef.current = new AudioRecorder(ctx);
    audioRecorderRef.current.startRecording(stream);
    noteBufferRef.current?.startCapture(ctx.currentTime);

    setRecordingState("recording");
    setRecordingDuration(0);

    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((d) => d + 1);
    }, 1000);
  }, [clearRecordingData, setRecordingState]);

  const handleStopRecording = useCallback(async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const ctx = audioEngineRef.current?.getContext();
    if (!ctx) return;

    setRecordingState("analyzing");
    setError(null);

    try {
      const notes = noteBufferRef.current?.stopCapture(ctx.currentTime) ?? [];
      const validation = NoteBuffer.validate(notes);
      if (!validation.valid) {
        setError(validation.reason ?? "Invalid phrase");
        setRecordingState("idle");
        return;
      }

      let audioBuffer: AudioBuffer | null = null;
      try {
        audioBuffer = await audioRecorderRef.current?.stopRecording() ?? null;
      } catch { console.warn("Audio decode failed, continuing without playback"); }

      const duration = notes.length > 0 ? notes[notes.length - 1].relativeTime : 0;
      const candidates = keyDetectorRef.current?.detectFromNotes(notes) ?? [];
      if (candidates.length === 0) {
        setError("Could not detect key. Try a more melodic phrase.");
        setRecordingState("idle");
        return;
      }

      if (sessionMode === "manual") {
        usePhraseStore.getState().setTempManualData({
          notes, audioBuffer, duration,
          singingKey: { key: candidates[0].key, mode: candidates[0].mode as "major" | "minor" },
        });
        setRecordingState("idle");
        return;
      }

      // Algorithm mode: chord mapping
      const phraseCandidates = candidates.map((candidate) => {
        const timeline = ChordMapper.mapProgression(notes, candidate);
        const chordToneRatio = ChordMapper.computeChordToneRatio(notes, timeline);
        const blended = candidate.ksScore * 0.65 + chordToneRatio * 0.35;
        return {
          key: candidate.key, mode: candidate.mode,
          probability: candidate.blendedProbability,
          chordTimeline: timeline, _blended: blended,
        };
      });

      phraseCandidates.sort((a, b) => b._blended - a._blended);
      const blendedSum = phraseCandidates.reduce((s, c) => s + Math.max(c._blended, 0), 0);
      const finalCandidates = phraseCandidates.map((c) => ({
        key: c.key, mode: c.mode as "major" | "minor",
        probability: blendedSum > 0 ? (Math.max(c._blended, 0) / blendedSum) * 100 : 0,
        chordTimeline: c.chordTimeline,
      }));

      setSession({
        id: crypto.randomUUID(), duration, capturedAt: Date.now(),
        notes, audioBuffer, candidates: finalCandidates, selectedCandidate: 0, source: "algorithm",
      });
    } catch (err) {
      console.error("Phrase analysis failed:", err);
      setError("Analysis failed. Please try again.");
    }
    setRecordingState("idle");
  }, [setSession, setRecordingState, sessionMode]);

  const handleResing = useCallback(() => {
    clearSession();
    setSessionModeLocal(null);
    setScreen("mode");
  }, [clearSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngineRef.current?.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const audioContext = audioEngineRef.current?.getContext() ?? null;

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Three.js Background */}
      <div className="absolute inset-0 z-0">
        {isMounted && (
          <Canvas
            camera={{ position: [0, 0, 5], fov: 60 }}
            dpr={[1, 1.5]}
            gl={{ alpha: true, antialias: false, powerPreference: "default", preserveDrawingBuffer: true }}
            onCreated={({ gl }) => gl.setClearColor("#050508")}
          >
            <SessionScene />
            <EffectComposer>
              <Bloom intensity={0.8} luminanceThreshold={0.25} luminanceSmoothing={0.9} mipmapBlur />
            </EffectComposer>
          </Canvas>
        )}
      </div>

      {/* Background gradient overlay */}
      <div
        id="bg-sim"
        className="fixed inset-0 z-[1] pointer-events-none transition-opacity duration-1000"
        style={{
          background: isActive
            ? "radial-gradient(ellipse 100% 60% at 50% 70%, rgba(124,58,237,0.14) 0%, rgba(6,182,212,0.08) 50%, transparent 100%)"
            : "radial-gradient(ellipse 80% 50% at 50% 60%, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.04) 60%, transparent 100%)",
        }}
      />

      {/* UI Root */}
      <div id="ui-root" className="fixed inset-0 z-10" style={{ pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          {/* Top Bar */}
          <TopBar
            visible={isActive}
            onEndSession={handleStop}
          />

          {/* Error Banner */}
          {error && (
            <div className={`error-banner visible`}>{error}</div>
          )}

          {/* Screen: Mic Off */}
          <div className={`session-screen ${screen === "micoff" ? "active" : ""}`} style={{ textAlign: "center" }}>
            <MicOffScreen onStart={handleStart} loading={loading} error={error} />
          </div>

          {/* Screen: Mode Select */}
          <div className={`session-screen ${screen === "mode" ? "active" : ""}`} style={{ paddingTop: 48 }}>
            <ModeSelectScreen onSelectMode={handleSetSessionMode} />
          </div>

          {/* Screen: Algorithm Mode */}
          <div
            className={`session-screen ${screen === "algo" ? "active" : ""}`}
            style={{ paddingTop: 48, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start" }}
          >
            <AlgoScreen
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              recordingDuration={recordingDuration}
              sessionMode={sessionMode}
              onSwitchMode={handleSetSessionMode}
              onBackToModes={handleBackToModes}
            />
          </div>

          {/* Screen: Manual Mode */}
          <div
            className={`session-screen ${screen === "manual" ? "active" : ""}`}
            style={{ paddingTop: 48, flexDirection: "row", alignItems: "stretch", justifyContent: "flex-start" }}
          >
            <ManualScreen
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              recordingDuration={recordingDuration}
              audioContext={audioContext}
              onSwitchMode={handleSetSessionMode}
              onBackToModes={handleBackToModes}
            />
          </div>

          {/* Screen: Results */}
          <div
            className={`session-screen ${screen === "results" ? "active" : ""}`}
            style={{ paddingTop: 48, alignItems: "flex-start", justifyContent: "flex-start", overflowY: "auto" }}
          >
            {currentSession && audioContext && (
              <ResultsScreen
                phrase={currentSession}
                audioContext={audioContext}
                onResing={handleResing}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
