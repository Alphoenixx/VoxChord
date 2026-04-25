/**
 * ChromaAnalyzer — Phase 3
 *
 * Builds 12-bin pitch-class distribution vectors (chroma vectors) from
 * timestamped note data. Supports both full-phrase and windowed analysis.
 * Duration-weighted, not count-weighted — a held note contributes more
 * than a passing tone.
 */

import { TimestampedNote } from './NoteBuffer';

export class ChromaAnalyzer {
  /**
   * Build a 12-bin chroma vector from a full note array.
   * Each bin is weighted by the duration the note was held
   * (approximated as gap to the next note's timestamp).
   */
  static buildChroma(notes: TimestampedNote[]): Float32Array {
    const chroma = new Float32Array(12);
    if (notes.length === 0) return chroma;

    for (let i = 0; i < notes.length; i++) {
      // Duration = time until next note, or 0.1s for the last note
      const duration =
        i < notes.length - 1
          ? notes[i + 1].relativeTime - notes[i].relativeTime
          : 0.1;

      chroma[notes[i].pitchClass] += Math.max(duration, 0.01);
    }

    // Normalize to sum = 1
    const sum = chroma.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (let i = 0; i < 12; i++) chroma[i] /= sum;
    }

    return chroma;
  }

  /**
   * Build a chroma vector for notes falling within a specific time window.
   * Used by ChordMapper for per-segment analysis.
   */
  static buildWindowChroma(
    notes: TimestampedNote[],
    startTime: number,
    endTime: number
  ): Float32Array {
    const windowNotes = notes.filter(
      (n) => n.relativeTime >= startTime && n.relativeTime < endTime
    );
    return ChromaAnalyzer.buildChroma(windowNotes);
  }

  /**
   * Cosine similarity between two 12-bin vectors.
   * Returns value in range [0, 1] where 1 = identical distribution.
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < 12; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dotProduct / denom;
  }
}
