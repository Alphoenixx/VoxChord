"use client";

/**
 * CandidateCards — Phase 8
 *
 * Displays 3 ranked chord progression candidates with Play/Use buttons.
 * Collapsing behavior based on confidence thresholds.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhraseCandidate } from "@/stores/usePhraseStore";
import { formatChordDisplay } from "@/utils/formatters";

interface CandidateCardsProps {
  candidates: PhraseCandidate[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onPlay: (index: number) => void;
  playingIndex: number | null; // which candidate is currently playing
}

export default function CandidateCards({
  candidates,
  selectedIndex,
  onSelect,
  onPlay,
  playingIndex,
}: CandidateCardsProps) {
  const topProb = candidates[0]?.probability ?? 0;

  // Determine initial collapse state
  const defaultExpanded =
    topProb < 65 ? true :   // all expanded
    topProb < 85 ? false :  // alternatives collapsed
    false;                  // alternatives collapsed

  const [showAlts, setShowAlts] = useState(defaultExpanded);

  const getRankLabel = (i: number) =>
    i === 0 ? "★ Best" : i === 1 ? "Alt 1" : "Alt 2";

  return (
    <div className="flex flex-col gap-2 w-full max-w-lg">
      {/* Low confidence warning */}
      {topProb < 65 && (
        <p className="text-[10px] font-mono text-amber-400/60 tracking-[0.1em] text-center mb-1">
          Multiple interpretations possible
        </p>
      )}

      {candidates.map((candidate, i) => {
        // Hide alternatives if collapsed
        if (i > 0 && !showAlts) return null;

        const isSelected = i === selectedIndex;
        const isPlaying = i === playingIndex;

        return (
          <motion.div
            key={`${candidate.key}-${candidate.mode}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`
              flex items-center justify-between px-4 py-3 rounded-xl
              border transition-all duration-300
              ${isSelected
                ? "bg-violet-500/10 border-violet-500/25"
                : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
              }
            `}
          >
            {/* Left: Rank + Key + Probability */}
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-[9px] font-mono uppercase tracking-[0.15em] flex-shrink-0 ${
                i === 0 ? "text-violet-400" : "text-white/25"
              }`}>
                {getRankLabel(i)}
              </span>
              <span className="text-sm font-display font-semibold text-white/80">
                {formatChordDisplay(`${candidate.key}`)}
                <span className="text-white/40 ml-1 text-xs">{candidate.mode}</span>
              </span>
              <span className="text-[10px] font-mono text-white/30">
                {Math.round(candidate.probability)}%
              </span>
            </div>

            {/* Right: chord sequence preview + actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mini chord preview */}
              <div className="hidden md:flex items-center gap-1">
                {candidate.chordTimeline.slice(0, 4).map((event, ci) => (
                  <span
                    key={ci}
                    className="text-[10px] font-mono text-white/30"
                  >
                    {event.chord.display}
                    {ci < Math.min(candidate.chordTimeline.length, 4) - 1 && " →"}
                  </span>
                ))}
              </div>

              {/* Play button */}
              <button
                onClick={() => onPlay(i)}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                  isPlaying
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/60"
                }`}
              >
                {isPlaying ? (
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                    <rect x="2" y="2" width="3" height="8" rx="0.5" />
                    <rect x="7" y="2" width="3" height="8" rx="0.5" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M3 1.5v9l7.5-4.5z" />
                  </svg>
                )}
              </button>

              {/* Use button */}
              {!isSelected && (
                <button
                  onClick={() => onSelect(i)}
                  className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/25
                             hover:text-violet-400 transition-colors px-2 py-1"
                >
                  Use
                </button>
              )}
              {isSelected && (
                <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-violet-400 px-2 py-1">
                  ✓
                </span>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Toggle alternatives */}
      {!showAlts && candidates.length > 1 && (
        <button
          onClick={() => setShowAlts(true)}
          className="text-[10px] font-mono text-white/20 hover:text-white/40
                     transition-colors tracking-[0.1em] mt-1"
        >
          {candidates.length - 1} alternative{candidates.length > 2 ? "s" : ""} available ↓
        </button>
      )}
      {showAlts && candidates.length > 1 && (
        <button
          onClick={() => setShowAlts(false)}
          className="text-[10px] font-mono text-white/20 hover:text-white/40
                     transition-colors tracking-[0.1em] mt-1"
        >
          Collapse ↑
        </button>
      )}
    </div>
  );
}
