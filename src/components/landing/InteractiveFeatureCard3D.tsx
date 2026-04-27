"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { createParticleBurst } from "@/utils/cinematicEffects";

interface InteractiveFeatureCard3DProps {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  desc: string;
  stat: string;
  statLabel: string;
  accent: string;
  index: number;
}

export default function InteractiveFeatureCard3D({
  Icon,
  title,
  desc,
  stat,
  statLabel,
  accent,
  index,
}: InteractiveFeatureCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const statRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Mouse move 3D tilt effect
    const handleMouseMove = (e: MouseEvent) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * 5;
      const rotateY = ((centerX - x) / centerX) * 5;

      gsap.to(card, {
        rotationX: rotateX,
        rotationY: rotateY,
        transformPerspective: 1000,
        duration: 0.5,
        ease: "power2.out",
      });
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        rotationX: 0,
        rotationY: 0,
        duration: 0.6,
        ease: "power3.out",
      });
    };

    const handleMouseEnter = () => {
      if (iconRef.current) {
        gsap.to(iconRef.current, {
          scale: 1.15,
          duration: 0.4,
          ease: "back.out(1.5)",
        });

        createParticleBurst(
          cardRef.current!.getBoundingClientRect().left + cardRef.current!.getBoundingClientRect().width / 2,
          cardRef.current!.getBoundingClientRect().top + 80,
          8,
          accent
        );
      }

      // Animate stat number
      if (statRef.current) {
        const statValue = parseInt(stat.match(/\d+/)?.[0] || "0");
        const obj = { value: 0 };
        gsap.to(obj, {
          value: statValue,
          duration: 0.8,
          onUpdate: () => {
            if (statRef.current) {
              statRef.current.textContent = Math.round(obj.value).toString();
            }
          },
          ease: "power2.out",
        });
      }
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
    card.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
      card.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [accent, stat]);

  // Initial animation on load
  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 40, opacity: 0, rotationX: 20 },
        {
          y: 0,
          opacity: 1,
          rotationX: 0,
          duration: 0.9,
          delay: index * 0.15,
          ease: "back.out(1.3)",
          scrollTrigger: {
            trigger: cardRef.current,
            start: "top 92%",
          },
        }
      );
    }
  }, [index]);

  return (
    <div
      ref={cardRef}
      className="feature-card group glass-card-strong flex flex-col transition-all duration-500 relative"
      style={{
        minWidth: 0,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Gradient border glow on hover */}
      <div
        className="absolute inset-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${accent}40, transparent 40%, transparent 60%, ${accent}40)`,
          boxShadow: `0 0 40px ${accent}30, inset 0 0 20px ${accent}10`,
        }}
      />

      <div className="flex flex-col flex-1 p-8 text-center items-center relative z-10">
        {/* Icon */}
        <div
          ref={iconRef}
          className="w-12 h-12 mb-7 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500"
          style={{
            background: `${accent}14`,
            border: `1.5px solid ${accent}35`,
            boxShadow: `0 0 32px ${accent}25, inset 0 0 16px ${accent}08`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>

        {/* Title with letter reveal effect */}
        <h3
          ref={titleRef}
          className="font-display text-[15px] font-semibold tracking-[0.02em] text-white/90 mb-3 leading-snug"
        >
          {title}
        </h3>

        {/* Description */}
        <p className="text-[13px] text-white/30 leading-[1.85] flex-1">{desc}</p>

        {/* Stat section with glow */}
        <div
          className="mt-8 pt-6 border-t border-white/[0.06] w-full flex flex-col items-center gap-1"
          style={{
            textShadow: `0 0 16px ${accent}40`,
          }}
        >
          <span
            className="font-mono text-2xl font-bold transition-all duration-500"
            style={{ color: accent }}
          >
            <span ref={statRef}>{stat.replace(/\D/g, "").substring(0, 2)}</span>
            {stat.replace(/^\d+/, "")}
          </span>
          <span className="text-[11px] font-mono text-white/25 tracking-[0.1em]">
            {statLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
