import type { PlaneShape } from './plane3d';

/**
 * 기종마다 그림을 그리는 데 쓰는 실제 치수 (근삿값).
 * len 전체 길이·span 날개폭·dia 동체 폭(m), sweep 1/4 시위 후퇴각(도), ar 날개 가로세로비,
 * eng 엔진 자리(반날개폭 비율)와 엔진 덮개 지름·길이(m).
 * 공개된 제원표의 값을 반올림했고, 날개 면적·꼬리 높이처럼 덜 알려진 값은 비슷한 기종에서 어림했어요.
 */
export const SHAPES: Record<string, PlaneShape> = {
  // 1950·60년대
  f27: { len: 23.1, span: 29, dia: 2.7, sweep: 0, ar: 12, taper: 0.45, high: true, tail: 'low', eng: { prop: [0.3], d: 1.25, l: 0, propD: 3.66 }, noseLen: 1.4, stab: 0.32 },
  caravelle: { len: 32, span: 34.3, dia: 3.2, sweep: 20, ar: 8, tail: 'cross', eng: { rear: 1, d: 1.35, l: 5 }, finH: 4.6 },
  'dc8-50': { len: 45.9, span: 43.4, dia: 3.73, sweep: 30, ar: 7.5, tail: 'low', eng: { wing: [0.33, 0.6], d: 1.5, l: 4.8 } },
  b707: { len: 46.6, span: 44.4, dia: 3.76, sweep: 35, ar: 7.1, tail: 'low', eng: { wing: [0.35, 0.62], d: 1.5, l: 4.7 } },
  'b727-100': { len: 40.6, span: 32.9, dia: 3.76, sweep: 32, ar: 7.7, tail: 't', eng: { rear: 1, center: 'sduct', d: 1.4, l: 5.4 } },
  dc9: { len: 36.4, span: 28.5, dia: 3.35, sweep: 24, ar: 8.7, tail: 't', eng: { rear: 1, d: 1.4, l: 5.6 } },
  'b727-200': { len: 46.7, span: 32.9, dia: 3.76, sweep: 32, ar: 7.7, tail: 't', eng: { rear: 1, center: 'sduct', d: 1.4, l: 5.4 } },
  'dc8-63': { len: 57.1, span: 45.2, dia: 3.73, sweep: 30, ar: 7.5, tail: 'low', eng: { wing: [0.33, 0.6], d: 1.6, l: 4.8 } },
  'b737-200': { len: 30.5, span: 28.4, dia: 3.76, tall: 1.07, sweep: 25, ar: 8.8, tail: 'low', eng: { wing: [0.31], d: 1.3, l: 6, slim: true } },
  // 1970년대
  'b747-100': { len: 70.6, span: 59.6, dia: 6.5, sweep: 37.5, ar: 7, tail: 'low', hump: 0.33, noseLen: 1.4, eng: { wing: [0.4, 0.68], d: 2.75, l: 6 } },
  'b747-200': { len: 70.6, span: 59.6, dia: 6.5, sweep: 37.5, ar: 7, tail: 'low', hump: 0.33, noseLen: 1.4, eng: { wing: [0.4, 0.68], d: 2.75, l: 6 } },
  dc10: { len: 55.5, span: 50.4, dia: 6.02, sweep: 35, ar: 7.5, tail: 'low', eng: { wing: [0.34], center: 'fin', d: 2.7, l: 6 } },
  l1011: { len: 54.2, span: 47.3, dia: 5.97, sweep: 35, ar: 7.2, tail: 'low', eng: { wing: [0.34], center: 'sduct', d: 2.7, l: 6.2 } },
  a300b4: { len: 53.6, span: 44.8, dia: 5.64, sweep: 28, ar: 7.7, tail: 'low', eng: { wing: [0.34], d: 2.7, l: 6 } },
  concorde: {
    len: 61.7,
    span: 25.6,
    dia: 2.88,
    tall: 1.12,
    sweep: 55,
    sst: true,
    tail: 'none',
    noseLen: 4.2,
    tailLen: 2.2,
    finH: 6.2,
    planform: [
      [0.1, 0.38, 0.93],
      [0.2, 0.52, 0.93],
      [0.35, 0.63, 0.925],
      [0.55, 0.73, 0.92],
      [0.75, 0.81, 0.915],
      [0.9, 0.87, 0.915],
      [1, 0.9, 0.92],
    ],
    eng: { box: true, d: 1.55, l: 0 },
  },
  // 1980년대
  md82: { len: 45.1, span: 32.9, dia: 3.35, sweep: 24.5, ar: 9.6, tail: 't', eng: { rear: 1, d: 1.45, l: 6 } },
  'b767-200': { len: 48.5, span: 47.6, dia: 5.03, tall: 1.07, sweep: 31.5, ar: 8, tail: 'low', eng: { wing: [0.33], d: 2.75, l: 5.8 } },
  b757: { len: 47.3, span: 38, dia: 3.76, tall: 1.07, sweep: 25, ar: 7.8, tail: 'low', eng: { wing: [0.33], d: 2.4, l: 5 } },
  'b737-300': { len: 33.4, span: 28.9, dia: 3.76, tall: 1.07, sweep: 25, ar: 9.2, tail: 'low', eng: { wing: [0.33], d: 1.9, l: 4 } },
  a310: { len: 46.7, span: 43.9, dia: 5.64, sweep: 28, ar: 8.8, tail: 'low', tip: 'fence', tipH: 1.4, eng: { wing: [0.34], d: 2.75, l: 5.8 } },
  'a300-600': { len: 54.1, span: 44.8, dia: 5.64, sweep: 28, ar: 7.7, tail: 'low', tip: 'fence', tipH: 1.4, eng: { wing: [0.34], d: 2.75, l: 5.8 } },
  'b767-300': { len: 54.9, span: 47.6, dia: 5.03, tall: 1.07, sweep: 31.5, ar: 8, tail: 'low', eng: { wing: [0.33], d: 2.75, l: 5.8 } },
  a320: { len: 37.6, span: 34.1, dia: 3.95, tall: 1.05, sweep: 25, ar: 9.4, tail: 'low', tip: 'fence', tipH: 1.6, eng: { wing: [0.34], d: 2.2, l: 4.4 } },
  f100: { len: 35.5, span: 28.1, dia: 3.3, sweep: 17, ar: 8.4, tail: 't', eng: { rear: 1, d: 1.55, l: 4.6 } },
  atr72: { len: 27.2, span: 27.1, dia: 2.87, sweep: 3, ar: 12, taper: 0.5, high: true, tail: 't', eng: { prop: [0.3], d: 1.2, l: 0, propD: 3.93 }, noseLen: 1.35, stab: 0.27 },
  'b747-400': { len: 70.6, span: 64.4, dia: 6.5, sweep: 37.5, ar: 7.9, tail: 'low', hump: 0.43, noseLen: 1.4, tip: 'winglet', tipH: 1.9, eng: { wing: [0.4, 0.68], d: 2.75, l: 6 } },
  // 1990년대
  md11: { len: 61.6, span: 51.7, dia: 6.02, sweep: 35, ar: 7.9, tail: 'low', tip: 'updown', tipH: 2.3, eng: { wing: [0.34], center: 'fin', d: 2.75, l: 6 } },
  crj200: { len: 26.8, span: 21.2, dia: 2.69, sweep: 25, ar: 8.6, tail: 't', tip: 'winglet', tipH: 1.2, eng: { rear: 1, d: 1.3, l: 3.6 } },
  'a340-300': { len: 63.7, span: 60.3, dia: 5.64, sweep: 30, ar: 9.3, tail: 'low', tip: 'winglet', tipH: 2.7, eng: { wing: [0.33, 0.6], d: 2.35, l: 5 } },
  'a330-300': { len: 63.7, span: 60.3, dia: 5.64, sweep: 30, ar: 10, tail: 'low', tip: 'winglet', tipH: 2.7, eng: { wing: [0.31], d: 3, l: 6 } },
  a321: { len: 44.5, span: 34.1, dia: 3.95, tall: 1.05, sweep: 25, ar: 9.4, tail: 'low', tip: 'fence', tipH: 1.6, eng: { wing: [0.34], d: 2.2, l: 4.9 } },
  'b777-200': { len: 63.7, span: 60.9, dia: 6.2, sweep: 31.6, ar: 8.7, tail: 'low', eng: { wing: [0.31], d: 3.6, l: 7.2 } },
  'b737-800': { len: 39.5, span: 35.8, dia: 3.76, tall: 1.07, sweep: 25, ar: 9.4, tail: 'low', tip: 'blended', tipH: 2.4, eng: { wing: [0.34], d: 2.05, l: 4.4 } },
  // 2000년대 이후
  q400: { len: 32.8, span: 28.4, dia: 2.69, sweep: 0, ar: 12.8, taper: 0.5, high: true, tail: 't', eng: { prop: [0.29], d: 1.35, l: 0, propD: 4.1 }, noseLen: 1.5, stab: 0.29 },
  'a340-600': { len: 75.4, span: 63.5, dia: 5.64, sweep: 31, ar: 9.2, tail: 'low', tip: 'winglet', tipH: 2.9, eng: { wing: [0.33, 0.6], d: 2.9, l: 6 } },
  'b777-300': { len: 73.9, span: 64.8, dia: 6.2, sweep: 31.6, ar: 9, tail: 'low', tip: 'raked', eng: { wing: [0.3], d: 3.9, l: 7.6 } },
  e190: { len: 36.2, span: 28.7, dia: 3, tall: 1.12, sweep: 23, ar: 8.6, tail: 'low', tip: 'winglet', tipH: 1.5, eng: { wing: [0.33], d: 1.7, l: 3.8 } },
  a380: { len: 72.7, span: 79.8, dia: 7.14, tall: 1.18, sweep: 33.5, ar: 7.5, taper: 0.22, decks: 2, tail: 'low', tip: 'fence', tipH: 3.4, noseLen: 1.35, eng: { wing: [0.37, 0.63], d: 3.4, l: 6.5 } },
  'b787-8': { len: 56.7, span: 60.1, dia: 5.77, sweep: 32.2, ar: 11, taper: 0.18, tail: 'low', tip: 'raked', eng: { wing: [0.32], d: 3.25, l: 6.3 } },
  'b787-9': { len: 62.8, span: 60.1, dia: 5.77, sweep: 32.2, ar: 11, taper: 0.18, tail: 'low', tip: 'raked', eng: { wing: [0.32], d: 3.25, l: 6.3 } },
  'a350-900': { len: 66.8, span: 64.75, dia: 5.96, sweep: 31.9, ar: 9.5, tail: 'low', tip: 'curved', tipH: 3.4, eng: { wing: [0.31], d: 3.5, l: 6.6 } },
  'a220-300': { len: 38.7, span: 35.1, dia: 3.7, sweep: 25, ar: 11, tail: 'low', tip: 'blended', tipH: 1.6, eng: { wing: [0.33], d: 2.15, l: 4.4 } },
  a320neo: { len: 37.6, span: 35.8, dia: 3.95, tall: 1.05, sweep: 25, ar: 9.4, tail: 'low', tip: 'sharklet', tipH: 2.4, eng: { wing: [0.34], d: 2.45, l: 4.8 } },
  a321neo: { len: 44.5, span: 35.8, dia: 3.95, tall: 1.05, sweep: 25, ar: 9.4, tail: 'low', tip: 'sharklet', tipH: 2.4, eng: { wing: [0.34], d: 2.45, l: 4.8 } },
  'a330-900': { len: 63.7, span: 64, dia: 5.64, sweep: 30, ar: 10.5, tail: 'low', tip: 'sharklet', tipH: 3.2, eng: { wing: [0.31], d: 3.3, l: 6.2 } },
  'a350-1000': { len: 73.8, span: 64.75, dia: 5.96, sweep: 31.9, ar: 9.5, tail: 'low', tip: 'curved', tipH: 3.4, eng: { wing: [0.31], d: 3.6, l: 6.7 } },
};
