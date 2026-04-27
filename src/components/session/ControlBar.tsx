"use client";

/**
 * ControlBar — Simplified
 *
 * Record toggle button.
 * States: IDLE → RECORDING → ANALYZING
 */

import { motion } from "framer-motion";
import { usePhraseStore } from "@/stores/usePhraseStore";

interface ControlBarProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordingDuration: number; // seconds
}

export default function ControlBar({
  onStartRecording,
  onStopRecording,
  recordingDuration,
}: ControlBarProps) {
  const { recordingState } = usePhraseStore();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full mt-4">
      <div className="flex items-center gap-4">
        {recordingState === "idle" && (
          <motion.button
            onClick={onStartRecording}
            className="flex items-center gap-3 px-10 py-4 rounded-full font-display font-semibold text-lg tracking-[0.04em]
                       bg-gradient-to-r from-violet-600/90 via-purple-500/90 to-cyan-500/90
                       text-white transition-all duration-300 hover:scale-[1.03]
                       shadow-[0_0_40px_rgba(139,92,246,0.4)]
                       hover:shadow-[0_0_60px_rgba(139,92,246,0.6)]
                       border border-white/[0.12]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-red-400 shadow-[0_0_12px_#f87171]" />
            TAP TO SING
          </motion.button>
        )}

        {recordingState === "recording" && (
          <motion.button
            onClick={onStopRecording}
            className="flex items-center gap-3 px-10 py-4 rounded-full font-display font-semibold text-lg tracking-[0.04em]
                       bg-red-500/20 text-red-300 border border-red-500/40
                       transition-all duration-300 hover:bg-red-500/30
                       shadow-[0_0_30px_rgba(239,68,68,0.2)]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.span
              className="w-3.5 h-3.5 rounded-sm bg-red-400"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            STOP · {formatTime(recordingDuration)}
          </motion.button>
        )}

        {recordingState === "analyzing" && (
          <motion.div
            className="flex items-center gap-3 px-10 py-4 rounded-full font-display font-semibold text-lg tracking-[0.04em]
                       bg-white/[0.04] text-white/50 border border-white/[0.08]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.span
              className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            Analyzing…
          </motion.div>
        )}
      </div>
    </div>
  );
}
