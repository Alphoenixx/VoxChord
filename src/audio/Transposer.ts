/**
 * Transposer — Phase 9
 *
 * Tracks the singer's vocal range across all stable notes in a session.
 * Suggests a transposition offset to bring a detected key into the
 * singer's comfortable range, and applies that offset to chord timelines.
 */

import { ChordEvent } from './ChordMapper';
import { ParsedChord } from './ChordParser';

const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export class Transposer {
  private lowestMidi: number = 127;
  private highestMidi: number = 0;

  /** Call for every stable note to update the vocal range bounds. */
  trackNote(midi: number): void {
    if (midi < 0 || midi > 127) return;
    if (midi < this.lowestMidi) this.lowestMidi = midi;
    if (midi > this.highestMidi) this.highestMidi = midi;
  }

  getRange(): { low: number; high: number; center: number } {
    if (this.lowestMidi > this.highestMidi) {
      return { low: 60, high: 72, center: 66 }; // default C4-C5
    }
    return {
      low: this.lowestMidi,
      high: this.highestMidi,
      center: Math.round((this.lowestMidi + this.highestMidi) / 2),
    };
  }

  /**
   * Suggest a transposition offset in semitones.
   * Clamps to [-6, +6] (nearest octave equivalent).
   */
  suggestTransposition(detectedKeyRootPitchClass: number): number {
    const range = this.getRange();
    const vocalCenterPC = range.center % 12;

    let offset = vocalCenterPC - detectedKeyRootPitchClass;

    // Clamp to [-6, +6]
    if (offset > 6) offset -= 12;
    if (offset < -6) offset += 12;

    return offset;
  }

  /**
   * Transpose all chord roots in a timeline by the given semitone offset.
   * Returns a new timeline (does not mutate the original).
   */
  transpose(timeline: ChordEvent[], semitones: number): ChordEvent[] {
    if (semitones === 0) return timeline;

    return timeline.map((event) => {
      const rootIndex = KEY_NAMES.indexOf(event.chord.root);
      if (rootIndex === -1) return event;

      const newRootIndex = ((rootIndex + semitones) % 12 + 12) % 12;
      const newRootName = KEY_NAMES[newRootIndex];
      const suffix =
        event.chord.type === 'major' ? '' :
        event.chord.type === 'minor' ? 'm' : 'dim';

      return {
        ...event,
        chord: {
          root: newRootName,
          type: event.chord.type,
          display: `${newRootName}${suffix}`,
        },
      };
    });
  }

  reset(): void {
    this.lowestMidi = 127;
    this.highestMidi = 0;
  }

  /**
   * Compute semitone offset between two keys.
   * Returns the number of semitones to shift FROM originalKey TO singingKey.
   */
  static computeOffset(
    originalKey: string,
    singingKey: string
  ): number {
    const originalRootPC = KEY_NAMES.indexOf(originalKey);
    const singingRootPC = KEY_NAMES.indexOf(singingKey);

    if (originalRootPC === -1 || singingRootPC === -1) return 0;

    let offset = singingRootPC - originalRootPC;
    if (offset > 6) offset -= 12;
    if (offset < -6) offset += 12;

    return offset;
  }

  /**
   * Convert ParsedChord[] into ChordEvent[] with timestamps.
   * Auto-distributes evenly across the given duration.
   */
  static autoDistribute(
    chords: ParsedChord[],
    totalDuration: number
  ): ChordEvent[] {
    if (!chords || chords.length === 0) return [];
    if (totalDuration <= 0) totalDuration = 1;

    const chordDuration = totalDuration / chords.length;

    return chords.map((c, i) => ({
      time: i * chordDuration,
      endTime: (i + 1) * chordDuration,
      chord: {
        root: c.root,
        type: c.type === 'minor' || c.type === 'dim' ? c.type : 'major', // map complex types down for basic rendering if needed, but display keeps it
        display: c.display
      }
    }));
  }

  /**
   * Convert ParsedChord[] into ChordEvent[] using tap timestamps.
   */
  static applyTapTimestamps(
    chords: ParsedChord[],
    tapTimes: number[],
    totalDuration: number
  ): ChordEvent[] {
    if (!chords || chords.length === 0) return [];

    return chords.map((c, i) => {
      // If we don't have enough taps, auto-distribute remaining time
      let time = 0;
      if (i < tapTimes.length) {
        time = tapTimes[i];
      } else {
        const prevTime = i > 0 && i - 1 < tapTimes.length ? tapTimes[i - 1] : 0;
        const remainingTime = totalDuration - prevTime;
        const remainingChords = chords.length - i;
        time = prevTime + remainingTime / remainingChords;
      }

      let endTime = totalDuration;
      if (i + 1 < tapTimes.length) {
        endTime = tapTimes[i + 1];
      } else if (i + 1 < chords.length) {
        // approximate next end time if missing
        const remainingTime = totalDuration - time;
        const remainingChords = chords.length - i;
        endTime = time + remainingTime / remainingChords;
      }

      return {
        time,
        endTime,
        chord: {
          root: c.root,
          type: c.type === 'minor' || c.type === 'dim' ? c.type : 'major',
          display: c.display
        }
      };
    });
  }
}
