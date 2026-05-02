/**
 * AudioRecorder — Phase 2
 *
 * Records raw audio from the microphone stream in parallel with the
 * pitch-detection AudioWorklet. On stop, converts the Blob into an
 * AudioBuffer that can be replayed, seeked, and looped.
 */

export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext;
  private _recording: boolean = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /** Begin recording from the given microphone stream. */
  startRecording(stream: MediaStream): void {
    this.chunks = [];
    this._recording = true;

    // Use webm/opus if available, fallback to whatever the browser supports
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    this.recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
    });

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    // Do not use a timeslice (e.g. 250ms). On some devices, chunking the MediaRecorder 
    // stream introduces micro-stutters and cuts in the final decoded AudioBuffer.
    // Recording in one continuous chunk is much smoother.
    this.recorder.start();
  }

  /** Stop recording and return a decoded AudioBuffer. */
  async stopRecording(): Promise<AudioBuffer> {
    this._recording = false;

    return new Promise<AudioBuffer>((resolve, reject) => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        reject(new Error('Recorder is not active'));
        return;
      }

      this.recorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          resolve(audioBuffer);
        } catch (err) {
          reject(err);
        }
      };

      this.recorder.stop();
    });
  }

  isRecording(): boolean {
    return this._recording;
  }

  reset(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.recorder = null;
    this.chunks = [];
    this._recording = false;
  }
}
