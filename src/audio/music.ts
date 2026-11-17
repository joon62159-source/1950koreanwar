/**
 * 배경 음악 — 외부 음원 없이 Web Audio 로 그 자리에서 만들어 낸다(저작권·용량 걱정 없음).
 * 분위기(mood)에 따라 음계·박자·악기 구성이 바뀌고, 곡은 끝없이 이어진다.
 */
export type Mood = 'title' | 'campaign' | 'battle' | 'victory' | 'defeat';

interface MoodDef {
  bpm: number;
  root: number; // MIDI 근음
  scale: number[]; // 근음에서의 반음 간격
  pad: boolean;
  melody: number; // 한 박에 선율이 나올 확률
  drums: 0 | 1 | 2; // 0 없음, 1 행군, 2 전투
  gain: number;
}

const MOODS: Record<Mood, MoodDef> = {
  title: { bpm: 56, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], pad: true, melody: 0.35, drums: 0, gain: 1 },
  campaign: { bpm: 70, root: 50, scale: [0, 2, 3, 5, 7, 8, 11], pad: true, melody: 0.3, drums: 1, gain: 0.95 },
  battle: { bpm: 104, root: 50, scale: [0, 1, 3, 5, 7, 8, 10], pad: true, melody: 0.18, drums: 2, gain: 1 },
  victory: { bpm: 66, root: 48, scale: [0, 2, 4, 5, 7, 9, 11], pad: true, melody: 0.5, drums: 0, gain: 1 },
  defeat: { bpm: 48, root: 43, scale: [0, 2, 3, 5, 7, 8, 10], pad: true, melody: 0.22, drums: 0, gain: 0.9 },
};

const KEY = 'korea1950.music.v1';
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Prefs {
  on: boolean;
  volume: number;
}
function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return { on: p.on !== false, volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.5 };
    }
  } catch {
    /* 저장소를 못 써도 계속 */
  }
  return { on: true, volume: 0.5 };
}

class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private degree = 0;
  private mood: Mood = 'title';
  private prefs: Prefs = loadPrefs();
  private listeners = new Set<() => void>();
  private unlocked = false;

  get on() {
    return this.prefs.on;
  }
  get volume() {
    return this.prefs.volume;
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }
  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.prefs));
    } catch {
      /* 무시 */
    }
  }

  /** 첫 사용자 입력 때 한 번 호출 — 브라우저는 소리를 사용자 동작 뒤에만 허용한다 */
  unlock() {
    if (this.unlocked) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.unlocked = true;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.prefs.on ? this.prefs.volume * 0.5 : 0;
    // 간단한 공간감: 짧은 피드백 딜레이
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.38;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.bus.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(wet);
    wet.connect(this.master);
    this.master.connect(ctx.destination);
    // 흰 잡음 버퍼 (북소리·스네어용)
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextTime = ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 200);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.prefs.on) void this.ctx.resume();
    });
    if (this.prefs.on) void ctx.resume();
  }

  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    this.beat = 0;
    this.degree = 0;
  }

  setOn(on: boolean) {
    this.prefs.on = on;
    this.save();
    this.applyVolume();
    if (on && this.ctx) void this.ctx.resume();
    this.emit();
  }
  setVolume(v: number) {
    this.prefs.volume = Math.min(1, Math.max(0, v));
    this.save();
    this.applyVolume();
    this.emit();
  }
  private applyVolume() {
    if (!this.ctx || !this.master) return;
    const target = this.prefs.on ? this.prefs.volume * 0.5 * MOODS[this.mood].gain : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.prefs.on || ctx.state !== 'running') {
      if (ctx) this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.1);
      return;
    }
    this.applyVolume();
    const mood = MOODS[this.mood];
    const spb = 60 / mood.bpm;
    while (this.nextTime < ctx.currentTime + 0.6) {
      this.playBeat(mood, this.nextTime, spb, this.beat);
      this.nextTime += spb;
      this.beat++;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, attack = 0.02, cutoff = 2400) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.bus!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, kind: 'kick' | 'snare', vol: number) {
    const ctx = this.ctx!;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g);
      g.connect(this.bus!);
      o.start(t);
      o.stop(t + 0.45);
    } else {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      s.connect(f);
      f.connect(g);
      g.connect(this.bus!);
      s.start(t, Math.random() * 0.5, 0.2);
    }
  }

  private playBeat(m: MoodDef, t: number, spb: number, beat: number) {
    const inBar = beat % 4;
    const noteAt = (deg: number, oct: number) => m.root + m.scale[((deg % 7) + 7) % 7] + 12 * oct + 12 * Math.floor(deg / 7);

    // 화음 바탕: 마디(4박)마다 근음이 한 칸씩 움직인다
    if (inBar === 0) {
      const prog = [0, 5, 3, 4, 0, 2, 5, 4];
      this.degree = prog[Math.floor(beat / 4) % prog.length];
      if (m.pad) {
        const dur = spb * 4.2;
        for (const off of [0, 2, 4]) {
          const f = hz(noteAt(this.degree + off, 0));
          this.note(f, t, dur, 'sawtooth', 0.05, spb * 1.4, 700);
          this.note(f * 1.004, t, dur, 'sawtooth', 0.04, spb * 1.4, 700);
        }
        this.note(hz(noteAt(this.degree, -1)), t, dur, 'sine', 0.16, 0.3, 400);
      }
    }
    // 선율: 음계 위를 천천히 걷는다
    if (Math.random() < m.melody) {
      const step = [-2, -1, 0, 1, 2, 3][Math.floor(Math.random() * 6)];
      const deg = this.degree + 7 + step + (Math.random() < 0.25 ? 2 : 0);
      this.note(hz(noteAt(deg, 0)), t + (Math.random() < 0.3 ? spb * 0.5 : 0), spb * 2.2, 'triangle', 0.13, 0.015, 3200);
    }
    // 타악
    if (m.drums === 1) {
      if (inBar === 0 || inBar === 2) this.drum(t, 'kick', 0.5);
      if (inBar === 1 || inBar === 3) this.drum(t, 'snare', 0.1);
    } else if (m.drums === 2) {
      this.drum(t, 'kick', inBar === 0 ? 0.85 : 0.55);
      this.drum(t + spb * 0.5, 'snare', 0.13);
      if (inBar === 3) {
        this.drum(t + spb * 0.25, 'snare', 0.1);
        this.drum(t + spb * 0.75, 'snare', 0.12);
      }
      // 짧게 끊어 치는 저음
      this.note(hz(noteAt(this.degree, -1)), t, spb * 0.45, 'sawtooth', 0.12, 0.01, 500);
    }
  }
}

export const music = new MusicEngine();
