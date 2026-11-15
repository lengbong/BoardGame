import { describe, expect, it } from 'vitest';
import { BAR, compile, parseChords, parseLine, RANGE, scoreSeconds, TPB, UNPITCHED, type Score } from '../../lib/orchestra';
import { AIRLINE_JINGLES, AIRLINE_MAIN, AIRLINE_TITLE, LONG_HAUL_KM, routeFanfare } from './song';

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const BGM: Score[] = [AIRLINE_TITLE, AIRLINE_MAIN];
const JINGLES: Score[] = Object.values(AIRLINE_JINGLES);
const ALL = [...BGM, ...JINGLES];

describe('하늘길 항공사 음악', () => {
  it('모든 곡의 악보가 읽히고 섹션 길이가 맞는다', () => {
    for (const s of ALL) expect(() => compile(s), s.title).not.toThrow();
  });

  it('배경음악은 도입부를 한 번 연주하고 1분 넘는 구간을 반복한다', () => {
    for (const s of BGM) {
      const c = compile(s);
      expect(c.loopStart, s.title).toBeGreaterThan(0);
      const loopSeconds = ((c.length - c.loopStart!) / TPB) * (60 / s.bpm);
      expect(loopSeconds, s.title).toBeGreaterThan(60);
    }
  });

  it('팡파르는 반복하지 않고 짧다', () => {
    for (const s of JINGLES) {
      expect(compile(s).loopStart, s.title).toBeNull();
      expect(scoreSeconds(s), s.title).toBeLessThan(12);
    }
    expect(scoreSeconds(AIRLINE_JINGLES.quarterGood)).toBeLessThan(5);
    expect(scoreSeconds(AIRLINE_JINGLES.quarterBad)).toBeLessThan(5);
  });

  it('모든 음이 악기 음역 안에 있다', () => {
    for (const s of ALL) {
      for (const e of compile(s).events) {
        const r = RANGE[e.inst];
        if (!r || UNPITCHED.has(e.inst)) continue;
        expect(e.midi >= r[0] && e.midi <= r[1], `${s.title} ${e.inst} ${e.midi} (${e.tick / BAR + 1}마디)`).toBe(true);
      }
    }
  });

  it('손으로 쓴 선율의 강박(1·3박) 긴 음은 그때 화음의 구성음이다', () => {
    const wrong: string[] = [];
    for (const s of ALL) {
      for (const sec of s.sections) {
        if (!sec.chords) continue;
        const { spans } = parseChords(sec.chords);
        for (const p of sec.parts) {
          if (UNPITCHED.has(p.inst) || p.inst === 'timp' || p.inst === 'timproll') continue;
          for (const n of parseLine(p.notes).notes) {
            const beat = (n.tick % BAR) / TPB;
            if ((beat !== 0 && beat !== 2) || n.dur < TPB) continue;
            const chord = spans.find((sp) => sp.tick <= n.tick && n.tick < sp.tick + sp.dur)?.chord;
            if (!chord) continue;
            for (const pitch of n.pitches) {
              const pc = (pitch + (p.shift ?? 0)) % 12;
              if (!chord.tones.includes(pc)) wrong.push(`${s.title}/${sec.name}/${p.inst} ${n.tick / BAR + 1}마디 ${NAMES[pc]}`);
            }
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('취항 팡파르: 가까운 노선은 짧게, 대륙을 건너는 노선은 더 길고 크게', () => {
    expect(routeFanfare(1200)).toBe(AIRLINE_JINGLES.routeShort);
    expect(routeFanfare(LONG_HAUL_KM)).toBe(AIRLINE_JINGLES.routeLong);
    expect(routeFanfare(9600)).toBe(AIRLINE_JINGLES.routeLong);
    expect(scoreSeconds(AIRLINE_JINGLES.routeShort)).toBeLessThan(3.5);
    expect(scoreSeconds(AIRLINE_JINGLES.routeLong)).toBeLessThan(5.5);
    expect(scoreSeconds(AIRLINE_JINGLES.routeLong)).toBeGreaterThan(scoreSeconds(AIRLINE_JINGLES.routeShort));
  });

  it('취항 팡파르의 심벌은 축하 카드에서 비행기가 내릴 때(1.75~2.15초) 친다', () => {
    for (const s of [AIRLINE_JINGLES.routeShort, AIRLINE_JINGLES.routeLong]) {
      const c = compile(s);
      const hit = c.events.find((e) => e.inst === 'crash')!;
      // playJingle은 0.12초 뒤에 시작한다
      const at = 0.12 + (hit.tick / TPB) * (60 / s.bpm);
      expect(at, s.title).toBeGreaterThan(1.6);
      expect(at, s.title).toBeLessThan(2.3);
    }
  });

  it('곡마다 소리 크기가 정해져 있다 (예전 음악과 비슷한 크기로 맞춤)', () => {
    for (const s of ALL) expect(s.volume, s.title).toBeGreaterThan(0);
  });
});
