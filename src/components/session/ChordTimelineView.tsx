"use client";

/**
 * ChordTimeline — Phase 8
 *
 * Horizontal chord sequence with past/active/upcoming highlight states.
 * Sync engine swaps CSS classes — no JS animation needed for transitions.
 */

import { ChordEvent } from "@/audio/ChordMapper";
import { formatChordDisplay } from "@/utils/formatters";

interface ChordTimelineProps {
  timeline: ChordEvent[];
  activeIndex: number;    // -1 if nothing active
}

export default function ChordTimeline({ timeline, activeIndex }: ChordTimelineProps) {
  if (timeline.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {timeline.map((event, i) => {
        const state =
          i < activeIndex ? "past" :
          i === activeIndex ? "active" :
          "upcoming";

        return (
          <div key={`${event.chord.display}-${i}`} className="flex items-center gap-2">
            <div
              className={`
                px-3 py-1.5 rounded-lg font-display font-semibold text-sm
                transition-all duration-300 ease-out
                ${state === "past"
                  ? "opacity-30 scale-100 bg-white/[0.02] border border-white/[0.04] text-white/40"
                  : state === "active"
                  ? "opacity-100 scale-105 bg-violet-500/15 border border-violet-500/30 text-white shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                  : "opacity-60 scale-100 bg-white/[0.02] border border-white/[0.06] text-white/60"
                }
              `}
            >
              {formatChordDisplay(event.chord.display)}
            </div>
            {/* Arrow separator (not after the last chord) */}
            {i < timeline.length - 1 && (
              <span className={`text-[10px] font-mono transition-opacity duration-300 ${
                state === "past" ? "opacity-15" : "opacity-25"
              }`}>
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
