"use client";

interface ModeSelectScreenProps {
  onSelectMode: (mode: "algorithm" | "manual") => void;
}

export default function ModeSelectScreen({ onSelectMode }: ModeSelectScreenProps) {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.4em", color: "var(--muted)", marginBottom: 16 }}>
        SELECT WORKFLOW
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 100, fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "var(--white)", marginBottom: 48 }}>
        How would you like to work?
      </div>

      <div className="mode-cards">
        {/* Auto Detect Card */}
        <div className="mode-card" onClick={() => onSelectMode("algorithm")}>
          <div style={{ width: 48, height: 48, marginBottom: 24 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <defs><linearGradient id="vGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#06B6D4"/></linearGradient></defs>
              <path d="M24 6 C16 6, 10 12, 10 20 L10 28 C10 36, 16 42, 24 42 C32 42, 38 36, 38 28 L38 20 C38 12, 32 6, 24 6 Z" stroke="url(#vGrad)" strokeWidth="1.5" fill="none"/>
              <path d="M16 24 C16 27.3, 19.6 30, 24 30 C28.4 30, 32 27.3, 32 24" stroke="url(#vGrad)" strokeWidth="1.5" fill="none"/>
              <line x1="24" y1="42" x2="24" y2="46" stroke="url(#vGrad)" strokeWidth="1.5"/>
              <line x1="18" y1="46" x2="30" y2="46" stroke="url(#vGrad)" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="card-title">Auto Detect</div>
          <div className="card-desc">
            Sing any phrase. VoxChord analyses your melody, detects the key, and generates chord progressions that fit — in under a second.
          </div>
          <div className="card-tags">
            <span className="card-tag">YIN ALGORITHM</span>
            <span className="card-tag">KEY PROFILES</span>
            <span className="card-tag">DIATONIC ENGINE</span>
          </div>
        </div>

        {/* I Have Chords Card */}
        <div className="mode-card" onClick={() => onSelectMode("manual")}>
          <div style={{ width: 48, height: 48, marginBottom: 24 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <defs><linearGradient id="vGrad2" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#06B6D4"/></linearGradient></defs>
              <line x1="10" y1="8" x2="10" y2="40" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.5"/>
              <line x1="18" y1="8" x2="18" y2="40" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.5"/>
              <line x1="26" y1="8" x2="26" y2="40" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.5"/>
              <line x1="34" y1="8" x2="34" y2="40" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.5"/>
              <line x1="42" y1="8" x2="42" y2="40" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.5"/>
              <line x1="2" y1="8" x2="2" y2="40" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.5"/>
              <line x1="2" y1="8" x2="42" y2="8" stroke="url(#vGrad2)" strokeWidth="2.5"/>
              <line x1="2" y1="18" x2="42" y2="18" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.4"/>
              <line x1="2" y1="28" x2="42" y2="28" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.4"/>
              <line x1="2" y1="38" x2="42" y2="38" stroke="url(#vGrad2)" strokeWidth="1" opacity="0.4"/>
              <circle cx="2" cy="23" r="4" fill="#8B5CF6"/>
              <circle cx="26" cy="18" r="4" fill="#8B5CF6"/>
              <circle cx="34" cy="23" r="4" fill="#8B5CF6"/>
            </svg>
          </div>
          <div className="card-title">I Have Chords</div>
          <div className="card-desc">
            Paste your chord progression. Sing the melody. VoxChord transposes everything to match your voice and times the chords to your performance.
          </div>
          <div className="card-tags">
            <span className="card-tag">CHORD PARSER</span>
            <span className="card-tag">TRANSPOSITION</span>
            <span className="card-tag">TAP TIMING</span>
          </div>
        </div>
      </div>
    </div>
  );
}
