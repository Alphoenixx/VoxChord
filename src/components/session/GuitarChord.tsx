"use client";

/**
 * GuitarChord — Phase 6
 *
 * Pure SVG guitar chord diagram renderer. No external library.
 * Renders a 6-string × 5-fret grid with:
 * - Nut line (thick) for open position, fret number label for barre
 * - Filled circles for finger positions
 * - ○ for open strings, ✕ for muted strings
 * - Smooth fade transition between chords
 */

import { motion, AnimatePresence } from "framer-motion";
import { getVoicing, ChordVoicing } from "@/data/chordVoicings";
import { formatChordDisplay } from "@/utils/formatters";

interface GuitarChordProps {
  chord: string;        // "B♭m", "G♭", "Edim"
  size?: number;        // px width, default 120
  animate?: boolean;    // fade transition
}

const STRINGS = 6;
const FRETS = 5;

export default function GuitarChord({ chord, size = 120, animate = true }: GuitarChordProps) {
  const voicing = getVoicing(chord);

  // Layout dimensions relative to size
  const padding = size * 0.15;
  const topMargin = size * 0.25;    // space for muted/open indicators + chord name
  const bottomMargin = size * 0.12;
  const width = size;
  const gridWidth = width - padding * 2;
  const gridHeight = (size * 1.3) - topMargin - bottomMargin;
  const totalHeight = topMargin + gridHeight + bottomMargin;
  const stringSpacing = gridWidth / (STRINGS - 1);
  const fretSpacing = gridHeight / FRETS;

  const getStringX = (s: number) => padding + s * stringSpacing;
  const getFretY = (f: number) => topMargin + f * fretSpacing;

  const diagram = (
    <svg
      width={width}
      height={totalHeight}
      viewBox={`0 0 ${width} ${totalHeight}`}
      className="select-none"
    >
      {/* Background */}
      <rect
        x={0} y={0} width={width} height={totalHeight}
        rx={8} fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.06)" strokeWidth={1}
      />

      {voicing ? (
        <>
          {/* Nut line or fret number */}
          {voicing.baseFret === 1 ? (
            <line
              x1={padding} y1={topMargin}
              x2={padding + gridWidth} y2={topMargin}
              stroke="rgba(255,255,255,0.7)" strokeWidth={3} strokeLinecap="round"
            />
          ) : (
            <text
              x={padding - 8} y={topMargin + fretSpacing * 0.6}
              fill="rgba(255,255,255,0.4)" fontSize={size * 0.08}
              fontFamily="var(--font-mono)" textAnchor="end"
            >
              {voicing.baseFret}fr
            </text>
          )}

          {/* Fret lines (horizontal) */}
          {Array.from({ length: FRETS + 1 }).map((_, f) => (
            <line
              key={`fret-${f}`}
              x1={padding} y1={getFretY(f)}
              x2={padding + gridWidth} y2={getFretY(f)}
              stroke="rgba(255,255,255,0.12)" strokeWidth={1}
            />
          ))}

          {/* String lines (vertical) */}
          {Array.from({ length: STRINGS }).map((_, s) => (
            <line
              key={`string-${s}`}
              x1={getStringX(s)} y1={topMargin}
              x2={getStringX(s)} y2={topMargin + gridHeight}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1}
            />
          ))}

          {/* Muted (✕) and Open (○) indicators above nut */}
          {voicing.frets.map((fret, s) => {
            const x = getStringX(s);
            const y = topMargin - size * 0.06;

            if (fret === -1) {
              // Muted
              return (
                <text
                  key={`mute-${s}`}
                  x={x} y={y}
                  fill="rgba(255,255,255,0.3)" fontSize={size * 0.09}
                  textAnchor="middle" dominantBaseline="central"
                  fontFamily="var(--font-mono)"
                >
                  ✕
                </text>
              );
            } else if (fret === 0) {
              // Open
              return (
                <circle
                  key={`open-${s}`}
                  cx={x} cy={y}
                  r={size * 0.03}
                  fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5}
                />
              );
            }
            return null;
          })}

          {/* Finger positions */}
          {voicing.frets.map((fret, s) => {
            if (fret <= 0) return null; // skip muted and open

            const displayFret = voicing.baseFret === 1 ? fret : fret - voicing.baseFret + 1;
            const x = getStringX(s);
            const y = getFretY(displayFret - 1) + fretSpacing / 2;
            const r = size * 0.045;

            return (
              <circle
                key={`finger-${s}`}
                cx={x} cy={y} r={r}
                fill="#8B5CF6"
                stroke="rgba(139,92,246,0.4)" strokeWidth={1}
              />
            );
          })}
        </>
      ) : (
        /* Fallback: show chord name only if no voicing found */
        <text
          x={width / 2} y={totalHeight / 2}
          fill="rgba(255,255,255,0.3)" fontSize={size * 0.1}
          textAnchor="middle" dominantBaseline="central"
          fontFamily="var(--font-mono)"
        >
          {chord}
        </text>
      )}

      {/* Chord name below diagram */}
      <text
        x={width / 2} y={totalHeight - bottomMargin * 0.3}
        fill="rgba(255,255,255,0.7)" fontSize={size * 0.11}
        textAnchor="middle" dominantBaseline="central"
        fontFamily="var(--font-display)" fontWeight={600}
      >
        {chord}
      </text>
    </svg>
  );

  if (!animate) return diagram;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={chord}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {diagram}
      </motion.div>
    </AnimatePresence>
  );
}
