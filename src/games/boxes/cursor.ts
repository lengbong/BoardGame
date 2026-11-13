import { hLine, lineInfo, vLine } from './rules';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const ARROW_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * 키보드 커서: 선 자리를 (2n+1)×(2n+1) 격자로 본다.
 * 가로선은 (x 홀수, y 짝수), 세로선은 (x 짝수, y 홀수).
 * ←→는 같은 줄의 다음 선으로, ↑↓는 가로선 줄 ↔ 세로선 줄을 번갈아 (아래로 두 번 가면 같은 칸 아래 가로선).
 */
export function moveCursor(n: number, edge: number, dir: Direction): number {
  const { horizontal, r, c } = lineInfo(n, edge);
  const x = horizontal ? 2 * c + 1 : 2 * c;
  const y = horizontal ? 2 * r : 2 * r + 1;
  if (dir === 'left' || dir === 'right') {
    const nx = x + (dir === 'left' ? -2 : 2);
    const min = horizontal ? 1 : 0;
    const max = horizontal ? 2 * n - 1 : 2 * n;
    if (nx < min || nx > max) return edge;
    return horizontal ? hLine(n, r, (nx - 1) / 2) : vLine(n, r, nx / 2);
  }
  const ny = y + (dir === 'up' ? -1 : 1);
  if (ny < 0 || ny > 2 * n) return edge;
  if (horizontal) {
    // 가로선 → 그 칸의 왼쪽 세로선
    return vLine(n, (ny - 1) / 2, (x - 1) / 2);
  }
  // 세로선 → 오른쪽 칸의 가로선 (맨 오른쪽 세로선이면 왼쪽 칸)
  const nx = x + 1 <= 2 * n - 1 ? x + 1 : x - 1;
  return hLine(n, ny / 2, (nx - 1) / 2);
}

/** 처음 커서 자리: 판 가운데쯤 가로선 */
export function centerLine(n: number): number {
  return hLine(n, Math.floor(n / 2), Math.floor((n - 1) / 2));
}

/** 화면 읽기 프로그램용 선 이름 */
export function lineLabel(n: number, edge: number): string {
  const { horizontal, r, c } = lineInfo(n, edge);
  return horizontal ? `가로선 ${r + 1}번째 줄 ${c + 1}번째` : `세로선 ${r + 1}번째 줄 ${c + 1}번째`;
}
