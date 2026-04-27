# VoxChord 🎹

VoxChord is a high-performance, real-time audio analysis platform that detects pitch from a microphone input and suggests musical harmonies in real-time. Designed with a cinematic UI/UX, it runs entirely in the browser using Web Audio Worklets for zero main-thread blocking and ultra-low latency.

**🌍 Live Demo:** [https://vox-chord-kappa.vercel.app/](https://vox-chord-kappa.vercel.app/)

## ✨ Features

- **Real-time Pitch Detection**: High-accuracy fundamental frequency detection using advanced autocorrelation algorithms.
- **Dynamic Harmony Engine**: Intelligent chord suggestions based on detected pitch and musical context.
- **Cinematic UI/UX**: A premium, dark-mode interface with glassmorphism, 3D elements (via Three.js), and smooth GSAP/Framer Motion animations.
- **Low Latency Architecture**: Multi-threaded audio processing utilizing Web Workers and AudioWorklets for < 30ms response times.
- **Privacy First**: All audio processing happens locally in your browser. Audio is never stored or sent to a server.

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4
- **Animations**: GSAP & Framer Motion
- **Audio Processing**: Web Audio API (AudioWorklets)
- **3D Visuals**: Three.js / React Three Fiber
- **State Management**: Zustand

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ 
- NPM / Yarn / PNPM

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Alphoenixx/VoxChord.git
   cd VoxChord
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

Alternatively, you can use the provided Python runner:
```bash
python run.py
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🏗️ Project Structure

- `src/audio`: Core pitch detection and chord suggestion engines.
- `src/components`: UI components organized by landing and session views.
- `src/stores`: Global state management for audio, chords, and UI flow.
- `public/worklets`: Low-level audio processing scripts running on dedicated threads.
