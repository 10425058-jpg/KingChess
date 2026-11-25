export type SoundCue =
  | 'move'
  | 'capture'
  | 'check'
  | 'castle'
  | 'promote'
  | 'gameOver';

class SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    gainPeak: number,
    delaySec = 0,
    endFreq?: number,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  play(cue: SoundCue, enabled: boolean): void {
    if (!enabled) return;

    try {
      switch (cue) {
        case 'move':
          this.playTone(210, 0.075, 'triangle', 0.12, 0, 125);
          break;
        case 'capture':
          this.playTone(320, 0.09, 'sawtooth', 0.1, 0, 95);
          this.playTone(170, 0.06, 'sine', 0.14, 0.01, 90);
          break;
        case 'castle':
          this.playTone(220, 0.065, 'triangle', 0.11, 0, 130);
          this.playTone(260, 0.07, 'triangle', 0.11, 0.085, 145);
          break;
        case 'promote':
          this.playTone(440, 0.11, 'sine', 0.11, 0, 660);
          this.playTone(660, 0.14, 'triangle', 0.1, 0.06, 880);
          break;
        case 'check':
          this.playTone(540, 0.14, 'sine', 0.12, 0, 460);
          this.playTone(720, 0.12, 'triangle', 0.07, 0.03, 640);
          break;
        case 'gameOver':
          this.playTone(392, 0.18, 'triangle', 0.1, 0);
          this.playTone(493.88, 0.2, 'triangle', 0.09, 0.09);
          this.playTone(587.33, 0.28, 'sine', 0.1, 0.18);
          break;
      }
    } catch {
      // Never let Web Audio failures interrupt gameplay
    }
  }
}

export const soundEngine = new SoundEngine();
