/**
 * PlaybackEngine — Phase 7
 *
 * Drives frame-accurate chord highlight animation during audio playback.
 * Uses requestAnimationFrame to track elapsed time and fires events
 * when the active chord changes. Supports play, stop, seek, and loop.
 */

import { ChordEvent } from './ChordMapper';

export type PlaybackEvent =
  | { type: 'chordChange'; chord: ChordEvent; index: number; progress: number }
  | { type: 'ended' }
  | { type: 'scrub'; position: number };

export class PlaybackEngine {
  private sourceNode: AudioBufferSourceNode | null = null;
  private ctx: AudioContext;
  private startedAt: number = 0;
  private offset: number = 0;
  private timeline: ChordEvent[] = [];
  private animFrameId: number = 0;
  private onEvent: (e: PlaybackEvent) => void;
  private lastChordIndex: number = -1;
  private _looping: boolean = false;
  private _playing: boolean = false;
  private buffer: AudioBuffer | null = null;

  constructor(ctx: AudioContext, onEvent: (e: PlaybackEvent) => void) {
    this.ctx = ctx;
    this.onEvent = onEvent;
  }

  play(buffer: AudioBuffer, timeline: ChordEvent[], fromOffset: number = 0): void {
    this.stop(); // clean up any existing playback

    this.buffer = buffer;
    this.timeline = timeline;
    this.offset = fromOffset;
    this.lastChordIndex = -1;
    this._playing = true;

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.loop = this._looping;
    this.sourceNode.connect(this.ctx.destination);

    this.sourceNode.onended = () => {
      if (this._playing && !this._looping) {
        this._playing = false;
        this.onEvent({ type: 'ended' });
        cancelAnimationFrame(this.animFrameId);
      }
    };

    this.startedAt = this.ctx.currentTime;
    this.sourceNode.start(0, fromOffset);

    // Begin animation tick
    this.tick();
  }

  stop(): void {
    this._playing = false;
    cancelAnimationFrame(this.animFrameId);

    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Already stopped
      }
      this.sourceNode = null;
    }
  }

  seek(position: number): void {
    if (!this.buffer) return;
    const clampedPos = Math.max(0, Math.min(position, this.buffer.duration));
    this.onEvent({ type: 'scrub', position: clampedPos });
    this.play(this.buffer, this.timeline, clampedPos);
  }

  toggleLoop(): boolean {
    this._looping = !this._looping;
    if (this.sourceNode) {
      this.sourceNode.loop = this._looping;
    }
    return this._looping;
  }

  getElapsed(): number {
    if (!this._playing) return this.offset;
    return this.ctx.currentTime - this.startedAt + this.offset;
  }

  isPlaying(): boolean {
    return this._playing;
  }

  isLooping(): boolean {
    return this._looping;
  }

  private tick = (): void => {
    if (!this._playing) return;

    const elapsed = this.getElapsed();

    // Find the active chord: last chord whose start time <= elapsed
    let activeIndex = -1;
    for (let i = this.timeline.length - 1; i >= 0; i--) {
      if (this.timeline[i].time <= elapsed) {
        activeIndex = i;
        break;
      }
    }

    // Fire event if chord changed
    if (activeIndex !== this.lastChordIndex && activeIndex >= 0) {
      this.lastChordIndex = activeIndex;
      const chord = this.timeline[activeIndex];
      const chordDuration = chord.endTime - chord.time;
      const progress = chordDuration > 0
        ? Math.min((elapsed - chord.time) / chordDuration, 1)
        : 0;

      this.onEvent({
        type: 'chordChange',
        chord,
        index: activeIndex,
        progress,
      });
    }

    this.animFrameId = requestAnimationFrame(this.tick);
  };
}
