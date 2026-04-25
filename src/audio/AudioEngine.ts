import { AudioLatencyInfo } from '../stores/useAudioStore';

export interface PitchData {
  pitch: number;
  midi: number;
  pitchClass: number;
  cents: number;
  rms: number;
  voiced: boolean;
  stable: boolean;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  async init(onPitchData: (data: PitchData) => void): Promise<AudioLatencyInfo> {
    if (this.ctx) {
      await this.stop();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0,
          sampleRate: 44100
        }
      });

      this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 44100 });
      
      // Load the worklet
      await this.ctx.audioWorklet.addModule('/worklets/pitch-worklet.js');

      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.ctx, 'pitch-worklet');

      this.workletNode.port.onmessage = (event) => {
        onPitchData(event.data);
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.ctx.destination); // Required for processing to happen

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
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

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
