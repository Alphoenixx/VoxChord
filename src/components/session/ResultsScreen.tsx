"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Phrase, usePhraseStore } from "@/stores/usePhraseStore";
import { PlaybackEngine } from "@/audio/PlaybackEngine";
import GuitarChord from "./GuitarChord";

interface ResultsScreenProps {
  phrase: Phrase;
  audioContext: AudioContext;
  onResing: () => void;
}

export default function ResultsScreen({ phrase, audioContext, onResing }: ResultsScreenProps) {
  const { selectCandidate } = usePhraseStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [activeChordIdx, setActiveChordIdx] = useState(0);
  const playbackRef = useRef<PlaybackEngine | null>(null);
  const rafRef = useRef<number>(0);

  const candidate = phrase.candidates[phrase.selectedCandidate];
  const timeline = candidate?.chordTimeline ?? [];
  const duration = phrase.duration || 1;
  const activeChord = timeline[activeChordIdx];

  // Init playback engine with event handler
  useEffect(() => {
    playbackRef.current = new PlaybackEngine(audioContext, (event) => {
      if (event.type === "chordChange") {
        setActiveChordIdx(event.index);
        setPlaybackPos(event.progress);
      } else if (event.type === "ended") {
        setIsPlaying(false);
        setPlaybackPos(0);
        setActiveChordIdx(0);
      }
    });
    return () => { playbackRef.current?.stop(); };
  }, [audioContext]);

  // RAF loop for smooth scrub bar updates during playback
  const startPlaybackLoop = useCallback(() => {
    const tick = () => {
      if (!playbackRef.current) return;
      const elapsed = playbackRef.current.getElapsed();
      const progress = Math.min(elapsed / duration, 1);
      setPlaybackPos(progress);

      if (playbackRef.current.isPlaying()) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [duration]);

  const togglePlay = useCallback(() => {
    if (!playbackRef.current || !phrase.audioBuffer) return;
    if (isPlaying) {
      playbackRef.current.stop();
      cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
    } else {
      const offset = playbackPos * duration;
      playbackRef.current.play(phrase.audioBuffer, timeline, offset);
      setIsPlaying(true);
      startPlaybackLoop();
    }
  }, [isPlaying, playbackPos, duration, timeline, phrase.audioBuffer, startPlaybackLoop]);

  const toggleLoop = useCallback(() => {
    setLoopEnabled((v) => !v);
  }, []);

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setPlaybackPos(pos);
    if (playbackRef.current && isPlaying) {
      playbackRef.current.seek(pos * duration);
      startPlaybackLoop();
    }
  }, [isPlaying, duration, startPlaybackLoop]);

  const handleSelectCandidate = useCallback((idx: number) => {
    selectCandidate(idx);
    setActiveChordIdx(0);
  }, [selectCandidate]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const chordName = activeChord?.chord?.display ?? timeline[0]?.chord?.display ?? "—";

  return (
    <div style={{ maxWidth: 800, width: "100%", margin: "0 auto", padding: "40px 24px" }}>
      {/* Candidate Selector */}
      {phrase.source === "algorithm" && phrase.candidates.length > 1 && (
        <div className="candidate-row">
          {phrase.candidates.map((c, i) => (
            <div
              key={i}
              className={`candidate-card ${phrase.selectedCandidate === i ? "selected" : ""}`}
              onClick={() => handleSelectCandidate(i)}
            >
              <div style={{ fontFamily: "'Space Grotesk'", fontSize: 14, color: "var(--white)", fontWeight: 400 }}>
                {c.key} {c.mode}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "var(--muted)", marginTop: 2 }}>
                INTERPRETATION {i + 1}
              </div>
              {phrase.selectedCandidate === i && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(124,58,237,0.8)", marginTop: 4 }}>
                  Selected
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Phrase Card Top */}
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start", marginBottom: 32 }}>
        {/* Guitar Chord Display */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="result-chord-name">{chordName}</div>
          <GuitarChord chord={chordName} />
        </div>

        {/* Scrub + Controls */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Scrub Bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)" }}>
                {formatTime(playbackPos * duration)}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)" }}>
                {formatTime(duration)}
              </span>
            </div>
            <div className="scrub-bar-track" onClick={handleScrub} style={{ cursor: "pointer" }}>
              <div className="scrub-fill" style={{ width: `${playbackPos * 100}%` }} />
            </div>
          </div>

          {/* Playback Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <button className={`ctrl-btn ${loopEnabled ? "active" : ""}`} onClick={toggleLoop} title="Loop">↺</button>
            <button
              className={`ctrl-btn play-btn ${isPlaying ? "playing" : ""}`}
              onClick={togglePlay}
              title="Play/Pause"
              style={{ width: 60, height: 60, fontSize: 20, background: "var(--glass-strong)", borderColor: "rgba(255,255,255,0.12)", color: "var(--white)" }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button className="ctrl-btn" onClick={onResing} title="Re-Sing" style={{ fontSize: 14 }}>🎤</button>
          </div>
        </div>
      </div>

      {/* Chord Timeline */}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "var(--muted)", marginBottom: 12 }}>
        CHORD TIMELINE
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
        {timeline.map((evt, i) => {
          const state = i < activeChordIdx ? "past" : i === activeChordIdx ? "active-chord" : "upcoming";
          return (
            <div
              key={i}
              className={`timeline-pill ${state}`}
              onClick={() => {
                const pos = evt.time / duration;
                setPlaybackPos(pos);
                setActiveChordIdx(i);
              }}
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
  );
}
