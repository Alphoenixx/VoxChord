/**
 * Guitar Chord Voicing Library — Phase 6
 *
 * 36 standard voicings: 12 roots × (major, minor, diminished).
 * Each voicing specifies fret positions for 6 strings (low E → high E),
 * finger assignments, base fret, and which strings are muted/open.
 */

export interface ChordVoicing {
  name: string;           // "C", "Cm", "Cdim"
  frets: number[];        // [x, 3, 2, 0, 1, 0] — 6 strings, -1 = muted
  fingers: number[];      // [0, 3, 2, 0, 1, 0] — 0 = open/muted
  baseFret: number;       // 1 = open position
  barreString?: number;   // if barre, which fret is barred
}

// Helper: -1 means muted (×), 0 means open (○)
const VOICINGS: Record<string, ChordVoicing> = {
  // ── Major Chords ──
  "C":    { name: "C",    frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
  "D♭":  { name: "D♭",   frets: [-1, 4, 3, 1, 2, 1], fingers: [0, 4, 3, 1, 2, 1], baseFret: 1 },
  "D":    { name: "D",    frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  "E♭":  { name: "E♭",   frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 2, 4, 3], baseFret: 1 },
  "E":    { name: "E",    frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
  "F":    { name: "F",    frets: [1, 1, 2, 3, 3, 1], fingers: [1, 1, 2, 3, 4, 1], baseFret: 1, barreString: 1 },
  "G♭":  { name: "G♭",   frets: [2, 1, 1, 3, 4, 2], fingers: [2, 1, 1, 3, 4, 1], baseFret: 1 },
  "G":    { name: "G",    frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], baseFret: 1 },
  "A♭":  { name: "A♭",   frets: [4, 3, 1, 1, 1, 4], fingers: [3, 2, 1, 1, 1, 4], baseFret: 1, barreString: 1 },
  "A":    { name: "A",    frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
  "B♭":  { name: "B♭",   frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barreString: 1 },
  "B":    { name: "B",    frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barreString: 2 },

  // ── Minor Chords ──
  "Cm":   { name: "Cm",   frets: [-1, 3, 1, 0, 1, 3], fingers: [0, 3, 1, 0, 2, 4], baseFret: 1 },
  "D♭m": { name: "D♭m",  frets: [-1, 4, 2, 1, 2, 0], fingers: [0, 4, 2, 1, 3, 0], baseFret: 1 },
  "Dm":   { name: "Dm",   frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
  "E♭m": { name: "E♭m",  frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2], baseFret: 1 },
  "Em":   { name: "Em",   frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
  "Fm":   { name: "Fm",   frets: [1, 1, 1, 3, 3, 1], fingers: [1, 1, 1, 3, 4, 1], baseFret: 1, barreString: 1 },
  "G♭m": { name: "G♭m",  frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], baseFret: 1, barreString: 2 },
  "Gm":   { name: "Gm",   frets: [3, 1, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4], baseFret: 1 },
  "A♭m": { name: "A♭m",  frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], baseFret: 4, barreString: 4 },
  "Am":   { name: "Am",   frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
  "B♭m": { name: "B♭m",  frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], baseFret: 1, barreString: 1 },
  "Bm":   { name: "Bm",   frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], baseFret: 1, barreString: 2 },

  // ── Diminished Chords ──
  "Cdim":   { name: "Cdim",   frets: [-1, 3, 4, 2, 4, 2], fingers: [0, 2, 3, 1, 4, 1], baseFret: 1 },
  "D♭dim": { name: "D♭dim",  frets: [-1, 4, 5, 3, 5, 3], fingers: [0, 2, 3, 1, 4, 1], baseFret: 1 },
  "Ddim":   { name: "Ddim",   frets: [-1, -1, 0, 1, 3, 1], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  "E♭dim": { name: "E♭dim",  frets: [-1, -1, 1, 2, 4, 2], fingers: [0, 0, 1, 2, 4, 3], baseFret: 1 },
  "Edim":   { name: "Edim",   frets: [0, 1, 2, 0, -1, -1], fingers: [0, 1, 2, 0, 0, 0], baseFret: 1 },
  "Fdim":   { name: "Fdim",   frets: [-1, -1, 3, 1, 0, 1], fingers: [0, 0, 3, 1, 0, 2], baseFret: 1 },
  "G♭dim": { name: "G♭dim",  frets: [-1, -1, 4, 2, 1, 2], fingers: [0, 0, 4, 2, 1, 3], baseFret: 1 },
  "Gdim":   { name: "Gdim",   frets: [-1, -1, 5, 3, 2, 3], fingers: [0, 0, 4, 2, 1, 3], baseFret: 1 },
  "A♭dim": { name: "A♭dim",  frets: [-1, -1, 6, 4, 3, 4], fingers: [0, 0, 4, 2, 1, 3], baseFret: 1 },
  "Adim":   { name: "Adim",   frets: [-1, 0, 1, 2, 1, -1], fingers: [0, 0, 1, 3, 2, 0], baseFret: 1 },
  "B♭dim": { name: "B♭dim",  frets: [-1, 1, 2, 3, 2, -1], fingers: [0, 1, 2, 4, 3, 0], baseFret: 1 },
  "Bdim":   { name: "Bdim",   frets: [-1, 2, 3, 4, 3, -1], fingers: [0, 1, 2, 4, 3, 0], baseFret: 1 },
};

/**
 * Look up a voicing by chord display name.
 * Handles both "B♭m" style and falls back gracefully.
 */
export function getVoicing(chordDisplay: string): ChordVoicing | null {
  return VOICINGS[chordDisplay] || null;
}

/**
 * Get all available chord names.
 */
export function getAllChordNames(): string[] {
  return Object.keys(VOICINGS);
}

export default VOICINGS;
