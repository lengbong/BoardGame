/**
 * 오케스트라풍 배경음악 엔진 — 금관·현악·목관·하프·팀파니·심벌을 WebAudio로 합성하고, 홀 잔향을 입힌다.
 * 음원 파일 없이 악보(짧은 글자)만으로 곡을 만든다. (예: games/airline/song.ts)
 *
 * 악보 글자
 * - 음: `Bb4:q` = 내림나(4옥타브) 4분음표. 가운데 도는 C4. 길이를 빼면 앞 음 길이를 그대로 쓴다.
 * - 길이: w(온) h(2분) q(4분) e(8분) s(16분), 점음표 `q.`, 셋잇단 `et`, 붙임 `h+q`
 * - 화음 `[Bb3,D4,F4]:h`, 쉼표 `r:q`, 타악기 한 번 치기 `x:q`, 마디줄 `|` (마디 경계가 아니면 오류)
 * - 꾸밈: `>` 세게, `'` 짧게(스타카토), `<` 점점 크게(부풀기)
 * - 화음 진행(반주용): `Bb:w | Eb/G:h F7:h` — m, 7, maj7, m7, sus4, sus2, add9, dim, aug, 6, 9, `/베이스`
 *
 * 섹션마다 손으로 쓴 선율(parts)에 더해, 화음 진행과 반주 모양(style)으로 현악 화음·베이스·팀파니·작은북이 저절로 붙는다.
 */

/** 한 박 = 12틱 (16분음표 3틱, 셋잇단 8분음표 4틱) */
export const TPB = 12;
/** 4/4박자 한 마디 */
export const BAR = TPB * 4;

export type Inst =
  | 'trumpet'
  | 'horn'
  | 'trombone'
  | 'strings'
  | 'violins'
  | 'cello'
  | 'bass'
  | 'pizz'
  | 'flute'
  | 'oboe'
  | 'harp'
  | 'glock'
  | 'timp'
  | 'timproll'
  | 'snare'
  | 'snareroll'
  | 'bassdrum'
  | 'crash'
  | 'cymroll'
  | 'triangle';

/** 음높이가 없는 타악기 (악보에 `x`로 적는다) */
export const UNPITCHED: ReadonlySet<Inst> = new Set<Inst>(['snare', 'snareroll', 'bassdrum', 'crash', 'cymroll', 'triangle']);

/** 악기마다 소리 낼 수 있는 음역 (MIDI). 테스트에서 악보가 이 안에 있는지 본다. */
export const RANGE: Partial<Record<Inst, [number, number]>> = {
  trumpet: [52, 84],
  horn: [41, 77],
  trombone: [34, 72],
  strings: [43, 96],
  violins: [55, 100],
  cello: [36, 76],
  bass: [28, 55],
  pizz: [36, 96],
  flute: [60, 96],
  oboe: [58, 91],
  harp: [36, 103],
  glock: [79, 108],
  timp: [38, 57],
  timproll: [38, 57],
};

export interface Layer {
  inst: Inst;
  /** 반음 단위로 옮기기 (12 = 한 옥타브 위) */
  shift?: number;
  vol?: number;
}

/** 손으로 쓴 한 줄 (선율, 화음, 타악기) */
export interface Part {
  inst: Inst;
  notes: string;
  vol?: number;
  shift?: number;
  /** 같은 선율을 함께 연주하는 악기 (예: 트럼펫 + 바이올린 한 옥타브 위) */
  with?: Layer[];
}

/**
 * 반주 모양
 * - pad: 현악이 화음을 길게, 베이스는 근음
 * - march: 행진곡 (1·3박 베이스와 팀파니, 2·4박 호른 화음, 작은북)
 * - drive: 첼로가 '따-다다' 질주, 팀파니 (앞으로 나아가는 느낌)
 * - hymn: 금관·현악 전부가 화음을 크게 (절정)
 * - none: 반주 없음 (손으로 다 적을 때)
 */
export type Style = 'none' | 'pad' | 'march' | 'drive' | 'hymn';

export interface Section {
  name: string;
  bars: number;
  /** 화음 진행. style 반주와 roll·crash의 음높이에 쓴다. */
  chords?: string;
  style?: Style;
  /** 반주 세기 0~1 (기본 0.8) */
  dyn?: number;
  /** 하프 분산화음 (반짝이는 장식) */
  harp?: boolean;
  /** 섹션 첫 박에 심벌·큰북·팀파니 */
  crash?: boolean;
  /** 섹션 끝 몇 박 동안 팀파니 롤과 심벌이 점점 커지며 다음 섹션으로 */
  roll?: number;
  /** 이 섹션 전체(선율과 화음)를 반음 단위로 옮기기 — 조옮김 */
  transpose?: number;
  parts: Part[];
}

export interface Score {
  kind: 'orchestra';
  title: string;
  bpm: number;
  sections: Section[];
  /** 반복할 때 돌아갈 섹션 번호 (앞 섹션은 처음 한 번만). 없으면 한 번만 연주 (짧은 팡파르) */
  loopFrom?: number;
  /** 전체 소리 크기 (없으면 startMusic·playJingle 기본값) */
  volume?: number;
}

export interface NoteEvent {
  tick: number;
  /** 소리 나는 길이 (틱) */
  dur: number;
  inst: Inst;
  midi: number;
  vel: number;
  swell?: boolean;
  /** 반주 화음: 가볍게 합성한다 (오실레이터를 덜 써서 느린 컴퓨터에서도 끊기지 않게) */
  light?: boolean;
}

export interface Compiled {
  title: string;
  bpm: number;
  events: NoteEvent[];
  /** 반복 구간의 음들 (loopStart 이후) */
  loopEvents: NoteEvent[];
  length: number;
  loopStart: number | null;
  /** 마지막 음이 끝나는 틱 (팡파르 길이 계산용) */
  end: number;
}

/* ───────────────────────── 악보 읽기 ───────────────────────── */

const DUR: Record<string, number> = { w: 48, h: 24, q: 12, e: 6, s: 3 };

export function parseDuration(text: string): number {
  let total = 0;
  for (const piece of text.split('+')) {
    const m = /^([whqes])(t|\.)?$/.exec(piece);
    if (!m) throw new Error(`길이를 읽을 수 없어요: ${text}`);
    let d = DUR[m[1]];
    if (m[2] === '.') d *= 1.5;
    if (m[2] === 't') d = (d * 2) / 3;
    if (!Number.isInteger(d)) throw new Error(`틱으로 나눠지지 않는 길이: ${text}`);
    total += d;
  }
  return total;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchClass(name: string): number {
  const m = /^([A-G])(#|b)?$/.exec(name);
  if (!m) throw new Error(`음 이름을 읽을 수 없어요: ${name}`);
  return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}

/** 'Bb4' → 70 (가운데 도 C4 = 60) */
export function noteNumber(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`음을 읽을 수 없어요: ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export interface LineNote {
  tick: number;
  dur: number;
  pitches: number[];
  accent: boolean;
  staccato: boolean;
  swell: boolean;
}

/** 악보 한 줄을 음 목록으로. length = 전체 길이(틱) */
export function parseLine(text: string): { notes: LineNote[]; length: number } {
  const notes: LineNote[] = [];
  let pos = 0;
  let last = TPB;
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') {
      if (pos % BAR !== 0) throw new Error(`마디줄이 마디 경계에 있지 않아요 (${pos / TPB}박): …${tok}`);
      continue;
    }
    const m = /^(r|x|\[[^\]]+\]|[A-G][#b]?-?\d)(?::([whqest.+]+))?([>'<]*)$/.exec(tok);
    if (!m) throw new Error(`악보를 읽을 수 없어요: ${tok}`);
    const dur = m[2] ? parseDuration(m[2]) : last;
    last = dur;
    if (m[1] !== 'r') {
      const pitches = m[1] === 'x' ? [0] : m[1].startsWith('[') ? m[1].slice(1, -1).split(',').map((s) => noteNumber(s.trim())) : [noteNumber(m[1])];
      notes.push({ tick: pos, dur, pitches, accent: m[3].includes('>'), staccato: m[3].includes("'"), swell: m[3].includes('<') });
    }
    pos += dur;
  }
  return { notes, length: pos };
}

const QUALITY: [string, number[]][] = [
  ['maj7', [0, 4, 7, 11]],
  ['m7b5', [0, 3, 6, 10]],
  ['m7', [0, 3, 7, 10]],
  ['7sus4', [0, 5, 7, 10]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
  ['add9', [0, 2, 4, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['m6', [0, 3, 7, 9]],
  ['m', [0, 3, 7]],
  ['7', [0, 4, 7, 10]],
  ['9', [0, 2, 4, 7, 10]],
  ['6', [0, 4, 7, 9]],
  ['', [0, 4, 7]],
];

export interface Chord {
  /** 근음 (0=C … 11=B) */
  root: number;
  /** 화음 구성음 (음이름 번호) */
  tones: number[];
  bass: number;
}

export function parseChord(symbol: string): Chord {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol);
  if (!m) throw new Error(`화음을 읽을 수 없어요: ${symbol}`);
  const q = QUALITY.find(([name]) => name === m[2]);
  if (!q) throw new Error(`모르는 화음 종류: ${symbol}`);
  const root = pitchClass(m[1]);
  return { root, tones: q[1].map((i) => (root + i) % 12), bass: m[3] ? pitchClass(m[3]) : root };
}

export interface ChordSpan {
  tick: number;
  dur: number;
  chord: Chord | null;
}

/** 'Bb:w | Eb/G:h F7:h' → 화음과 시작 틱 */
export function parseChords(text: string): { spans: ChordSpan[]; length: number } {
  const spans: ChordSpan[] = [];
  let pos = 0;
  let last = BAR;
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') {
      if (pos % BAR !== 0) throw new Error(`화음 마디줄이 마디 경계에 있지 않아요: ${text}`);
      continue;
    }
    const [sym, dur] = tok.split(':');
    const d = dur ? parseDuration(dur) : last;
    last = d;
    spans.push({ tick: pos, dur: d, chord: sym === 'N' ? null : parseChord(sym) });
    pos += d;
  }
  return { spans, length: pos };
}

function transposeChord(c: Chord, n: number): Chord {
  const t = (pc: number) => (((pc + n) % 12) + 12) % 12;
  return { root: t(c.root), tones: c.tones.map(t), bass: t(c.bass) };
}

/** pc 음이름 중 lo 이상에서 가장 낮은 음 */
function above(pc: number, lo: number): number {
  return lo + ((((pc - lo) % 12) + 12) % 12);
}

/** 화음 구성음을 lo부터 한 옥타브 안에 모아 쌓는다 */
function voicing(c: Chord, lo: number): number[] {
  return [...new Set(c.tones.map((pc) => above(pc, lo)))].sort((a, b) => a - b);
}

/* ───────────────────────── 악보 → 음 목록 ───────────────────────── */

const compiledCache = new WeakMap<Score, Compiled>();

export function compile(score: Score): Compiled {
  const cached = compiledCache.get(score);
  if (cached) return cached;
  const events: NoteEvent[] = [];
  let start = 0;
  let loopStart: number | null = null;
  score.sections.forEach((sec, si) => {
    if (si === score.loopFrom) loopStart = start;
    const len = sec.bars * BAR;
    const tr = sec.transpose ?? 0;
    const where = `${score.title} / ${sec.name}`;
    for (const part of sec.parts) {
      const line = parseLine(part.notes);
      if (line.length !== len) throw new Error(`${where} / ${part.inst}: ${line.length / TPB}박 (섹션은 ${sec.bars * 4}박)`);
      const layers: Layer[] = [{ inst: part.inst }, ...(part.with ?? [])];
      for (const n of line.notes) {
        for (const layer of layers) {
          const unpitched = UNPITCHED.has(layer.inst);
          for (const p of unpitched ? [0] : n.pitches) {
            events.push({
              tick: start + n.tick,
              dur: n.dur * (n.staccato ? 0.45 : 0.94),
              inst: layer.inst,
              midi: unpitched ? 0 : p + tr + (part.shift ?? 0) + (layer.shift ?? 0),
              vel: (part.vol ?? 1) * (layer.vol ?? 1) * (n.accent ? 1.25 : 1),
              swell: n.swell || undefined,
            });
          }
        }
      }
    }
    if (sec.chords) {
      const { spans, length } = parseChords(sec.chords);
      if (length !== len) throw new Error(`${where} / 화음: ${length / TPB}박 (섹션은 ${sec.bars * 4}박)`);
      const moved = spans.map((s) => ({ ...s, tick: s.tick + start, chord: s.chord && transposeChord(s.chord, tr) }));
      accompany(events, moved, start, sec);
    }
    start += len;
  });
  events.sort((a, b) => a.tick - b.tick);
  const end = events.reduce((m, e) => Math.max(m, e.tick + e.dur), 0);
  const ls: number | null = loopStart;
  const result: Compiled = {
    title: score.title,
    bpm: score.bpm,
    events,
    loopEvents: ls === null ? [] : events.filter((e) => e.tick >= ls),
    length: start,
    loopStart: ls,
    end,
  };
  compiledCache.set(score, result);
  return result;
}

/** 화음 진행과 반주 모양으로 현악 화음·베이스·팀파니·작은북을 만든다 */
function accompany(out: NoteEvent[], spans: ChordSpan[], secStart: number, sec: Section): void {
  const style = sec.style ?? 'pad';
  const dyn = sec.dyn ?? 0.8;
  const add = (tick: number, dur: number, inst: Inst, midi: number, vel: number) => out.push({ tick, dur, inst, midi, vel, light: true });
  const beatInBar = (tick: number) => Math.floor((tick - secStart) / TPB) % 4;

  for (const span of spans) {
    const c = span.chord;
    if (!c) continue;
    const pad = voicing(c, 55);
    const low = above(c.bass, 33);
    const timpRoot = above(c.root, 41);
    const timpFifth = above((c.root + 7) % 12, 41);
    const beats = Math.max(1, Math.round(span.dur / TPB));
    const barStart = (span.tick - secStart) % BAR === 0;

    if (style === 'pad') {
      for (const n of pad) add(span.tick, span.dur, 'strings', n, 0.55 * dyn);
      add(span.tick, span.dur, 'bass', low, 0.55 * dyn);
      add(span.tick, span.dur, 'cello', low + 12, 0.45 * dyn);
      if (dyn >= 0.7) for (const n of voicing(c, 50).slice(0, 2)) add(span.tick, span.dur, 'horn', n, 0.3 * dyn);
      if (barStart) add(span.tick, TPB, 'timp', timpRoot, 0.3 * dyn);
    } else if (style === 'march') {
      for (const n of pad) add(span.tick, span.dur, 'strings', n, 0.38 * dyn);
      for (let b = 0; b < beats; b++) {
        const t = span.tick + b * TPB;
        const bi = beatInBar(t);
        if (bi === 0 || bi === 2) {
          const bass = bi === 0 ? low : above((c.root + 7) % 12, 33);
          add(t, 9, 'bass', bass, 0.6 * dyn);
          add(t, 9, 'cello', bass + 12, 0.45 * dyn);
          add(t, TPB, 'timp', bi === 0 ? timpRoot : timpFifth, 0.38 * dyn);
          if (bi === 0) add(t, TPB, 'bassdrum', 0, 0.3 * dyn);
        } else {
          for (const n of voicing(c, 53)) add(t, 5, 'horn', n, 0.32 * dyn);
          add(t, 3, 'snare', 0, 0.32 * dyn);
          if (bi === 3) {
            add(t + 6, 2, 'snare', 0, 0.16 * dyn);
            add(t + 9, 2, 'snare', 0, 0.2 * dyn);
          }
        }
      }
    } else if (style === 'drive') {
      for (const n of pad) add(span.tick, span.dur, 'strings', n, 0.34 * dyn);
      for (let b = 0; b < beats; b++) {
        const t = span.tick + b * TPB;
        const bi = beatInBar(t);
        add(t, 5, 'cello', low + 12, 0.5 * dyn);
        add(t + 6, 2.5, 'cello', low + 12, 0.36 * dyn);
        add(t + 9, 2.5, 'cello', low + 12, 0.4 * dyn);
        if (bi === 0 || bi === 2) {
          add(t, 10, 'bass', low, 0.5 * dyn);
          add(t, TPB, 'timp', bi === 0 ? timpRoot : timpFifth, 0.36 * dyn);
        }
        if (bi === 0) add(t, TPB, 'bassdrum', 0, 0.26 * dyn);
        if (bi === 1 || bi === 3) add(t, 3, 'snare', 0, 0.2 * dyn);
      }
    } else if (style === 'hymn') {
      for (const n of pad) add(span.tick, span.dur, 'strings', n, 0.6 * dyn);
      for (const n of voicing(c, 53).slice(0, 3)) add(span.tick, span.dur, 'horn', n, 0.36 * dyn);
      add(span.tick, span.dur, 'trombone', above(c.bass, 43), 0.36 * dyn);
      add(span.tick, span.dur, 'trombone', above((c.root + 7) % 12, 48), 0.3 * dyn);
      add(span.tick, span.dur, 'bass', low, 0.6 * dyn);
      add(span.tick, span.dur, 'cello', low + 12, 0.5 * dyn);
      add(span.tick, TPB, 'timp', timpRoot, 0.5 * dyn);
      for (let b = 2; b < beats; b += 2) add(span.tick + b * TPB, TPB, 'timp', timpFifth, 0.3 * dyn);
      if (barStart) add(span.tick, TPB, 'bassdrum', 0, 0.26 * dyn);
    }

    if (sec.harp) {
      // 화음을 두 옥타브에 걸쳐 8분음표로 오르내린다
      const base = voicing(c, 62);
      const ladder = [...base, ...base.map((n) => n + 12), base[0] + 24];
      const path = [...ladder, ...ladder.slice(1, -1).reverse()];
      for (let i = 0; i * 6 < span.dur; i++) add(span.tick + i * 6, 6, 'harp', path[i % path.length], 0.42 * dyn);
    }
  }

  const first = spans.find((s) => s.chord);
  if (sec.crash && first?.chord) {
    add(secStart, BAR, 'crash', 0, 0.75);
    add(secStart, TPB, 'bassdrum', 0, 0.55);
    add(secStart, TPB, 'timp', above(first.chord.root, 41), 0.65);
  }
  const lastSpan = [...spans].reverse().find((s) => s.chord);
  if (sec.roll && lastSpan?.chord) {
    const d = sec.roll * TPB;
    const t = secStart + sec.bars * BAR - d;
    add(t, d, 'timproll', above(lastSpan.chord.bass, 41), 0.75);
    add(t, d, 'cymroll', 0, 0.6);
  }
}

/* ───────────────────────── 소리 합성 ───────────────────────── */

const LEVEL: Record<Inst, number> = {
  trumpet: 0.15,
  horn: 0.12,
  trombone: 0.12,
  strings: 0.055,
  violins: 0.075,
  cello: 0.075,
  bass: 0.13,
  pizz: 0.12,
  flute: 0.17,
  oboe: 0.11,
  harp: 0.13,
  glock: 0.06,
  timp: 0.45,
  timproll: 0.22,
  snare: 0.22,
  snareroll: 0.12,
  bassdrum: 0.5,
  crash: 0.11,
  cymroll: 0.08,
  triangle: 0.04,
};

const PAN: Record<Inst, number> = {
  trumpet: 0.12,
  horn: -0.28,
  trombone: 0.3,
  strings: -0.05,
  violins: -0.38,
  cello: 0.35,
  bass: 0.42,
  pizz: -0.2,
  flute: -0.15,
  oboe: 0.12,
  harp: -0.5,
  glock: 0.38,
  timp: -0.12,
  timproll: -0.12,
  snare: 0.18,
  snareroll: 0.18,
  bassdrum: 0,
  crash: 0.28,
  cymroll: -0.25,
  triangle: 0.45,
};

function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ac: BaseAudioContext): AudioBuffer {
  let buf = noises.get(ac);
  if (!buf) {
    buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noises.set(ac, buf);
  }
  return buf;
}

/** 홀 잔향: 점점 어두워지며 사라지는 잡음을 직접 만든다 (한 채널, 계산을 아끼려고) */
const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();
function impulse(ac: BaseAudioContext): AudioBuffer {
  let buf = impulses.get(ac);
  if (!buf) {
    const seconds = 2.4;
    const len = Math.floor(ac.sampleRate * seconds);
    buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const k = 0.75 - 0.6 * x; // 뒤로 갈수록 높은 소리가 먼저 사라진다
      y += (Math.random() * 2 - 1 - y) * k;
      const pre = i < ac.sampleRate * 0.012 ? 0 : 1;
      d[i] = y * Math.pow(1 - x, 2.4) * pre;
    }
    impulses.set(ac, buf);
  }
  return buf;
}

interface Chain {
  dry: GainNode;
  send: GainNode;
}

/** 컨텍스트마다 하나: 잔향과 압축기를 거쳐 스피커로 */
const chains = new WeakMap<BaseAudioContext, Chain>();
function chain(ac: BaseAudioContext): Chain {
  let c = chains.get(ac);
  if (!c) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.25;
    comp.connect(ac.destination);
    const dry = ac.createGain();
    dry.connect(comp);
    // 잔향은 한 채널로 계산하고, 오른쪽만 살짝 늦춰 좌우로 퍼지게 한다
    const send = ac.createGain();
    send.gain.value = 0.36;
    send.channelCount = 1;
    send.channelCountMode = 'explicit';
    const verb = ac.createConvolver();
    verb.channelCount = 1;
    verb.channelCountMode = 'explicit';
    verb.buffer = impulse(ac);
    const merge = ac.createChannelMerger(2);
    const late = ac.createDelay(0.05);
    late.delayTime.value = 0.019;
    send.connect(verb);
    verb.connect(merge, 0, 0);
    verb.connect(late).connect(merge, 0, 1);
    merge.connect(comp);
    c = { dry, send };
    chains.set(ac, c);
  }
  return c;
}

/** 곡 하나(또는 팡파르 하나)의 출구. master로 소리를 키우고 줄인다. */
export interface Bus {
  ac: BaseAudioContext;
  master: GainNode;
  outs: Map<Inst, AudioNode>;
  /** 코러스용으로 계속 도는 떨림 (closeBus에서 멈춘다) */
  lfos: OscillatorNode[];
}

export function createBus(ac: BaseAudioContext, volume: number): Bus {
  const c = chain(ac);
  const master = ac.createGain();
  master.gain.value = volume;
  master.connect(c.dry);
  master.connect(c.send);
  return { ac, master, outs: new Map(), lfos: [] };
}

export function closeBus(bus: Bus): void {
  bus.master.disconnect();
  for (const l of bus.lfos) {
    try {
      l.stop();
    } catch {
      // 이미 멈췄다
    }
  }
  bus.lfos = [];
}

/** 음마다 필터를 만들지 않고 악기 출구에서 한 번만 거른다 */
const SHARED_FILTER: Partial<Record<Inst, number>> = { strings: 2800, violins: 5200, cello: 1600, bass: 700, harp: 3600, pizz: 2200 };
/** 여러 명이 함께 켜는 느낌(코러스)을 악기 출구에서 입힌다 */
const ENSEMBLE: ReadonlySet<Inst> = new Set<Inst>(['strings', 'violins']);

function panTo(ac: BaseAudioContext, value: number, dst: AudioNode): AudioNode {
  if (typeof ac.createStereoPanner !== 'function') return dst;
  const p = ac.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, value));
  p.connect(dst);
  return p;
}

/** 악기마다 한 번만 만드는 출구: 소리 크기 → (공용 필터) → (합주 코러스) → 좌우 자리 */
function out(bus: Bus, inst: Inst): AudioNode {
  const made = bus.outs.get(inst);
  if (made) return made;
  const ac = bus.ac;
  const g = ac.createGain();
  g.gain.value = LEVEL[inst];
  let tail: AudioNode = g;
  const cut = SHARED_FILTER[inst];
  if (cut) {
    const lp = filter(ac, 'lowpass', cut, 0.5);
    tail.connect(lp);
    tail = lp;
  }
  const pan = PAN[inst];
  tail.connect(panTo(ac, pan, bus.master));
  if (ENSEMBLE.has(inst)) {
    // 조금씩 늦고 흔들리는 두 갈래를 좌우로 벌린다
    const voices: [number, number, number, number][] = [
      [0.013, 0.55, 0.0025, -0.3],
      [0.021, 0.83, 0.0035, 0.3],
    ];
    for (const [delay, rate, depth, side] of voices) {
      const dl = ac.createDelay(0.05);
      dl.delayTime.value = delay;
      const lfo = osc(ac, 'sine', rate);
      const lg = ac.createGain();
      lg.gain.value = depth;
      lfo.connect(lg).connect(dl.delayTime);
      lfo.start();
      bus.lfos.push(lfo);
      const wg = ac.createGain();
      wg.gain.value = 0.7;
      tail.connect(dl).connect(wg).connect(panTo(ac, pan + side, bus.master));
    }
  }
  bus.outs.set(inst, g);
  return g;
}

/** 올라가고(a) → 줄어들어 머물고(sus) → 놓으면 사라지는(rel) 소리 크기. 끝나는 시각을 돌려준다. */
function adsr(p: AudioParam, t: number, d: number, peak: number, a: number, dec: number, sus: number, rel: number): number {
  const at = Math.max(0.003, Math.min(a, d * 0.85));
  const hold = Math.max(d, at);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + at);
  p.setTargetAtTime(peak * sus, t + at, dec / 3);
  p.setTargetAtTime(0, t + hold, rel / 4);
  return t + hold + rel * 1.3;
}

function osc(ac: BaseAudioContext, type: OscillatorType, f: number, detune = 0): OscillatorNode {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  return o;
}

function startStop(nodes: AudioScheduledSourceNode[], t: number, end: number): void {
  for (const n of nodes) {
    n.start(t);
    n.stop(end);
  }
}

/** 늦게 시작하는 떨림(비브라토). 센트 단위 depth */
function vibrato(ac: BaseAudioContext, targets: AudioParam[], t: number, rate: number, depth: number, delay: number): AudioScheduledSourceNode {
  const lfo = osc(ac, 'sine', rate);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.setValueAtTime(0, t + delay);
  g.gain.linearRampToValueAtTime(depth, t + delay + 0.35);
  lfo.connect(g);
  for (const p of targets) g.connect(p);
  return lfo;
}

function noiseSource(ac: BaseAudioContext): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  src.loopStart = Math.random();
  return src;
}

function filter(ac: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = ac.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

interface BrassOpts {
  cut: number;
  max: number;
  attack: number;
  scoop: number;
  second: OscillatorType;
}

const BRASS: Record<'trumpet' | 'horn' | 'trombone', BrassOpts> = {
  trumpet: { cut: 7, max: 6500, attack: 0.035, scoop: 35, second: 'sawtooth' },
  horn: { cut: 3.2, max: 2300, attack: 0.07, scoop: 0, second: 'triangle' },
  trombone: { cut: 4.5, max: 2600, attack: 0.05, scoop: 15, second: 'sawtooth' },
};

/** 금관: 톱니파 두 개(반주 화음은 하나)를 필터로 '빠아-' 열어 준다 */
function brass(ac: BaseAudioContext, dst: AudioNode, o: BrassOpts, f: number, t: number, d: number, v: number, swell: boolean, light: boolean): void {
  const g = ac.createGain();
  const lp = filter(ac, 'lowpass', f * 1.3, 1.1);
  const a = swell ? d * 0.8 : o.attack;
  const open = Math.min(f * o.cut * (0.65 + 0.35 * Math.min(v, 1.3)), o.max);
  lp.frequency.setValueAtTime(f * 1.3, t);
  lp.frequency.linearRampToValueAtTime(open, t + a * 1.4);
  lp.frequency.setTargetAtTime(open * 0.72, t + a * 1.4, 0.18);
  const end = adsr(g.gain, t, d, v, a, 0.3, 0.78, 0.14);
  const os = light ? [osc(ac, 'sawtooth', f)] : [osc(ac, 'sawtooth', f, -5), osc(ac, o.second, f, 5)];
  if (o.scoop && !swell && !light) {
    for (const x of os) {
      const base = x.detune.value;
      x.detune.setValueAtTime(base - o.scoop, t);
      x.detune.linearRampToValueAtTime(base, t + 0.06);
    }
  }
  const nodes: AudioScheduledSourceNode[] = [...os];
  if (d > 0.45 && !light) nodes.push(vibrato(ac, os.map((x) => x.detune), t, 5.4, 9, 0.28));
  for (const x of os) x.connect(lp);
  lp.connect(g).connect(dst);
  startStop(nodes, t, end);
}

/** 현악: 톱니파 (필터와 합주 코러스는 악기 출구에서). detunes 개수만큼 겹친다 */
function strings(ac: BaseAudioContext, dst: AudioNode, f: number, t: number, d: number, v: number, swell: boolean, attack: number, rel: number, detunes: number[], depth: number): void {
  const g = ac.createGain();
  const a = swell ? d * 0.8 : attack;
  const end = adsr(g.gain, t, d, v / Math.sqrt(detunes.length), a, 0.35, 0.88, rel);
  const os = detunes.map((c) => osc(ac, 'sawtooth', f, c));
  const nodes: AudioScheduledSourceNode[] = [...os];
  if (d > 0.5 && depth > 0) nodes.push(vibrato(ac, os.map((x) => x.detune), t, 5.2, depth, 0.2));
  for (const x of os) x.connect(g);
  g.connect(dst);
  startStop(nodes, t, end);
}

/** 첼로·콘트라베이스 (필터는 악기 출구에서). sub = 같은 높이 사인파로 몸통을 두껍게 */
function lowStrings(ac: BaseAudioContext, dst: AudioNode, f: number, t: number, d: number, v: number, attack: number, two: boolean, sub: boolean): void {
  const g = ac.createGain();
  const end = adsr(g.gain, t, d, v, attack, 0.3, 0.85, 0.22);
  const os = two ? [osc(ac, 'sawtooth', f, -6), osc(ac, 'sawtooth', f, 6)] : [osc(ac, 'sawtooth', f)];
  if (sub) os.push(osc(ac, 'sine', f));
  for (const x of os) x.connect(g);
  g.connect(dst);
  startStop(os, t, end);
}

/** 퉁기거나 치는 소리 (하프, 글로켄슈필, 트라이앵글): 바로 커졌다가 저절로 사라진다 */
function pluck(ac: BaseAudioContext, dst: AudioNode, f: number, t: number, v: number, decay: number, parts: [OscillatorType, number, number][]): void {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.004, decay / 4);
  const end = t + decay * 1.4;
  const nodes = parts.map(([type, mult, vol]) => {
    const o = osc(ac, type, f * mult);
    if (vol === 1) {
      o.connect(g);
    } else {
      const pg = ac.createGain();
      pg.gain.value = vol;
      o.connect(pg).connect(g);
    }
    return o;
  });
  g.connect(dst);
  startStop(nodes, t, end);
}

function flute(ac: BaseAudioContext, dst: AudioNode, f: number, t: number, d: number, v: number, swell: boolean): void {
  const g = ac.createGain();
  const end = adsr(g.gain, t, d, v, swell ? d * 0.8 : 0.05, 0.2, 0.85, 0.18);
  const o1 = osc(ac, 'sine', f);
  const o2 = osc(ac, 'triangle', f);
  const o2g = ac.createGain();
  o2g.gain.value = 0.25;
  const o3 = osc(ac, 'sine', f * 2);
  const o3g = ac.createGain();
  o3g.gain.value = 0.07;
  o1.connect(g);
  o2.connect(o2g).connect(g);
  o3.connect(o3g).connect(g);
  g.connect(dst);
  const nodes: AudioScheduledSourceNode[] = [o1, o2, o3];
  if (d > 0.4) nodes.push(vibrato(ac, [o1.detune, o2.detune, o3.detune], t, 5, 13, 0.22));
  // 숨소리
  const n = noiseSource(ac);
  const bp = filter(ac, 'bandpass', f * 2, 1.2);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(v * 0.18, t);
  ng.gain.setTargetAtTime(0, t + 0.02, 0.03);
  n.connect(bp).connect(ng).connect(dst);
  n.start(t);
  n.stop(t + 0.2);
  startStop(nodes, t, end);
}

function oboe(ac: BaseAudioContext, dst: AudioNode, f: number, t: number, d: number, v: number, swell: boolean): void {
  const g = ac.createGain();
  const end = adsr(g.gain, t, d, v, swell ? d * 0.8 : 0.035, 0.2, 0.85, 0.15);
  const o1 = osc(ac, 'sawtooth', f);
  const bp = filter(ac, 'bandpass', 1350, 1.4);
  const lp = filter(ac, 'lowpass', 3200, 0.5);
  const mix = ac.createGain();
  mix.gain.value = 0.55;
  o1.connect(bp).connect(g);
  o1.connect(lp).connect(mix).connect(g);
  g.connect(dst);
  const nodes: AudioScheduledSourceNode[] = [o1];
  if (d > 0.4) nodes.push(vibrato(ac, [o1.detune], t, 5.5, 8, 0.25));
  startStop(nodes, t, end);
}

function timpani(ac: BaseAudioContext, dst: AudioNode, f: number, t: number, v: number): void {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.004, 0.38);
  const end = t + 2;
  const parts: [number, number][] = [
    [1, 1],
    [1.504, 0.38],
    [2.0, 0.14],
  ];
  const nodes = parts.map(([m, vol]) => {
    const o = osc(ac, 'sine', f * m);
    o.frequency.setValueAtTime(f * m * 1.05, t);
    o.frequency.exponentialRampToValueAtTime(f * m, t + 0.12);
    const pg = ac.createGain();
    pg.gain.value = vol;
    o.connect(pg).connect(g);
    return o;
  });
  g.connect(dst);
  // 채로 치는 '퉁'
  const n = noiseSource(ac);
  const lp = filter(ac, 'lowpass', 700, 0.8);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(v * 0.5, t);
  ng.gain.setTargetAtTime(0, t, 0.035);
  n.connect(lp).connect(ng).connect(dst);
  n.start(t);
  n.stop(t + 0.3);
  startStop(nodes, t, end);
}

/** 떨림으로 만든 '두르르르' 롤 (점점 크게) */
function roll(ac: BaseAudioContext, dst: AudioNode, src: AudioNode[], t: number, d: number, v: number, rate: number): AudioScheduledSourceNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(v * 0.12, t);
  g.gain.linearRampToValueAtTime(v, t + d);
  g.gain.setTargetAtTime(0, t + d, 0.08);
  const trem = ac.createGain();
  trem.gain.value = 0.65;
  const lfo = osc(ac, 'sine', rate);
  const lg = ac.createGain();
  lg.gain.value = 0.35;
  lfo.connect(lg).connect(trem.gain);
  for (const s of src) s.connect(g);
  g.connect(trem).connect(dst);
  return lfo;
}

function timpaniRoll(ac: BaseAudioContext, dst: AudioNode, f: number, t: number, d: number, v: number): void {
  const o1 = osc(ac, 'sine', f);
  const o2 = osc(ac, 'sine', f * 1.504);
  const o2g = ac.createGain();
  o2g.gain.value = 0.35;
  o2.connect(o2g);
  const n = noiseSource(ac);
  const lp = filter(ac, 'lowpass', 320, 0.7);
  const ng = ac.createGain();
  ng.gain.value = 0.5;
  n.connect(lp).connect(ng);
  const lfo = roll(ac, dst, [o1, o2g, ng], t, d, v, 14);
  startStop([o1, o2, n, lfo], t, t + d + 0.5);
}

function snare(ac: BaseAudioContext, dst: AudioNode, t: number, v: number): void {
  const n = noiseSource(ac);
  const hp = filter(ac, 'highpass', 1200, 0.7);
  const bp = filter(ac, 'bandpass', 3600, 0.6);
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.setTargetAtTime(0, t, 0.045);
  n.connect(hp).connect(bp).connect(g).connect(dst);
  const o = osc(ac, 'triangle', 190);
  const og = ac.createGain();
  og.gain.setValueAtTime(v * 0.6, t);
  og.gain.setTargetAtTime(0, t, 0.022);
  o.connect(og).connect(dst);
  startStop([n, o], t, t + 0.35);
}

function snareRoll(ac: BaseAudioContext, dst: AudioNode, t: number, d: number, v: number): void {
  const n = noiseSource(ac);
  const bp = filter(ac, 'bandpass', 3200, 0.7);
  n.connect(bp);
  const lfo = roll(ac, dst, [bp], t, d, v, 22);
  startStop([n, lfo], t, t + d + 0.4);
}

function bassDrum(ac: BaseAudioContext, dst: AudioNode, t: number, v: number): void {
  const o = osc(ac, 'sine', 72);
  o.frequency.setValueAtTime(72, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.25);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.006);
  g.gain.setTargetAtTime(0, t + 0.006, 0.28);
  o.connect(g).connect(dst);
  const n = noiseSource(ac);
  const lp = filter(ac, 'lowpass', 180, 0.7);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(v * 0.6, t);
  ng.gain.setTargetAtTime(0, t, 0.05);
  n.connect(lp).connect(ng).connect(dst);
  startStop([o, n], t, t + 1.6);
}

function crash(ac: BaseAudioContext, dst: AudioNode, t: number, v: number): void {
  const n = noiseSource(ac);
  const hp = filter(ac, 'highpass', 3200, 0.5);
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.setTargetAtTime(0, t + 0.01, 0.65);
  n.connect(hp).connect(g).connect(dst);
  const n2 = noiseSource(ac);
  const bp = filter(ac, 'bandpass', 8500, 0.9);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(v * 0.8, t);
  g2.gain.setTargetAtTime(0, t, 0.25);
  n2.connect(bp).connect(g2).connect(dst);
  startStop([n, n2], t, t + 3.6);
}

function cymbalRoll(ac: BaseAudioContext, dst: AudioNode, t: number, d: number, v: number): void {
  const n = noiseSource(ac);
  const hp = filter(ac, 'highpass', 4500, 0.5);
  const bp = filter(ac, 'bandpass', 7500, 0.5);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + d);
  g.gain.setTargetAtTime(0, t + d, 0.12);
  n.connect(hp).connect(bp).connect(g).connect(dst);
  startStop([n], t, t + d + 0.8);
}

/** 음 하나를 t초에 예약한다. spt = 1틱의 초 */
export function playNote(bus: Bus, ev: NoteEvent, t: number, spt: number): void {
  const ac = bus.ac;
  const dst = out(bus, ev.inst);
  const f = hz(ev.midi);
  const d = Math.max(0.04, ev.dur * spt);
  const v = ev.vel;
  const sw = !!ev.swell;
  const light = !!ev.light;
  switch (ev.inst) {
    case 'trumpet':
    case 'horn':
    case 'trombone':
      brass(ac, dst, BRASS[ev.inst], f, t, d, v, sw, light);
      break;
    case 'strings':
      strings(ac, dst, f, t, d, v, sw, 0.25, 0.5, light ? [0] : [-6, 6], 0);
      break;
    case 'violins':
      strings(ac, dst, f, t, d, v, sw, 0.06, 0.32, light ? [0] : [-6, 6], light ? 0 : 11);
      break;
    case 'cello':
      lowStrings(ac, dst, f, t, d, v, sw ? d * 0.8 : 0.04, !light, false);
      break;
    case 'bass':
      lowStrings(ac, dst, f, t, d, v, sw ? d * 0.8 : 0.03, false, true);
      break;
    case 'pizz':
      pluck(ac, dst, f, t, v, 0.35, [['triangle', 1, 1]]);
      break;
    case 'harp':
      pluck(ac, dst, f, t, v, 1.3, [['triangle', 1, 1]]);
      break;
    case 'glock':
      pluck(ac, dst, f, t, v, 1.3, [
        ['sine', 1, 1],
        ['sine', 2.756, 0.28],
      ]);
      break;
    case 'triangle':
      pluck(ac, dst, 1, t, v, 1.8, [
        ['sine', 4186, 1],
        ['sine', 5920, 0.6],
        ['sine', 7880, 0.4],
      ]);
      break;
    case 'flute':
      flute(ac, dst, f, t, d, v, sw);
      break;
    case 'oboe':
      oboe(ac, dst, f, t, d, v, sw);
      break;
    case 'timp':
      timpani(ac, dst, f, t, v);
      break;
    case 'timproll':
      timpaniRoll(ac, dst, f, t, d, v);
      break;
    case 'snare':
      snare(ac, dst, t, v);
      break;
    case 'snareroll':
      snareRoll(ac, dst, t, d, v);
      break;
    case 'bassdrum':
      bassDrum(ac, dst, t, v);
      break;
    case 'crash':
      crash(ac, dst, t, v);
      break;
    case 'cymroll':
      cymbalRoll(ac, dst, t, d, v);
      break;
  }
}

/* ───────────────────────── 재생 ───────────────────────── */

/**
 * 악보를 조금씩 앞당겨 예약하며 연주한다. (반복 구간은 끝없이)
 * hold/resume으로 팡파르가 나오는 동안 멈췄다가 다음 마디부터 이어 간다.
 */
export class ScorePlayer {
  private pass = 0;
  private idx = 0;
  private passTime: number;
  private held: number | null = null;
  readonly spt: number;

  /** play를 주면 소리 대신 그 함수를 부른다 (테스트용) */
  constructor(
    readonly comp: Compiled,
    readonly bus: Bus | null,
    startTime: number,
    private readonly play?: (ev: NoteEvent, t: number) => void,
  ) {
    this.passTime = startTime;
    this.spt = 60 / comp.bpm / TPB;
  }

  private events(): NoteEvent[] {
    return this.pass === 0 ? this.comp.events : this.comp.loopEvents;
  }

  private base(): number {
    return this.pass === 0 ? 0 : (this.comp.loopStart ?? 0);
  }

  /** horizon초까지 시작하는 음을 예약한다. late초보다 늦은 음은 건너뛴다. 곡이 끝나면 false */
  pump(horizon: number, late = -Infinity): boolean {
    if (this.held !== null) return true;
    for (;;) {
      const evs = this.events();
      if (this.idx >= evs.length) {
        if (this.comp.loopStart === null || this.comp.loopEvents.length === 0) return false;
        this.passTime += (this.comp.length - this.base()) * this.spt;
        this.pass += 1;
        this.idx = 0;
        continue;
      }
      const ev = evs[this.idx];
      const t = this.passTime + (ev.tick - this.base()) * this.spt;
      if (t > horizon) return true;
      if (t < late - 1) {
        // 탭이 오래 멈춰 있었으면 밀린 음을 하나씩 넘기지 않고 지금 마디부터 다시
        this.hold(late);
        this.resume(late + 0.05);
        continue;
      }
      this.idx += 1;
      if (t < late) continue;
      if (this.play) this.play(ev, t);
      else if (this.bus) playNote(this.bus, ev, t, this.spt);
    }
  }

  /** time초 뒤 첫 마디에서 멈춘다 (팡파르가 나오는 동안) */
  hold(time: number): void {
    if (this.held !== null) return;
    let tick = this.base() + (time - this.passTime) / this.spt;
    tick = Math.max(this.base(), Math.ceil(tick / BAR - 1e-6) * BAR);
    if (tick >= this.comp.length && this.comp.loopStart !== null) {
      this.passTime += (this.comp.length - this.base()) * this.spt;
      this.pass += 1;
      tick = this.comp.loopStart;
    }
    const evs = this.events();
    let i = 0;
    while (i < evs.length && evs[i].tick < tick) i++;
    this.idx = i;
    this.held = tick;
  }

  /** 멈춘 마디부터 time초에 다시 */
  resume(time: number): void {
    if (this.held === null) return;
    this.passTime = time - (this.held - this.base()) * this.spt;
    this.held = null;
  }

  get isHeld(): boolean {
    return this.held !== null;
  }
}

/** 처음부터 seconds초 동안의 음을 한꺼번에 예약한다 (OfflineAudioContext로 미리 듣기·테스트용) */
export function renderScore(ac: BaseAudioContext, score: Score, seconds: number, volume = 0.16): void {
  const bus = createBus(ac, score.volume ?? volume);
  const player = new ScorePlayer(compile(score), bus, 0.05);
  player.pump(seconds);
}

/** 팡파르 길이 (초, 마지막 음이 끝날 때까지) */
export function scoreSeconds(score: Score): number {
  const c = compile(score);
  return c.end * (60 / c.bpm / TPB);
}
