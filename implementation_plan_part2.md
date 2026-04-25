# VoxChord — Implementation Plan (Part 2 of 2)
## 3D Cinematic UI, Scroll Orchestration, Session Interface & Build Order

---

## 7. Landing Page — Cinematic 3D Scroll Experience

### 7.1 Section Map (5 scroll-driven sections)

The landing page is **one continuous R3F `<Canvas>`** that spans the full viewport. Lenis controls smooth scrolling. GSAP ScrollTrigger maps scroll position → camera position, object transforms, and text reveals. HTML overlay sections are positioned absolutely over the canvas.

```
Section 0: HERO          (0% - 20% scroll)
Section 1: FEATURES      (20% - 45% scroll)
Section 2: HOW IT WORKS  (45% - 65% scroll)
Section 3: LIVE DEMO     (65% - 85% scroll)
Section 4: CTA           (85% - 100% scroll)
```

### 7.2 Section Designs

#### Section 0 — Hero (Viewport-filling 3D scene)

**3D Scene:**
- A **giant floating treble clef** model (gold PBR material, metallic=0.9, roughness=0.1), slowly rotating on Y-axis
- **Particle field** of 2000+ floating music notes (♩ ♪ ♫) using instanced meshes, drifting with Perlin noise displacement
- Deep space **HDRI environment** (dark studio with warm accent lights)
- Camera starts wide, slowly dollies in as user scrolls

**Overlay:**
- Title: **"VoxChord"** — massive, Inter Black 120px, white with subtle text-shadow glow
- Subtitle: "Sing. Detect. Harmonize." — fade-in staggered letter animation (GSAP)
- Floating glass pill button: "Start Session →" with hover scale + glow
- Small latency badge: "< 30ms real-time" with pulse animation

**Post-processing:** Bloom (intensity 1.5, threshold 0.6), chromatic aberration (subtle), vignette

#### Section 1 — Features (Scroll-animated cards)

**3D Scene:** Camera pans right. Background transitions to a **3D sound wave mesh** (custom shader — see §8) that undulates based on scroll position.

**Overlay:** Three **glassmorphism cards** that slide in from below as you scroll into view:

| Card | Icon (3D) | Title | Description |
|------|-----------|-------|-------------|
| 1 | Microphone model | Real-Time Detection | YIN pitch detection at 11.6ms hop rate |
| 2 | Piano keys model | Smart Chords | Diatonic chord suggestions ranked by stability |
| 3 | Waveform model | Key Awareness | Auto key detection with manual override |

Each card: `backdrop-filter: blur(16px)`, dark semi-transparent bg, 1px border with gradient, hover → lift + stronger glow.

**GSAP animation:** Cards stagger in (0.15s delay each), parallax on Y-axis tied to scroll.

#### Section 2 — How It Works (Pipeline visualization)

**3D Scene:** Camera moves to face a **horizontal pipeline** of connected 3D nodes. Each node is a glowing sphere with a label. Lines connect them with animated particle flow.

```
🎤 Mic → ⚡ Worklet → 🎵 YIN → 🎹 Chords → 📺 Display
```

**Scroll interaction:** As you scroll, each pipeline stage "activates" — the sphere scales up, glows brighter, and a text panel appears below explaining that stage. Particles flow between active stages.

#### Section 3 — Live Demo Teaser

**3D Scene:** A **floating holographic piano keyboard** (12 keys, one octave) with the currently "sung" note highlighted. A simulated pitch detection runs automatically — the demo plays a pre-recorded melody and shows the chord suggestions updating in real-time.

**Purpose:** Show the product working before the user commits to mic access. Use a pre-analysed melody stored as JSON `{ time, pitchClass, chord }[]`.

#### Section 4 — Call to Action

**3D Scene:** Camera pulls back to reveal the full scene from above. All elements visible in miniature. Slow rotation.

**Overlay:** Large CTA card:
- "Ready to find your chords?"
- "Start Live Session" button (large, gradient, animated border)
- Links to GitHub, docs

---

## 8. Custom GLSL Shaders

### 8.1 Sound Wave Vertex Shader (`waveVertex.glsl`)

```glsl
uniform float uTime;
uniform float uScrollProgress;
uniform float uAmplitude;

varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Multi-frequency wave displacement
  float wave1 = sin(pos.x * 3.0 + uTime * 2.0) * uAmplitude;
  float wave2 = sin(pos.x * 7.0 - uTime * 1.5) * uAmplitude * 0.5;
  float wave3 = cos(pos.x * 5.0 + uTime * 3.0) * uAmplitude * 0.3;

  pos.y += (wave1 + wave2 + wave3) * (0.3 + uScrollProgress * 0.7);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

### 8.2 Sound Wave Fragment Shader (`waveFragment.glsl`)

```glsl
uniform float uTime;
uniform vec3 uColor1;  // e.g. #8B5CF6 (violet)
uniform vec3 uColor2;  // e.g. #06B6D4 (cyan)

varying vec2 vUv;

void main() {
  // Gradient based on UV + time
  float mixFactor = vUv.x + sin(uTime * 0.5) * 0.2;
  vec3 color = mix(uColor1, uColor2, mixFactor);

  // Edge glow
  float glow = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
  color += vec3(0.1) * (1.0 - glow);

  gl_FragColor = vec4(color, 0.8 * glow);
}
```

### 8.3 Audio-Reactive Particle Shader (for live session)

```glsl
uniform float uRMS;        // current audio energy
uniform float uPitchClass;  // 0-11, drives hue

void main() {
  // Map pitch class to hue (C=0°, C#=30°, ... B=330°)
  float hue = uPitchClass / 12.0;
  vec3 color = hsv2rgb(vec3(hue, 0.8, 0.6 + uRMS * 2.0));

  float dist = length(gl_PointCoord - vec2(0.5));
  float alpha = smoothstep(0.5, 0.0, dist) * (0.3 + uRMS * 3.0);

  gl_FragColor = vec4(color, alpha);
}
```

---

## 9. Scroll Orchestration (GSAP + Lenis)

### 9.1 Lenis Setup (`src/hooks/useLenis.ts`)

```typescript
// Initialize Lenis with cinematic smoothness
const lenis = new Lenis({
  duration: 1.6,        // smooth scroll duration
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
  orientation: 'vertical',
  smoothWheel: true,
});

// Feed into GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

### 9.2 GSAP Master Timeline (`src/hooks/useGSAPTimeline.ts`)

```typescript
// One ScrollTrigger per section, driving R3F camera + overlay animations
// Section 0: Hero
ScrollTrigger.create({
  trigger: '#hero',
  start: 'top top',
  end: 'bottom top',
  onUpdate: (self) => {
    // Pass scroll progress to Zustand → R3F reads it
    useScrollStore.getState().setProgress(0, self.progress);
  }
});

// Camera keyframes driven by scroll
// progress 0.0 → camera at [0, 2, 8]
// progress 0.2 → camera at [3, 1, 5]
// progress 0.5 → camera at [6, 0, 4]
// etc.
```

### 9.3 R3F Camera Controller

```tsx
function CinematicCamera() {
  const progress = useScrollStore(s => s.progress);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (!cameraRef.current) return;
    // Interpolate camera position along a spline based on scroll
    const pos = spline.getPointAt(progress);
    const lookAt = lookAtSpline.getPointAt(progress);
    cameraRef.current.position.lerp(pos, 0.05);
    cameraRef.current.lookAt(lookAt);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={50} />;
}
```

---

## 10. Live Session UI

### 10.1 Layout

```
┌─────────────────────────────────────────────┐
│  [Key: C Major ▼]          [Latency: 28ms]  │  ← Top bar
│                                              │
│          ┌──────────────────┐                │
│          │   ♩  A4  +12¢    │                │  ← Pitch indicator (center)
│          │   ████████░░     │                │     with cents bar
│          └──────────────────┘                │
│                                              │
│    ┌────────┐  ┌────────┐  ┌────────┐       │
│    │   Am   │  │   F    │  │   C    │       │  ← Chord cards
│    │  root  │  │  3rd   │  │  5th   │       │
│    │ ██████ │  │ █████  │  │ ████   │       │     (stability bars)
│    │primary │  │        │  │        │       │
│    └────────┘  └────────┘  └────────┘       │
│                                              │
│  Am → F → C → G → Am → Dm → G → C          │  ← Chord history strip
│                                              │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │  R3F: Audio-reactive particles         │  │  ← 3D background
│  │  Color = pitch class hue              │  │
│  │  Size = RMS energy                    │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└─────────────────────────────────────────────┘
```

### 10.2 Component Specifications

**PitchIndicator** — `requestAnimationFrame` driven, reads `useAudioStore`. Cents bar is a CSS `width` transition (60ms ease). Note name uses `scale` transform on change. When `stable=false`, opacity drops to 0.5.

**ChordCards** — Framer Motion `AnimatePresence` with `layout` prop. Entry: `opacity 0→1, y 20→0, scale 0.9→1` over 100ms. Exit: reverse. Primary card has glowing border (`box-shadow` with accent color). Each card shows chord name (large), role text (small), and a horizontal stability bar (gradient fill).

**ChordHistory** — Horizontal scrollable strip. New chords push from right with Framer Motion `layoutId` animation. Max 8 visible. Older chords fade to 40% opacity.

**SessionScene (3D background)** — Minimal R3F canvas behind the HUD:
- 2000 point particles with `uRMS` and `uPitchClass` uniforms
- Particles breathe (scale) with audio energy
- Color shifts with pitch class (hue rotation)
- Subtle bloom post-processing (lower intensity than landing)

### 10.3 Update Rates

| Component | Trigger | Rate |
|-----------|---------|------|
| Pitch indicator | `worklet.port.onmessage` → `rAF` | ~60fps display, ~86Hz data |
| Chord cards | Stable pitch class change | Event-driven (~0.5-2Hz) |
| Chord history | New chord committed | Event-driven |
| Key display | Key re-detection | Every 2 seconds |
| 3D particles | `useFrame` | 60fps, reads RMS from store |

---

## 11. Design System & Color Palette

```css
:root {
  /* Primary palette — electric violet to cyan gradient */
  --color-primary: #8B5CF6;
  --color-secondary: #06B6D4;
  --color-accent: #F59E0B;

  /* Surfaces */
  --bg-deep: #0A0A0F;
  --bg-card: rgba(15, 15, 25, 0.6);
  --bg-glass: rgba(255, 255, 255, 0.05);
  --border-glass: rgba(255, 255, 255, 0.1);

  /* Text */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #475569;

  /* Stability indicators */
  --stability-high: #22C55E;
  --stability-mid: #F59E0B;
  --stability-low: #EF4444;

  /* Pitch class hues (chromatic circle) */
  --hue-C: 0; --hue-Cs: 30; --hue-D: 60; --hue-Ds: 90;
  --hue-E: 120; --hue-F: 150; --hue-Fs: 180; --hue-G: 210;
  --hue-Gs: 240; --hue-A: 270; --hue-As: 300; --hue-B: 330;
}
```

**Typography:** Inter (Google Fonts) — `900` for hero, `700` for headings, `400` for body, `300` for secondary text. Monospace: JetBrains Mono for pitch/latency numbers.

**Glassmorphism standard:**
```css
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

---

## 12. Post-Processing Pipeline (R3F)

```tsx
import { EffectComposer, Bloom, ChromaticAberration,
         Vignette, DepthOfField } from '@react-three/postprocessing';

<EffectComposer>
  <Bloom
    intensity={1.5}
    luminanceThreshold={0.6}
    luminanceSmoothing={0.9}
    mipmapBlur
  />
  <ChromaticAberration offset={[0.001, 0.001]} />
  <Vignette eskil={false} offset={0.1} darkness={0.8} />
  {/* DoF only on landing, not session */}
  {isLanding && (
    <DepthOfField
      focusDistance={0.01}
      focalLength={0.05}
      bokehScale={3}
    />
  )}
</EffectComposer>
```

---

## 13. 3D Assets & Models

| Asset | Source | Format | Notes |
|-------|--------|--------|-------|
| Treble clef | Blender (model) | `.glb` | Gold PBR material, ~5k polys |
| Music notes (♩♪♫) | Blender (instanced) | `.glb` | 3 variants, ~200 polys each |
| Microphone | Blender | `.glb` | Stylized, chrome material |
| Piano keys (1 octave) | Blender | `.glb` | White/black keys, ~2k polys |
| Sound wave mesh | Procedural (R3F) | `PlaneGeometry` | 200x50 segments, custom shader |
| Particles | Procedural (R3F) | `Points` | 2000 instances, point sprites |
| HDRI environment | Poly Haven | `.hdr` | Dark studio, 1k resolution |

**Optimization:** All `.glb` files compressed with Draco. Use `gltfjsx` to generate typed React components. Lazy-load models with `React.lazy` + `Suspense`.

---

## 14. Performance Optimization Strategy

| Technique | Where | Impact |
|-----------|-------|--------|
| Draco compression | All `.glb` models | 70-90% smaller files |
| Instanced meshes | Particle notes, piano keys | 1 draw call instead of N |
| Offscreen audio | AudioWorklet | Zero main thread audio cost |
| Zustand selectors | All components | Minimal re-renders |
| `useFrame` with delta | R3F animations | Frame-rate independent |
| `drei/Preload` | Model loading | No jank on first scroll |
| Memoised chord table | ChordEngine constructor | O(1) chord lookup |
| Throttled key detection | KeyDetector | Runs every 2s, not every frame |
| `will-change: transform` | Animated DOM elements | GPU-accelerated compositing |
| `React.memo` | Chord cards, history | Skip re-render if data unchanged |

---

## 15. Phased Build Order

### Phase A — Foundation (Days 1-2)
1. Scaffold Next.js project, install all deps
2. Set up Tailwind config with custom design tokens
3. Create Zustand stores (audio, chord, scroll)
4. Build `pitch-worklet.js` with full YIN implementation
5. Build `AudioEngine.ts` — mic capture + worklet registration
6. **Milestone:** Console-log detected pitch from mic input

### Phase B — Music Theory Core (Days 3-4)
7. Implement `KeyDetector.ts` with Krumhansl-Schmuckler
8. Implement `ChordEngine.ts` with pre-computed lookup tables
9. Wire: worklet → store → chord engine → store
10. **Milestone:** Console-log chord suggestions updating in real-time

### Phase C — Session UI (Days 5-7)
11. Build `PitchIndicator` component with cents bar
12. Build `ChordCards` with Framer Motion animations
13. Build `ChordHistory` strip
14. Build `KeyDisplay` with manual override dropdown
15. Build `LatencyMonitor`
16. Build `SessionScene` (audio-reactive particles in R3F)
17. Compose session page layout
18. **Milestone:** Fully functional live session — sing and see chords

### Phase D — Landing Page 3D (Days 8-12)
19. Create 3D models in Blender, export `.glb`
20. Build `HeroScene` with treble clef + particle field
21. Build `SoundWave3D` with custom shaders
22. Build `PianoKeys3D` for demo section
23. Set up Lenis smooth scroll
24. Set up GSAP ScrollTrigger per section
25. Build cinematic camera controller (spline interpolation)
26. Build HTML overlay sections (Hero text, feature cards, CTA)
27. Add post-processing (Bloom, ChromAb, Vignette, DoF)
28. **Milestone:** Complete cinematic landing page with scroll animations

### Phase E — Polish (Days 13-15)
29. Add vibrato detection mode
30. Add falsetto break handling (hold last chord during breaks < 500ms)
31. Responsive design (mobile layout adjustments)
32. Performance audit (Lighthouse, Chrome DevTools Performance tab)
33. Cross-browser testing (Chrome, Firefox, Safari, mobile Chrome)
34. Edge case testing (silence, noise, multi-voice, humming)
35. **Milestone:** Production-ready application

---

## 16. Key Risk Mitigations

| Risk | Mitigation |
|------|------------|
| AudioWorklet not supported | Feature-detect, fall back to `ScriptProcessorNode` with warning |
| YIN too slow on mobile | Profile; reduce buffer to 1024 or increase hop to 1024 |
| Mic permission denied | Graceful UI state: show demo mode with pre-recorded data |
| 3D perf on low-end GPU | Detect via `renderer.info`, reduce particles, disable post-fx |
| Key detection inaccurate on short phrases | Default to C major, prominent manual override |
| Safari AudioContext restrictions | Resume context on first user gesture (click/tap) |
| GLSL shader compilation fails on some GPUs | Fallback to `MeshStandardMaterial` |

---

> [!IMPORTANT]
> The **single most critical architectural decision** is keeping all pitch detection in the AudioWorklet. Every other design choice — YIN over FFT, pre-computed chord tables, 60ms onset hold — builds on the guarantee that audio processing never competes with React rendering.
