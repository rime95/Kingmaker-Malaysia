"use client";

// The soundtrack, made in the browser (no recordings, nothing copyrighted): gamelan-style bells, a kompang frame drum,
// soft pads and bass, scheduled a little ahead of time so it never stutters. Three loops (the title theme, the campaign,
// a tense counting night) and short stings for the big moments. Browsers only allow sound after a click, so the
// engine waits for the first one.

export type MusicMode = "title" | "campaign" | "night";
export type Sfx = "click" | "chime" | "gain" | "loss" | "hold" | "call" | "majority" | "fanfare" | "whoosh";

interface Song {
  bpm: number;
  /** Chords, one per bar: root (MIDI) and intervals. */
  chords: { root: number; notes: number[] }[];
  /** Melody scale (MIDI), played on the bells. */
  scale: number[];
  /** 16-step patterns: bass hits, kompang "dum" and "tak", ticks; melody density 0–1. */
  bass: number[];
  dum: number[];
  tak: number[];
  tick: number[];
  melody: number;
  pad: number;
}

const m = (n: number) => 440 * 2 ** ((n - 69) / 12);

const SONGS: Record<MusicMode, Song> = {
  // Grand and slow: D minor, Bb, F, C, with bells over it.
  title: {
    bpm: 78,
    chords: [
      { root: 50, notes: [0, 3, 7, 12] },
      { root: 46, notes: [0, 4, 7, 12] },
      { root: 53, notes: [0, 4, 7, 11] },
      { root: 48, notes: [0, 4, 7, 14] },
    ],
    scale: [62, 64, 65, 69, 70, 74, 76, 77, 81],
    bass: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    dum: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    tak: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    tick: [],
    melody: 0.35,
    pad: 1,
  },
  // Light and moving: G, Em, C, D, with the kompang.
  campaign: {
    bpm: 96,
    chords: [
      { root: 55, notes: [0, 4, 7] },
      { root: 52, notes: [0, 3, 7] },
      { root: 48, notes: [0, 4, 7] },
      { root: 50, notes: [0, 4, 7] },
    ],
    scale: [67, 69, 71, 74, 76, 79, 81],
    bass: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    dum: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    tak: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    tick: [],
    melody: 0.25,
    pad: 0.6,
  },
  // Tense: a Phrygian drone, a ticking clock, a heartbeat drum.
  night: {
    bpm: 116,
    chords: [
      { root: 40, notes: [0, 7, 12, 15] },
      { root: 41, notes: [0, 7, 12, 16] },
      { root: 40, notes: [0, 7, 12, 15] },
      { root: 38, notes: [0, 7, 12, 15] },
    ],
    scale: [64, 65, 67, 71, 72, 76],
    bass: [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    dum: [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    tak: [],
    tick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    melody: 0.12,
    pad: 0.8,
  },
};

class Engine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private mode: MusicMode | null = null;
  private wanted: MusicMode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private next = 0;
  private seed = 1;
  volume = 0.7;
  sfxOn = true;

  /** Create the audio graph on the first user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      // A short white-noise buffer for drums and whooshes.
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (this.wanted) this.play(this.wanted);
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** Switch the music (null: silence). Cross-fades between loops. */
  play(mode: MusicMode | null) {
    this.wanted = mode;
    const ctx = this.ctx;
    if (!ctx || mode === this.mode) return;
    const t = ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0, t, 0.25);
    const start = () => {
      this.mode = mode;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (!mode) return;
      this.step = 0;
      this.next = ctx.currentTime + 0.1;
      this.musicBus.gain.setTargetAtTime(0.55, ctx.currentTime, 0.8);
      this.timer = setInterval(() => this.schedule(), 40);
    };
    if (this.mode) setTimeout(start, 700);
    else start();
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private schedule() {
    const ctx = this.ctx;
    const song = this.mode && SONGS[this.mode];
    if (!ctx || !song) return;
    const dt = 60 / song.bpm / 4;
    while (this.next < ctx.currentTime + 0.2) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % song.chords.length;
      const chord = song.chords[bar];
      const t = this.next;
      if (s === 0 && song.pad) for (const n of chord.notes) this.pad(m(chord.root + 12 + n), t, dt * 16, 0.035 * song.pad);
      if (song.bass[s]) this.bass(m(chord.root - 12), t, dt * 3);
      if (song.dum[s]) this.drum(t, 85, 0.5, 220);
      if (song.tak[s]) this.drum(t, 0, 0.18, 1800);
      if (song.tick[s]) this.tick(t, s % 4 === 0 ? 0.05 : 0.025);
      if (s % 2 === 0 && this.rand() < song.melody) {
        // Melody stays near the chord: pick a scale note, prefer chord tones.
        const pool = song.scale.filter((n) => chord.notes.some((x) => (chord.root + x - n) % 12 === 0));
        const notes = pool.length && this.rand() < 0.6 ? pool : song.scale;
        this.bell(m(notes[Math.floor(this.rand() * notes.length)]), t, 0.09);
      }
      this.step++;
      this.next += dt;
    }
  }

  // --- Instruments -------------------------------------------------------------------------------

  /** A gamelan-ish bell (bonang/saron): FM with an inharmonic ratio and a long ring. */
  private bell(f: number, t: number, vol: number, bus = this.musicBus, len = 1.6) {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 3.5;
    modGain.gain.setValueAtTime(f * 1.4, t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.05, t + len * 0.5);
    mod.connect(modGain).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    car.connect(g).connect(bus);
    car.start(t);
    mod.start(t);
    car.stop(t + len + 0.05);
    mod.stop(t + len + 0.05);
  }

  private pad(f: number, t: number, len: number, vol: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, len * 0.3));
    g.gain.setValueAtTime(vol, t + len * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
    filter.connect(g).connect(this.musicBus);
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filter);
      o.start(t);
      o.stop(t + len + 0.7);
    }
  }

  private bass(f: number, t: number, len: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  /** The kompang: a thump (pitched sine) and a slap (band-passed noise). */
  private drum(t: number, thump: number, vol: number, band: number, bus = this.musicBus) {
    const ctx = this.ctx!;
    if (thump) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(thump * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(thump, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.3);
    }
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = band;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(f).connect(g).connect(bus);
    n.start(t, Math.random() * 0.5, 0.15);
  }

  private tick(t: number, vol: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(f).connect(g).connect(this.musicBus);
    n.start(t, Math.random() * 0.5, 0.04);
  }

  private whoosh(t: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    n.connect(f).connect(g).connect(this.sfxBus);
    n.start(t, 0, 0.5);
  }

  /** A one-shot sound effect. */
  sfx(kind: Sfx) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + 0.01;
    const S = this.sfxBus;
    switch (kind) {
      case "click":
        this.bell(m(84), t, 0.04, S, 0.15);
        break;
      case "chime":
        this.bell(m(81), t, 0.08, S, 0.9);
        break;
      case "hold":
        this.bell(m(69), t, 0.05, S, 0.5);
        break;
      case "gain":
        [76, 81, 88].forEach((n, i) => this.bell(m(n), t + i * 0.07, 0.09, S, 1.2));
        break;
      case "loss":
        [64, 60, 55].forEach((n, i) => this.bell(m(n), t + i * 0.09, 0.07, S, 1));
        break;
      case "call":
        this.whoosh(t);
        this.drum(t + 0.3, 70, 0.9, 200, S);
        this.bell(m(76), t + 0.32, 0.08, S, 1.4);
        break;
      case "whoosh":
        this.whoosh(t);
        break;
      case "majority":
      case "fanfare": {
        // A rising fanfare on bells, a drum roll and a swelling chord.
        const notes = kind === "majority" ? [62, 66, 69, 74, 78, 81, 86] : [67, 71, 74, 79];
        notes.forEach((n, i) => this.bell(m(n), t + i * 0.11, 0.1, S, 2.2));
        for (let i = 0; i < 12; i++) this.drum(t + i * 0.05, 0, 0.12 + i * 0.03, 900, S);
        this.drum(t + 0.62, 75, 1.2, 180, S);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        g.connect(S);
        for (const n of [50, 57, 62, 66]) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = m(n);
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = 1400;
          o.connect(f).connect(g);
          o.start(t);
          o.stop(t + 3.1);
        }
        break;
      }
    }
  }
}

export const audio = typeof window === "undefined" ? null : new Engine();

if (typeof window !== "undefined") {
  const unlock = () => audio?.unlock();
  window.addEventListener("pointerdown", (e) => {
    unlock();
    // A soft click on every button.
    if ((e.target as Element | null)?.closest?.("button:not([disabled])")) audio?.sfx("click");
  });
  window.addEventListener("keydown", unlock);
}

export const sfx = (kind: Sfx) => audio?.sfx(kind);
