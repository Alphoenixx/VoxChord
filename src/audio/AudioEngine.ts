import { AudioLatencyInfo, AudioEvent, useAudioStore } from '../stores/useAudioStore';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  async init(onAudioEvent: (event: AudioEvent) => void): Promise<AudioLatencyInfo> {
    if (this.ctx) {
      await this.stop();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 44100 });
      useAudioStore.getState().setAudioContext(this.ctx);
      
      // Load the worklet
      await this.ctx.audioWorklet.addModule('/worklets/pitch-worklet.js');

      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.ctx, 'pitch-worklet');

      this.workletNode.port.onmessage = (event) => {
        onAudioEvent(event.data);
      };

      this.source.connect(this.workletNode);
      
      // Connect to a muted gain node instead of destination directly
      // This prevents the microphone from creating a feedback loop while still forcing the browser to process the worklet.
      const dummyGain = this.ctx.createGain();
      dummyGain.gain.value = 0;
      this.workletNode.connect(dummyGain);
      dummyGain.connect(this.ctx.destination);

      return this.getLatency();
    } catch (err) {
      console.error("Failed to initialize audio engine", err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
      useAudioStore.getState().setAudioContext(null);
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  /** Expose the AudioContext for NoteBuffer timestamps and AudioRecorder decoding */
  getContext(): AudioContext | null { return this.ctx; }

  /** Expose the raw mic stream for AudioRecorder */
  getStream(): MediaStream | null { return this.stream; }

  getLatency(): AudioLatencyInfo {
    if (!this.ctx) return { base: 0, output: 0, total: 0 };
    
    // Convert to milliseconds
    const base = (this.ctx.baseLatency || 0) * 1000;
    const output = (this.ctx.outputLatency || 0) * 1000;
    
    return {
      base: Math.round(base),
      output: Math.round(output),
      total: Math.round(base + output)
    };
  }
}
