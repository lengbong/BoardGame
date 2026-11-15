import { SHAPES } from './aircraftShapes';
import { FREIGHTERS } from './freighters';
import type { PlaneShape } from './plane3d';

/**
 * 화물기 그림: 바탕 여객기의 실제 치수에 손님 창문을 빼고 큰 짐 문을 그린다 (plane3d.ts의 freighter).
 * 바탕 여객기와 길이·날개가 다른 기종(747-8F, A330-200F)은 그 치수로 고친다.
 */
const FIX: Record<string, Partial<PlaneShape>> = {
  'b747-8f': { len: 76.3, span: 68.4, tip: 'raked', tipH: undefined, eng: { wing: [0.4, 0.68], d: 3.1, l: 6.4 } },
  'b747-400f': { hump: 0.33, tip: 'winglet', tipH: 1.9 },
  'a330-200f': { len: 58.8 },
  'b737-800bcf': {},
};

export const FREIGHTER_SHAPES: Record<string, PlaneShape> = Object.fromEntries(
  FREIGHTERS.filter((m) => m.base && SHAPES[m.base]).map((m) => [m.id, { ...SHAPES[m.base!], ...FIX[m.id], freighter: true } as PlaneShape]),
);
