"use client";

/**
 * PhraseCard — Simplified
 *
 * Single playback interface:
 * - Huge current chord display
 * - Scrub/playback bar
 * - Chord timeline
 * - Play/Loop/Re-sing buttons
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phrase, usePhraseStore } from "@/stores/usePhraseStore";
import { PlaybackEngine, PlaybackEvent } from "@/audio/PlaybackEngine";
import { formatChordDisplay } from "@/utils/formatters";
import ChordTimelineView from "./ChordTimelineView";
import GuitarChord from "./GuitarChord";

interface PhraseCardProps {
  phrase: Phrase;
  audioContext: AudioContext;
  onResing: () => void;
}

export default function PhraseCard({ phrase, audioContext, onResing }: PhraseCardProps) {
  const { selectCandidate } = usePhraseStore();

  const [activeChordIndex, setActiveChordIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showAlts, setShowAlts] = useState(false);

  const playbackRef = useRef<PlaybackEngine | null>(null);
  const animRef = useRef<number>(0);

  const selectedCandidate = phrase.candidates[phrase.selectedCandidate];
  const activeChord = selectedCandidate?.chordTimeline[activeChordIndex] ?? null;

  // Create playback engine once
  useEffect(() => {
    const handleEvent = (e: PlaybackEvent) => {
      if (e.type === "chordChange") {
        setActiveChordIndex(e.index);
      } else if (e.type === "ended") {
        if (isLooping && playbackRef.current && phrase.audioBuffer) {
          playbackRef.current.play(phrase.audioBuffer, selectedCandidate.chordTimeline);
          setElapsed(0);
          trackElapsed();
        } else {
          setIsPlaying(false);
          setActiveChordIndex(-1);
          cancelAnimationFrame(animRef.current);
        }
      }
    };

    playbackRef.current = new PlaybackEngine(audioContext, handleEvent);

    return () => {
      playbackRef.current?.stop();
      cancelAnimationFrame(animRef.current);
    };
  }, [audioContext, isLooping, phrase.audioBuffer, selectedCandidate]);

  const trackElapsed = useCallback(() => {
    if (playbackRef.current?.isPlaying()) {
      setElapsed(playbackRef.current.getElapsed());
      animRef.current = requestAnimationFrame(trackElapsed);
    }
  }, []);

  const handlePlay = useCallback(() => {
    if (!phrase.audioBuffer || !playbackRef.current || !selectedCandidate) return;

    if (isPlaying) {
      playbackRef.current.stop();
      setIsPlaying(false);
      setActiveChordIndex(-1);
      cancelAnimationFrame(animRef.current);
    } else {
      playbackRef.current.play(phrase.audioBuffer, selectedCandidate.chordTimeline);
      setIsPlaying(true);
      setElapsed(0);
      trackElapsed();
    }
  }, [phrase, isPlaying, selectedCandidate, trackElapsed]);

  const handleSelectCandidate = useCallback((idx: number) => {
    selectCandidate(idx);
    setShowAlts(false);
    if (isPlaying && playbackRef.current && phrase.audioBuffer) {
      playbackRef.current.play(phrase.audioBuffer, phrase.candidates[idx].chordTimeline);
    }
  }, [phrase, isPlaying, selectCandidate]);

  const currentDisplayChord = activeChord?.chord.display ?? selectedCandidate?.chordTimeline[0]?.chord.display ?? "C";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full flex flex-col items-center justify-center p-6 mt-10 max-w-2xl mx-auto"
    >
      {/* Huge Chord Display */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <GuitarChord chord={currentDisplayChord} size={220} />
      </div>

      {/* Scrub Bar */}
      <div className="w-full mt-8 relative">
        <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-violet-500 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]"
            style={{ width: `${(elapsed / phrase.duration) * 100}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="w-full mt-6 flex justify-center pb-4 overflow-x-auto hide-scrollbar mask-edges">
        {selectedCandidate && (
          <ChordTimelineView
            timeline={selectedCandidate.chordTimeline}
            activeIndex={activeChordIndex}
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 mt-8">
        <button
          onClick={() => setIsLooping(!isLooping)}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-mono text-sm tracking-widest transition-all ${
            isLooping
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
              : "bg-white/[0.03] text-white/40 border border-white/[0.08] hover:text-white/80"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          LOOP
        </button>

        <button
          onClick={handlePlay}
          className="w-16 h-16 rounded-full flex items-center justify-center bg-white text-black hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
        >
          {isPlaying ? (
            <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-7 h-7 ml-1.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </button>

        <button
          onClick={onResing}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-mono text-sm tracking-widest bg-white/[0.03] text-white/40 border border-white/[0.08] hover:text-white/80 hover:bg-white/[0.06] transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          RE-SING
        </button>
      </div>

      {/* Alternatives Toggle / Manual Info */}
      {phrase.source === 'manual' ? (
        <div className="mt-8 relative text-center">
          <p className="text-[10px] font-mono text-cyan-400/50 tracking-[0.15em] uppercase">
            Transposed to fit your voice
          </p>
        </div>
      ) : phrase.candidates.length > 1 && (
        <div className="mt-8 relative">
          <button
            onClick={() => setShowAlts(!showAlts)}
            className="text-[10px] font-mono text-white/30 hover:text-white/60 tracking-[0.15em] uppercase"
          >
            Not right? Try another key ↓
          </button>

          <AnimatePresence>
            {showAlts && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-4 flex flex-col gap-2 w-64 z-50"
              >
                {phrase.candidates.map((c, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectCandidate(idx)}
                    className={`px-4 py-3 rounded-xl border text-sm font-display font-semibold transition-colors ${
                      idx === phrase.selectedCandidate
                        ? "bg-violet-500/20 border-violet-500/40 text-white shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "bg-[#0a0a0f] border-white/[0.08] text-white/50 hover:bg-white/[0.02]"
                    }`}
                  >
                    {formatChordDisplay(c.key)} {c.mode}
                    <span className="ml-2 text-[10px] font-mono font-normal text-white/30">
                      ({Math.round(c.probability)}%)
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
