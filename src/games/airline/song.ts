import type { Score } from '../../lib/orchestra';

/**
 * 하늘길 항공사 음악 — 직접 작곡한 오케스트라풍 곡들.
 * 90년대 항공 경영 게임처럼 금관 팡파르·현악·팀파니로 화려하고 웅장하게 (선율은 모두 새로 지었다).
 *
 * - AIRLINE_TITLE  '하늘길 서곡' (설정 화면·게임 끝): 내림나장조 100 BPM, 끝에서 다장조로 올라가는 절정
 * - AIRLINE_MAIN   '창공의 항로' (경영 화면): 바장조 104 BPM, 호른 → 트럼펫 → 오보에 → 고조 → 사장조 절정
 * - AIRLINE_JINGLES 분기 결산(흑자·적자), 게임 끝(우승·마무리) 짧은 팡파르
 *
 * 악보 적는 법은 src/lib/orchestra.ts 맨 위에 있다.
 */

/* ─────────────── 하늘길 서곡 (설정 화면) ─────────────── */

/** 서곡 주제 1~7마디 (8마디째는 이어지는 곳마다 다르다) */
const OVERTURE_THEME = `
  F4:q. Bb4:e D5:q. Bb4:e | G5:h. F5:e Eb5:e | Eb5:q. D5:e C5:q. Bb4:e | C5:h. r:e F4:e |
  F4:q. Bb4:e D5:q. F5:e | Bb5:h. A5:e G5:e | G5:q. F5:e Eb5:e. D5:s C5:q |`;
const OVERTURE_CHORDS = 'Bb:w | Eb/G:w | Cm7:w | Fsus4:h F7:h | Bb/D:w | Gm:w | Cm7:h F7:h | Bb:w';

export const AIRLINE_TITLE: Score = {
  kind: 'orchestra',
  title: '하늘길 서곡',
  bpm: 100,
  volume: 0.08,
  loopFrom: 1,
  sections: [
    {
      // 팀파니 롤과 심벌이 부풀며 막이 오른다 (처음 한 번만)
      name: '막 오르기',
      bars: 1,
      chords: 'F:w',
      style: 'none',
      roll: 4,
      parts: [
        { inst: 'strings', notes: '[F3,A3,C4,F4]:w<', vol: 0.8 },
        { inst: 'horn', notes: '[A3,C4,F4]:w<', vol: 0.7 },
        { inst: 'bass', notes: 'F1:w<', with: [{ inst: 'cello', shift: 12 }] },
      ],
    },
    {
      // 트럼펫 팡파르: 따다다 빠-암, 끝은 내림육·내림칠 화음을 거쳐 으뜸화음으로
      name: '팡파르',
      bars: 4,
      chords: 'Bb:w | Bb:w | Gb:h Ab:h | Bb:w',
      style: 'none',
      crash: true,
      parts: [
        { inst: 'trumpet', notes: "F4:et> F4 F4 Bb4:q.> F4:e Bb4 D5 | F5:h.> r:e D5:e | Db5:q.> Bb4:e Eb5:q.> C5:e | D5:et F5 D5 Bb5:h.>" },
        { inst: 'horn', notes: 'r:q [D4,F4]:q. [D4,F4]:e [D4,F4]:q | [Bb3,D4,F4]:h. r:q | [Bb3,Db4]:h [C4,Eb4]:h | [D4,F4]:w' },
        { inst: 'trombone', notes: 'r:w | [Bb2,F3]:h. r:q | [Gb2,Db3]:h [Ab2,Eb3]:h | [Bb2,F3]:w' },
        { inst: 'strings', notes: '[Bb3,D4,F4]:w | [Bb3,D4,F4]:w | [Bb3,Db4,Gb4]:h [C4,Eb4,Ab4]:h | [D4,F4,Bb4]:w' },
        { inst: 'violins', notes: 'r:w | r:h. F4:s G4 A4 Bb4 | Db5:h Eb5:h | F5:w' },
        { inst: 'bass', notes: 'Bb1:q. Bb1:e Bb1:q Bb1:q | Bb1:h. r:q | Gb1:h Ab1:h | Bb1:w', with: [{ inst: 'cello', shift: 12 }] },
        { inst: 'timp', notes: 'Bb2:q F2:e F2:e Bb2:q F2:q | Bb2:h. r:q | Gb2:q. Gb2:e Ab2:q. Ab2:e | Bb2:w' },
        { inst: 'snare', notes: 'x:et x x r:h. | r:w | r:w | x:et x x r:h.' },
        { inst: 'glock', notes: 'r:w | r:w | r:w | D6:et F6 D6 Bb6:h.' },
        { inst: 'crash', notes: 'r:w | r:w | r:w | x:w' },
        { inst: 'bassdrum', notes: 'r:w | r:w | r:w | x:w' },
      ],
    },
    {
      // 주제: 트럼펫과 바이올린이 행진곡 위에서 당당하게
      name: '주제',
      bars: 8,
      chords: OVERTURE_CHORDS,
      style: 'march',
      dyn: 0.8,
      parts: [
        { inst: 'trumpet', notes: `${OVERTURE_THEME} Bb4:h. F4:et G4 A4`, with: [{ inst: 'violins', vol: 0.55 }] },
        { inst: 'horn', notes: 'D4:w | Eb4:w | Eb4:h G4:h | F4:h Eb4:h | F4:w | D4:w | Eb4:h Eb4:h | D4:h. r:q', vol: 0.75 },
      ],
    },
    {
      // 구름 위: 바이올린과 플루트가 노래하고 하프가 반짝인다
      name: '구름 위',
      bars: 8,
      chords: 'Eb:w | Bb/D:w | Cm:w | Gm:w | Ab:w | Eb/G:w | Fsus4:w | F7:w',
      style: 'pad',
      dyn: 0.6,
      harp: true,
      roll: 4,
      parts: [
        {
          inst: 'violins',
          notes: 'Bb4:q Eb5:q G5:h | F5:h. D5:q | Eb5:q G5:q C6:h | Bb5:q. A5:e G5:h | C6:q. Bb5:e Ab5:q Eb5:q | G5:q. F5:e Eb5:q G5:q | F5:h Bb5:h | A5:w',
          with: [{ inst: 'flute', vol: 0.45 }],
        },
        { inst: 'horn', notes: 'G3:w | F3:w | G3:w | D4:w | Eb4:w | Bb3:w | C4:w | C4:h Eb4:h', vol: 0.7 },
      ],
    },
    {
      // 절정: 한 음 올려 다장조로, 금관 전부와 하프·글로켄슈필
      name: '절정',
      bars: 8,
      chords: OVERTURE_CHORDS,
      style: 'hymn',
      dyn: 1,
      harp: true,
      crash: true,
      roll: 2,
      transpose: 2,
      parts: [
        {
          inst: 'trumpet',
          notes: `${OVERTURE_THEME} Bb4:w`,
          with: [
            { inst: 'horn', shift: -12, vol: 0.85 },
            { inst: 'violins', shift: 12, vol: 0.6 },
            { inst: 'glock', shift: 24, vol: 0.45 },
          ],
        },
      ],
    },
  ],
};

/* ─────────────── 창공의 항로 (경영 화면) ─────────────── */

/** 주제 A (호른): 도— 레 | 미— 솔 | 파·미 레 도 | 레— (솔) … 끝으로 갈수록 높이 날아오른다 */
const ROUTE_THEME = `
  F4:h. G4:q | A4:h. C5:q | Bb4:q. A4:e G4:q F4:q | G4:h. C4:q |
  A4:h. Bb4:q | D5:h. F5:q | F5:q. D5:e C5:q E5:q | F5:h. r:q`;
const ROUTE_CHORDS = 'F:w | Am:w | Bb:h Gm7:h | C:w | Dm:w | Bb:w | Gm7:h C7:h | F:w';

export const AIRLINE_MAIN: Score = {
  kind: 'orchestra',
  title: '창공의 항로',
  bpm: 104,
  volume: 0.1,
  loopFrom: 1,
  sections: [
    {
      name: '이륙 준비',
      bars: 2,
      chords: 'F:w | C7sus4:h C7:h',
      style: 'drive',
      dyn: 0.5,
      parts: [{ inst: 'horn', notes: '[A3,C4,F4]:w< | r:h. C4:q', vol: 0.8 }],
    },
    {
      // 첼로가 '따-다다' 달리고 호른이 주제를
      name: '주제 A',
      bars: 8,
      chords: ROUTE_CHORDS,
      style: 'drive',
      dyn: 0.65,
      parts: [{ inst: 'horn', notes: ROUTE_THEME, with: [{ inst: 'violins', vol: 0.4 }] }],
    },
    {
      // 트럼펫이 이어받아 행진곡으로
      name: '주제 B',
      bars: 8,
      chords: 'Gm7:w | Bb/D:w | C:w | F:w | Gm7:w | Am7:w | Bb:h C7:h | F:w',
      style: 'march',
      dyn: 0.85,
      crash: true,
      parts: [
        {
          inst: 'trumpet',
          notes: 'Bb5:h. A5:e G5:e | F5:h D5:q. Bb4:e | C5:q. D5:e E5:h | F5:h. C5:q | G5:h F5:q. D5:e | E5:h. D5:e C5:e | D5:q. C5:e Bb4:h | A4:h F4:h',
          with: [{ inst: 'violins', vol: 0.55 }],
        },
        { inst: 'horn', notes: 'G4:w | F4:w | E4:w | F4:h A4:h | Bb4:w | A4:w | F4:h E4:h | F4:w', vol: 0.7 },
      ],
    },
    {
      // 순항: 단조로 잔잔하게, 오보에와 하프 (뒤 네 마디는 플루트가 한 옥타브 위에서 함께)
      name: '순항',
      bars: 8,
      chords: 'Dm:w | Bb:w | Gm:w | A7:w | Dm:w | Bb:w | Gm7:w | C7sus4:h C7:h',
      style: 'pad',
      dyn: 0.5,
      harp: true,
      parts: [
        { inst: 'oboe', notes: 'A4:q. D5:e F5:h | F5:q. E5:e D5:h | Bb4:q. D5:e G5:h | A5:q. G5:e E5:h | F5:q. E5:e D5:q A4:q | Bb4:q. C5:e D5:q F5:q | G5:q. F5:e D5:q Bb4:q | C5:h E5:h' },
        { inst: 'flute', notes: 'r:w | r:w | r:w | r:w | F5:q. E5:e D5:q A4:q | Bb4:q. C5:e D5:q F5:q | G5:q. F5:e D5:q Bb4:q | C5:h E5:h', shift: 12, vol: 0.45 },
      ],
    },
    {
      // 고도를 높인다: 바이올린이 한 칸씩 올라가고 트럼펫이 두드리며 팀파니 롤로
      name: '상승',
      bars: 8,
      chords: 'Bb:w | C:w | Am:w | Dm:w | Eb:w | F:w | Cm:w | D7:w',
      style: 'drive',
      dyn: 0.75,
      roll: 4,
      parts: [
        { inst: 'violins', notes: 'D5:h. F5:q | E5:h. G5:q | E5:h. A5:q | F5:h. A5:q | G5:h. Bb5:q | A5:h. C6:q | G5:h. C6:q | A5:h. F#5:q' },
        { inst: 'horn', notes: 'F4:w | E4:w | E4:w | D4:w | Eb4:w | C4:w | Eb4:w | D4:h F#4:h', vol: 0.7 },
        {
          inst: 'trumpet',
          notes: "r:w | r:w | r:w | r:w | r:h [G4,Bb4]:e' [G4,Bb4]:e' [G4,Bb4]:q | r:h [A4,C5]:e' [A4,C5]:e' [A4,C5]:q | r:h [G4,C5]:e' [G4,C5]:e' [G4,C5]:q | [F#4,A4]:e' [F#4,A4]:e' [F#4,A4]:q [F#4,A4,C5]:h<",
          vol: 0.7,
        },
        { inst: 'snareroll', notes: 'r:w | r:w | r:w | r:w | r:w | r:w | r:w | x:w' },
      ],
    },
    {
      // 절정: 사장조로 올라 금관이 주제를 크게, 글로켄슈필이 두 옥타브 위에서 반짝
      name: '절정',
      bars: 8,
      chords: ROUTE_CHORDS,
      style: 'hymn',
      dyn: 1,
      harp: true,
      crash: true,
      transpose: 2,
      parts: [
        {
          inst: 'trumpet',
          notes: ROUTE_THEME,
          with: [
            { inst: 'horn', shift: -12, vol: 0.85 },
            { inst: 'violins', shift: 12, vol: 0.6 },
            { inst: 'glock', shift: 24, vol: 0.4 },
          ],
        },
      ],
    },
    {
      // 구름을 지나 다시 바장조로 내려앉는다
      name: '하강',
      bars: 4,
      chords: 'Eb:w | Bb/D:w | Gm7:w | C7sus4:h C7:h',
      style: 'pad',
      dyn: 0.45,
      harp: true,
      parts: [
        { inst: 'flute', notes: 'G5:h. F5:q | F5:h D5:h | D5:h. Bb4:q | C5:w' },
        { inst: 'horn', notes: 'r:w | r:w | r:w | r:h. C4:q', vol: 0.8 },
      ],
    },
  ],
};

/* ─────────────── 짧은 팡파르 ─────────────── */

/** 분기 결산 흑자: 따다다 빠-밤! */
const QUARTER_GOOD: Score = {
  kind: 'orchestra',
  title: '흑자 결산',
  bpm: 112,
  volume: 0.11,
  sections: [
    {
      name: '팡파르',
      bars: 2,
      parts: [
        { inst: 'trumpet', notes: 'F4:et> F4 F4 Bb4:q Eb5:q F5:q | [D5,F5,Bb5]:h.> r:q' },
        { inst: 'horn', notes: '[D4,F4]:q [D4,F4]:q [Eb4,G4]:q [F4,A4]:q | [D4,F4,Bb4]:h. r:q' },
        { inst: 'trombone', notes: 'Bb2:h Eb3:q F3:q | [Bb2,F3]:h. r:q' },
        { inst: 'strings', notes: '[Bb3,D4,F4]:h [Bb3,Eb4,G4]:q [A3,C4,F4]:q | [Bb3,D4,F4,Bb4]:h. r:q' },
        { inst: 'violins', notes: 'r:h. F5:s G5 A5 Bb5 | D6:h. r:q' },
        { inst: 'bass', notes: 'Bb1:h Eb2:q F2:q | Bb1:h. r:q', with: [{ inst: 'cello', shift: 12 }] },
        { inst: 'timp', notes: 'Bb2:q Bb2:q Eb2:q F2:q | Bb2:h. r:q' },
        { inst: 'snare', notes: 'x:et x x r:h. | r:w' },
        { inst: 'glock', notes: 'r:w | Bb6:h. r:q' },
        { inst: 'crash', notes: 'r:w | x:h. r:q' },
        { inst: 'bassdrum', notes: 'r:w | x:h. r:q' },
      ],
    },
  ],
};

/** 분기 결산 적자: 차분한 사단조 — 다음 분기에 다시 */
const QUARTER_BAD: Score = {
  kind: 'orchestra',
  title: '적자 결산',
  bpm: 96,
  volume: 0.14,
  sections: [
    {
      name: '한숨',
      bars: 2,
      parts: [
        { inst: 'oboe', notes: 'Bb4:q. A4:e G4:q F#4:q | G4:h. r:q' },
        { inst: 'horn', notes: '[G3,D4]:h [G3,C4,Eb4]:q [F#3,C4]:q | [G3,Bb3,D4]:h. r:q', vol: 0.7 },
        { inst: 'strings', notes: '[G3,Bb3,D4]:h [G3,C4,Eb4]:q [F#3,A3,D4]:q | [G3,Bb3,D4]:h. r:q', vol: 0.8 },
        { inst: 'bass', notes: 'G1:h C2:q D2:q | G1:h. r:q', with: [{ inst: 'cello', shift: 12 }], vol: 0.8 },
        { inst: 'timp', notes: 'G2:h r:q D2:q | G2:h. r:q', vol: 0.6 },
        { inst: 'harp', notes: 'r:w | G3:s Bb3 D4 G4 Bb4:q r:h', vol: 0.8 },
      ],
    },
  ],
};

/** 게임 끝 — 우승: 행진하다가 내림육·내림칠을 지나 큰 으뜸화음 */
const VICTORY: Score = {
  kind: 'orchestra',
  title: '우승',
  bpm: 108,
  volume: 0.11,
  sections: [
    {
      name: '개선',
      bars: 4,
      parts: [
        { inst: 'trumpet', notes: 'Bb4:q.> F4:e Bb4:q D5:q | F5:h.> D5:et Eb5 F5 | Gb5:h> Ab5:h> | Bb5:w>' },
        { inst: 'horn', notes: '[D4,F4]:q. [D4,F4]:e [D4,F4]:q [F4,Bb4]:q | [D4,F4,Bb4]:h. r:q | [Db4,Gb4]:h [Eb4,Ab4]:h | [D4,F4,Bb4]:w' },
        { inst: 'trombone', notes: 'Bb2:q. Bb2:e Bb2:q Bb2:q | [Bb2,F3]:h. r:q | [Gb2,Db3]:h [Ab2,Eb3]:h | [Bb2,F3]:w' },
        { inst: 'violins', notes: '[D5,F5]:w | r:h Bb4:s C5 D5 Eb5 F5 G5 A5 Bb5 | Gb5:h Ab5:h | Bb5:w' },
        { inst: 'strings', notes: '[Bb3,D4,F4]:w | [Bb3,D4,F4]:w | [Bb3,Db4,Gb4]:h [C4,Eb4,Ab4]:h | [Bb3,D4,F4,Bb4]:w' },
        { inst: 'bass', notes: 'Bb1:w | Bb1:w | Gb1:h Ab1:h | Bb1:w', with: [{ inst: 'cello', shift: 12 }] },
        { inst: 'timp', notes: 'Bb2:q F2:e F2:e Bb2:q F2:q | Bb2:h r:h | Gb2:h Ab2:h | r:w' },
        { inst: 'timproll', notes: 'r:w | r:h F2:h | r:w | Bb2:w' },
        { inst: 'snare', notes: 'r:w | r:h. x:et x x | r:w | r:w' },
        { inst: 'cymroll', notes: 'r:w | r:h x:h | r:w | r:w' },
        { inst: 'crash', notes: 'x:w | r:w | x:w | x:w' },
        { inst: 'bassdrum', notes: 'x:w | r:w | x:h x:h | x:w' },
        { inst: 'glock', notes: 'r:w | r:w | r:w | [D6,F6,Bb6]:w' },
        { inst: 'triangle', notes: 'r:w | r:w | r:w | x:w' },
      ],
    },
  ],
};

/** 게임 끝 — 마무리 (우승하지 못했을 때): 사단조로 시작해 내림나장조로 따뜻하게 닫는다 */
const FINALE: Score = {
  kind: 'orchestra',
  title: '마무리',
  bpm: 92,
  volume: 0.18,
  sections: [
    {
      name: '막 내리기',
      bars: 4,
      chords: 'Gm:w | Eb:w | Cm7:h F7:h | Bb:w',
      style: 'pad',
      dyn: 0.6,
      harp: true,
      parts: [
        { inst: 'violins', notes: 'G4:q. A4:e Bb4:q D5:q | Eb5:h. D5:e C5:e | C5:h A4:h | Bb4:w' },
        { inst: 'horn', notes: '[Bb3,D4]:w | [G3,Bb3]:w | [G3,Eb4]:h [A3,Eb4]:h | [Bb3,D4,F4]:w', vol: 0.7 },
        { inst: 'timp', notes: 'G2:w | r:w | r:w | Bb2:w', vol: 0.6 },
        { inst: 'crash', notes: 'r:w | r:w | r:w | x:w', vol: 0.5 },
      ],
    },
  ],
};

export const AIRLINE_JINGLES = {
  quarterGood: QUARTER_GOOD,
  quarterBad: QUARTER_BAD,
  victory: VICTORY,
  finale: FINALE,
} as const;
