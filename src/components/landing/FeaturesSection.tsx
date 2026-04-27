"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import InteractiveFeatureCard3D from "./InteractiveFeatureCard3D";

gsap.registerPlugin(ScrollTrigger);

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function IconMic({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
function IconKeys({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="20" height="13" rx="2" />
      <line x1="6" y1="8" x2="6" y2="21" />
      <line x1="10" y1="8" x2="10" y2="21" />
      <line x1="14" y1="8" x2="14" y2="21" />
      <line x1="18" y1="8" x2="18" y2="21" />
      <rect x="4" y="3" width="3.5" height="6" rx="1" fill="currentColor" stroke="none" opacity="0.5" />
      <rect x="9.25" y="3" width="3.5" height="6" rx="1" fill="currentColor" stroke="none" opacity="0.5" />
      <rect x="15" y="3" width="3.5" height="6" rx="1" fill="currentColor" stroke="none" opacity="0.5" />
    </svg>
  );
}
function IconCompass({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88 16.24,7.76" />
    </svg>
  );
}

// ─── Feature Data with enhanced colors ─────────────────────────────────────────
const features = [
  {
    Icon: IconMic,
    title: "Real-Time Detection",
    desc: "YIN pitch detection runs inside an AudioWorklet at an 11.6 ms hop rate — faster than human auditory perception can resolve.",
    stat: "11.6ms",
    statLabel: "Hop rate",
    accent: "#9D4EDD",
  },
  {
    Icon: IconKeys,
    title: "Smart Chord Lookup",
    desc: "Pre-computed diatonic tables rank every chord suggestion by root, third, fifth, and seventh voice-leading relationships.",
    stat: "O(1)",
    statLabel: "Lookup",
    accent: "#C77DFF",
  },
  {
    Icon: IconCompass,
    title: "Key Awareness",
    desc: "Krumhansl-Schmuckler profiles weighted with exponential decay across an 8-second rolling window track your key in real time.",
    stat: "24",
    statLabel: "Keys tracked",
    accent: "#00D9FF",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function FeaturesSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const heading = containerRef.current.querySelector(".section-heading");

    gsap.fromTo(
      heading,
      { y: 48, opacity: 0, filter: "blur(12px)" },
      { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.2, ease: "power3.out",
        scrollTrigger: { trigger: heading, start: "top 88%" } }
    );
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto px-6 md:px-10 text-center">

      {/* Section heading */}
      <div className="section-heading text-center mb-16">
        <p className="text-[10px] font-mono uppercase tracking-[0.6em] text-white/20 mb-5">
          Architecture
        </p>
        <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-[0.01em] leading-[1.15] text-gradient">
          Unprecedented Accuracy
        </h2>
        <p className="mt-5 text-sm text-white/30 max-w-xl mx-auto leading-[1.9] tracking-wide">
          Zero main-thread blocking — every computation runs on the dedicated audio thread.
        </p>
      </div>

      {/* Cards — 3-column with 3D interactive effects */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map(({ Icon, title, desc, stat, statLabel, accent }, i) => (
          <InteractiveFeatureCard3D
            key={i}
            Icon={Icon}
            title={title}
            desc={desc}
            stat={stat}
            statLabel={statLabel}
            accent={accent}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
