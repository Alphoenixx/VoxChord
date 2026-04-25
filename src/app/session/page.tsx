"use client";

/**
 * Session Page — Phase 8 (Major Rewrite)
 *
 * Two-mode session interface:
 * 1. Live pitch monitor (existing) — always running when active
 * 2. Phrase capture → analysis → chord progression cards (new)
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

import PitchIndicator from "@/components/session/PitchIndicator";
import ChordCards from "@/components/session/ChordCards";
import KeyDisplay from "@/components/session/KeyDisplay";
import LatencyMonitor from "@/components/session/LatencyMonitor";
import SessionScene from "@/components/session/SessionScene";
import ControlBar from "@/components/session/ControlBar";
import PhraseCard from "@/components/session/PhraseCard";
import ModeSelector from "@/components/session/ModeSelector";
import ManualChordInput from "@/components/session/ManualChordInput";
import Link from "next/link";

export default function SessionPage() {
  const { isActive, setIsActive, handleAudioEvent, setLatency } = useAudioStore();
  const { setDetectedKey, setSuggestions } = useChordStore();
  const { currentSession, recordingState, setRecordingState, setSession, clearSession, clearRecordingData, tempManualData } = usePhraseStore();

  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [sessionMode, setSessionMode] = useState<'algorithm' | 'manual' | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const chordEngineRef = useRef<ChordEngine | null>(null);
  const keyDetectorRef = useRef<KeyDetector | null>(null);
  const noteBufferRef = useRef<NoteBuffer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const transposerRef = useRef<Transposer | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Session elapsed timer
  useEffect(() => {
    if (isActive) {
      setElapsed(0);
      elapsedTimerRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    } else {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [isActive]);

  const formatElapsed = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  // ── Start Session (Mic Init) ──
  const handleStart = async () => {
    try {
      if (!audioEngineRef.current) audioEngineRef.current = new AudioEngine();

      const latencyInfo = await audioEngineRef.current.init((event) => {
        handleAudioEvent(event);

        if (event.type === 'SilenceEvent') return;

        const pitchClass = ((event.midi % 12) + 12) % 12;
        const noteData = {
          pitch: event.frequency,
          midi: event.midi,
          pitchClass,
          cents: event.cents,
          voiced: true,
          stable: true
        };

        // Track vocal range
        if (event.midi > 0) {
          transposerRef.current?.trackNote(event.midi);
        }

        // Push to note buffer if recording
        if (noteBufferRef.current?.isRecording()) {
          const ctx = audioEngineRef.current?.getContext();
          if (ctx) {
            noteBufferRef.current.push(noteData, event.timestamp);
          }
        }

        // Live chord suggestions (existing behavior)
        keyDetectorRef.current?.addObservation(pitchClass);

        const state = useChordStore.getState();
        let keyName = "C";
        let mode: "major" | "minor" = "major";

        if (state.manualKeyOverride) {
          const parts = state.manualKeyOverride.split(" ");
          keyName = parts[0];
          mode = parts[1] as "major" | "minor";
        } else if (state.detectedKey) {
          keyName = state.detectedKey.key;
          mode = state.detectedKey.mode;
        }

        if (chordEngineRef.current) {
          const suggestions = chordEngineRef.current.suggest(keyName, mode, pitchClass);
          setSuggestions(suggestions);
          if (suggestions.length > 0) {
            useChordStore.getState().addToHistory(suggestions[0].chord);
          }
        }
      });

      setLatency(latencyInfo);
      setIsActive(true);
      setHasStarted(true);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Microphone access denied. Please grant permission and try again.");
    }
  };

  const handleStop = async () => {
    if (audioEngineRef.current) await audioEngineRef.current.stop();
    setIsActive(false);
  };

  // ── Phrase Recording ──
  const handleStartRecording = useCallback(() => {
    const ctx = audioEngineRef.current?.getContext();
    const stream = audioEngineRef.current?.getStream();
    if (!ctx || !stream) return;

    // Clear previous session data but keep manual input
    clearRecordingData();

    // Init recorder
    audioRecorderRef.current = new AudioRecorder(ctx);
    audioRecorderRef.current.startRecording(stream);

    // Init note buffer
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

    try {
      // Stop note buffer
      const notes = noteBufferRef.current?.stopCapture(ctx.currentTime) ?? [];

      // Validate
      const validation = NoteBuffer.validate(notes);
      if (!validation.valid) {
        setError(validation.reason ?? "Invalid phrase");
        setRecordingState("idle");
        return;
      }

      // Stop audio recorder
      let audioBuffer: AudioBuffer | null = null;
      try {
        audioBuffer = await audioRecorderRef.current?.stopRecording() ?? null;
      } catch {
        console.warn("Audio recording decode failed, continuing without playback");
      }

      const duration = notes.length > 0 ? notes[notes.length - 1].relativeTime : 0;

      // Detect singing key (always needed)
      const candidates = keyDetectorRef.current?.detectFromNotes(notes) ?? [];
      if (candidates.length === 0) {
        setError("Could not detect key. Try a more melodic phrase.");
        setRecordingState("idle");
        return;
      }

      if (sessionMode === 'manual') {
        const singingKey = { key: candidates[0].key, mode: candidates[0].mode as 'major'|'minor' };
        usePhraseStore.getState().setTempManualData({
          notes,
          audioBuffer,
          duration,
          singingKey
        });
        setRecordingState("idle");
        return; // UI will handle the rest in ManualChordInput
      }

      // Algorithm Mode: Phase 4: Chord mapping for each candidate
      const phraseCandidates = candidates.map((candidate) => {
        const timeline = ChordMapper.mapProgression(notes, candidate);
        const chordToneRatio = ChordMapper.computeChordToneRatio(notes, timeline);
        const blended = candidate.ksScore * 0.65 + chordToneRatio * 0.35;

        return {
          key: candidate.key,
          mode: candidate.mode,
          probability: candidate.blendedProbability,
          chordTimeline: timeline,
          _blended: blended,
        };
      });

      phraseCandidates.sort((a, b) => b._blended - a._blended);
      const blendedSum = phraseCandidates.reduce((s, c) => s + Math.max(c._blended, 0), 0);
      const finalCandidates = phraseCandidates.map((c) => ({
        key: c.key,
        mode: c.mode as "major" | "minor",
        probability: blendedSum > 0 ? (Math.max(c._blended, 0) / blendedSum) * 100 : 0,
        chordTimeline: c.chordTimeline,
      }));

      setSession({
        id: crypto.randomUUID(),
        duration,
        capturedAt: Date.now(),
        notes,
        audioBuffer,
        candidates: finalCandidates,
        selectedCandidate: 0,
        source: 'algorithm'
      });

      setError(null);
    } catch (err) {
      console.error("Phrase analysis failed:", err);
      setError("Analysis failed. Please try again.");
    }

    setRecordingState("idle");
  }, [setSession, setRecordingState, sessionMode]);

  const handleResing = () => {
    clearSession();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngineRef.current?.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#050508] overflow-hidden flex flex-col">
      <div className="absolute inset-0 z-0">
        {isMounted && (
          <Canvas 
            camera={{ position: [0, 0, 5], fov: 60 }} 
            dpr={[1, 1.5]}
            gl={{ alpha: true, antialias: false, powerPreference: "default", preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.setClearColor('#050508');
            }}
          >
            <SessionScene />
            <EffectComposer>
              <Bloom intensity={0.8} luminanceThreshold={0.25} luminanceSmoothing={0.9} mipmapBlur />
            </EffectComposer>
          </Canvas>
        )}
      </div>

      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 60%, rgba(5,5,8,0.55) 0%, rgba(5,5,8,0.82) 100%)",
        }}
      />

      {!isActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050508]/85 backdrop-blur-md overflow-y-auto">
          <div className="relative text-center flex flex-col items-center justify-center min-h-full py-12">
            <h1 className="font-display text-[clamp(3.5rem,10vw,7rem)] font-extrabold tracking-[0.01em] leading-[1.0] text-gradient text-glow mb-5">
              VoxChord
            </h1>
            <button
              onClick={handleStart}
              className="px-14 py-5 rounded-full font-display font-semibold text-xl tracking-[0.04em]
                         bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500
                         text-white transition-all duration-400 hover:scale-[1.04]
                         shadow-[0_0_60px_rgba(139,92,246,0.45)]"
            >
              Start Playing
            </button>
            <Link href="/" className="mt-14 text-[10px] font-mono text-white/25 hover:text-white/65">
              ← Back to home
            </Link>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div className="relative z-10 flex-1 flex flex-col justify-between p-6 md:p-10 pointer-events-none overflow-hidden">
        
        {/* Top bar */}
        <div className="flex items-start justify-between pointer-events-auto">
          <div className="flex items-center gap-4">
            <KeyDisplay />
            {sessionMode !== null && !currentSession && recordingState === "idle" && !tempManualData && (
              <button
                onClick={() => setSessionMode(null)}
                className="px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.1em] text-white/40 hover:text-white/80 border border-white/[0.06] bg-white/[0.02] transition-colors"
              >
                ← Back to Modes
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <LatencyMonitor />
            {isActive && (
              <button
                onClick={handleStop}
                className="px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.15em]
                           text-white/40 hover:text-red-400 border border-white/[0.06] bg-white/[0.02]"
              >
                End
              </button>
            )}
          </div>
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center pointer-events-auto w-full max-w-4xl mx-auto">
          {error && <p className="text-[11px] font-mono text-red-400/70 absolute top-24">{error}</p>}

          {!currentSession ? (
            <>
              {sessionMode === null ? (
                <ModeSelector
                  onSelectAlgorithm={() => setSessionMode('algorithm')}
                  onSelectManual={() => setSessionMode('manual')}
                  onEndSession={handleStop}
                  detectedKeyName={useChordStore.getState().detectedKey?.key}
                  detectedKeyMode={useChordStore.getState().detectedKey?.mode}
                />
              ) : sessionMode === 'algorithm' ? (
                // ALGORITHM MODE
                <div className="flex flex-col items-center justify-center gap-8 w-full">
                  <PitchIndicator />
                  {recordingState === "idle" && <ChordCards />}
                  <ControlBar
                    onStartRecording={handleStartRecording}
                    onStopRecording={handleStopRecording}
                    recordingDuration={recordingDuration}
                  />
                </div>
              ) : (
                // MANUAL MODE
                <div className="flex flex-col items-center justify-center gap-8 w-full">
                  {tempManualData || recordingState === "idle" ? (
                    <ManualChordInput 
                      onStartRecording={handleStartRecording} 
                      audioContext={audioEngineRef.current?.getContext()!} 
                    />
                  ) : (
                    <>
                      <PitchIndicator />
                      <ControlBar
                        onStartRecording={handleStartRecording}
                        onStopRecording={handleStopRecording}
                        recordingDuration={recordingDuration}
                      />
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            // PLAYBACK MODE
            <PhraseCard
              phrase={currentSession}
              audioContext={audioEngineRef.current?.getContext()!}
              onResing={() => {
                handleResing();
                setSessionMode(null); // Return to mode selector on re-sing
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
