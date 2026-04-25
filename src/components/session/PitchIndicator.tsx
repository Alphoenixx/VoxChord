"use client";

import { useAudioStore } from "@/stores/useAudioStore";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { formatChordDisplay } from "@/utils/formatters";

// Prefer flats for display — matches KeyDetector and ChordCards
const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// Cents threshold beyond which the indicator turns red
const WARN_CENTS = 15;

export default function PitchIndicator() {
  const { noteName, cents, stable, voiced, pitchClass } = useAudioStore();
  const [displayCents, setDisplayCents] = useState(0);

  // Smooth interpolation for cents
  useEffect(() => {
    let raf: number;
    const animate = () => {
      setDisplayCents((prev) => {
        const diff = cents - prev;
        if (Math.abs(diff) < 0.3) return cents;
        return prev + diff * 0.12;
      });
      raf = requestAnimationFrame(animate);
    };
    if (voiced) animate();
    else setDisplayCents(0);
    return () => cancelAnimationFrame(raf);
  }, [cents, voiced]);

  const centsPos    = Math.max(-50, Math.min(50, displayCents));
  const absCents    = Math.abs(centsPos);
  const isPerfect   = absCents < 5;
  const isWarning   = absCents >= WARN_CENTS; // red zone
  const hue         = pitchClass >= 0 ? (pitchClass / 12) * 360 : 270;

  // Display note name using flat convention
  const displayNote = voiced && noteName
    ? NOTE_NAMES[NOTE_NAMES.findIndex((_, i) => i === pitchClass)] ?? noteName
    : "—";

  // Cents bar colour
  const barColor = isPerfect
    ? "#22c55e"
    : isWarning
    ? "#ef4444"
    : `hsla(${hue},80%,65%,0.8)`;

  return (
    <div
      className={clsx(
        "relative flex flex-col items-center justify-center w-96 h-56 glass-card-strong transition-all duration-500 px-8 py-10",
        voiced && stable && !isWarning && "shadow-[0_0_40px_rgba(139,92,246,0.2)]",
        voiced && stable && isWarning  && "shadow-[0_0_40px_rgba(239,68,68,0.25)]",
        !voiced && "opacity-70 animate-pulse"
      )}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{
          background: voiced
            ? `linear-gradient(90deg, transparent, hsla(${hue},80%,65%,0.5), transparent)`
            : "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
        }}
      />

      {/* Note name + cents reading */}
      <div className="flex items-baseline gap-4">
        <span
          className={clsx(
            "font-display text-8xl font-extrabold tracking-[0.02em] transition-all duration-300",
            voiced ? "text-white" : "text-white/20"
          )}
          style={{
            textShadow: voiced ? `0 0 30px hsla(${hue},80%,65%,0.3)` : "none",
          }}
        >
          {voiced ? formatChordDisplay(displayNote) : "—"}
        </span>

        {voiced && (
          <span
            className={clsx(
              "font-mono text-sm font-semibold tracking-wide transition-colors duration-200",
              isPerfect  && "text-emerald-400",
              isWarning  && "text-red-400",
              !isPerfect && !isWarning && (centsPos > 0 ? "text-amber-400" : "text-blue-400")
            )}
          >
            {centsPos > 0 ? "+" : ""}
            {Math.round(centsPos)}¢
          </span>
        )}
      </div>

      {/* Cents bar — turns red when > WARN_CENTS */}
      <div className="w-64 h-2 bg-white/[0.04] mt-8 relative rounded-full overflow-hidden">
        {/* Center mark */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20 -translate-x-1/2 z-10" />

        {voiced && (
          <>
            {centsPos < 0 ? (
              <div
                className="absolute top-0 bottom-0 right-1/2 rounded-l-full transition-all duration-75"
                style={{
                  width: `${absCents}%`,
                  background: barColor,
                  boxShadow: `0 0 10px ${barColor}80`,
                }}
              />
            ) : (
              <div
                className="absolute top-0 bottom-0 left-1/2 rounded-r-full transition-all duration-75"
                style={{
                  width: `${centsPos}%`,
                  background: barColor,
                  boxShadow: `0 0 10px ${barColor}80`,
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Warning label when cents > threshold */}
      {voiced && isWarning && (
        <p className="mt-2 text-[9px] font-mono uppercase tracking-[0.3em] text-red-400/60">
          {absCents >= 30 ? "Far off pitch" : "Slightly off"}
        </p>
      )}

      {/* Status row */}
      <div className={clsx("flex items-center gap-3", isWarning ? "mt-2" : "mt-5")}>
        <div
          className={clsx(
            "w-1.5 h-1.5 rounded-full transition-colors duration-300",
            !voiced && "bg-white/10",
            voiced && stable && !isWarning && "bg-emerald-500 shadow-[0_0_6px_#22c55e]",
            voiced && stable && isWarning  && "bg-red-500 shadow-[0_0_6px_#ef4444]",
            voiced && !stable && "bg-amber-500 shadow-[0_0_6px_#f59e0b] animate-pulse"
          )}
        />
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20">
          {!voiced ? "Listening" : stable ? (isWarning ? "Adjusting" : "Locked") : "Tracking"}
        </span>
      </div>
    </div>
  );
}
