import { create } from 'zustand';

export interface ChordSuggestion {
  chord: string;        // e.g. "Am", "F", "C"
  role: string;         // "root" | "third" | "fifth" | "seventh" | "ninth"
  stability: number;    // 0.0 - 1.0
  resolvesTo?: string;  // e.g. "C" if leading tone
}

export interface DetectedKey {
  key: string;
  mode: 'major' | 'minor';
  confidence: number;
}

interface ChordState {
  detectedKey: DetectedKey | null;
  manualKeyOverride: string | null;
  suggestions: ChordSuggestion[];
  history: { chord: string; timestamp: number }[];
  
  // Actions
  setDetectedKey: (key: DetectedKey | null) => void;
  overrideKey: (key: string | null) => void;
  setSuggestions: (suggestions: ChordSuggestion[]) => void;
  addToHistory: (chord: string) => void;
}

export const useChordStore = create<ChordState>((set) => ({
  detectedKey: null,
  manualKeyOverride: null,
  suggestions: [],
  history: [],

  setDetectedKey: (key) => set({ detectedKey: key }),
  overrideKey: (key) => set({ manualKeyOverride: key }),
  setSuggestions: (suggestions) => set({ suggestions }),
  addToHistory: (chord) => set((state) => {
    // avoid consecutive duplicates
    if (state.history.length > 0 && state.history[state.history.length - 1].chord === chord) {
      return state;
    }
    const newHistory = [...state.history, { chord, timestamp: Date.now() }];
    if (newHistory.length > 12) {
      newHistory.shift();
    }
    return { history: newHistory };
  }),
}));
