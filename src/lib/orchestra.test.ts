import { describe, expect, it } from 'vitest';
import { BAR, compile, noteNumber, parseChord, parseChords, parseDuration, parseLine, ScorePlayer, TPB, type NoteEvent, type Score } from './orchestra';

describe('악보 읽기', () => {
  it('길이: 온·2분·4분·8분·16분, 점음표, 셋잇단, 붙임', () => {
    expect(parseDuration('w')).toBe(48);
    expect(parseDuration('q')).toBe(12);
    expect(parseDuration('e.')).toBe(9);
    expect(parseDuration('et')).toBe(4);
    expect(parseDuration('h+q')).toBe(36);
    expect(() => parseDuration('s.')).toThrow();
    expect(() => parseDuration('z')).toThrow();
  });

  it('음 이름 → MIDI 번호 (가운데 도 C4 = 60)', () => {
    expect(noteNumber('C4')).toBe(60);
    expect(noteNumber('Bb4')).toBe(70);
    expect(noteNumber('F#5')).toBe(78);
    expect(noteNumber('B1')).toBe(35);
  });

  it('한 줄: 화음·쉼표·꾸밈, 길이를 빼면 앞 길이', () => {
    const { notes, length } = parseLine("F4:q. Bb4:e D5:h | [D4,F4]:h> r:q x:e' C5<");
    expect(length).toBe(BAR * 2);
    expect(notes.map((n) => n.tick)).toEqual([0, 18, 24, 48, 84, 90]);
    expect(notes[2]).toMatchObject({ dur: 24, pitches: [74] });
    expect(notes[3]).toMatchObject({ pitches: [62, 65], accent: true, dur: 24 });
    expect(notes[4]).toMatchObject({ pitches: [0], staccato: true });
    expect(notes[5]).toMatchObject({ swell: true, dur: 6 });
  });

  it('마디줄이 마디 경계에 있지 않으면 오류', () => {
    expect(() => parseLine('C4:h | D4:h')).toThrow();
    expect(() => parseLine('C4:q*')).toThrow();
  });

  it('화음 이름', () => {
    expect(parseChord('Eb/G')).toEqual({ root: 3, tones: [3, 7, 10], bass: 7 });
    expect(parseChord('Cm7').tones).toEqual([0, 3, 7, 10]);
    expect(parseChord('F7').tones).toEqual([5, 9, 0, 3]);
    expect(parseChord('Fsus4').tones).toEqual([5, 10, 0]);
    expect(() => parseChord('Hm')).toThrow();
    const { spans, length } = parseChords('Bb:w | Cm7:h F7');
    expect(length).toBe(BAR * 2);
    expect(spans.map((s) => [s.tick, s.dur])).toEqual([
      [0, 48],
      [48, 24],
      [72, 24],
    ]);
  });
});

const TEST_SCORE: Score = {
  kind: 'orchestra',
  title: '시험곡',
  bpm: 120,
  loopFrom: 1,
  sections: [
    { name: '도입', bars: 1, parts: [{ inst: 'trumpet', notes: 'C4:w' }] },
    { name: '반복', bars: 2, parts: [{ inst: 'trumpet', notes: 'D4:h E4:h | F4:w' }] },
  ],
};

describe('악보 → 음 목록', () => {
  it('섹션 길이와 선율 길이가 다르면 어디가 틀렸는지 알려 준다', () => {
    const bad: Score = { ...TEST_SCORE, title: '틀린 곡', sections: [{ name: '짧음', bars: 2, parts: [{ inst: 'horn', notes: 'C4:w' }] }] };
    expect(() => compile(bad)).toThrow(/틀린 곡 \/ 짧음 \/ horn/);
  });

  it('도입부는 한 번, 반복 구간은 loopStart부터', () => {
    const c = compile(TEST_SCORE);
    expect(c.length).toBe(BAR * 3);
    expect(c.loopStart).toBe(BAR);
    expect(c.events.map((e) => e.midi)).toEqual([60, 62, 64, 65]);
    expect(c.loopEvents.map((e) => e.midi)).toEqual([62, 64, 65]);
  });

  it('화음 진행으로 반주가 붙고, 조옮김은 선율과 화음을 함께 옮긴다', () => {
    const s: Score = {
      kind: 'orchestra',
      title: '반주 시험',
      bpm: 100,
      sections: [{ name: '행진', bars: 1, chords: 'C:w', style: 'march', crash: true, transpose: 2, parts: [{ inst: 'trumpet', notes: 'E4:w', with: [{ inst: 'violins', shift: 12 }] }] }],
    };
    const c = compile(s);
    const by = (inst: string) => c.events.filter((e) => e.inst === inst);
    expect(by('trumpet').map((e) => e.midi)).toEqual([66]);
    expect(by('violins').map((e) => e.midi)).toEqual([78]);
    // D장조 화음 (D F# A)
    expect(new Set(by('strings').map((e) => e.midi % 12))).toEqual(new Set([2, 6, 9]));
    expect(by('bass').map((e) => e.tick)).toEqual([0, 24]);
    expect(by('horn').length).toBeGreaterThan(0);
    expect(by('crash')).toHaveLength(1);
    expect(by('strings').every((e) => e.light)).toBe(true);
    expect(by('trumpet')[0].light).toBeUndefined();
  });
});

describe('연주 순서', () => {
  const run = () => {
    const heard: [number, number][] = [];
    const p = new ScorePlayer(compile(TEST_SCORE), null, 0, (ev: NoteEvent, t: number) => heard.push([ev.midi, +t.toFixed(3)]));
    return { p, heard };
  };

  it('끝까지 가면 도입부를 건너뛰고 반복 구간으로 돌아간다', () => {
    const { p, heard } = run();
    expect(p.pump(10.5)).toBe(true);
    // 120 BPM: 한 마디 2초
    expect(heard).toEqual([
      [60, 0],
      [62, 2],
      [64, 3],
      [65, 4],
      [62, 6],
      [64, 7],
      [65, 8],
      [62, 10],
    ]);
  });

  it('팡파르 동안 멈췄다가 다음 마디부터 이어 간다', () => {
    const { p, heard } = run();
    p.pump(3.2);
    p.hold(3.2);
    expect(p.isHeld).toBe(true);
    p.pump(9);
    expect(heard).toHaveLength(3);
    p.resume(10);
    p.pump(12.5);
    expect(heard.slice(3)).toEqual([
      [65, 10],
      [62, 12],
    ]);
  });

  it('탭이 오래 멈춰 있었으면 밀린 음을 몰아서 내지 않는다', () => {
    const { p, heard } = run();
    p.pump(0.5);
    p.pump(20.35, 20);
    expect(heard.slice(1).every(([, t]) => t >= 20)).toBe(true);
    expect(heard.length).toBeGreaterThan(1);
  });

  it('반복하지 않는 곡(팡파르)은 끝나면 false', () => {
    const once: Score = { ...TEST_SCORE, title: '한 번', loopFrom: undefined };
    const heard: number[] = [];
    const p = new ScorePlayer(compile(once), null, 0, (ev) => heard.push(ev.midi));
    expect(p.pump(Infinity)).toBe(false);
    expect(heard).toEqual([60, 62, 64, 65]);
  });

  it('1틱 = 한 박의 12분의 1', () => {
    expect(TPB * 4).toBe(BAR);
  });
});
