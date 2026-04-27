"use client";

interface MicOffScreenProps {
  onStart: () => void;
  loading: boolean;
  error: string | null;
}

export default function MicOffScreen({ onStart, loading, error }: MicOffScreenProps) {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div className="micoff-overline">VOXCHORD</div>
      <div className="micoff-headline">
        Your session<br />begins with<br />your voice.
      </div>
      <div className="micoff-sub">
        VoxChord needs microphone access to detect pitch and generate chord suggestions in real time.
      </div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <button className={`start-btn ${loading ? "loading" : ""}`} onClick={onStart}>
          <span className="btn-spinner" />
          <span style={{ position: "relative", zIndex: 1 }}>
            {loading ? "INITIALIZING…" : "START SESSION"}
          </span>
        </button>
      </div>
      {error && (
        <div style={{
          marginTop: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, color: "rgba(239,68,68,0.75)",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
