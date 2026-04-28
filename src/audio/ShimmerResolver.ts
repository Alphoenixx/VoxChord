/**
 * ShimmerResolver
 *
 * Maps any chord (including 7ths, sus, aug, dim, slash) to the correct
 * shimmer audio file. Only major and minor shimmer samples exist,
 * so complex chords map down to their root quality while the UI
 * continues to display the full chord name.
 *
 * Available files: Shimmer {Root}.wav and Shimmer {Root}m.wav
 * Root names: C, Cm, D, Dm, Db, Dbm, E, Em, Eb, Ebm, F, Fm,
 *             G, Gm, Gb, Gbm, A, Am, Ab, Abm, B, Bm, Bb, Bbm
 *
 * Unicode ♭ in chord.root must map to ASCII 'b' for the filename.
 */

import { ParsedChord } from './ChordParser';

/** Constants from the implementation plan */
export const SHIMMER_FADEOUT_MS = 120;
export const SHIMMER_GAP_MS    = 80;
export const SHIMMER_OFFSET_S  = 0.1;

export class ShimmerResolver {
  /**
   * Given a ParsedChord, return the URL path to the shimmer WAV file.
   * Complex qualities (7th, sus, aug, dim) fall back to major or minor.
   */
  static resolve(chord: ParsedChord): string {
    // Normalize root: replace Unicode flat with ASCII 'b'
    const root = chord.root
      .replace('♭', 'b')
      .replace('♯', '#');

    // Determine if the shimmer should be minor
    const isMinor = chord.type === 'minor' || chord.type === 'dim';

    const filename = isMinor
      ? `Shimmer ${root}m.wav`
      : `Shimmer ${root}.wav`;

    return `/chords/${filename}`;
  }

  /**
   * Return unique shimmer URLs needed for a set of chords.
   */
  static resolveAll(chords: ParsedChord[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const chord of chords) {
      if (!map.has(chord.display)) {
        map.set(chord.display, this.resolve(chord));
      }
    }
    return map;
  }
}
