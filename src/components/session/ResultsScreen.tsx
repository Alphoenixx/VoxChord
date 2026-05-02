"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phrase, usePhraseStore } from "@/stores/usePhraseStore";
import { PlaybackEngine } from "@/audio/PlaybackEngine";
import { ShimmerResolver, SHIMMER_FADEOUT_MS, SHIMMER_GAP_MS, SHIMMER_OFFSET_S } from "@/audio/ShimmerResolver";
import GuitarChord from "./GuitarChord";

/* ── CLAUDE.md Motion Constants ── */
const ENTRANCE = [0.16, 1, 0.3, 1]   as const;
const OSMO     = [0.625, 0.05, 0, 1] as const;

interface ResultsScreenProps {
  phrase: Phrase;
  audioContext: AudioContext;
  onResing: () => void;
}

export default function ResultsScreen({ phrase, audioContext, onResing }: ResultsScreenProps) {
  const { selectCandidate } = usePhraseStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [activeChordIdx, setActiveChordIdx] = useState(0);
  const [voiceVol, setVoiceVol] = useState(1.0);
  const [chordVol, setChordVol] = useState(0.7);

  const playbackRef = useRef<PlaybackEngine | null>(null);
  const rafRef = useRef<number>(0);
  const masterLimiterRef = useRef<DynamicsCompressorNode | null>(null);
  const voiceGainRef = useRef<GainNode | null>(null);
  const chordGainRef = useRef<GainNode | null>(null);
  const shimmerBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeShimmerRef = useRef<AudioBufferSourceNode | null>(null);
  const shimmerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const candidate = phrase.candidates[phrase.selectedCandidate];
  const timeline = candidate?.chordTimeline ?? [];
  const duration = phrase.duration || 1;
  const activeChord = timeline[activeChordIdx];
  const nextChord = timeline[activeChordIdx + 1];

  /* ── Preload shimmer audio files ── */
  useEffect(() => {
    const unique = new Set(timeline.map(t => t.chord.display));
    const loadAll = async () => {
      for (const chordName of unique) {
        const parsed = { root: "", suffix: "", bass: null, type: "major" as const, display: chordName, pitchClass: 0 };
        // Re-derive type from display for shimmer resolution
        const isMinor = chordName.endsWith("m") && !chordName.endsWith("dim") && !chordName.endsWith("maj");
        const rootMatch = chordName.match(/^([A-G][♭♯b#]?)/);
        if (!rootMatch) continue;
        const root = rootMatch[1];
        const resolvedParsed = { ...parsed, root, type: (isMinor ? "minor" : "major") as any };
        const url = ShimmerResolver.resolve(resolvedParsed);
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            const audioBuf = await audioContext.decodeAudioData(arrayBuf);
            shimmerBuffersRef.current.set(chordName, audioBuf);
          }
        } catch (e) {
          console.warn(`Failed to load shimmer: ${url}`, e);
        }
      }
    };
    loadAll();
  }, [timeline, audioContext]);

  /* ── Gain nodes for independent volume ── */
  useEffect(() => {
    // Master Limiter to prevent distortion/clipping
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -1.0; // Start compressing at -1dB
    limiter.knee.value = 40;
    limiter.ratio.value = 12;
    limiter.attack.value = 0;
    limiter.release.value = 0.25;
    limiter.connect(audioContext.destination);
    masterLimiterRef.current = limiter;

    const vGain = audioContext.createGain();
    vGain.gain.value = voiceVol;
    vGain.connect(limiter);
    voiceGainRef.current = vGain;

    const cGain = audioContext.createGain();
    cGain.gain.value = chordVol;
    cGain.connect(limiter);
    chordGainRef.current = cGain;

    return () => { 
      vGain.disconnect(); 
      cGain.disconnect(); 
      limiter.disconnect();
    };
  }, [audioContext]);

  useEffect(() => {
    if (voiceGainRef.current) voiceGainRef.current.gain.value = voiceVol;
  }, [voiceVol]);
  useEffect(() => {
    if (chordGainRef.current) chordGainRef.current.gain.value = chordVol;
  }, [chordVol]);

  /* ── Shimmer trigger on chord change ── */
  const triggerShimmer = useCallback((chordDisplay: string, chordDuration: number) => {
    if (!chordGainRef.current) return;
    const buffer = shimmerBuffersRef.current.get(chordDisplay);
    if (!buffer) return;

    // Clear any pending shimmer starts
    if (shimmerTimeoutRef.current) {
      clearTimeout(shimmerTimeoutRef.current);
    }

    // Fade out previous shimmer
    if (activeShimmerRef.current) {
      try {
        const prev = activeShimmerRef.current;
        const fadeGain = audioContext.createGain();
        fadeGain.gain.setValueAtTime(1, audioContext.currentTime);
        fadeGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + SHIMMER_FADEOUT_MS / 1000);
        
        prev.disconnect();
        prev.connect(fadeGain).connect(chordGainRef.current!);
        
        setTimeout(() => { 
          try { prev.stop(); prev.disconnect(); } catch {} 
        }, SHIMMER_FADEOUT_MS);
      } catch {}
      activeShimmerRef.current = null;
    }

    // Schedule new shimmer after gap
    shimmerTimeoutRef.current = setTimeout(() => {
      if (!chordGainRef.current) return;
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(chordGainRef.current);
      
      // Calculate duration to prevent overlapping into next chord
      const playDur = Math.max(0.3, chordDuration - (SHIMMER_FADEOUT_MS + SHIMMER_GAP_MS) / 1000);
      
      try {
        source.start(audioContext.currentTime, SHIMMER_OFFSET_S, playDur);
        activeShimmerRef.current = source;
      } catch (e) {
        console.error("Failed to start shimmer source", e);
      }
    }, SHIMMER_GAP_MS);
  }, [audioContext]);

  /* ── Playback engine ── */
  useEffect(() => {
    playbackRef.current = new PlaybackEngine(audioContext, (event) => {
      if (event.type === "chordChange") {
        setActiveChordIdx(event.index);
        const chordEvt = timeline[event.index];
        if (chordEvt) {
          triggerShimmer(chordEvt.chord.display, chordEvt.endTime - chordEvt.time);
        }
      } else if (event.type === "ended") {
        setIsPlaying(false);
        setPlaybackPos(0);
        setActiveChordIdx(0);
      }
    });
    return () => { playbackRef.current?.stop(); };
  }, [audioContext, timeline, triggerShimmer]);

  const startLoop = useCallback(() => {
    const tick = () => {
      if (!playbackRef.current) return;
      setPlaybackPos(Math.min(playbackRef.current.getElapsed() / duration, 1));
      if (playbackRef.current.isPlaying()) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [duration]);

  const togglePlay = useCallback(() => {
    if (!playbackRef.current || !phrase.audioBuffer) return;
    if (isPlaying) {
      playbackRef.current.stop();
      try { activeShimmerRef.current?.stop(); } catch {}
      cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
    } else {
      playbackRef.current.play(phrase.audioBuffer, timeline, playbackPos * duration);
      setIsPlaying(true);
      startLoop();
    }
  }, [isPlaying, playbackPos, duration, timeline, phrase.audioBuffer, startLoop]);

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = pos * duration;

    // 1. Update UI state immediately for responsiveness
    setPlaybackPos(pos);
    
    // 2. Find and update active chord immediately so display doesn't jump
    let activeIdx = 0;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].time <= seekTime) {
        activeIdx = i;
        break;
      }
    }
    setActiveChordIdx(activeIdx);

    // 3. Update audio engine
    if (playbackRef.current && isPlaying) {
      cancelAnimationFrame(rafRef.current);
      playbackRef.current.seek(seekTime);
      startLoop();
    }
  }, [isPlaying, duration, timeline, startLoop]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  /* ════════════════════════════════════════
     RENDER — Cinematic Karaoke Playback
     ════════════════════════════════════════ */
  return (
    <div style={{
      width: "100%", height: "calc(100vh - 48px)",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background Layer 0 — living atmosphere */}
      <div className="sync-atmosphere" />

      {/* ── Top Bar ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "24px 32px 0", zIndex: 2, flexShrink: 0,
      }}>
        <div className="phase-overline">Playback</div>
        {/* Candidate selector */}
        {phrase.source === "algorithm" && phrase.candidates.length > 1 && (
          <div style={{ display: "flex", gap: 8 }}>
            {phrase.candidates.map((c, i) => (
              <button key={i} onClick={() => { selectCandidate(i); setActiveChordIdx(0); }}
                className={phrase.selectedCandidate === i ? "mode-pill active" : "mode-pill"}
                style={{ padding: "6px 14px", fontSize: 9 }}
              >
                {c.key} {c.mode}
              </button>
            ))}
          </div>
        )}
        <button onClick={onResing} className="results-restart-btn" title="Restart">↺</button>
      </div>

      {/* ── Karaoke Core ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        zIndex: 1, padding: "0 32px", gap: 32, position: "relative",
      }}>
        {/* Active chord — massive typography */}
        <div style={{ position: "relative", width: "100%", maxWidth: 800, textAlign: "center", minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AnimatePresence mode="popLayout">
            <motion.div key={activeChordIdx}
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -8 }}
              transition={{ duration: 0.5, ease: ENTRANCE }}
              style={{ position: "absolute" }}
            >
              <div className="karaoke-chord">
                {activeChord?.chord?.display ?? "—"}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Next chord whisper */}
          {nextChord && (
            <motion.div
              key={`next-${activeChordIdx}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="karaoke-next"
            >
              <div className="karaoke-next-chord">{nextChord.chord.display}</div>
              <div className="karaoke-next-label">NEXT</div>
            </motion.div>
          )}
        </div>

        {/* Guitar chord diagram */}
        <GuitarChord chord={activeChord?.chord?.display ?? "—"} size={100} />

        {/* ── Scrub bar with chord markers ── */}
        <div style={{ width: "100%", maxWidth: 640 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="sync-time-total">{fmt(playbackPos * duration)}</span>
            <span className="sync-time-total">{fmt(duration)}</span>
          </div>
          <div className="results-scrub-track" onClick={handleScrub}>
            {/* Chord markers */}
            {timeline.map((evt, i) => (
              <div key={i} className="sync-marker" style={{
                left: `${(evt.time / duration) * 100}%`,
                opacity: i === activeChordIdx ? 1 : 0.3,
              }}>
                <div className="sync-marker-line" />
              </div>
            ))}
            <div className="results-scrub-fill" style={{ width: `${playbackPos * 100}%` }} />
          </div>
        </div>

        {/* ── Chord timeline pills ── */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, maxWidth: 640, width: "100%" }}>
          {timeline.map((evt, i) => {
            const state = i < activeChordIdx ? "past" : i === activeChordIdx ? "active-chord" : "upcoming";
            return (
              <div key={i} className={`results-timeline-pill ${state}`}
                onClick={() => { setPlaybackPos(evt.time / duration); setActiveChordIdx(i); }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: state === "active-chord" ? "var(--white)" : "var(--muted)" }}>
                  {evt.chord.display}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                  {(evt.endTime - evt.time).toFixed(1)}s
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Control Deck ── */}
      <div className="control-deck" style={{ zIndex: 2, flexShrink: 0 }}>
        {/* Play controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="results-restart-btn" onClick={() => {
            if (playbackRef.current && isPlaying) { playbackRef.current.stop(); }
            setPlaybackPos(0); setActiveChordIdx(0); setIsPlaying(false);
          }} title="Restart">↺</button>

          <button
            className={`results-play-btn ${isPlaying ? "is-playing" : ""}`}
            onClick={togglePlay} title="Play/Pause"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        </div>

        {/* Volume mixer */}
        <div style={{ display: "flex", gap: 32 }}>
          <div className="mixer-slider violet">
            <div className="mixer-slider-label">
              <span className="mixer-slider-name">Voice</span>
              <span className="mixer-slider-value">{Math.round(voiceVol * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={voiceVol}
              onChange={e => setVoiceVol(Number(e.target.value))} />
          </div>
          <div className="mixer-slider cyan">
            <div className="mixer-slider-label">
              <span className="mixer-slider-name">Chords</span>
              <span className="mixer-slider-value">{Math.round(chordVol * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={chordVol}
              onChange={e => setChordVol(Number(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  );
}
