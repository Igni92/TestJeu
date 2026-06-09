/**
 * Effets sonores synthétisés en WebAudio — aucun fichier audio.
 * L'AudioContext est créé/réveillé au premier geste utilisateur.
 */

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master) {
      this.master.gain.value = m ? 0 : 0.5;
    }
  }

  /** À appeler sur le premier geste utilisateur. */
  resume(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private tone(
    freq: number,
    type: OscillatorType,
    start: number,
    duration: number,
    volume: number,
    freqEnd?: number,
  ): void {
    if (!this.ctx || !this.master || this._muted) return;
    const t0 = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(start: number, duration: number, volume: number, cutoff = 900): void {
    if (!this.ctx || !this.master || this._muted) return;
    const t0 = this.ctx.currentTime + start;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  /** Petit clic doux (UI). */
  click(): void {
    this.tone(640, 'triangle', 0, 0.06, 0.25, 480);
  }

  /** « Toc » de construction + souffle de poussière. */
  build(): void {
    this.tone(150, 'sine', 0, 0.18, 0.55, 55);
    this.noise(0.02, 0.22, 0.3, 700);
  }

  /** Arpège « pop / pièce » à la collecte. */
  collect(): void {
    this.tone(660, 'triangle', 0, 0.09, 0.3);
    this.tone(880, 'triangle', 0.06, 0.09, 0.3);
    this.tone(1320, 'triangle', 0.12, 0.14, 0.28);
  }

  /** Pop sec (déblaiement). */
  pop(): void {
    this.tone(300, 'square', 0, 0.05, 0.18, 520);
    this.noise(0, 0.08, 0.15, 1400);
  }

  /** Jingle de montée de niveau. */
  levelUp(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.tone(f, 'triangle', i * 0.09, 0.22, 0.28);
      this.tone(f * 2, 'sine', i * 0.09, 0.18, 0.1);
    });
  }

  /** Bourdonnement d'erreur (action impossible). */
  error(): void {
    this.tone(160, 'square', 0, 0.12, 0.14, 120);
  }

  /** Démolition : effondrement grave. */
  demolish(): void {
    this.tone(190, 'sawtooth', 0, 0.25, 0.22, 50);
    this.noise(0, 0.3, 0.3, 500);
  }
}

export const sfx = new Sfx();
