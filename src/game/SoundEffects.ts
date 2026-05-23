import { SoundChannels } from './Types';

export class SoundEffects {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private humChannels: SoundChannels = {};
  private isHumEnabled: boolean = true;
  private isMuted: boolean = false;

  constructor() {
    // Initialized on first user interaction due to browser security policies
  }

  private init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.startAmbientHum();
    } catch (e) {
      console.warn("Web Audio API failed to initialize:", e);
    }
  }

  public enableAudio() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setHumEnabled(enabled: boolean) {
    this.isHumEnabled = enabled;
    if (this.humChannels.gain) {
      this.humChannels.gain.gain.setTargetAtTime(enabled && !this.isMuted ? 0.08 : 0, this.ctx?.currentTime || 0, 0.1);
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime, 0.1);
    }
    return this.isMuted;
  }

  private startAmbientHum() {
    if (!this.ctx || !this.masterGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(75, this.ctx.currentTime); // Deep hum

      // Low pass filter to make it warmer
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(3, this.ctx.currentTime); // 3Hz modulation
      lfoGain.gain.setValueAtTime(10, this.ctx.currentTime); // Pitch depth modulation

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      gain.gain.setValueAtTime(this.isHumEnabled ? 0.08 : 0, this.ctx.currentTime);

      osc.start();
      lfo.start();

      this.humChannels = { osc, gain, lfo, lfoGain };
    } catch (err) {
      console.error("Failed to start hum:", err);
    }
  }

  public setDimensionHum(layer: number) {
    if (!this.ctx || !this.humChannels.osc) return;
    // Map dimension 0 -> 75Hz, dimension 1 -> 110Hz, dimension 2 -> 155Hz
    const targetFreq = 75 + layer * 35;
    this.humChannels.osc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);
  }

  public playCollect() {
    this.enableAudio();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + 0.16);
  }

  public playShift() {
    this.enableAudio();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);

    filter.type = 'peaking';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    filter.Q.setValueAtTime(10, t);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + 0.26);
  }

  public playRewind() {
    this.enableAudio();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const duration = 0.8;
    
    // Play a rising reversed sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    // Rapid descending pitch to simulate reverse tape glitch
    osc.frequency.exponentialRampToValueAtTime(60, t + duration);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(t + duration + 0.05);

    // Play secondary glitch sparks
    for (let i = 0; i < 4; i++) {
      const sparkT = t + i * 0.15;
      const sparkOsc = this.ctx.createOscillator();
      const sparkGain = this.ctx.createGain();

      sparkOsc.type = 'square';
      sparkOsc.frequency.setValueAtTime(200 + Math.random() * 600, sparkT);
      sparkGain.gain.setValueAtTime(0.05, sparkT);
      sparkGain.gain.linearRampToValueAtTime(0.001, sparkT + 0.08);

      sparkOsc.connect(sparkGain);
      sparkGain.connect(this.masterGain);

      sparkOsc.start(sparkT);
      sparkOsc.stop(sparkT + 0.09);
    }
  }

  public playCascadeCleared() {
    this.enableAudio();
    const ctx = this.ctx;
    const masterGain = this.masterGain;
    if (!ctx || !masterGain) return;

    const t = ctx.currentTime;
    const chord = [329.63, 392.00, 523.25, 659.25]; // C Major chord

    chord.forEach((freq, idx) => {
      const noteT = t + idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteT);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, noteT + 0.45);

      gain.gain.setValueAtTime(0.08, noteT);
      gain.gain.linearRampToValueAtTime(0.001, noteT + 0.45);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(noteT);
      osc.stop(noteT + 0.46);
    });
  }

  public playGameOver() {
    this.enableAudio();
    const ctx = this.ctx;
    const masterGain = this.masterGain;
    if (!ctx || !masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(40, t + 1.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 1.2);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc.stop(t + 1.25);
  }

  public playVictory() {
    this.enableAudio();
    const ctx = this.ctx;
    const masterGain = this.masterGain;
    if (!ctx || !masterGain) return;

    const t = ctx.currentTime;
    const arpeggio = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Bright ascending arpeggio

    arpeggio.forEach((freq, idx) => {
      const noteT = t + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteT);

      gain.gain.setValueAtTime(0.12, noteT);
      gain.gain.linearRampToValueAtTime(0.001, noteT + 0.35);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(noteT);
      osc.stop(noteT + 0.36);
    });
  }
}
