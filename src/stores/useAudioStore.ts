import { create } from 'zustand';

export interface AudioLatencyInfo {
  base: number;
  output: number;
  total: number;
}

interface AudioState {
  isActive: boolean;
  pitch: number;           // Hz, -1 if unvoiced
  midi: number;
  pitchClass: number;      // 0-11
  noteName: string;        // "C", "C#", etc.
  cents: number;           // ±50
  rms: number;
  voiced: boolean;
  stable: boolean;
  latency: AudioLatencyInfo;
  
  // Actions
  setIsActive: (isActive: boolean) => void;
  setAudioData: (data: Partial<AudioState>) => void;
  setLatency: (latency: AudioLatencyInfo) => void;
}

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const useAudioStore = create<AudioState>((set) => ({
  isActive: false,
  pitch: -1,
  midi: -1,
  pitchClass: -1,
  noteName: "-",
  cents: 0,
  rms: 0,
  voiced: false,
  stable: false,
  latency: { base: 0, output: 0, total: 0 },

  setIsActive: (isActive) => set({ isActive }),
  setAudioData: (data) => set((state) => {
    let extra = {};
    if (data.pitchClass !== undefined && data.pitchClass >= 0) {
      extra = { noteName: noteNames[data.pitchClass] };
    } else if (data.pitchClass === -1) {
      extra = { noteName: "-" };
    }
    return { ...state, ...data, ...extra };
  }),
  setLatency: (latency) => set({ latency }),
}));
