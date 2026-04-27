import { create } from 'zustand';

interface ScrollState {
  progress: number;        // 0-1 overall
  activeSection: number;   // index of current section
  isInSession: boolean;
  
  setProgress: (section: number, progress: number) => void;
  setIsInSession: (inSession: boolean) => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  progress: 0,
  activeSection: 0,
  isInSession: false,

  setProgress: (section, progress) => set({ activeSection: section, progress }),
  setIsInSession: (inSession) => set({ isInSession: inSession }),
}));
