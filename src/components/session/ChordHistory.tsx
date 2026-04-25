"use client";

import { useChordStore } from "@/stores/useChordStore";
import { motion, AnimatePresence } from "framer-motion";
import { formatChordDisplay } from "@/utils/formatters";

// Enharmonic map (sharps → preferred flats)
const ENHARMONIC: Record<string, string> = {
  "A#": "B♭", "A#m": "B♭m", "A#dim": "B♭dim",
  "D#": "E♭", "D#m": "E♭m", "D#dim": "E♭dim",
  "G#": "A♭", "G#m": "A♭m", "G#dim": "A♭dim",
  "C#": "D♭", "C#m": "C♯m", "C#dim": "D♭dim",
  "F#": "F♯",  "F#m": "F♯m", "F#dim": "F♯dim",
};
const displayChord = (raw: string) => ENHARMONIC[raw] ?? raw;

export default function ChordHistory() {
  const { history } = useChordStore();

  if (history.length === 0) {
    return (
      <div className="h-14 flex items-center justify-center">
        <span className="text-[9px] font-mono uppercase tracking-[0.45em] text-white/10">
          Chord history will appear here
        </span>
      </div>
    );
  }

  return (
    // justify-center ensures the row is always centered, not left-anchored
    <div className="w-full max-w-2xl mx-auto h-14 flex items-center justify-center mask-edges overflow-hidden">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <AnimatePresence mode="popLayout" initial={false}>
          {history.map((item, idx) => {
            const isNewest = idx === history.length - 1;
            const age      = (history.length - 1 - idx) / Math.max(1, history.length - 1);
            const opacity  = isNewest ? 1 : Math.max(0.18, 0.6 - age * 0.45);

            return (
              <motion.div
                key={item.timestamp}
                layout
                initial={{ opacity: 0, scale: 0.65, x: 24 }}
                animate={{ opacity, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, x: -12 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                className="flex items-center gap-2 flex-shrink-0"
              >
                {/* Chip — fixed width, hover affordance on inactive items */}
                <span
                  className={
                    `font-display font-semibold text-sm tracking-wide text-white
                     inline-flex items-center justify-center
                     w-14 h-8 rounded-lg transition-all duration-200
                     ${isNewest
                       ? "bg-violet-500/15 border border-violet-400/22 shadow-[0_0_10px_rgba(139,92,246,0.15)]"
                       : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12] cursor-default"
                     }`
                  }
                >
                  {formatChordDisplay(displayChord(item.chord))}
                </span>

                {idx < history.length - 1 && (
                  <span className="text-white/10 text-[10px] font-mono flex-shrink-0">→</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
