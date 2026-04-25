"use client";

import React from 'react';

interface ModeSelectorProps {
  onSelectAlgorithm: () => void;
  onSelectManual: () => void;
  onEndSession: () => void;
  detectedKeyName?: string;
  detectedKeyMode?: string;
}

export default function ModeSelector({
  onSelectAlgorithm,
  onSelectManual,
  onEndSession,
  detectedKeyName = "C",
  detectedKeyMode = "major",
}: ModeSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto py-10 z-50 pointer-events-auto">
      
      <div className="flex items-center justify-between w-full mb-12 px-8">
        <div /> {/* Spacer to keep End Session button on the right */}
        <button
          onClick={onEndSession}
          className="px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.15em]
                     text-white/40 hover:text-red-400 border border-white/[0.06] bg-white/[0.02]"
        >
          End Session
        </button>
      </div>

      <p className="text-sm font-mono tracking-[0.1em] text-white/50 mb-10 text-center max-w-lg leading-relaxed">
        Choose how you want to build your chord progression:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* Algorithm Card */}
        <button
          onClick={onSelectAlgorithm}
          className="group relative flex flex-col items-start p-8 rounded-3xl border border-white/[0.08] bg-[#0a0a0f]/60 backdrop-blur-md transition-all hover:bg-white/[0.03] hover:border-violet-500/30 text-left overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-6">
            <span className="text-2xl">🎤</span>
          </div>
          
          <h3 className="font-display text-2xl font-bold tracking-wide text-white mb-3">
            Auto Detect
          </h3>
          
          <p className="font-mono text-xs text-white/50 leading-relaxed tracking-wide mb-8">
            Sing a melody and VoxChord will figure out the chords automatically.
          </p>

          <div className="mt-auto flex items-center gap-2 text-[10px] font-mono tracking-widest text-violet-300/70 uppercase">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Works best with clear melodies
          </div>
        </button>

        {/* Manual Card */}
        <button
          onClick={onSelectManual}
          className="group relative flex flex-col items-start p-8 rounded-3xl border border-white/[0.08] bg-[#0a0a0f]/60 backdrop-blur-md transition-all hover:bg-white/[0.03] hover:border-cyan-500/30 text-left overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mb-6">
            <span className="text-2xl">🎸</span>
          </div>
          
          <h3 className="font-display text-2xl font-bold tracking-wide text-white mb-3">
            I Have Chords
          </h3>
          
          <p className="font-mono text-xs text-white/50 leading-relaxed tracking-wide mb-8">
            Paste chords from the internet and VoxChord will transpose them to your voice.
          </p>

          <div className="mt-auto flex items-center gap-2 text-[10px] font-mono tracking-widest text-cyan-300/70 uppercase">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Always accurate
          </div>
        </button>
      </div>
    </div>
  );
}
