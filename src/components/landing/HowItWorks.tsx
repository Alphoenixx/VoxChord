"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function IconMic({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
function IconZap({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function IconWave({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconLayers({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  );
}
function IconMonitor({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────
type Step = {
  Icon: React.ComponentType<{ className?: string; color: string }>;
  label: string;
  desc: string;
  color: string;
};

const pipeline: Step[] = [
  { Icon: IconMic,     label: "Capture", desc: "Raw PCM via getUserMedia",   color: "#8B5CF6" },
  { Icon: IconZap,     label: "Worklet", desc: "Audio thread processing",    color: "#A78BFA" },
  { Icon: IconWave,    label: "YIN",     desc: "Pitch period estimation",    color: "#06B6D4" },
  { Icon: IconLayers,  label: "Chords",  desc: "Diatonic table lookup",      color: "#22D3EE" },
  { Icon: IconMonitor, label: "Display", desc: "60 fps HUD paint",           color: "#F59E0B" },
];

// Icon circle size in px (must match the w/h classes below)
const ICON_SIZE = 64; // w-16 h-16

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const heading    = containerRef.current.querySelector(".section-heading");
    const nodes      = containerRef.current.querySelectorAll(".pipeline-node");
    const connectors = containerRef.current.querySelectorAll(".pipeline-connector");
    const card       = containerRef.current.querySelector(".latency-card");

    gsap.fromTo(heading,
      { y: 48, opacity: 0, filter: "blur(12px)" },
      { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.2, ease: "power3.out",
        scrollTrigger: { trigger: heading, start: "top 88%" } }
    );
    nodes.forEach((n, i) =>
      gsap.fromTo(n,
        { y: 36, opacity: 0, scale: 0.85 },
        { y: 0, opacity: 1, scale: 1, duration: 0.9, delay: i * 0.13, ease: "back.out(1.4)",
          scrollTrigger: { trigger: containerRef.current, start: "top 76%" } }
      )
    );
    connectors.forEach((c, i) =>
      gsap.fromTo(c,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.5, delay: i * 0.13 + 0.28, ease: "power2.out",
          scrollTrigger: { trigger: containerRef.current, start: "top 76%" } }
      )
    );
    if (card)
      gsap.fromTo(card,
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.0, ease: "power3.out",
          scrollTrigger: { trigger: card, start: "top 92%" } }
      );
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto px-6 md:px-10 text-center">

      {/* Section heading */}
      <div className="section-heading text-center mb-20">
        <p className="text-[10px] font-mono uppercase tracking-[0.6em] text-white/20 mb-5">
          Pipeline
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-[0.01em] leading-[1.15] text-gradient">
          From Voice to Chord
        </h2>
        {/* Wider max-w prevents awkward mid-phrase line break */}
        <p className="mt-5 text-sm text-white/30 max-w-xl mx-auto leading-[1.9] tracking-wide">
          Five stages. Under 30 ms end-to-end. Zero main-thread blocking.
        </p>
      </div>

      {/*
        ── Pipeline row ────────────────────────────────────────────────────────
        Strategy: one outer flex row, nodes are evenly spaced via justify-between.
        Connectors are absolutely positioned so they can never be "orphaned" —
        they live BETWEEN siblings, spanning from the right edge of circle N
        to the left edge of circle N+1.
      */}
      <div className="relative flex items-start justify-between">
        {/* Absolute connector layer — drawn under the nodes */}
        {pipeline.map((step, i) => {
          if (i === pipeline.length - 1) return null; // no connector after last node
          return (
            <div
              key={`connector-${i}`}
              className="pipeline-connector absolute h-px top-8 origin-left pointer-events-none"
              style={{
                // Position: start at center of node i, end at center of node i+1
                // Each node occupies (100 / N)% of the row. Center of node i = (i + 0.5) / N * 100%
                // We offset by half the icon size to start/end at circle edges.
                left:  `calc(${(i + 0.5) / pipeline.length * 100}% + ${ICON_SIZE / 2}px)`,
                right: `calc(${(pipeline.length - i - 1.5) / pipeline.length * 100}% + ${ICON_SIZE / 2}px)`,
                background: `linear-gradient(90deg, ${step.color}55, ${pipeline[i + 1].color}55)`,
                boxShadow: `0 0 6px ${step.color}22`,
              }}
            />
          );
        })}

        {/* Node columns */}
        {pipeline.map(({ Icon, label, desc, color }, i) => (
          <div
            key={i}
            className="pipeline-node relative flex flex-col items-center text-center"
            style={{ width: `${100 / pipeline.length}%` }}
          >
            {/* Icon circle — w-16 h-16 = 64px matches ICON_SIZE */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center bg-white/[0.03] border border-white/[0.07]
                         transition-all duration-500 hover:scale-110 hover:border-white/[0.14]"
              style={{ boxShadow: `0 0 24px ${color}20, inset 0 0 16px ${color}08` }}
            >
              <Icon className="w-7 h-7" color={color} />
            </div>

            <h4 className="font-display font-semibold text-sm mt-5 tracking-[0.03em] text-white/85">
              {label}
            </h4>
            {/* Wider max-w so single-word descs don't stack */}
            <p className="text-[11px] font-mono text-white/25 mt-2 leading-[1.65] tracking-wide px-2">
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Latency card — full pipeline width, content spaced evenly */}
      <div className="latency-card mt-16 w-full glass-card-strong border-glow">
        <div className="flex items-center justify-evenly w-full p-10">
          <div className="text-center">
            <span className="font-mono text-4xl font-extrabold tracking-[0.02em] text-gradient">~30ms</span>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/25 mt-3">Typical</p>
          </div>
          <div className="w-px h-12 bg-white/[0.08]" />
          <div className="text-center">
            <span className="font-mono text-4xl font-extrabold tracking-[0.02em] text-gradient-warm">~50ms</span>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/25 mt-3">Worst case</p>
          </div>
        </div>
      </div>

    </div>
  );
}
