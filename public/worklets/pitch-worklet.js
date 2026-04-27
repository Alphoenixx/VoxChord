// public/worklets/pitch-worklet.js
class PitchWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    // Stage 5: FFT Buffer Size Check -> 4096 minimum for low frequencies
    this.BUFFER_SIZE = 4096;
    this.HOP = 512;
    this.buf = new Float32Array(this.BUFFER_SIZE);
    this.writeHead = 0;
    this.hopCounter = 0;

    // Tunable Configuration
    this.config = {
      rmsThreshold: 0.015,
      aperiodicityThreshold: 0.12,
      confirmationFrames: 4,
      hysteresisThresholdCents: 30,
      onsetDelayMs: 20
    };

    // Stage 1 State
    this.isSilent = true;
    this.silenceSince = 0;
    this.silenceEndTimer = null;

    // Stage 3 State
    this.recentFrames = [];

    // Stage 4 State
    this.currentConfirmedNote = null;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    for (let i = 0; i < input.length; i++) {
      this.buf[this.writeHead % this.BUFFER_SIZE] = input[i];
      this.writeHead++;
    }

    this.hopCounter += input.length;
    if (this.hopCounter >= this.HOP) {
      this.hopCounter = 0;

      const head = this.writeHead % this.BUFFER_SIZE;
      const analysis = new Float32Array(this.BUFFER_SIZE);
      for (let i = 0; i < this.BUFFER_SIZE; i++) {
        analysis[i] = this.buf[(head + i) % this.BUFFER_SIZE];
      }

      const timestamp = currentTime; // available in AudioWorkletGlobalScope

      // Stage 1: RMS Energy Gate
      const rms = this.computeRMS(analysis);
      if (rms < this.config.rmsThreshold) {
        this.handleSilence(timestamp);
        return true;
      }

      // Handle onset delay
      if (this.isSilent) {
        if (this.silenceEndTimer === null) {
          this.silenceEndTimer = timestamp;
        }
        if ((timestamp - this.silenceEndTimer) * 1000 < this.config.onsetDelayMs) {
          return true; // Skip while in onset delay
        }
        this.isSilent = false;
        this.silenceEndTimer = null;
      }

      // Stage 2: Aperiodicity / Confidence Gate
      const result = this.yin(analysis);
      if (result.pitch === -1 || result.aperiodicity > this.config.aperiodicityThreshold) {
        return true; // Rejected
      }

      // Stage 3: Confirmation Buffer
      this.processConfirmation(result, timestamp);
    }
    return true;
  }

  handleSilence(timestamp) {
    if (!this.isSilent) {
      this.isSilent = true;
      this.silenceSince = timestamp;
      this.recentFrames = []; // Clear confirmation buffer immediately
      this.currentConfirmedNote = null;
    }

    this.port.postMessage({
      type: 'SilenceEvent',
      timestamp: timestamp,
      duration: timestamp - this.silenceSince
    });
  }

  processConfirmation(result, timestamp) {
    this.recentFrames.push({ ...result, timestamp });
    if (this.recentFrames.length > this.config.confirmationFrames) {
      this.recentFrames.shift();
    }

    if (this.recentFrames.length < this.config.confirmationFrames) {
      return; // Not enough frames to confirm
    }

    // Check if dominant (all within ±20 cents of median)
    const sortedMidi = [...this.recentFrames].map(f => f.midi).sort((a, b) => a - b);
    const medianMidi = sortedMidi[Math.floor(sortedMidi.length / 2)];

    let allConsistent = true;
    for (const frame of this.recentFrames) {
      if (Math.abs(frame.midi - medianMidi) > 0.20) { // 20 cents
        allConsistent = false;
        break;
      }
    }

    if (!allConsistent) {
      this.recentFrames = []; // Reset buffer
      return;
    }

    const avgAperiodicity = this.recentFrames.reduce((sum, f) => sum + f.aperiodicity, 0) / this.recentFrames.length;
    const confidence = Math.max(0, 1.0 - (avgAperiodicity / this.config.aperiodicityThreshold));

    const confirmedCandidate = {
      midi: medianMidi,
      frequency: result.pitch,
      cents: result.cents,
      timestamp: timestamp,
      confidence: confidence
    };

    // Stage 4: Hysteresis Guard
    this.processHysteresis(confirmedCandidate);
  }

  processHysteresis(candidate) {
    if (!this.currentConfirmedNote) {
      this.updateConfirmedNote(candidate);
      return;
    }

    const diffCents = Math.abs(candidate.midi - this.currentConfirmedNote.rawMidi) * 100;
    if (diffCents > this.config.hysteresisThresholdCents) {
      this.updateConfirmedNote(candidate);
    } else {
      // Stay on current note, but emit updated continuous values
      this.emitStableEvent(
        this.currentConfirmedNote.discreteMidi,
        this.currentConfirmedNote.root,
        this.currentConfirmedNote.octave,
        (candidate.midi - this.currentConfirmedNote.discreteMidi) * 100,
        candidate.frequency,
        candidate.timestamp,
        candidate.confidence
      );
    }
  }

  updateConfirmedNote(candidate) {
    const discreteMidi = Math.round(candidate.midi);
    const pitchClass = ((discreteMidi % 12) + 12) % 12;
    const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
    
    this.currentConfirmedNote = {
      discreteMidi: discreteMidi,
      rawMidi: candidate.midi,
      root: NOTE_NAMES[pitchClass],
      octave: Math.floor(discreteMidi / 12) - 1
    };

    this.emitStableEvent(
      discreteMidi,
      this.currentConfirmedNote.root,
      this.currentConfirmedNote.octave,
      (candidate.midi - discreteMidi) * 100,
      candidate.frequency,
      candidate.timestamp,
      candidate.confidence
    );
  }

  emitStableEvent(midi, root, octave, cents, frequency, timestamp, confidence) {
    this.port.postMessage({
      type: 'StableNoteEvent',
      midi, root, octave, cents, frequency, timestamp, confidence
    });
  }

  yin(buf) {
    const N = buf.length;
    const halfN = Math.floor(N / 2);
    const minLag = Math.floor(sampleRate / 1200);
    const maxLag = Math.min(Math.floor(sampleRate / 70), halfN);

    const d = new Float32Array(halfN);
    for (let tau = 1; tau < halfN; tau++) {
      let sum = 0;
      for (let t = 0; t < halfN; t++) {
        const delta = buf[t] - buf[t + tau];
        sum += delta * delta;
      }
      d[tau] = sum;
    }

    const dPrime = new Float32Array(halfN);
    dPrime[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfN; tau++) {
      runningSum += d[tau];
      dPrime[tau] = d[tau] / (runningSum / tau);
    }

    let bestTau = -1;
    for (let tau = minLag; tau < maxLag; tau++) {
      if (dPrime[tau] < 0.20) { // loose search threshold
        while (tau + 1 < maxLag && dPrime[tau + 1] < dPrime[tau]) tau++;
        bestTau = tau;
        break;
      }
    }

    if (bestTau === -1) return { pitch: -1, aperiodicity: 1.0 };

    const aperiodicity = dPrime[bestTau];

    let refined = bestTau;
    if (bestTau > 0 && bestTau < halfN - 1) {
      const a = dPrime[bestTau - 1];
      const b = dPrime[bestTau];
      const c = dPrime[bestTau + 1];
      const denom = (a - 2 * b + c);
      if (Math.abs(denom) > 1e-6) {
        refined = bestTau + (a - c) / (2 * denom);
      }
    }

    const pitch = sampleRate / refined;
    const midi = 12 * Math.log2(pitch / 440) + 69;
    const nearestMidi = Math.round(midi);
    const cents = (midi - nearestMidi) * 100;

    return { pitch, midi, cents, aperiodicity };
  }

  computeRMS(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }
}

registerProcessor('pitch-worklet', PitchWorklet);
