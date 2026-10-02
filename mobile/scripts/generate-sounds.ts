/**
 * Synthesizes the app's sound effects into assets/sounds/*.wav.
 *
 *   npx tsx scripts/generate-sounds.ts
 *
 * Everything is generated from code (modal "wood" synthesis for checkers and
 * dice, additive bells and marimba for rewards) with a fixed seed, so the
 * output is reproducible and there are no third-party audio licences to track.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100;
const OUT_DIR = join(__dirname, '..', 'assets', 'sounds');

// ---------------------------------------------------------------------------
// Tiny DSP toolkit

type Buf = Float32Array;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(20261002);
const between = (lo: number, hi: number) => lo + (hi - lo) * rand();

const buffer = (seconds: number): Buf => new Float32Array(Math.ceil(seconds * SR));

function mixInto(target: Buf, source: Buf, atSeconds: number, gain = 1) {
  const offset = Math.round(atSeconds * SR);
  for (let i = 0; i < source.length && offset + i < target.length; i++) {
    if (offset + i >= 0) target[offset + i] += source[i] * gain;
  }
}

interface Partial {
  /** Frequency in Hz (absolute) */
  freq: number;
  amp: number;
  /** Exponential decay time constant in seconds. */
  tau: number;
}

/** A sum of exponentially decaying sinusoids: the core of struck-object sounds. */
function modal(partials: Partial[], seconds: number, attack = 0.0008): Buf {
  const out = buffer(seconds);
  for (const p of partials) {
    const phase = rand() * Math.PI * 2;
    const w = (2 * Math.PI * p.freq) / SR;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const env = Math.exp(-t / p.tau) * (attack > 0 ? 1 - Math.exp(-t / attack) : 1);
      out[i] += p.amp * env * Math.sin(w * i + phase);
    }
  }
  return fadeTail(out);
}

/** Raised-cosine fade over the end of a buffer so truncated decays never click. */
function fadeTail(buf: Buf, seconds = 0.04): Buf {
  const n = Math.min(buf.length, Math.round(seconds * SR), Math.floor(buf.length * 0.3));
  for (let i = 0; i < n; i++) {
    buf[buf.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
  }
  return buf;
}

function noise(seconds: number): Buf {
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) out[i] = rand() * 2 - 1;
  return out;
}

function envelope(buf: Buf, fn: (t: number) => number): Buf {
  for (let i = 0; i < buf.length; i++) buf[i] *= fn(i / SR);
  return buf;
}

type FilterType = 'lowpass' | 'highpass' | 'bandpass';

/** RBJ cookbook biquad; `freq` may vary over time for sweeps. */
function filter(buf: Buf, type: FilterType, freq: number | ((t: number) => number), q = 0.707): Buf {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const f = typeof freq === 'function' ? freq(i / SR) : freq;
    const w0 = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    let b0: number;
    let b1: number;
    let b2: number;
    if (type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;
    const x0 = buf[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

/** A small Schroeder room so bells and chords don't sound dry and synthetic. */
function reverb(buf: Buf, wet = 0.18, tailSeconds = 0.6): Buf {
  const out = new Float32Array(buf.length + Math.round(tailSeconds * SR));
  out.set(buf);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => ({
    delay: Math.round(d * SR),
    feedback: 0.72,
    line: new Float32Array(Math.round(d * SR)),
    index: 0,
    damp: 0,
  }));
  const allpasses = [0.005, 0.0017].map((d) => ({
    delay: Math.round(d * SR),
    line: new Float32Array(Math.round(d * SR)),
    index: 0,
  }));
  const result = new Float32Array(out.length);
  for (let i = 0; i < out.length; i++) {
    const input = out[i];
    let sum = 0;
    for (const comb of combs) {
      const delayed = comb.line[comb.index];
      // One-pole damping darkens the tail like a real room.
      comb.damp = delayed * 0.6 + comb.damp * 0.4;
      comb.line[comb.index] = input + comb.damp * comb.feedback;
      comb.index = (comb.index + 1) % comb.delay;
      sum += delayed;
    }
    let y = sum * 0.25;
    for (const ap of allpasses) {
      const delayed = ap.line[ap.index];
      const v = y + delayed * 0.7;
      ap.line[ap.index] = v;
      ap.index = (ap.index + 1) % ap.delay;
      y = delayed - v * 0.7;
    }
    result[i] = input * (1 - wet * 0.5) + y * wet;
  }
  return result;
}

/** Scales to a peak level (dBFS), fades the edges and trims trailing silence. */
function finish(buf: Buf, peakDb: number, fadeOutMs = 12): Buf {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? Math.pow(10, peakDb / 20) / peak : 1;
  let end = buf.length;
  const floor = Math.pow(10, -66 / 20) / Math.max(gain, 1e-9);
  while (end > 1 && Math.abs(buf[end - 1]) < floor) end--;
  const out = buf.slice(0, Math.min(buf.length, end + Math.round(0.005 * SR)));
  const fade = Math.round((fadeOutMs / 1000) * SR);
  const fadeIn = Math.round(0.0004 * SR);
  for (let i = 0; i < out.length; i++) {
    let v = out[i] * gain;
    if (i < fadeIn) v *= i / fadeIn;
    const fromEnd = out.length - 1 - i;
    if (fromEnd < fade) v *= fromEnd / fade;
    out[i] = v;
  }
  return out;
}

function writeWav(name: string, buf: Buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(-1, Math.min(1, buf[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(OUT_DIR, `${name}.wav`), Buffer.concat([header, data]));
  console.log(`${name.padEnd(10)} ${(buf.length / SR).toFixed(2)}s  ${((44 + data.length) / 1024).toFixed(0)} KB`);
}

const note = (name: string): number => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = /^([A-G]#?)(\d)$/.exec(name);
  if (!match) throw new Error(name);
  const midi = names.indexOf(match[1]) + (Number(match[2]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

// ---------------------------------------------------------------------------
// Instruments

/** A short high-passed noise tick: the contact "click" at the start of an impact. */
function transient(gain: number, highpass = 1800, ms = 2.5): Buf {
  const n = noise(ms / 1000 + 0.004);
  envelope(n, (t) => Math.exp(-t / (ms / 3000)));
  const out = filter(n, 'highpass', highpass, 0.8);
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

/** A checker landing on the wooden board. */
function woodKnock(pitch: number, weight: number): Buf {
  const out = buffer(0.22);
  const body = modal(
    [
      { freq: 230 * pitch, amp: 0.55 * weight, tau: 0.03 },
      { freq: 505 * pitch, amp: 1, tau: 0.026 },
      { freq: 890 * pitch, amp: 0.62, tau: 0.017 },
      { freq: 1370 * pitch, amp: 0.4, tau: 0.011 },
      { freq: 2140 * pitch, amp: 0.26, tau: 0.007 },
      { freq: 3300 * pitch, amp: 0.14, tau: 0.004 },
    ],
    0.22,
  );
  mixInto(out, body, 0);
  mixInto(out, transient(0.5, 2200), 0);
  return filter(out, 'lowpass', 7000, 0.6);
}

/** Bright plastic click of a die hitting the board. */
function diceClick(gain: number): Buf {
  const spread = () => between(0.9, 1.12);
  const click = modal(
    [
      { freq: 1850 * spread(), amp: 0.8, tau: 0.009 },
      { freq: 3150 * spread(), amp: 1, tau: 0.0065 },
      { freq: 4700 * spread(), amp: 0.6, tau: 0.0045 },
      { freq: 6400 * spread(), amp: 0.3, tau: 0.003 },
      { freq: 330 * spread(), amp: 0.35, tau: 0.014 },
    ],
    0.06,
  );
  mixInto(click, transient(0.6, 2500, 1.5), 0);
  for (let i = 0; i < click.length; i++) click[i] *= gain;
  return click;
}

/** Marimba-like mallet tone: fundamental plus the bar's 4x and 10x overtones. */
function marimba(freq: number, seconds = 0.6, decay = 0.22): Buf {
  return modal(
    [
      { freq, amp: 1, tau: decay },
      { freq: freq * 2, amp: 0.12, tau: decay * 0.5 },
      { freq: freq * 3.93, amp: 0.22, tau: decay * 0.18 },
      { freq: freq * 9.8, amp: 0.06, tau: decay * 0.05 },
    ],
    seconds,
    0.0015,
  );
}

/** Glockenspiel-like bell with inharmonic partials. */
function bell(freq: number, seconds = 0.9, decay = 0.38): Buf {
  return modal(
    [
      { freq, amp: 1, tau: decay },
      { freq: freq * 2.76, amp: 0.36, tau: decay * 0.42 },
      { freq: freq * 5.4, amp: 0.16, tau: decay * 0.2 },
      { freq: freq * 8.93, amp: 0.07, tau: decay * 0.1 },
    ],
    seconds,
    0.0012,
  );
}

/** Soft rounded tone for gentle "not quite" cues. */
function softTone(freq: number, seconds: number, decay: number): Buf {
  const out = modal(
    [
      { freq, amp: 1, tau: decay },
      { freq: freq * 2, amp: 0.22, tau: decay * 0.6 },
      { freq: freq * 3, amp: 0.06, tau: decay * 0.4 },
    ],
    seconds,
    0.004,
  );
  return filter(out, 'lowpass', 1800, 0.7);
}

/** Warm brass-like chord voice: band-limited saw with a filter swell. */
function brassVoice(freq: number, seconds: number): Buf {
  const out = buffer(seconds);
  const detunes = [-0.0025, 0.0025];
  for (const detune of detunes) {
    const f = freq * (1 + detune);
    const harmonics = Math.min(14, Math.floor(9000 / f));
    for (let h = 1; h <= harmonics; h++) {
      const w = (2 * Math.PI * f * h) / SR;
      const amp = 1 / h;
      const phase = rand() * Math.PI * 2;
      for (let i = 0; i < out.length; i++) {
        const t = i / SR;
        const vibrato = t > 0.25 ? 1 + 0.003 * Math.sin(2 * Math.PI * 5.2 * t) : 1;
        out[i] += amp * Math.sin(w * i * vibrato + phase) * 0.5;
      }
    }
  }
  envelope(out, (t) => Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.08) / 0.55));
  fadeTail(out, 0.25);
  return filter(out, 'lowpass', (t) => 900 + 2600 * Math.exp(-Math.pow((t - 0.09) / 0.12, 2)) + 600 * Math.exp(-t / 0.5), 0.9);
}

/** Tiny high glints scattered over a span, for sparkle on rewards. */
function sparkles(seconds: number, count: number, from: number, to: number, gain: number): Buf {
  const out = buffer(seconds);
  const pentatonic = ['C7', 'D7', 'E7', 'G7', 'A7', 'C8'].map(note);
  for (let i = 0; i < count; i++) {
    const at = between(from, to);
    const freq = pentatonic[Math.floor(rand() * pentatonic.length)];
    const fade = 1 - (at - from) / Math.max(0.001, to - from);
    const glint = modal(
      [
        { freq, amp: 1, tau: 0.06 },
        { freq: freq * 2.76, amp: 0.25, tau: 0.02 },
      ],
      0.25,
      0.001,
    );
    mixInto(out, glint, at, gain * (0.4 + 0.6 * fade) * between(0.6, 1));
  }
  return out;
}

function whooshNoise(seconds: number, fromHz: number, toHz: number): Buf {
  const n = noise(seconds);
  const swept = filter(n, 'bandpass', (t) => fromHz * Math.pow(toHz / fromHz, Math.min(1, t / seconds)), 1.4);
  return envelope(swept, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / seconds)), 1.6));
}

// ---------------------------------------------------------------------------
// Sounds

const sounds: Record<string, () => Buf> = {
  // GAME ---------------------------------------------------------------------
  place1: () => finish(woodKnock(1, 1), -3),
  place2: () => {
    const out = woodKnock(1.07, 0.9);
    // A second, smaller clack against the stack.
    mixInto(out, woodKnock(1.9, 0.3), 0.011, 0.22);
    return finish(out, -3.5);
  },
  place3: () => finish(woodKnock(0.93, 1.1), -3),
  select: () => {
    const out = modal(
      [
        { freq: 980, amp: 0.7, tau: 0.012 },
        { freq: 1820, amp: 1, tau: 0.009 },
        { freq: 2950, amp: 0.45, tau: 0.006 },
      ],
      0.09,
    );
    mixInto(out, transient(0.35, 2600, 1.2), 0);
    return finish(filter(out, 'lowpass', 6500), -11);
  },
  hit: () => {
    const out = buffer(0.42);
    mixInto(out, woodKnock(0.82, 1.4), 0, 1);
    mixInto(out, woodKnock(1.55, 0.6), 0.016, 0.7);
    // Low thump with a slight pitch drop.
    const thump = buffer(0.2);
    let phase = 0;
    for (let i = 0; i < thump.length; i++) {
      const t = i / SR;
      const f = 70 + 60 * Math.exp(-t / 0.03);
      phase += (2 * Math.PI * f) / SR;
      thump[i] = Math.sin(phase) * Math.exp(-t / 0.06) * (1 - Math.exp(-t / 0.002));
    }
    mixInto(out, thump, 0, 0.75);
    mixInto(out, whooshNoise(0.2, 900, 3800), 0.03, 0.08);
    return finish(out, -1.5);
  },
  bearoff: () => {
    const out = buffer(0.3);
    const knock = modal(
      [
        { freq: 300, amp: 0.8, tau: 0.045 },
        { freq: 720, amp: 1, tau: 0.03 },
        { freq: 1260, amp: 0.55, tau: 0.018 },
        { freq: 2050, amp: 0.25, tau: 0.009 },
      ],
      0.3,
    );
    mixInto(out, knock, 0);
    mixInto(out, transient(0.4, 1800), 0);
    // A small bounce in the tray.
    mixInto(out, woodKnock(1.2, 0.5), 0.045, 0.28);
    return finish(filter(out, 'lowpass', 6000), -3.5);
  },
  dice: () => {
    const out = buffer(0.62);
    const dieA = [0, 0.064, 0.12, 0.168, 0.207, 0.238, 0.263, 0.283, 0.298, 0.31];
    const dieB = [0.022, 0.081, 0.133, 0.18, 0.218, 0.249, 0.272, 0.29, 0.303];
    for (const [i, at] of dieA.entries()) mixInto(out, diceClick(Math.pow(0.84, i)), at);
    for (const [i, at] of dieB.entries()) mixInto(out, diceClick(0.9 * Math.pow(0.83, i)), at);
    // Soft rolling bed underneath the clicks.
    const bed = filter(noise(0.4), 'lowpass', 1600, 0.6);
    envelope(bed, (t) => Math.sin(Math.PI * Math.min(1, t / 0.36)) * 0.05);
    mixInto(out, bed, 0);
    return finish(out, -3);
  },

  // REWARD -------------------------------------------------------------------
  success: () => {
    const out = buffer(1.0);
    mixInto(out, marimba(note('A5'), 0.7, 0.2), 0, 0.85);
    mixInto(out, marimba(note('E6'), 0.8, 0.26), 0.105, 1);
    mixInto(out, bell(note('E7'), 0.5, 0.15), 0.105, 0.06);
    return finish(reverb(out, 0.16, 0.5), -2.5, 40);
  },
  xp: () => {
    const out = buffer(0.5);
    mixInto(out, bell(note('C7'), 0.35, 0.08), 0, 0.8);
    mixInto(out, bell(note('G7'), 0.35, 0.09), 0.045, 1);
    return finish(reverb(out, 0.12, 0.3), -9, 30);
  },
  star1: () => star('E6'),
  star2: () => star('G6'),
  star3: () => star('C7'),
  complete: () => {
    const out = buffer(2.0);
    const melody: [string, number][] = [
      ['G5', 0],
      ['C6', 0.11],
      ['E6', 0.22],
      ['G6', 0.33],
    ];
    for (const [n, at] of melody) mixInto(out, marimba(note(n), 0.8, 0.24), at, 0.8);
    mixInto(out, bell(note('C7'), 1.4, 0.55), 0.47, 0.75);
    for (const n of ['C5', 'E5', 'G5']) mixInto(out, brassVoice(note(n), 1.2), 0.45, 0.07);
    mixInto(out, sparkles(2, 7, 0.5, 1.2, 0.18), 0);
    return finish(reverb(out, 0.2, 0.7), -1.5, 80);
  },
  levelup: () => {
    const out = buffer(2.6);
    const arpeggio: [string, number][] = [
      ['C6', 0],
      ['E6', 0.075],
      ['G6', 0.15],
      ['C7', 0.225],
    ];
    for (const [n, at] of arpeggio) mixInto(out, bell(note(n), 0.9, 0.3), at, 0.55);
    for (const n of ['C4', 'G4', 'C5', 'E5', 'G5']) mixInto(out, brassVoice(note(n), 1.9), 0.3, 0.14);
    mixInto(out, bell(note('C7'), 1.8, 0.7), 0.31, 0.5);
    mixInto(out, bell(note('E7'), 1.6, 0.6), 0.33, 0.25);
    mixInto(out, sparkles(2.6, 16, 0.35, 1.6, 0.22), 0);
    mixInto(out, whooshNoise(0.35, 600, 5000), 0, 0.05);
    return finish(reverb(out, 0.22, 0.9), -1, 120);
  },
  unlock: () => {
    const out = buffer(1.3);
    const latch = (freqScale: number) =>
      modal(
        [
          { freq: 2350 * freqScale, amp: 1, tau: 0.012 },
          { freq: 3850 * freqScale, amp: 0.7, tau: 0.008 },
          { freq: 5500 * freqScale, amp: 0.35, tau: 0.005 },
          { freq: 640 * freqScale, amp: 0.3, tau: 0.02 },
        ],
        0.1,
      );
    mixInto(out, latch(1), 0, 0.45);
    mixInto(out, transient(0.3, 3000), 0);
    mixInto(out, latch(0.82), 0.075, 0.6);
    mixInto(out, transient(0.35, 2600), 0.075);
    const rise: [string, number][] = [
      ['G6', 0.16],
      ['B6', 0.22],
      ['D7', 0.28],
    ];
    for (const [n, at] of rise) mixInto(out, bell(note(n), 0.9, 0.32), at, 0.5);
    mixInto(out, whooshNoise(0.4, 700, 5200), 0.1, 0.06);
    mixInto(out, sparkles(1.3, 6, 0.3, 0.8, 0.14), 0);
    return finish(reverb(out, 0.18, 0.6), -2, 80);
  },

  // UI -----------------------------------------------------------------------
  error: () => {
    const out = buffer(0.6);
    mixInto(out, softTone(note('D4'), 0.4, 0.1), 0, 0.9);
    mixInto(out, softTone(note('A#3'), 0.45, 0.13), 0.11, 1);
    return finish(reverb(out, 0.08, 0.3), -7, 40);
  },
  tap: () => {
    const out = modal(
      [
        { freq: 1650, amp: 1, tau: 0.006 },
        { freq: 3100, amp: 0.4, tau: 0.003 },
      ],
      0.04,
    );
    mixInto(out, transient(0.25, 3000, 0.8), 0);
    return finish(out, -14, 5);
  },
  whoosh: () => finish(whooshNoise(0.32, 450, 3200), -12, 30),
};

function star(name: string): Buf {
  const out = buffer(1.1);
  // A soft "pop" as the star appears.
  const pop = buffer(0.08);
  let phase = 0;
  for (let i = 0; i < pop.length; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (200 + 500 * Math.exp(-t / 0.012))) / SR;
    pop[i] = Math.sin(phase) * Math.exp(-t / 0.018);
  }
  mixInto(out, pop, 0, 0.28);
  mixInto(out, bell(note(name), 1.0, 0.36), 0.008, 1);
  mixInto(out, sparkles(1.1, 5, 0.02, 0.32, 0.16), 0);
  return finish(reverb(out, 0.16, 0.5), -3, 60);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, make] of Object.entries(sounds)) writeWav(name, make());
