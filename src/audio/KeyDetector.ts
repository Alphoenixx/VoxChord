import { DetectedKey } from '../stores/useChordStore';
import { TimestampedNote } from './NoteBuffer';
import { ChromaAnalyzer } from './ChromaAnalyzer';
import { ParsedChord } from './ChordParser';

export interface KeyCandidate {
  key: string;
  mode: 'major' | 'minor';
  ksScore: number;              // raw Pearson correlation
  chordToneRatio: number;       // 0-1, filled in by ChordMapper after mapping
  blendedProbability: number;   // percentage 0-100
}

export class KeyDetector {
  // Major key profile (Krumhansl & Kessler 1982)
  private static MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                                   2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  // Minor key profile
  private static MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                                   2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  private static KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

  private window: { pitchClass: number; timestamp: number }[] = [];
  private WINDOW_MS = 8000;
  private DECAY_HALFLIFE_MS = 3000;

  addObservation(pitchClass: number): void {
    if (pitchClass < 0 || pitchClass > 11) return;
    this.window.push({ pitchClass, timestamp: Date.now() });
    
    // Cleanup old observations
    const cutoff = Date.now() - this.WINDOW_MS;
    while (this.window.length > 0 && this.window[0].timestamp < cutoff) {
      this.window.shift();
    }
  }

  detectKey(): DetectedKey | null {
    if (this.window.length < 10) return null; // Not enough data

    const now = Date.now();
    const histogram = new Array(12).fill(0);

    // Build exponentially decayed histogram
    for (const obs of this.window) {
      const ageMs = now - obs.timestamp;
      const weight = Math.pow(0.5, ageMs / this.DECAY_HALFLIFE_MS);
      histogram[obs.pitchClass] += weight;
    }

    // Normalize histogram
    const sum = histogram.reduce((a: number, b: number) => a + b, 0);
    if (sum === 0) return null;
    const normalized = histogram.map((v: number) => v / sum);

    let bestCorrelation = -Infinity;
    let bestKey: DetectedKey | null = null;

    // Test all 24 keys
    for (let root = 0; root < 12; root++) {
      // Test Major
      const rMaj = this.pearsonCorrelation(normalized, KeyDetector.MAJOR_PROFILE, root);
      if (rMaj > bestCorrelation) {
        bestCorrelation = rMaj;
        bestKey = { key: KeyDetector.KEY_NAMES[root], mode: 'major', confidence: rMaj };
      }

      // Test Minor
      const rMin = this.pearsonCorrelation(normalized, KeyDetector.MINOR_PROFILE, root);
      if (rMin > bestCorrelation) {
        bestCorrelation = rMin;
        bestKey = { key: KeyDetector.KEY_NAMES[root], mode: 'minor', confidence: rMin };
      }
    }

    return bestKey;
  }

  /**
   * Phase 3 — Analyze a completed phrase and return the top 3 key candidates.
   * Uses duration-weighted chroma instead of the live decayed histogram.
   */
  detectFromNotes(notes: TimestampedNote[]): KeyCandidate[] {
    if (notes.length < 3) return [];

    // Build duration-weighted chroma vector
    const chroma = ChromaAnalyzer.buildChroma(notes);
    const chromaArray = Array.from(chroma);

    // Score all 24 keys
    const allScores: { key: string; mode: 'major' | 'minor'; score: number }[] = [];

    for (let root = 0; root < 12; root++) {
      const rMaj = this.pearsonCorrelation(chromaArray, KeyDetector.MAJOR_PROFILE, root);
      allScores.push({ key: KeyDetector.KEY_NAMES[root], mode: 'major', score: rMaj });

      const rMin = this.pearsonCorrelation(chromaArray, KeyDetector.MINOR_PROFILE, root);
      allScores.push({ key: KeyDetector.KEY_NAMES[root], mode: 'minor', score: rMin });
    }

    // Sort descending by score, take top 3
    allScores.sort((a, b) => b.score - a.score);
    const top3 = allScores.slice(0, 3);

    // Normalize scores to percentages
    const scoreSum = top3.reduce((sum, c) => sum + Math.max(c.score, 0), 0);

    return top3.map((c) => ({
      key: c.key,
      mode: c.mode,
      ksScore: c.score,
      chordToneRatio: 0,  // filled in after ChordMapper runs
      blendedProbability: scoreSum > 0 ? (Math.max(c.score, 0) / scoreSum) * 100 : 0,
    }));
  }

  reset(): void {
    this.window = [];
  }

  private pearsonCorrelation(x: number[], profile: number[], root: number): number {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    const n = 12;

    for (let i = 0; i < n; i++) {
      const xi = x[i];
      // Rotate profile by root
      const yi = profile[(i - root + 12) % 12];

      sumX += xi;
      sumY += yi;
      sumXY += xi * yi;
      sumX2 += xi * xi;
      sumY2 += yi * yi;
    }

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  /**
   * Detect the key implied by a sequence of parsed chords.
   * Uses KS correlation on the pitch classes of chord roots + 3rds + 5ths.
   */
  static detectKeyFromChords(chords: ParsedChord[]): { key: string; mode: 'major' | 'minor'; confidence: number } | null {
    if (!chords || chords.length === 0) return null;

    // Fallback for very short progressions: just trust the first chord
    if (chords.length < 2) {
      const first = chords[0];
      const mode = first.type === 'minor' || first.type === 'dim' ? 'minor' : 'major';
      return { key: first.root, mode, confidence: 1.0 };
    }

    const chroma = new Array(12).fill(0);

    // Build histogram
    chords.forEach((chord, i) => {
      // Weight the first chord more heavily (1.5x)
      const weight = i === 0 ? 1.5 : 1.0;

      // Add root
      chroma[chord.pitchClass] += weight * 1.0;

      // Add 3rd
      if (chord.type === 'minor' || chord.type === 'dim') {
        chroma[(chord.pitchClass + 3) % 12] += weight * 0.5;
      } else if (chord.type === 'major' || chord.type === 'aug') {
        chroma[(chord.pitchClass + 4) % 12] += weight * 0.5;
      }

      // Add 5th
      if (chord.type === 'dim') {
        chroma[(chord.pitchClass + 6) % 12] += weight * 0.5;
      } else if (chord.type === 'aug') {
        chroma[(chord.pitchClass + 8) % 12] += weight * 0.5;
      } else {
        chroma[(chord.pitchClass + 7) % 12] += weight * 0.5;
      }
    });

    // Normalize
    const sum = chroma.reduce((a, b) => a + b, 0);
    const normalized = sum > 0 ? chroma.map(v => v / sum) : chroma;

    let bestCorrelation = -Infinity;
    let bestKey: { key: string; mode: 'major' | 'minor'; confidence: number } | null = null;

    // We can instantiate a temp instance or just adapt pearsonCorrelation to be static or instance.
    // Let's just write the inline calculation since it's static needed here.
    
    const pearson = (x: number[], profile: number[], root: number) => {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      const n = 12;
      for (let j = 0; j < n; j++) {
        const xj = x[j];
        const yj = profile[(j - root + 12) % 12];
        sumX += xj; sumY += yj; sumXY += xj * yj; sumX2 += xj * xj; sumY2 += yj * yj;
      }
      const num = (n * sumXY) - (sumX * sumY);
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      return den === 0 ? 0 : num / den;
    };

    for (let root = 0; root < 12; root++) {
      const rMaj = pearson(normalized, KeyDetector.MAJOR_PROFILE, root);
      if (rMaj > bestCorrelation) {
        bestCorrelation = rMaj;
        bestKey = { key: KeyDetector.KEY_NAMES[root], mode: 'major', confidence: rMaj };
      }

      const rMin = pearson(normalized, KeyDetector.MINOR_PROFILE, root);
      if (rMin > bestCorrelation) {
        bestCorrelation = rMin;
        bestKey = { key: KeyDetector.KEY_NAMES[root], mode: 'minor', confidence: rMin };
      }
    }

    return bestKey;
  }
}
