"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePhraseStore } from "@/stores/usePhraseStore";
import { ChordParser } from "@/audio/ChordParser";
import { KeyDetector } from "@/audio/KeyDetector";
import { Transposer } from "@/audio/Transposer";
import { PlaybackEngine, PlaybackEvent } from "@/audio/PlaybackEngine";
import { formatChordDisplay } from "@/utils/formatters";

interface ManualChordInputProps {
  onStartRecording: () => void;
  audioContext: AudioContext | null;
}

export default function ManualChordInput({ onStartRecording, audioContext }: ManualChordInputProps) {
  const store = usePhraseStore();
  const {
    manualInput, setManualInput,
    parsedChords, setParsedChords,
    detectedOriginalKey, setDetectedOriginalKey,
    originalKeyOverride, setOriginalKeyOverride,
    transposedChords, setTransposedChords,
    tapTimestamps, addTapTimestamp, resetTapTimestamps,
    timingMode, setTimingMode,
    tempManualData, setSession
  } = store;

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeChordIndex, setActiveChordIndex] = useState(-1);
  const playbackRef = useRef<PlaybackEngine | null>(null);

  // -- 1. Parsing Logic --
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const parsed = ChordParser.parse(manualInput);
      setParsedChords(parsed);

      if (parsed.length > 0) {
        const keyInfo = KeyDetector.detectKeyFromChords(parsed);
        setDetectedOriginalKey(keyInfo);
      } else {
        setDetectedOriginalKey(null);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [manualInput, setParsedChords, setDetectedOriginalKey]);

  // -- 2. Transposition Logic (when tempManualData is present) --
  useEffect(() => {
    if (tempManualData && parsedChords.length > 0) {
      const origKey = originalKeyOverride || detectedOriginalKey;
      if (origKey && tempManualData.singingKey) {
        const offset = Transposer.computeOffset(origKey.key, tempManualData.singingKey.key);
        const transposed = ChordParser.transposeAll(parsedChords, offset);
        setTransposedChords(transposed);
      }
    }
  }, [tempManualData, parsedChords, originalKeyOverride, detectedOriginalKey, setTransposedChords]);

  // -- 3. Playback Engine for Tap Mode --
  useEffect(() => {
    if (!audioContext || !tempManualData?.audioBuffer) return;

    const handleEvent = (e: PlaybackEvent) => {
      if (e.type === "chordChange") {
        setActiveChordIndex(e.index);
      } else if (e.type === "ended") {
        setIsPlaying(false);
        setActiveChordIndex(-1);
      }
    };

    playbackRef.current = new PlaybackEngine(audioContext, handleEvent);

    return () => {
      playbackRef.current?.stop();
    };
  }, [audioContext, tempManualData]);

  // -- Actions --
  const handleTap = () => {
    if (playbackRef.current && isPlaying) {
      const elapsed = playbackRef.current.getElapsed();
      addTapTimestamp(elapsed);
    }
  };

  const handlePlay = () => {
    if (!tempManualData?.audioBuffer || !playbackRef.current) return;
    
    if (isPlaying) {
      playbackRef.current.stop();
      setIsPlaying(false);
      setActiveChordIndex(-1);
    } else {
      resetTapTimestamps();
      // Start playback without timeline first to record taps
      const dummyTimeline = Transposer.autoDistribute(transposedChords, tempManualData.duration);
      playbackRef.current.play(tempManualData.audioBuffer, dummyTimeline);
      setIsPlaying(true);
    }
  };

  const handleUseChords = () => {
    if (!tempManualData) return;

    let finalTimeline = [];
    if (timingMode === 'tap' && tapTimestamps.length > 0) {
      finalTimeline = Transposer.applyTapTimestamps(transposedChords, tapTimestamps, tempManualData.duration);
    } else {
      finalTimeline = Transposer.autoDistribute(transposedChords, tempManualData.duration);
    }

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
        chordTimeline: finalTimeline
      }],
      selectedCandidate: 0,
      source: 'manual'
    });
  };

  const currentKey = originalKeyOverride || detectedOriginalKey;

  // -- RENDER: INPUT STATE --
  if (!tempManualData) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-2xl gap-6 pointer-events-auto">
        <h2 className="text-xl font-display font-bold text-white tracking-wide">Enter Chords</h2>
        <p className="text-sm font-mono text-white/50 text-center">
          Paste the chords you found online. We'll figure out the key.
        </p>

        <textarea
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="e.g. Cm Fm Bb Eb"
          className="w-full bg-[#0a0a0f]/80 border border-white/[0.1] rounded-2xl p-6 text-white font-mono text-lg focus:outline-none focus:border-cyan-500/50 resize-none h-32"
        />

        {parsedChords.length > 0 && (
          <div className="w-full flex flex-wrap gap-2 justify-center">
            {parsedChords.map((c, i) => (
              <span key={i} className="px-3 py-1 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm font-display font-bold text-white/80">
                {formatChordDisplay(c.display)}
              </span>
            ))}
          </div>
        )}

        {currentKey && (
          <div className="text-[11px] font-mono text-white/40 bg-white/[0.02] px-4 py-2 rounded-full border border-white/[0.05]">
            Detected original key: <strong className="text-cyan-400">{formatChordDisplay(currentKey.key)} {currentKey.mode}</strong>
          </div>
        )}

        <button
          onClick={onStartRecording}
          disabled={parsedChords.length === 0}
          className="mt-4 px-12 py-4 rounded-full font-display font-semibold text-lg tracking-[0.04em]
                     bg-gradient-to-r from-cyan-600 to-blue-600 text-white transition-all 
                     hover:scale-[1.04] shadow-[0_0_40px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:hover:scale-100"
        >
          Now Sing The Melody
        </button>
      </div>
    );
  }

  // -- RENDER: RESULT STATE --
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl gap-8 pointer-events-auto bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] p-8 rounded-3xl">
      <div className="text-center">
        <h2 className="text-2xl font-display font-bold text-white mb-2">Transposed!</h2>
        <p className="text-sm font-mono text-white/50">
          Original: {currentKey?.key} {currentKey?.mode} → Your Voice: {tempManualData.singingKey.key} {tempManualData.singingKey.mode}
        </p>
      </div>

      {/* Transposed Chords Display */}
      <div className="w-full flex flex-wrap gap-3 justify-center bg-black/40 p-6 rounded-2xl border border-white/[0.05]">
        {transposedChords.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-2 relative">
            <span className="text-lg font-display font-bold text-white">
              {formatChordDisplay(c.display)}
            </span>
            {timingMode === 'tap' && tapTimestamps.length > i && (
              <span className="absolute -bottom-4 text-green-400 text-[10px]">✓</span>
            )}
            {timingMode === 'tap' && tapTimestamps.length === i && isPlaying && (
              <span className="absolute -bottom-4 text-cyan-400 text-[10px] animate-pulse">●</span>
            )}
          </div>
        ))}
      </div>

      {/* Timing Controls */}
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex items-center bg-white/[0.03] p-1 rounded-full border border-white/[0.05]">
          <button
            onClick={() => setTimingMode('auto')}
            className={`px-6 py-2 rounded-full text-xs font-mono tracking-widest uppercase transition-colors ${
              timingMode === 'auto' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
            }`}
          >
            Auto Space
          </button>
          <button
            onClick={() => setTimingMode('tap')}
            className={`px-6 py-2 rounded-full text-xs font-mono tracking-widest uppercase transition-colors ${
              timingMode === 'tap' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white/80'
            }`}
          >
            Tap to Time
          </button>
        </div>

        {timingMode === 'tap' && (
          <div className="flex flex-col items-center gap-4 mt-4 w-full">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                className="w-16 h-16 rounded-full flex items-center justify-center bg-white text-black hover:scale-105 transition-transform"
              >
                <svg className="w-7 h-7 ml-1.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleTap}
                className="w-full py-8 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-display text-2xl font-bold tracking-widest active:scale-95 active:bg-cyan-500/40 transition-all"
              >
                TAP HERE
              </button>
            )}
            <p className="text-[10px] font-mono text-white/40">
              {tapTimestamps.length} of {transposedChords.length} chords tapped
            </p>
          </div>
        )}
      </div>

      <div className="flex w-full gap-4 mt-6">
        <button
          onClick={() => setTempManualData(null)}
          className="flex-1 py-4 rounded-xl font-display font-semibold text-sm tracking-[0.04em]
                     bg-transparent hover:bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all"
        >
          ↺ Re-Sing Phrase
        </button>
        <button
          onClick={handleUseChords}
          className="flex-[2] py-4 rounded-xl font-display font-semibold text-lg tracking-[0.04em]
                     bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
        >
          ✓ Use These Chords
        </button>
      </div>
    </div>
  );
}
