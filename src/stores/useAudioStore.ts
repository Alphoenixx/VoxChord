import { create } from 'zustand';

export interface AudioLatencyInfo {
  base: number;
  output: number;
  total: number;
}

export interface StableNoteEvent {
  type: 'StableNoteEvent';
  midi: number;
  root: string;
  octave: number;
  cents: number;
  frequency: number;
  timestamp: number;
  confidence: number;
}

export interface SilenceEvent {
  type: 'SilenceEvent';
  timestamp: number;
  duration: number;
}

export type AudioEvent = StableNoteEvent | SilenceEvent;

interface AudioState {
  isActive: boolean;
  
  // Note data
  voiced: boolean;
  pitchClass: number; // 0-11
  noteName: string; // root
  cents: number;
  midi: number;
  frequency: number;
  octave: number;
  confidence: number;
  stable: boolean; // Always true if voiced now, kept for UI compatibility
  
  latency: AudioLatencyInfo;
  audioContext: AudioContext | null;
  
  // Actions
  setIsActive: (isActive: boolean) => void;
  handleAudioEvent: (event: AudioEvent) => void;
  setLatency: (latency: AudioLatencyInfo) => void;
  setAudioContext: (ctx: AudioContext | null) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isActive: false,
  voiced: false,
  pitchClass: -1,
  noteName: "-",
  cents: 0,
  midi: -1,
  frequency: 0,
  octave: -1,
  confidence: 0,
  stable: false,
  latency: { base: 0, output: 0, total: 0 },
  audioContext: null,

  setIsActive: (isActive) => set({ isActive }),
  setAudioContext: (ctx) => set({ audioContext: ctx }),
  handleAudioEvent: (event) => set((state) => {
    if (event.type === 'SilenceEvent') {
      if (!state.voiced) return state; // already silent
      return { ...state, voiced: false, stable: false, noteName: "-", pitchClass: -1, cents: 0, midi: -1, frequency: 0, octave: -1, confidence: 0 };
    }

    const pitchClass = ((event.midi % 12) + 12) % 12;

    if (
      state.voiced &&
      state.pitchClass === pitchClass &&
      state.noteName === event.root &&
      state.cents === event.cents &&
      state.midi === event.midi &&
      state.frequency === event.frequency &&
      state.octave === event.octave &&
      state.confidence === event.confidence
    ) {
      return state;
    }

    return {
      ...state,
      voiced: true,
      stable: true,
      pitchClass,
      noteName: event.root,
      cents: event.cents,
      midi: event.midi,
      frequency: event.frequency,
      octave: event.octave,
      confidence: event.confidence
    };
  }),
  setLatency: (latency) => set({ latency }),
}));

if (typeof window !== 'undefined') {
  const resumeCtx = async () => {
    const ctx = useAudioStore.getState().audioContext
    if (ctx?.state === 'suspended') await ctx.resume()
  }

  document.addEventListener('touchstart',        resumeCtx, { passive: true })
  document.addEventListener('touchend',          resumeCtx, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeCtx()
  })
}
