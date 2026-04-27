/**
 * NoteBuffer — Phase 1
 * 
 * Accumulates timestamped pitch observations during a phrase recording.
 * Only stable, voiced notes pass the gate. On stop, the buffer is sliced
 * to the capture window and all timestamps are normalized to phrase-relative time.
 */

const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export interface TimestampedNote {
  note: string;           // "C", "D♭", etc. (flat-biased enharmonic)
  frequency: number;      // Hz
  midi: number;
  pitchClass: number;     // 0-11
  timestamp: number;      // AudioContext.currentTime (seconds, absolute)
  cents: number;
  relativeTime: number;   // normalized: phrase start = 0.0s
}

export class NoteBuffer {
  private buffer: TimestampedNote[] = [];
  private phraseStartTime: number = 0;
  private phraseEndTime: number = 0;
  private _recording: boolean = false;

  /** Begin accumulating notes. Call with current AudioContext.currentTime. */
  startCapture(ctxTime: number): void {
    this.buffer = [];
    this.phraseStartTime = ctxTime;
    this.phraseEndTime = 0;
    this._recording = true;
  }

  /** Stop accumulating. Returns the validated, time-normalized note array. */
  stopCapture(ctxTime: number): TimestampedNote[] {
    this._recording = false;
    this.phraseEndTime = ctxTime;

    // Slice to capture window (safety — should already be bounded)
    const sliced = this.buffer.filter(
      (n) => n.timestamp >= this.phraseStartTime && n.timestamp <= this.phraseEndTime
    );

    // Normalize timestamps relative to phrase start
    const normalized = sliced.map((n) => ({
      ...n,
      relativeTime: n.timestamp - this.phraseStartTime,
    }));

    return normalized;
  }

  /** Push a new observation. Only call when the note is stable & voiced. */
  push(pitchData: {
    pitch: number;
    midi: number;
    pitchClass: number;
    cents: number;
  }, ctxTime: number): void {
    if (!this._recording) return;
    if (pitchData.pitchClass < 0 || pitchData.pitchClass > 11) return;

    this.buffer.push({
      note: NOTE_NAMES[pitchData.pitchClass],
      frequency: pitchData.pitch,
      midi: pitchData.midi,
      pitchClass: pitchData.pitchClass,
      timestamp: ctxTime,
      cents: pitchData.cents,
      relativeTime: 0, // will be normalized on stopCapture
    });
  }

  /**
   * Validate a phrase's note array before processing.
   * Requirements:
   *  - Duration ≥ 1 second
   *  - ≥ 3 distinct pitch classes
   */
  static validate(notes: TimestampedNote[]): { valid: boolean; reason?: string } {
    if (notes.length === 0) {
      return { valid: false, reason: "No notes detected. Try singing louder." };
    }

    const duration = notes[notes.length - 1].relativeTime - notes[0].relativeTime;
    if (duration < 1.0) {
      return { valid: false, reason: "Phrase too short. Sing for at least 1 second." };
    }

    const distinctPitches = new Set(notes.map((n) => n.pitchClass));
    if (distinctPitches.size < 3) {
      return { valid: false, reason: "Too few distinct notes. Try a more melodic phrase." };
    }

    return { valid: true };
  }

  isRecording(): boolean {
    return this._recording;
  }

  /** Duration of the current/last capture in seconds */
  getDuration(): number {
    if (this._recording && this.buffer.length > 0) {
      return this.buffer[this.buffer.length - 1].timestamp - this.phraseStartTime;
    }
    return this.phraseEndTime - this.phraseStartTime;
  }

  reset(): void {
    this.buffer = [];
    this.phraseStartTime = 0;
    this.phraseEndTime = 0;
    this._recording = false;
  }
}
