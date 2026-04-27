/**
 * ChordParser
 * 
 * Parses messy text input (e.g. "Cm, F#m, Bb, Eb/G") into structured chord objects.
 * Normalizes all roots to the project's flat-preferred enharmonic convention.
 */

const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// Map sharp notation to our flat-only standard
const ENHARMONIC_MAP: Record<string, string> = {
  "C#": "D♭",
  "D#": "E♭",
  "F#": "G♭",
  "G#": "A♭",
  "A#": "B♭",
  // Ensure lowercase variants match
  "C♯": "D♭",
  "D♯": "E♭",
  "F♯": "G♭",
  "G♯": "A♭",
  "A♯": "B♭",
};

export interface ParsedChord {
  root: string;          // "C", "D♭", "G♭"
  suffix: string;        // "m", "dim", "maj7", "sus2", "7", ""
  bass: string | null;   // "E" in "C/E" (normalized)
  type: 'major' | 'minor' | 'dim' | 'aug' | 'other';
  display: string;       // "B♭m7", "C/E"
  pitchClass: number;    // 0-11
}

export class ChordParser {
  /**
   * Parse a string of chords into structured objects.
   * Splits on spaces, commas, dashes, pipes, arrows.
   */
  static parse(input: string): ParsedChord[] {
    if (!input || input.trim() === '') return [];

    // Split on common separators
    const tokens = input.split(/[\s,\-|→]+/).filter(Boolean);
    const chords: ParsedChord[] = [];

    for (const token of tokens) {
      const parsed = this.parseSingle(token);
      if (parsed) {
        chords.push(parsed);
      }
    }

    return chords;
  }

  /**
   * Parse a single chord string.
   */
  static parseSingle(token: string): ParsedChord | null {
    // Basic regex to grab root + accidental, and the rest
    // e.g., "C#m7" -> [1]="C", [2]="#", [3]="m7"
    // Handle slash chords later
    
    // Split slash first if present
    const slashParts = token.split('/');
    const mainPart = slashParts[0];
    const bassPart = slashParts.length > 1 ? slashParts[1] : null;

    const match = mainPart.match(/^([A-Ga-g])([#♯b♭]?)(.*)$/);
    if (!match) return null;

    let rootLetter = match[1].toUpperCase();
    const accidental = match[2].replace('b', '♭').replace('#', '♯');
    let suffix = match[3] || "";

    // Normalize root
    let root = `${rootLetter}${accidental}`;
    if (ENHARMONIC_MAP[root]) {
      root = ENHARMONIC_MAP[root];
    }

    const pitchClass = KEY_NAMES.indexOf(root);
    if (pitchClass === -1) return null;

    // Normalize bass if present
    let bass = null;
    if (bassPart) {
      const bassMatch = bassPart.match(/^([A-Ga-g])([#♯b♭]?)$/);
      if (bassMatch) {
        const bLetter = bassMatch[1].toUpperCase();
        const bAcc = bassMatch[2].replace('b', '♭').replace('#', '♯');
        bass = `${bLetter}${bAcc}`;
        if (ENHARMONIC_MAP[bass]) {
          bass = ENHARMONIC_MAP[bass];
        }
      } else {
        // Just append raw if we can't parse it
        bass = bassPart;
      }
    }

    // Determine type from suffix
    let type: ParsedChord['type'] = 'major';
    if (suffix === '' || suffix === 'M' || suffix === 'maj' || suffix === 'M7' || suffix === 'maj7') {
      type = 'major';
    } else if (suffix.startsWith('m') && !suffix.startsWith('maj')) {
      type = 'minor';
    } else if (suffix.startsWith('dim') || suffix.startsWith('°')) {
      type = 'dim';
    } else if (suffix.startsWith('aug') || suffix.startsWith('+')) {
      type = 'aug';
    } else {
      type = 'other';
    }

    // Special case for 'm' vs 'M'
    if (match[3] === 'M') { type = 'major'; }
    if (match[3] === 'm') { type = 'minor'; }

    let display = `${root}${suffix}`;
    if (bass) {
      display += `/${bass}`;
    }

    return {
      root,
      suffix,
      bass,
      type,
      display,
      pitchClass
    };
  }

  /**
   * Transpose a single parsed chord by a semitone offset.
   */
  static transposeChord(chord: ParsedChord, semitones: number): ParsedChord {
    if (semitones === 0) return chord;

    const newRootIndex = ((chord.pitchClass + semitones) % 12 + 12) % 12;
    const newRoot = KEY_NAMES[newRootIndex];

    let newBass = chord.bass;
    if (chord.bass) {
      const bassIdx = KEY_NAMES.indexOf(chord.bass);
      if (bassIdx !== -1) {
        newBass = KEY_NAMES[((bassIdx + semitones) % 12 + 12) % 12];
      }
    }

    let newDisplay = `${newRoot}${chord.suffix}`;
    if (newBass) {
      newDisplay += `/${newBass}`;
    }

    return {
      ...chord,
      root: newRoot,
      pitchClass: newRootIndex,
      bass: newBass,
      display: newDisplay
    };
  }

  /**
   * Transpose an array of parsed chords.
   */
  static transposeAll(chords: ParsedChord[], semitones: number): ParsedChord[] {
    return chords.map(c => this.transposeChord(c, semitones));
  }
}
