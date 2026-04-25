/**
 * usePhraseStore — Phase 5
 *
 * Central Zustand store holding all captured phrases with section labels,
 * audio buffers, note data, and 3 ranked chord progression candidates.
 */

import { create } from 'zustand';
import { TimestampedNote } from '../audio/NoteBuffer';
import { ChordEvent } from '../audio/ChordMapper';
import { ParsedChord } from '../audio/ChordParser';

export interface PhraseCandidate {
  key: string;
  mode: 'major' | 'minor';
  probability: number;        // 0-100
  chordTimeline: ChordEvent[];
}

export interface Phrase {
  id: string;
  duration: number;              // seconds
  capturedAt: number;            // Date.now()
  notes: TimestampedNote[];
  audioBuffer: AudioBuffer | null;
  candidates: PhraseCandidate[];  // always 3, ranked by blendedProbability
  selectedCandidate: number;      // 0, 1, or 2
  source?: 'algorithm' | 'manual';
}

interface PhraseState {
  currentSession: Phrase | null;
  recordingState: 'idle' | 'recording' | 'analyzing';

  // Manual mode data
  manualInput: string;
  parsedChords: ParsedChord[];
  detectedOriginalKey: { key: string; mode: 'major' | 'minor' } | null;
  originalKeyOverride: { key: string; mode: 'major' | 'minor' } | null;
  transposedChords: ParsedChord[];
  tapTimestamps: number[];
  timingMode: 'auto' | 'tap';
  tempManualData: { 
    notes: TimestampedNote[], 
    audioBuffer: AudioBuffer | null, 
    duration: number, 
    singingKey: { key: string; mode: 'major' | 'minor' } 
  } | null;

  // Actions
  setRecordingState: (s: 'idle' | 'recording' | 'analyzing') => void;
  setSession: (p: Phrase) => void;
  selectCandidate: (index: number) => void;
  clearSession: () => void;
  clearRecordingData: () => void; // keeps manual input intact

  setManualInput: (input: string) => void;
  setParsedChords: (chords: ParsedChord[]) => void;
  setDetectedOriginalKey: (key: { key: string; mode: 'major' | 'minor' } | null) => void;
  setOriginalKeyOverride: (key: { key: string; mode: 'major' | 'minor' } | null) => void;
  setTransposedChords: (chords: ParsedChord[]) => void;
  addTapTimestamp: (time: number) => void;
  resetTapTimestamps: () => void;
  setTimingMode: (mode: 'auto' | 'tap') => void;
  setTempManualData: (data: any) => void;
}

export const usePhraseStore = create<PhraseState>((set) => ({
  currentSession: null,
  recordingState: 'idle',

  manualInput: '',
  parsedChords: [],
  detectedOriginalKey: null,
  originalKeyOverride: null,
  transposedChords: [],
  tapTimestamps: [],
  timingMode: 'auto',
  tempManualData: null,

  setRecordingState: (recordingState) => set({ recordingState }),

  setSession: (p) => set({ currentSession: p }),

  selectCandidate: (index) =>
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, selectedCandidate: index }
        : null,
    })),

  clearSession: () => set({
    currentSession: null,
    manualInput: '',
    parsedChords: [],
    detectedOriginalKey: null,
    originalKeyOverride: null,
    transposedChords: [],
    tapTimestamps: [],
    timingMode: 'auto',
    tempManualData: null,
  }),

  clearRecordingData: () => set({
    currentSession: null,
    tapTimestamps: [],
    tempManualData: null,
  }),

  setManualInput: (input) => set({ manualInput: input }),
  setParsedChords: (chords) => set({ parsedChords: chords }),
  setDetectedOriginalKey: (key) => set({ detectedOriginalKey: key }),
  setOriginalKeyOverride: (key) => set({ originalKeyOverride: key }),
  setTransposedChords: (chords) => set({ transposedChords: chords }),
  addTapTimestamp: (time) => set((state) => ({ tapTimestamps: [...state.tapTimestamps, time] })),
  resetTapTimestamps: () => set({ tapTimestamps: [] }),
  setTimingMode: (mode) => set({ timingMode: mode }),
  setTempManualData: (data) => set({ tempManualData: data }),
}));
