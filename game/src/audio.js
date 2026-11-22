// Synthesized sound for VAULTBREAK — no audio files, everything is oscillators.
// In Node (tests) there is no AudioContext, so every call is a safe no-op.

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.lastAlarmTick = 0;
  }

  ensure() {
    if (typeof window === 'undefined') return false;
    if (!this.context) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.context = new AC();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.16;
    return this.muted;
  }

  tone(freq, seconds, type, slideTo, volume) {
    if (this.muted || !this.ensure()) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + seconds);
    gain.gain.setValueAtTime(volume || 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  pickup() {
    this.tone(880, 0.12, 'sine', 1320, 0.5);
    setTimeout(() => this.tone(1320, 0.14, 'sine', 1760, 0.4), 70);
  }

  vault() {
    this.tone(392, 0.16, 'triangle', 523, 0.55);
    setTimeout(() => this.tone(523, 0.16, 'triangle', 784, 0.55), 110);
    setTimeout(() => this.tone(784, 0.28, 'triangle', 1046, 0.5), 220);
  }

  coin() {
    this.tone(1568, 0.09, 'square', 2093, 0.22);
  }

  coinLand() {
    this.tone(1200, 0.06, 'square', 900, 0.2);
  }

  caught() {
    this.tone(220, 0.5, 'sawtooth', 55, 0.6);
    setTimeout(() => this.tone(110, 0.4, 'sawtooth', 40, 0.5), 120);
  }

  clear() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.22, 'triangle', n, 0.5), i * 110));
  }

  alarmTick(nowMs) {
    if (nowMs - this.lastAlarmTick < 900) return;
    this.lastAlarmTick = nowMs;
    this.tone(980, 0.1, 'square', 940, 0.25);
  }

  click() {
    this.tone(660, 0.05, 'sine', 660, 0.3);
  }
}
