import { ChordSuggestion } from '../stores/useChordStore';

// [24 keys][12 pitch classes] -> Suggestions
type ChordTable = ChordSuggestion[][][];

export class ChordEngine {
  private table: ChordTable;
  private static KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

  constructor() {
    this.table = this.precompute();
  }

  // Returns array of suggestions for a given key and pitch class
  suggest(keyName: string, mode: 'major' | 'minor', pitchClass: number): ChordSuggestion[] {
    if (pitchClass < 0 || pitchClass > 11) return [];
    
    let keyIndex = ChordEngine.KEY_NAMES.indexOf(keyName);
    if (keyIndex === -1) return [];
    
    // Offset for minor keys (12-23)
    if (mode === 'minor') {
      keyIndex += 12;
    }
    
    return this.table[keyIndex][pitchClass] || [];
  }

  private precompute(): ChordTable {
    const table: ChordTable = new Array(24).fill(null).map(() => new Array(12).fill(null).map(() => []));

    // For every root pitch class 0-11
    for (let root = 0; root < 12; root++) {
      // Major Key (index 0-11)
      this.computeDiatonicChords(table, root, 'major', root);
      
      // Minor Key (index 12-23)
      this.computeDiatonicChords(table, root, 'minor', root + 12);
    }

    // Sort all arrays by stability descending
    for (let k = 0; k < 24; k++) {
      for (let p = 0; p < 12; p++) {
        table[k][p].sort((a, b) => b.stability - a.stability);
      }
    }

    return table;
  }

  private computeDiatonicChords(table: ChordTable, keyRoot: number, mode: 'major' | 'minor', keyIndex: number) {
    const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorScaleIntervals = [0, 2, 3, 5, 7, 8, 10]; // Natural minor
    
    const intervals = mode === 'major' ? majorScaleIntervals : minorScaleIntervals;
    const scaleDegrees = intervals.map(i => (keyRoot + i) % 12);

    // I, ii, iii, IV, V, vi, vii° for major
    // i, ii°, III, iv, v, VI, VII for minor
    
    for (let degree = 0; degree < 7; degree++) {
      const rootTone = scaleDegrees[degree];
      const thirdTone = scaleDegrees[(degree + 2) % 7];
      const fifthTone = scaleDegrees[(degree + 4) % 7];
      const seventhTone = scaleDegrees[(degree + 6) % 7];
      const ninthTone = scaleDegrees[(degree + 1) % 7];

      // Determine chord quality (Major, Minor, Diminished)
      let thirdDiff = (thirdTone - rootTone + 12) % 12;
      let fifthDiff = (fifthTone - rootTone + 12) % 12;
      
      let chordSuffix = "";
      if (thirdDiff === 4 && fifthDiff === 7) chordSuffix = ""; // Major
      else if (thirdDiff === 3 && fifthDiff === 7) chordSuffix = "m"; // Minor
      else if (thirdDiff === 3 && fifthDiff === 6) chordSuffix = "dim"; // Diminished
      else if (thirdDiff === 4 && fifthDiff === 8) chordSuffix = "aug"; // Augmented (rare diatonically, harmonic minor maybe)

      const chordName = `${ChordEngine.KEY_NAMES[rootTone]}${chordSuffix}`;

      const addSuggestion = (pc: number, role: string, stability: number) => {
        let resolvesTo: string | undefined;
        // Tension awareness
        if (mode === 'major' && degree === 4 && role === 'root') { // V chord
           if (pc === scaleDegrees[6]) resolvesTo = ChordEngine.KEY_NAMES[keyRoot]; // Leading tone to I
        }
        
        table[keyIndex][pc].push({
          chord: chordName,
          role,
          stability,
          resolvesTo
        });
      };

      addSuggestion(rootTone, "root", 1.0);
      addSuggestion(fifthTone, "5th", 0.85);
      addSuggestion(thirdTone, "3rd", 0.80);
      addSuggestion(seventhTone, "7th", 0.60);
      // addSuggestion(ninthTone, "9th", 0.40); // optional color
    }
  }
}
