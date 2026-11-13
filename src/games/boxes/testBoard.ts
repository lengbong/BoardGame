/**
 * 테스트용: 글자 그림으로 판을 만든다. (게임 화면에서는 쓰지 않는다)
 *
 *   +-+-+      '+' 점, '-' 그은 가로선, '|' 그은 세로선, 빈칸은 안 그은 선
 *   |0| |      상자 칸의 숫자는 주인 (네 변이 다 그어진 상자만). 숫자가 없으면 0번 사람 것
 *   +-+ +
 */
import { boxLines, createGame, hLine, vLine } from './rules';
import type { BoxesSetup, BoxesState, SeatKind } from './types';

export interface BoardOptions {
  players?: number;
  current?: number;
  noExtraTurn?: boolean;
  kinds?: SeatKind[];
}

export function boardFromAscii(ascii: string, opts: BoardOptions = {}): BoxesState {
  const raw = ascii.split('\n');
  while (raw.length && raw[0].trim() === '') raw.shift();
  while (raw.length && raw[raw.length - 1].trim() === '') raw.pop();
  const indent = Math.min(...raw.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  const rows = raw.map((l) => l.slice(indent));
  const n = (rows.length - 1) / 2;
  if (!Number.isInteger(n) || n < 1) throw new Error('판 그림의 줄 수가 이상해요');
  const width = 2 * n + 1;
  const at = (y: number, x: number) => (rows[y] ?? '').padEnd(width, ' ')[x];

  const players = opts.players ?? 2;
  const seats = Array.from({ length: 4 }, (_, i) => ({
    kind: i < players ? (opts.kinds?.[i] ?? 'ai-normal') : 'empty',
    name: `P${i}`,
  })) as BoxesSetup['seats'];
  const s = createGame({ seats, options: { size: Math.max(3, n), noExtraTurn: !!opts.noExtraTurn, warnings: true } }, () => 0);
  // createGame은 3~6만 받으니 크기를 직접 맞춘다.
  s.size = n;
  s.options = { ...s.options, size: n };
  s.lines = Array.from({ length: 2 * n * (n + 1) }, () => -1);
  s.boxes = Array.from({ length: n * n }, () => -1);

  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) if (at(2 * r, 2 * c + 1) === '-') s.lines[hLine(n, r, c)] = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) if (at(2 * r + 1, 2 * c) === '|') s.lines[vLine(n, r, c)] = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const b = r * n + c;
      const full = boxLines(n, b).every((l) => s.lines[l] !== -1);
      const ch = at(2 * r + 1, 2 * c + 1);
      const digit = /[0-9]/.test(ch) ? Number(ch) : null;
      if (digit !== null && !full) throw new Error(`상자 (${r},${c})에 주인이 있는데 네 변이 다 그어지지 않았어요`);
      if (full) s.boxes[b] = digit ?? 0;
    }
  }
  s.players.forEach((p, i) => (p.score = s.boxes.filter((o) => o === i).length));
  s.current = opts.current ?? 0;
  s.history = s.lines.map((p, e) => (p === -1 ? -1 : e)).filter((e) => e >= 0);
  return s;
}

/** 디버깅용: 상태를 글자 그림으로 */
export function boardToAscii(s: BoxesState): string {
  const n = s.size;
  const rows: string[] = [];
  for (let r = 0; r <= n; r++) {
    let line = '';
    for (let c = 0; c < n; c++) line += '+' + (s.lines[hLine(n, r, c)] !== -1 ? '-' : ' ');
    rows.push(line + '+');
    if (r === n) break;
    let mid = '';
    for (let c = 0; c < n; c++) {
      mid += s.lines[vLine(n, r, c)] !== -1 ? '|' : ' ';
      const o = s.boxes[r * n + c];
      mid += o === -1 ? ' ' : String(o);
    }
    rows.push(mid + (s.lines[vLine(n, r, n)] !== -1 ? '|' : ' '));
  }
  return rows.join('\n');
}
