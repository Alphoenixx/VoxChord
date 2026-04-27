"use client";

import { useChordStore } from "@/stores/useChordStore";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { formatChordDisplay } from "@/utils/formatters";

// ─── Enharmonic display map (sharps → preferred flats) ────────────────────────
// Convention: B♭, E♭, A♭, D♭, G♭ are preferred in most keys over A#, D#, G#, C#, F#
const ENHARMONIC_FLATS: Record<string, string> = {
  "A#":    "B♭",
  "A#m":   "B♭m",
  "A#dim": "B♭dim",
  "A#aug": "B♭aug",
  "D#":    "E♭",
  "D#m":   "E♭m",
  "D#dim": "E♭dim",
  "D#aug": "E♭aug",
  "G#":    "A♭",
  "G#m":   "A♭m",
  "G#dim": "A♭dim",
  "G#aug": "A♭aug",
  "C#":    "D♭",
  "C#m":   "C#m",  // C#m is conventional (not D♭m)
  "C#dim": "D♭dim",
};

function displayChord(raw: string): string {
  return ENHARMONIC_FLATS[raw] ?? raw;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChordCards() {
  const { suggestions } = useChordStore();

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="flex items-start justify-center pt-6 pb-2">
        <span className="text-[11px] font-mono uppercase tracking-[0.35em] text-white/15">
          Waiting for stable pitch…
        </span>
      </div>
    );
  }

  const displayChords = suggestions.slice(0, 3);

  return (
    <div className="flex items-end justify-center gap-4 w-full">
      <AnimatePresence mode="popLayout">
        {displayChords.map((chord, index) => {
          const isPrimary   = index === 0;
          const stabColor =
            chord.stability >= 0.8 ? "#22c55e"
            : chord.stability >= 0.6 ? "#f59e0b"
            : "#ef4444";

          return (
            <motion.div
              key={`${chord.chord}-${chord.role}`}
              layout
              initial={{ opacity: 0, y: 30, scale: 0.85, filter: "blur(8px)" }}
              animate={{
                opacity: 1,
                y: 0,
                scale: isPrimary ? 1 : 0.88,
                filter: "blur(0px)",
              }}
              exit={{ opacity: 0, y: -20, scale: 0.85, filter: "blur(8px)" }}
              transition={{ type: "spring", stiffness: 250, damping: 22 }}
              className={clsx(
                // All cards always have a solid background — never ghosted
                "relative flex flex-col items-center justify-between overflow-hidden transition-shadow duration-500",
                isPrimary
                  ? "glass-card-strong w-52 py-10 px-6 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)]"
                  : "glass-card w-44 py-8 px-5 rounded-xl"
              )}
            >
              {/* Stability bar at top */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/[0.04]">
                <motion.div
                  className="h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${chord.stability * 100}%` }}
                  transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                  style={{ background: stabColor, boxShadow: `0 0 8px ${stabColor}50` }}
                />
              </div>

              {/* Role label */}
              <span className={clsx(
                "font-mono uppercase tracking-[0.3em]",
                isPrimary ? "text-[10px] text-white/30" : "text-[9px] text-white/20"
              )}>
                {chord.role}
              </span>

              {/* Chord name — enharmonically corrected */}
              <div className="flex-1 flex items-center justify-center py-2">
                <span className={clsx(
                  "font-display font-extrabold tracking-tight",
                  isPrimary ? "text-6xl text-white" : "text-4xl text-white/75"
                )}>
                  {formatChordDisplay(displayChord(chord.chord))}
                </span>
              </div>

              {/* Resolution hint */}
              <div className="h-6 flex items-end">
                {chord.resolvesTo ? (
                  <span className="text-[10px] font-mono text-amber-400/55 uppercase tracking-[0.18em]">
                    → {displayChord(chord.resolvesTo)}
                  </span>
                ) : (
                  // Keep spacing consistent even without hint
                  <span className="opacity-0 text-[10px]">–</span>
                )}
              </div>

              {/* Primary card glow */}
              {isPrimary && (
                <div
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-28 h-12 rounded-full opacity-15 blur-2xl"
                  style={{ background: stabColor }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
