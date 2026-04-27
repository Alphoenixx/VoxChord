/**
 * ChordMapper — Phase 4
 *
 * For each key candidate, produces a timestamped chord timeline by:
 * 1. Dividing the phrase into harmonic windows (~8 per phrase, min 1.0s each)
 * 2. Building a mini-chroma vector per window
 * 3. Scoring against rotated diatonic chord templates (cosine similarity)
 * 4. Deduplicating consecutive identical chords
 */

import { TimestampedNote } from './NoteBuffer';
import { KeyCandidate } from './KeyDetector';
import { ChromaAnalyzer } from './ChromaAnalyzer';

const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export interface ChordEvent {
  time: number;        // relative seconds from phrase start
  endTime: number;
  chord: {
    root: string;      // "B♭"
    type: 'major' | 'minor' | 'dim';
    display: string;   // "B♭m", "G♭", "Edim"
  };
}

// Base chord templates (root = C, pitch class 0)
// Each is a 12-bin binary vector indicating chord tones
const CHORD_TEMPLATES = {
  major: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],  // root, M3, P5
  minor: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],  // root, m3, P5
  dim:   [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],  // root, m3, dim5
};

interface ChordTemplate {
  root: number;        // pitch class 0-11
  rootName: string;
  type: 'major' | 'minor' | 'dim';
  vector: Float32Array;
  display: string;
}

/** Rotate a 12-bin template by `semitones` to transpose it to a new root. */
function rotateTemplate(template: number[], semitones: number): Float32Array {
  const rotated = new Float32Array(12);
  for (let i = 0; i < 12; i++) {
    rotated[(i + semitones) % 12] = template[i];
  }
  return rotated;
}

/** Build diatonic chord templates for a given key. */
function buildDiatonicTemplates(keyRoot: number, mode: 'major' | 'minor'): ChordTemplate[] {
  const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
  const minorIntervals = [0, 2, 3, 5, 7, 8, 10]; // natural minor

  // Chord quality pattern for each scale degree
  const majorQualities: ('major' | 'minor' | 'dim')[] =
    ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
  const minorQualities: ('major' | 'minor' | 'dim')[] =
    ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'];

  const intervals = mode === 'major' ? majorIntervals : minorIntervals;
  const qualities = mode === 'major' ? majorQualities : minorQualities;

  const templates: ChordTemplate[] = [];

  for (let degree = 0; degree < 7; degree++) {
    const root = (keyRoot + intervals[degree]) % 12;
    const quality = qualities[degree];
    const suffix = quality === 'major' ? '' : quality === 'minor' ? 'm' : 'dim';

    templates.push({
      root,
      rootName: KEY_NAMES[root],
      type: quality,
      vector: rotateTemplate(CHORD_TEMPLATES[quality], root),
      display: `${KEY_NAMES[root]}${suffix}`,
    });
  }

  return templates;
}

export class ChordMapper {
  /**
   * Map a chord progression for a single key candidate.
   * Returns a deduplicated, timestamped ChordEvent[] timeline.
   */
  static mapProgression(
    notes: TimestampedNote[],
    candidate: KeyCandidate
  ): ChordEvent[] {
    if (notes.length === 0) return [];

    const keyRoot = KEY_NAMES.indexOf(candidate.key);
    if (keyRoot === -1) return [];

    const templates = buildDiatonicTemplates(keyRoot, candidate.mode);

    // Compute phrase duration
    const phraseDuration =
      notes[notes.length - 1].relativeTime - notes[0].relativeTime;
    if (phraseDuration <= 0) return [];

    // Window segmentation: target ~8 windows, minimum 1.0s each
    const targetWindows = 8;
    const windowSize = Math.max(phraseDuration / targetWindows, 1.0);
    const numWindows = Math.max(1, Math.floor(phraseDuration / windowSize));

    const rawChords: ChordEvent[] = [];

    for (let w = 0; w < numWindows; w++) {
      const startTime = w * windowSize;
      const endTime = Math.min((w + 1) * windowSize, phraseDuration);

      // Build mini-chroma for this window
      const windowChroma = ChromaAnalyzer.buildWindowChroma(notes, startTime, endTime);

      // Score against all diatonic chord templates
      let bestScore = -1;
      let bestTemplate = templates[0];

      for (const template of templates) {
        const score = ChromaAnalyzer.cosineSimilarity(windowChroma, template.vector);
        if (score > bestScore) {
          bestScore = score;
          bestTemplate = template;
        }
      }

      rawChords.push({
        time: startTime,
        endTime,
        chord: {
          root: bestTemplate.rootName,
          type: bestTemplate.type,
          display: bestTemplate.display,
        },
      });
    }

    // Deduplicate: merge consecutive identical chords
    return ChordMapper.deduplicateTimeline(rawChords);
  }

  /**
   * Compute chord-tone coverage ratio for blended confidence scoring.
   * Returns the fraction of melody notes that fall on root, 3rd, or 5th
   * of their assigned chord.
   */
  static computeChordToneRatio(
    notes: TimestampedNote[],
    timeline: ChordEvent[]
  ): number {
    if (notes.length === 0 || timeline.length === 0) return 0;

    let hits = 0;

    for (const note of notes) {
      // Find active chord at this note's time
      const activeChord = timeline
        .filter((e) => e.time <= note.relativeTime)
        .pop();

      if (!activeChord) continue;

      const chordRoot = KEY_NAMES.indexOf(activeChord.chord.root);
      if (chordRoot === -1) continue;

      const interval = (note.pitchClass - chordRoot + 12) % 12;

      // Check if note falls on root (0), minor 3rd (3), major 3rd (4),
      // diminished 5th (6), or perfect 5th (7)
      const chordTones: number[] =
        activeChord.chord.type === 'major' ? [0, 4, 7] :
        activeChord.chord.type === 'minor' ? [0, 3, 7] :
        [0, 3, 6]; // dim

      if (chordTones.includes(interval)) {
        hits++;
      }
    }

    return hits / notes.length;
  }

  /** Merge consecutive identical chords into single entries with extended duration. */
  private static deduplicateTimeline(events: ChordEvent[]): ChordEvent[] {
    if (events.length === 0) return [];

    const deduped: ChordEvent[] = [{ ...events[0] }];

    for (let i = 1; i < events.length; i++) {
      const prev = deduped[deduped.length - 1];
      if (events[i].chord.display === prev.chord.display) {
        // Extend previous chord's duration
        prev.endTime = events[i].endTime;
      } else {
        deduped.push({ ...events[i] });
      }
    }

    return deduped;
  }
}
