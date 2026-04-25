"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useAudioStore } from "@/stores/useAudioStore";
import { useChordStore } from "@/stores/useChordStore";
import { AudioEngine } from "@/audio/AudioEngine";
import { ChordEngine } from "@/audio/ChordEngine";
import { KeyDetector } from "@/audio/KeyDetector";

import PitchIndicator from "@/components/session/PitchIndicator";
import ChordCards from "@/components/session/ChordCards";
import ChordHistory from "@/components/session/ChordHistory";
import KeyDisplay from "@/components/session/KeyDisplay";
import LatencyMonitor from "@/components/session/LatencyMonitor";
import SessionScene from "@/components/session/SessionScene";
import Link from "next/link";

export default function SessionPage() {
  const { isActive, setIsActive, setAudioData, setLatency } = useAudioStore();
  const { setDetectedKey, setSuggestions } = useChordStore();

  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [elapsed, setElapsed]       = useState(0); // seconds since session started

  const audioEngineRef  = useRef<AudioEngine | null>(null);
  const chordEngineRef  = useRef<ChordEngine | null>(null);
  const keyDetectorRef  = useRef<KeyDetector | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize engines on mount
  useEffect(() => {
    chordEngineRef.current  = new ChordEngine();
    keyDetectorRef.current  = new KeyDetector();

    const keyInterval = setInterval(() => {
      if (keyDetectorRef.current && isActive) {
        const newKey = keyDetectorRef.current.detectKey();
        if (newKey) setDetectedKey(newKey);
      }
    }, 2000);

    return () => clearInterval(keyInterval);
  }, [isActive, setDetectedKey]);

  // Elapsed timer — starts when session begins
  useEffect(() => {
    if (isActive) {
      setElapsed(0);
      elapsedTimerRef.current = setInterval(() => {
        setElapsed(s => s + 1);
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

  const handleStart = async () => {
    try {
      if (!audioEngineRef.current) audioEngineRef.current = new AudioEngine();

      const latencyInfo = await audioEngineRef.current.init((data) => {
        setAudioData(data);

        if (data.voiced && data.pitchClass >= 0) {
          keyDetectorRef.current?.addObservation(data.pitchClass);

          if (data.stable) {
            const state = useChordStore.getState();
            let keyName = "C";
            let mode: "major" | "minor" = "major";

            if (state.manualKeyOverride) {
              const parts = state.manualKeyOverride.split(" ");
              keyName = parts[0];
              mode    = parts[1] as "major" | "minor";
            } else if (state.detectedKey) {
              keyName = state.detectedKey.key;
              mode    = state.detectedKey.mode;
            }

            if (chordEngineRef.current) {
              const suggestions = chordEngineRef.current.suggest(keyName, mode, data.pitchClass);
              setSuggestions(suggestions);
              if (suggestions.length > 0) {
                useChordStore.getState().addToHistory(suggestions[0].chord);
              }
            }
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

  useEffect(() => {
    return () => { audioEngineRef.current?.stop(); };
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#050508] overflow-hidden flex flex-col">

      {/* ── 3D Background (reduced intensity) ── */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }} dpr={[1, 1.5]}>
          <SessionScene />
          <EffectComposer>
            <Bloom intensity={0.8} luminanceThreshold={0.25} luminanceSmoothing={0.9} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>

      {/* ── Dark overlay to reduce particle noise behind HUD ── */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 60%, rgba(5,5,8,0.55) 0%, rgba(5,5,8,0.82) 100%)",
        }}
      />

      {/* ── Start Session Overlay ── */}
      {!isActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050508]/85 backdrop-blur-md overflow-y-auto">
          {/* Ambient glow behind overlay text */}
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)",
            }}
          />

          <div className="relative text-center flex flex-col items-center justify-center min-h-full py-12">
            {/* Eyebrow — sentence case, consistent tracking */}
            <p className="text-[11px] font-mono tracking-[0.3em] text-white/30 mb-8 flex-shrink-0">
              Live session
            </p>

            {/* Title — dominant element */}
            <h1 className="font-display text-[clamp(3.5rem,10vw,7rem)] font-extrabold tracking-[0.01em] leading-[1.0] text-gradient text-glow mb-5 flex-shrink-0">
              VoxChord
            </h1>

            {/* Subtitle — sentence case, light weight */}
            <p className="text-sm font-mono text-white/25 tracking-[0.12em] mb-16 flex-shrink-0">
              Pitch detection · Chord suggestions · Real-time
            </p>

            {/* Primary CTA */}
            <button
              onClick={handleStart}
              className="px-14 py-5 rounded-full font-display font-semibold text-xl tracking-[0.04em] flex-shrink-0
                         bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500
                         text-white transition-all duration-400 hover:scale-[1.04]
                         shadow-[0_0_60px_rgba(139,92,246,0.45)]
                         hover:shadow-[0_0_90px_rgba(139,92,246,0.65)]"
            >
              Allow Microphone &amp; Start
            </button>

            {/* Trust copy — reassurance near mic request */}
            <p className="mt-5 text-[10px] font-mono text-white/60 tracking-[0.12em] flex-shrink-0">
              Runs locally in your browser · Audio is never stored
            </p>

            {/* Error */}
            {error && (
              <p className="mt-6 text-sm text-red-400/80 font-mono tracking-wide max-w-xs text-center flex-shrink-0">
                {error}
              </p>
            )}

            {/* Back link — clear contrast, well-spaced, sentence case */}
            <Link
              href="/"
              className="mt-14 text-[10px] font-mono text-white/25 hover:text-white/65
                         transition-colors tracking-[0.12em] flex-shrink-0"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      )}

      {/* ── HUD Overlay ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-between p-10 pointer-events-none">

        {/* Top bar */}
        <div className="flex justify-between items-center pointer-events-auto">
          {/* Left: Key selector */}
          <KeyDisplay />

          {/* Right: Latency + Elapsed + End — flex-shrink-0 prevents any label truncation */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <LatencyMonitor />

            {/* Session elapsed timer */}
            {isActive && (
              <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/[0.06] bg-white/[0.02] backdrop-blur-md flex-shrink-0 whitespace-nowrap">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25">
                  Time
                </span>
                <span className="text-[11px] font-mono font-semibold text-white/55">
                  {formatElapsed(elapsed)}
                </span>
              </div>
            )}

            {isActive && (
              <button
                onClick={handleStop}
                className="flex-shrink-0 px-4 py-2 text-[9px] font-mono uppercase tracking-[0.2em] text-red-400/50
                           border border-red-500/10 rounded-full hover:bg-red-500/[0.06] hover:text-red-400
                           transition-all duration-300 whitespace-nowrap"
              >
                End
              </button>
            )}
          </div>
        </div>

        {/* Center: Pitch + Chords */}
        <div className="flex flex-col items-center justify-center flex-1 gap-6">
          <PitchIndicator />
          <div className="w-full max-w-2xl pointer-events-auto">
            <ChordCards />
          </div>
        </div>

        {/* Bottom: History */}
        <div className="w-full pointer-events-auto pb-4 px-8">
          <ChordHistory />
        </div>
      </div>
    </div>
  );
}
