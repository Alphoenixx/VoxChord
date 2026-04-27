# VoxChord 🎹
### Real-Time Browser-Native Pitch Detection & Harmonic Intelligence Engine

> *"From vocal input to harmonic suggestion — under 30 milliseconds, zero servers, zero installation."*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-vox--chord--kappa.vercel.app-blueviolet?style=for-the-badge)](https://vox-chord-kappa.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-63%25-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Privacy First](https://img.shields.io/badge/Audio-Never%20Leaves%20Browser-green?style=for-the-badge)]()

---

## Table of Contents

1. [Abstract](#abstract)
2. [Motivation & Problem Statement](#motivation--problem-statement)
3. [System Architecture](#system-architecture)
4. [The Five-Stage Signal Pipeline](#the-five-stage-signal-pipeline)
5. [Core Algorithms](#core-algorithms)
6. [Harmony Intelligence Layer](#harmony-intelligence-layer)
7. [Rendering & State Architecture](#rendering--state-architecture)
8. [Technology Stack & Justification](#technology-stack--justification)
9. [Performance Profile](#performance-profile)
10. [Privacy & Security Design](#privacy--security-design)
11. [Project Structure](#project-structure)
12. [Getting Started](#getting-started)
13. [Future Directions](#future-directions)

---

## Abstract

VoxChord is a browser-native audio intelligence platform that performs real-time fundamental frequency detection from microphone input and generates musically contextual chord suggestions — with no server-side computation, no installation, and no audio data leaving the device. The system's core innovation is the architectural separation of all digital signal processing onto a dedicated real-time audio thread via the Web Audio API's `AudioWorklet` interface, eliminating the main-thread contention that has historically made browser-based pitch detection impractical. A five-stage pipeline — raw PCM capture, worklet-thread buffering, YIN-based pitch estimation, Krumhansl-Schmuckler key profiling, and O(1) diatonic chord lookup — achieves a typical end-to-end latency of under 30 ms and a worst-case ceiling of 50 ms. VoxChord is designed for singers, instrumentalists, music educators, and researchers who require instantaneous harmonic feedback in any environment with a modern browser.

---

## Motivation & Problem Statement

### The Real-Time Harmonic Assistance Gap

Singers and early-stage instrumentalists face two deeply coupled challenges: knowing whether a sustained pitch is in tune relative to a tonal center, and understanding which chords would contextually support a given melody note in real time. Existing solutions — hardware tuners, DAWs, and cloud-based services — each fail one or more core requirements: unacceptable latency, mandatory software installation, or transmission of sensitive audio data to external servers.

### Why the Browser Has Been a Hard Target

Browser-based pitch detection has historically been constrained by JavaScript's single-threaded execution model. The main thread simultaneously handles DOM diffing, garbage collection, user interaction events, and any custom DSP logic. Non-deterministic scheduling on this shared thread causes jitter and missed audio frames — fatal for a system whose perceptual deadline is ~30 ms. VoxChord resolves this through architectural isolation of all DSP onto a dedicated audio thread, a design made possible only with the `AudioWorklet` API reaching broad browser support.

---

## System Architecture

VoxChord is organized into three runtime-isolated tiers.

**Tier 1 — Audio Worklet Thread** handles all sample-level computation. This thread is preemptively scheduled by the browser's audio subsystem, immune to main-thread load, and operates with hard real-time guarantees. All pitch estimation lives exclusively here.

**Tier 2 — Main JavaScript Thread** receives serialized pitch data, runs stateful key inference and chord selection, and updates global application state. These operations are deliberately O(1) or O(log n) to leave the full latency budget available for rendering.

**Tier 3 — WebGL / React Render** consumes state from Zustand and paints the 60 fps visual HUD. The Three.js scene, GSAP timelines, and Framer Motion transitions all operate here, decoupled from audio computation by design.

This three-tier isolation guarantees that a slow React re-render cannot cause an audio dropout, and a heavy WebGL frame cannot delay chord output.

---

## The Five-Stage Signal Pipeline

Each audio frame traverses five discrete stages with a total round-trip bounded at ~50 ms worst-case.

### Stage 1 — Capture
The browser's `getUserMedia` API opens a mono audio stream from the system microphone, connected to an `AudioContext` at 44,100 Hz. Hardware delivers 128-sample chunks every ~2.9 ms. No audio is encoded, transmitted, or stored at any point.

### Stage 2 — Worklet Buffering
Incoming 128-sample chunks are accumulated into a 2,048-sample ring buffer on the audio thread. Every 512 new samples — a hop interval of 11.6 ms — the buffer is dispatched to the YIN estimator. This hop rate sits below the ~20 ms lower bound of human pitch-change perception, ensuring the display is never perceptibly stale.

### Stage 3 — YIN Pitch Estimation
The 2,048-sample buffer is analyzed using the YIN algorithm to extract fundamental frequency F₀. The result is posted to the main thread as a single floating-point Hz value with a confidence flag. Unvoiced frames (silence, breath noise, fricatives) are discarded before leaving the worklet, preventing noise from corrupting the key tracker.

### Stage 4 — Chord Lookup
The incoming frequency is quantized to the nearest pitch class, fed into the key profiling window, and used to index the pre-computed diatonic chord table. The output is an ordered list of chord suggestions ranked by voice-leading relevance. The lookup is pure array indexing — O(1) with zero dynamic music-theory computation at runtime.

### Stage 5 — HUD Render
The Zustand chord store update triggers a scoped React reconciliation pass, painting updated chord cards, the pitch indicator, and the key banner at 60 fps. Three.js visual elements update via the `useFrame` animation loop, which runs on `requestAnimationFrame` independently of React's diffing cycle.

---

## Core Algorithms

### YIN Pitch Detection

VoxChord implements the YIN algorithm (de Cheveigné & Kawahara, 2002), the established benchmark for monophonic pitch detection. YIN is grounded in the **Cumulative Mean Normalized Difference (CMND) function** — a normalized autocorrelation difference that eliminates the trivial zero-lag minimum and yields a function whose first sub-threshold minimum identifies the fundamental period T₀. Sub-sample accuracy is recovered through **parabolic interpolation** around that minimum, which is critical because adjacent musical semitones differ by only ~6% in frequency. The detected period is inverted against the sample rate to yield F₀ in Hz, then converted to the nearest MIDI pitch class.

YIN outperforms direct FFT peak-picking in two ways relevant to this application: it targets the waveform period rather than spectral peaks (avoiding harmonic ambiguity), and it requires no windowing function (eliminating spectral leakage artifacts). For a fixed 2,048-sample buffer, its computational cost is constant and well within the 11.6 ms hop budget on any modern device.

A frame is classified as **voiced** only when the CMND minimum falls below θ = 0.12. This conservative threshold minimizes octave errors at the cost of occasionally dropping borderline-pitched frames — an acceptable trade-off for a harmony-suggestion context.

### Krumhansl-Schmuckler Key Profiling

Knowing a single pitch is insufficient for chord suggestion — the system must continuously infer which of the 24 tonal centers the user is performing in. VoxChord implements the **Krumhansl-Schmuckler (KS) algorithm**, grounded in Krumhansl's 1990 psychoacoustic research on tonal hierarchies.

Each of the 24 keys is represented as a 12-element **tonal hierarchy profile** — a vector of perceptual stability weights for each chromatic pitch class derived from listener experiments. As voiced frames arrive, pitch class votes accumulate in a rolling 12-bin histogram weighted by an **exponential decay function** over an 8-second window. This decay ensures that notes from a recent phrase exert more influence than notes from 30 seconds prior, enabling live key-modulation tracking.

Key inference computes the Pearson correlation between the current histogram and all 24 KS profiles, each rotated to its root pitch class. The highest-correlating key is selected and updated on every incoming pitch event — tracking all 24 keys in parallel with negligible computational cost.

---

## Harmony Intelligence Layer

### Diatonic Chord Construction

With F₀ and key determined, the chord engine maps the detected pitch class onto a diatonic harmonic field. The seven notes of the inferred key generate seven diatonic chords (triads and sevenths) by stacking thirds. The engine identifies every diatonic chord in which the detected pitch appears as a chord tone, then ranks suggestions by **voice-leading role** in descending priority: root position, third, fifth, and seventh. This ranking mirrors how trained arrangers reason about melodic support, producing musically literate suggestions rather than naive frequency-to-chord mappings.

### Pre-Computed Lookup Tables

All 288 combinations of 12 pitch classes × 24 keys are resolved into ranked chord suggestion lists at build time. At runtime, suggestion retrieval is a single array access — O(1) regardless of key complexity. This design choice is what permits the harmony engine to consume negligible CPU budget while the majority of the latency budget is preserved for DSP and rendering.

---

## Rendering & State Architecture

### Zustand State Management

Three isolated Zustand stores manage application state without cross-contamination. `audioStore` holds live references to the `AudioContext`, `MediaStream`, and `AudioWorkletNode`. `chordStore` maintains the current pitch, inferred key, and ranked chord suggestions. `uiStore` controls session phase (landing → active → paused) and modal visibility. Zustand's subscription model ensures that only components consuming a changed slice re-render — preventing 60+ pitch updates per second from triggering full-tree reconciliation.

### Three.js / React Three Fiber Visuals

The cinematic visual layer renders in a dedicated WebGL canvas via React Three Fiber. 3D elements — waveform ribbons, pitch-responsive particle fields, frequency orbs — update through the `useFrame` hook, which runs on `requestAnimationFrame` outside React's reconciliation cycle. This isolation ensures that a computationally heavy Three.js frame cannot block state updates or delay chord output.

### Animation Stack

GSAP governs all timeline-precise DOM animations: session transitions, chord card staggering, and key-change banners. Framer Motion handles declarative React component mount/unmount transitions with spring physics. The two-library approach reflects complementary strengths — GSAP for imperative, frame-exact sequences; Framer Motion for stateful, physics-driven React lifecycle transitions.

---

## Technology Stack & Justification

| Technology | Version | Role | Rationale |
|---|---|---|---|
| **Next.js** | 15 (App Router) | Framework | Edge-optimized delivery, React Server Components, file-based routing |
| **TypeScript** | 5.x | Language | Type safety across the audio-UI boundary; catches worklet interface errors at compile time |
| **Tailwind CSS** | 4.x | Styling | Zero-runtime JIT CSS with no stylesheet bloat in a latency-sensitive app |
| **Zustand** | 4.x | State | Minimal boilerplate, concurrent-mode safe, subscription-scoped re-renders |
| **Web Audio API** | AudioWorklet | DSP Runtime | Only browser API providing true off-main-thread, hard-real-time audio processing |
| **Three.js / R3F** | r164 | 3D Visuals | WebGL abstraction with declarative React bindings |
| **GSAP** | 3.x | Sequenced Animation | Sub-frame precision, hardware-accelerated, zero layout recalculation |
| **Framer Motion** | 11.x | React Transitions | Declarative spring-physics animations for component lifecycle events |
| **Vercel** | — | Deployment | Global edge CDN; automatic HTTPS required by `getUserMedia` security policy |

### The No-Backend Decision

Routing audio to a server introduces 50–200 ms of irreducible network round-trip latency — exceeding the entire perceptual budget. Beyond latency, local processing provides an absolute privacy guarantee that server-side architectures cannot match. The no-backend design simultaneously eliminates infrastructure cost, WebSocket complexity, and offline-mode restrictions.

---

## Performance Profile

| Pipeline Stage | Typical | Worst Case |
|---|---|---|
| getUserMedia → AudioContext connection | 1–3 ms | 5 ms |
| Worklet accumulation (512-sample hop) | 11.6 ms | 11.6 ms (fixed) |
| YIN computation (2,048-sample buffer) | 2–5 ms | 8 ms |
| postMessage serialization | < 1 ms | 1 ms |
| Key profiling + chord lookup | < 1 ms | 1 ms |
| React render + 60 fps commit | 4–8 ms | 16 ms |
| **End-to-end total** | **~18–28 ms** | **~50 ms** |

The 11.6 ms hop rate is the dominant fixed component. The system's hard real-time guarantee derives from the AudioWorklet's preemptive scheduling — the audio thread cannot be starved by main-thread activity, so the hop rate holds even under heavy UI load.

---

## Privacy & Security Design

All audio computation occurs exclusively within the user's browser process. No PCM samples, pitch data, key estimates, or chord suggestions are transmitted to any external endpoint at any time. The application has no backend API, no analytics pipeline, and no data persistence layer. Microphone access is requested transiently per session and released on session end. The HTTPS requirement enforced by `getUserMedia` ensures the application cannot be served or intercepted over an unencrypted connection.

---

## Project Structure

```
VoxChord/
├── public/
│   └── worklets/               # AudioWorklet processors (audio thread)
│       └── pitch-processor.js  # YIN implementation, buffer management
├── src/
│   ├── audio/                  # Core DSP and music-theory engines
│   │   ├── pitchDetector.ts    # YIN wrapper, voicing classification
│   │   ├── keyDetector.ts      # KS profiling, exponential decay window
│   │   └── chordEngine.ts      # Diatonic tables, voice-leading ranking
│   ├── components/
│   │   ├── landing/            # Pre-session UI (hero, feature cards, CTA)
│   │   └── session/            # Active session HUD (pitch display, chord cards, 3D canvas)
│   ├── stores/
│   │   ├── audioStore.ts       # AudioContext, stream, and worklet node refs
│   │   ├── chordStore.ts       # Live pitch, key, and chord suggestions
│   │   └── uiStore.ts          # Session phase and modal state
│   └── app/                    # Next.js App Router pages
├── run.py                      # Python convenience launcher
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A modern browser with `AudioWorklet` support (Chrome 66+, Firefox 76+, Safari 14.1+)
- Microphone access

### Installation

```bash
git clone https://github.com/Alphoenixx/VoxChord.git
cd VoxChord
npm install
npm run dev
# alternatively: python run.py
```

Open `http://localhost:3000`, grant microphone permission when prompted, and click **Launch Session**.

> The application must be served over HTTPS or localhost for `getUserMedia` to function. The Vercel production deployment at [vox-chord-kappa.vercel.app](https://vox-chord-kappa.vercel.app) satisfies this requirement automatically.

---

## Future Directions

**Polyphonic Detection** — Extending beyond monophonic input to chords and harmonically complex signals via multi-pitch estimation (iterative subtraction, CREPE/SPICE) would expand applicability to piano and guitar.

**MIDI Output** — Exposing detected pitch and chord suggestions as real-time MIDI signals via the Web MIDI API would allow VoxChord to function as a live notation assistant or DAW plugin bridge.

**Adaptive Voicing Threshold** — The YIN threshold (currently fixed at θ = 0.12) could be dynamically calibrated per session using a short noise-floor measurement pass, improving detection in high-ambient-noise environments.

**Microtonal & Non-Western Scales** — The current harmony engine is grounded in 12-tone equal temperament. Supporting maqam, raga, and other non-Western tonal systems requires parameterizable scale definitions and alternative KS profile vectors.

**Offline PWA Mode** — Packaging VoxChord as a Progressive Web App with a service worker would enable full offline functionality after first load, making it viable in studios or classrooms without reliable internet.

**Session Analytics** — Logging the pitch and chord timeline locally in IndexedDB would allow musicians to review their harmonic trajectory across a practice session — without any server involvement.

---

<div align="center">

**VoxChord** · AudioWorklet + YIN + Krumhansl-Schmuckler · Built for musicians

*All audio processing is local. No data ever leaves your browser.*

</div>
