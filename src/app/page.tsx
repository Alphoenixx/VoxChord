"use client";

import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Link from "next/link";
import { useScrollStore } from "@/stores/useScrollStore";

import HeroScene from "@/components/landing/HeroScene";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorks from "@/components/landing/HowItWorks";

gsap.registerPlugin(ScrollTrigger);

function MenuIcon() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="0" y1="1" x2="18" y2="1" />
      <line x1="0" y1="6" x2="18" y2="6" />
      <line x1="0" y1="11" x2="18" y2="11" />
    </svg>
  );
}

export default function LandingPage() {
  const setProgress  = useScrollStore(s => s.setProgress);
  const heroRef      = useRef<HTMLDivElement>(null);
  const subtitleRef  = useRef<HTMLParagraphElement>(null);
  const ctaRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    const tl = gsap.timeline({ delay: 0.3 });
    tl.fromTo("#hero-title",
      { y: 60, opacity: 0, filter: "blur(20px)" },
      { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.4, ease: "power3.out" }
    ).fromTo(subtitleRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
      "-=0.8"
    ).fromTo(ctaRef.current,
      { y: 20, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.4)" },
      "-=0.5"
    );

    ScrollTrigger.create({
      trigger: "#hero",
      start: "top top",
      end: "50% top",
      onUpdate: (self) => {
        setProgress(0, self.progress);
        if (heroRef.current) {
          heroRef.current.style.opacity = `${1 - self.progress * 2}`;
          heroRef.current.style.transform = `translateY(${self.progress * -80}px) scale(${1 - self.progress * 0.1})`;
        }
      },
    });

    [["#features", 1], ["#how-it-works", 2], ["#cta", 3]].forEach(([id, i]) => {
      ScrollTrigger.create({
        trigger: id as string,
        start: "top 80%",
        end: "bottom 20%",
        onUpdate: (self) => setProgress(i as number, self.progress),
      });
    });

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [setProgress]);

  return (
    <div className="relative bg-[#050508] text-white overflow-hidden">

      {/* ── Sticky Nav ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-8 py-4
                         border-b border-white/[0.04] bg-[#050508]/80 backdrop-blur-md">
        <Link href="/" className="font-display font-semibold text-base tracking-[0.02em] text-gradient">
          VoxChord
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {/* Consistent casing — sentence case, no uppercase class */}
          <a href="#features"
             className="text-[12px] font-mono text-white/35 hover:text-white/65 transition-colors tracking-[0.06em]">
            Architecture
          </a>
          <a href="#how-it-works"
             className="text-[12px] font-mono text-white/35 hover:text-white/65 transition-colors tracking-[0.06em]">
            Pipeline
          </a>
          <Link href="/session"
            className="px-5 py-2 rounded-full font-display font-semibold text-sm tracking-[0.04em]
                       bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500
                       hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(139,92,246,0.3)]">
            Launch
          </Link>
        </nav>
        <button className="md:hidden text-white/40 hover:text-white/70 transition-colors">
          <MenuIcon />
        </button>
      </header>

      {/* ── Fixed 3D Canvas ── */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
          <HeroScene />
          <EffectComposer>
            <Bloom intensity={1.2} luminanceThreshold={0.5} luminanceSmoothing={0.9} mipmapBlur />
            <ChromaticAberration offset={[0.0005, 0.0005] as any} blendFunction={BlendFunction.NORMAL} />
            <Vignette eskil={false} offset={0.35} darkness={1.2} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* ── Scroll Content ── */}
      <main className="relative z-10">

        {/* ━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section id="hero" className="relative h-[115vh]">
          <div
            ref={heroRef}
            className="sticky top-0 h-screen w-full flex flex-col items-center justify-center text-center px-6 pt-20"
          >
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 40%, #050508 85%)" }} />

            <p className="relative z-10 text-[10px] font-mono uppercase tracking-[0.6em] text-white/20 mb-8">
              Real-time Harmony Engine
            </p>
            <h1 id="hero-title"
              className="relative z-10 font-display text-[clamp(4.5rem,13vw,11rem)] font-extrabold leading-[1.0] tracking-[0.01em] text-gradient text-glow">
              VoxChord
            </h1>
            <p ref={subtitleRef}
              className="relative z-10 mt-8 text-[clamp(0.75rem,1.8vw,1.1rem)] font-mono tracking-[0.55em] uppercase text-white/25">
              Sing · Detect · Harmonize
            </p>

            <div ref={ctaRef} className="relative z-10 mt-16 flex flex-col items-center gap-6">
              <Link href="/session"
                className="px-16 py-6 rounded-full font-display font-semibold text-2xl tracking-[0.04em]
                           bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500 text-white
                           shadow-[0_0_60px_rgba(139,92,246,0.45)] transition-all duration-400
                           hover:scale-[1.04] hover:shadow-[0_0_90px_rgba(139,92,246,0.65)]">
                Start Session
              </Link>
              <span className="flex items-center gap-3 text-[10px] font-mono text-white/20 tracking-[0.18em]">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80] animate-pulse" />
                &lt; 30ms real-time pitch detection
              </span>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 opacity-30">
              <span className="text-[9px] font-mono uppercase tracking-[0.5em]">Scroll</span>
              <svg className="animate-bounce w-4 h-4 text-white/60" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 6l5 5 5-5" />
              </svg>
            </div>
          </div>
        </section>

        {/* ━━━━ FEATURES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* 
          Explicit top padding accounts for nav bar (64px) + section breathing room.
          The bg covers to remove the hero 3D bleeding through.
        */}
        <section id="features"
          className="relative w-full bg-[#050508] flex flex-col items-center scroll-mt-24"
          style={{ paddingTop: "80px", paddingBottom: "48px" }}>
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#050508] pointer-events-none" />
          <FeaturesSection />
        </section>

        {/* ━━━━ SECTION DIVIDER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="relative z-10 w-full bg-[#050508]">
          <div className="max-w-5xl mx-auto px-10">
            <div className="border-t border-white/[0.05]" />
          </div>
        </div>

        {/* ━━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section id="how-it-works"
          className="relative w-full bg-[#050508] flex flex-col items-center"
          style={{ paddingTop: "48px", paddingBottom: "48px" }}>
          <HowItWorks />
        </section>

        {/* ━━━━ SECTION DIVIDER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="relative z-10 w-full bg-[#050508]">
          <div className="max-w-5xl mx-auto px-10">
            <div className="border-t border-white/[0.05]" />
          </div>
        </div>

        {/* ━━━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section id="cta" className="relative w-full bg-[#050508] flex flex-col items-center"
          style={{ paddingTop: "48px", paddingBottom: "80px" }}>
          {/* Ambient glow behind card */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />

          <div className="relative w-full max-w-lg px-6 text-center">
            <div className="glass-card-strong border-glow shadow-[0_0_80px_rgba(139,92,246,0.1)] p-16 pb-16">
              <p className="text-[10px] font-mono uppercase tracking-[0.55em] text-white/20 mb-6">
                Get Started
              </p>
              <h2 className="font-display text-4xl font-extrabold tracking-[0.01em] leading-[1.2] text-gradient mb-6">
                Ready to find your chords?
              </h2>
              <p className="text-white/35 mb-10 text-sm leading-[1.9] tracking-wide text-center max-w-[360px] mx-auto">
                Zero-latency pitch detection and harmony suggestions — all running locally in your browser.
              </p>
              <Link href="/session"
                className="inline-block px-14 py-5 rounded-full font-display font-semibold text-lg tracking-[0.04em]
                           bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500 text-white
                           shadow-[0_0_50px_rgba(139,92,246,0.4)] transition-all duration-400
                           hover:scale-[1.04] hover:shadow-[0_0_80px_rgba(139,92,246,0.6)]">
                Launch Live Session
              </Link>
            </div>
          </div>
        </section>

        {/* ━━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <footer className="relative w-full bg-[#050508] border-t border-white/[0.05]
                           py-10 text-center text-white/25 text-[11px] font-mono tracking-[0.3em] uppercase">
          VoxChord · AudioWorklet + YIN · Built for musicians
        </footer>

      </main>
    </div>
  );
}
