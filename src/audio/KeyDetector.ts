import { DetectedKey } from '../stores/useChordStore';

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
    const sum = histogram.reduce((a, b) => a + b, 0);
    if (sum === 0) return null;
    const normalized = histogram.map(v => v / sum);

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
}
