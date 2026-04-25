"use client";

import { useAudioStore } from "@/stores/useAudioStore";

export default function LatencyMonitor() {
  const { latency, isActive } = useAudioStore();

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02] backdrop-blur-md">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#22c55e] animate-pulse flex-shrink-0" />
      {/* Label so users know what this number means */}
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25 flex-shrink-0">
        Latency
      </span>
      <span className="text-[11px] font-mono font-semibold text-white/55 flex-shrink-0">
        {latency.total}ms
      </span>
    </div>
  );
}
