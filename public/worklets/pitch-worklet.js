// public/worklets/pitch-worklet.js
class PitchWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.BUFFER_SIZE = 2048;
    this.HOP = 512;
    this.buf = new Float32Array(this.BUFFER_SIZE);
    this.writeHead = 0;
    this.hopCounter = 0;
    this.YIN_THRESHOLD = 0.10;
    this.MIN_RMS = 0.005;

    // Pitch stabilisation
    this.medianBuf = [];
    this.MEDIAN_SIZE = 5;
    this.currentPitchClass = -1;
    this.onsetTimer = 0;
    this.ONSET_HOLD_MS = 60;
    this.HYSTERESIS_CENTS = 80;
    this.lastStableMidi = -1;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    // Accumulate 128-sample chunks into analysis buffer
    for (let i = 0; i < input.length; i++) {
      this.buf[this.writeHead % this.BUFFER_SIZE] = input[i];
      this.writeHead++;
    }

    this.hopCounter += input.length;
    if (this.hopCounter >= this.HOP) {
      this.hopCounter = 0;

      // Linearize circular buffer for analysis
      const head = this.writeHead % this.BUFFER_SIZE;
      const analysis = new Float32Array(this.BUFFER_SIZE);
      for (let i = 0; i < this.BUFFER_SIZE; i++) {
        analysis[i] = this.buf[(head + i) % this.BUFFER_SIZE];
      }

      const rms = this.computeRMS(analysis);
      if (rms < this.MIN_RMS) {
        this.port.postMessage({ pitch: -1, midi: -1, pitchClass: -1,
                                cents: 0, rms, voiced: false, stable: false });
        return true;
      }

      const result = this.yin(analysis);
      if (result.pitch > 0) {
        const stabilised = this.stabilise(result);
        this.port.postMessage({
          pitch: result.pitch,
          midi: result.midi,
          cents: result.cents,
          pitchClass: stabilised.pitchClass,
          stable: stabilised.stable,
          rms, voiced: true
        });
      } else {
        this.port.postMessage({ pitch: -1, midi: -1, pitchClass: -1,
                                cents: 0, rms, voiced: false, stable: false });
      }
    }
    return true;
  }

  yin(buf) {
    const N = buf.length;
    const halfN = Math.floor(N / 2);
    // sampleRate is a global variable available in AudioWorkletGlobalScope
    const minLag = Math.floor(sampleRate / 1200); // ~C6
    const maxLag = Math.min(Math.floor(sampleRate / 70), halfN); // ~B1

    // Step 1: Difference function
    const d = new Float32Array(halfN);
    for (let tau = 1; tau < halfN; tau++) {
      let sum = 0;
      for (let t = 0; t < halfN; t++) {
        const delta = buf[t] - buf[t + tau];
        sum += delta * delta;
      }
      d[tau] = sum;
    }

    // Step 2: Cumulative mean normalised difference
    const dPrime = new Float32Array(halfN);
    dPrime[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfN; tau++) {
      runningSum += d[tau];
      dPrime[tau] = d[tau] / (runningSum / tau);
    }

    // Step 3: Absolute threshold — search within voice range
    let bestTau = -1;
    for (let tau = minLag; tau < maxLag; tau++) {
      if (dPrime[tau] < this.YIN_THRESHOLD) {
        while (tau + 1 < maxLag && dPrime[tau + 1] < dPrime[tau]) tau++;
        bestTau = tau;
        break;
      }
    }

    if (bestTau === -1) return { pitch: -1, midi: -1, cents: 0 };

    // Voiced/unvoiced check
    if (dPrime[bestTau] > 0.15) return { pitch: -1, midi: -1, cents: 0 };

    // Step 4: Parabolic interpolation
    let refined = bestTau;
    if (bestTau > 0 && bestTau < halfN - 1) {
      const a = dPrime[bestTau - 1];
      const b = dPrime[bestTau];
      const c = dPrime[bestTau + 1];
      // small epsilon to prevent divide by zero
      const denom = (a - 2 * b + c);
      if (Math.abs(denom) > 1e-6) {
        refined = bestTau + (a - c) / (2 * denom);
      }
    }

    // Step 5: Convert
    const pitch = sampleRate / refined;
    const midi = 12 * Math.log2(pitch / 440) + 69;
    const nearestMidi = Math.round(midi);
    const cents = (midi - nearestMidi) * 100;

    return { pitch, midi, cents, nearestMidi };
  }

  stabilise(result) {
    // Median filter
    this.medianBuf.push(result.midi);
    if (this.medianBuf.length > this.MEDIAN_SIZE) this.medianBuf.shift();
    const sorted = [...this.medianBuf].sort((a, b) => a - b);
    const medianMidi = sorted[Math.floor(sorted.length / 2)];
    // Ensure positive mod
    const pitchClass = ((Math.round(medianMidi) % 12) + 12) % 12;

    // Hysteresis
    if (this.lastStableMidi >= 0) {
      const centsDiff = Math.abs(medianMidi - this.lastStableMidi) * 100;
      if (centsDiff < this.HYSTERESIS_CENTS) {
        return { pitchClass: this.currentPitchClass, stable: true };
      }
    }

    // Onset hold
    if (pitchClass !== this.currentPitchClass) {
      this.onsetTimer += (this.HOP / sampleRate) * 1000;
      if (this.onsetTimer < this.ONSET_HOLD_MS) {
        return { pitchClass: this.currentPitchClass, stable: false };
      }
      this.currentPitchClass = pitchClass;
      this.lastStableMidi = medianMidi;
      this.onsetTimer = 0;
    }

    return { pitchClass: this.currentPitchClass, stable: true };
  }

  computeRMS(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }
}

registerProcessor('pitch-worklet', PitchWorklet);
