/**
 * 줄을 탁자 안에 뱀 모양으로 놓는 배치.
 *
 * 길이 단위(unit) = 패의 짧은 변. 패는 2×1, 더블은 줄과 엇갈리게(가로질러) 놓는다.
 * 첫 패를 가운데 두고 양쪽으로 자란다.
 * - 오른쪽 팔: 오른쪽으로 가다가 끝에 다가가면 아래로 꺾고, 다음 줄은 왼쪽으로, 또 꺾고 … (ㄹ자)
 * - 왼쪽 팔: 오른쪽 팔을 180° 돌린 모양 (왼쪽으로 가다가 위로 꺾는다)
 * 탁자에 다 들어갈 때까지 unit을 조금씩 줄여서 다시 배치한다.
 */

/** 모서리를 돌 때 필요한 여유 (꺾는 패 1칸 + 아래로 내려가는 더블의 반칸) */
const RESERVE = 1.5;
/** 다음 줄은 적어도 이만큼 아래에 놓는다 (더블이 위아래로 겹치지 않게) */
const PITCH = 2.5;

/** 팔 하나를 놓을 때 쓰는 패 정보. entry: 첫 패 쪽에 닿는 숫자, exit: 바깥쪽 숫자 */
export interface ArmTile {
  double: boolean;
  entry: number | null;
  exit: number | null;
}

/** 단위 좌표계에서 패의 가운데와 회전 (0: 가로로 entry가 왼쪽, 90: 세로로 entry가 위쪽 …) */
export interface LocalPos {
  x: number;
  y: number;
  rot: number;
}

/** 화면 좌표(px)에서 패 하나의 위치. 패는 2u×u 크기로 그려서 가운데를 축으로 rot만큼 돌린다. a는 돌리기 전 왼쪽 칸, b는 오른쪽 칸 숫자 */
export interface TilePos {
  x: number;
  y: number;
  rot: number;
  a: number | null;
  b: number | null;
  double: boolean;
  /** 돌린 뒤 차지하는 상자 크기 (px) */
  w: number;
  h: number;
}

export interface GhostSpec {
  double: boolean;
  entry: number | null;
  exit: number | null;
}

export interface LineLayout {
  unit: number;
  /** 단위 좌표에서 탁자 가운데에 오는 점 */
  cx: number;
  cy: number;
  /** line과 같은 순서 */
  tiles: TilePos[];
  /** 다음 패가 놓일 자리 (ghosts를 주었을 때) */
  slots: { left: TilePos | null; right: TilePos | null };
}

export interface LayoutOptions {
  maxUnit?: number;
  minUnit?: number;
  /** 탁자 가장자리 여백 (px) */
  pad?: number;
  /** 양 끝에 다음 패 자리도 함께 배치한다. 줄이 비어 있으면 right 자리를 가운데에 둔다. */
  ghosts?: { left: GhostSpec | null; right: GhostSpec | null } | null;
  /** 크기와 가운데를 다시 정하지 않고 이 값을 그대로 쓴다 (다른 배치와 위치를 맞출 때) */
  fixed?: { unit: number; cx: number; cy: number } | null;
}

/** 오른쪽 팔을 단위 좌표로 배치한다. startX: 첫 패의 오른쪽 끝, halfW: 가운데에서 탁자 끝까지 */
export function layoutArm(tiles: readonly { double: boolean }[], startX: number, halfW: number): LocalPos[] {
  const out: LocalPos[] = [];
  let ax = startX; // 다음 패가 붙을 점
  let ay = 0;
  let phase: 'row' | 'down' = 'row';
  let dir = 1; // 지금 줄이 나아가는 방향 (+1 오른쪽, -1 왼쪽)
  let rowY = 0;
  let lastHalf = 0.5; // 아래로 내려가는 중일 때 마지막 패의 가로 반폭

  for (const t of tiles) {
    if (phase === 'row') {
      const along = t.double ? 1 : 2;
      if (dir * (ax + dir * along) + RESERVE <= halfW) {
        out.push({ x: ax + (dir * along) / 2, y: rowY, rot: t.double ? 90 : dir > 0 ? 0 : 180 });
        ax += dir * along;
      } else {
        // 모서리: 세로로 세워서 아래로 꺾는다. (더블은 원래 세로라서 그 아래 끝에서 내려간다)
        const cx = ax + dir * 0.5;
        if (t.double) {
          out.push({ x: cx, y: rowY, rot: 90 });
          ay = rowY + 1;
        } else {
          out.push({ x: cx, y: rowY + 0.5, rot: 90 });
          ay = rowY + 1.5;
        }
        ax = cx;
        lastHalf = 0.5;
        phase = 'down';
      }
    } else {
      const nextRowY = ay - 0.5;
      if (!t.double && nextRowY >= rowY + PITCH) {
        // 다음 줄로: 마지막 패 옆에 가로로 붙여서 반대 방향으로 간다.
        dir = -dir;
        rowY = nextRowY;
        const sx = ax + dir * lastHalf;
        out.push({ x: sx + dir, y: rowY, rot: dir > 0 ? 0 : 180 });
        ax = sx + dir * 2;
        phase = 'row';
      } else if (t.double) {
        out.push({ x: ax, y: ay + 0.5, rot: 0 });
        ay += 1;
        lastHalf = 1;
      } else {
        out.push({ x: ax, y: ay + 1, rot: 90 });
        ay += 2;
        lastHalf = 0.5;
      }
    }
  }
  return out;
}

export function boxOf(p: LocalPos): { x0: number; y0: number; x1: number; y1: number } {
  const vertical = p.rot % 180 !== 0;
  const hw = vertical ? 0.5 : 1;
  const hh = vertical ? 1 : 0.5;
  return { x0: p.x - hw, y0: p.y - hh, x1: p.x + hw, y1: p.y + hh };
}

const rotate180 = (p: LocalPos): LocalPos => ({ x: -p.x, y: -p.y, rot: (p.rot + 180) % 360 });

/**
 * 줄 전체를 width×height(px) 탁자 안에 배치한다.
 * line: 줄의 패 (앞이 왼쪽 끝), origin: 첫 패의 위치
 */
export function layoutLine(
  line: readonly { left: number; right: number }[],
  origin: number,
  width: number,
  height: number,
  opts: LayoutOptions = {},
): LineLayout {
  const maxUnit = opts.maxUnit ?? 30;
  const minUnit = opts.minUnit ?? 8;
  const pad = opts.pad ?? 12;
  const ghosts = opts.ghosts ?? null;

  if (line.length === 0) {
    const g = ghosts?.right ?? ghosts?.left ?? null;
    const unit = Math.max(minUnit, Math.min(maxUnit, (width - 2 * pad) / 2, (height - 2 * pad) / 2));
    const slot: TilePos | null = g
      ? {
          x: width / 2,
          y: height / 2,
          rot: g.double ? 90 : 0,
          a: g.entry,
          b: g.exit,
          double: g.double,
          w: (g.double ? 1 : 2) * unit,
          h: (g.double ? 2 : 1) * unit,
        }
      : null;
    return { unit, cx: 0, cy: 0, tiles: [], slots: { left: null, right: slot } };
  }

  const o = line[Math.max(0, Math.min(origin, line.length - 1))];
  const originDouble = o.left === o.right;
  const right: ArmTile[] = line.slice(origin + 1).map((t) => ({ double: t.left === t.right, entry: t.left, exit: t.right }));
  const left: ArmTile[] = line
    .slice(0, origin)
    .reverse()
    .map((t) => ({ double: t.left === t.right, entry: t.right, exit: t.left }));
  if (ghosts?.right) right.push({ ...ghosts.right });
  if (ghosts?.left) left.push({ ...ghosts.left });

  const startX = originDouble ? 0.5 : 1;
  const originPos: LocalPos = { x: 0, y: 0, rot: originDouble ? 90 : 0 };

  const fixed = opts.fixed ?? null;
  let unit = fixed ? fixed.unit : maxUnit;
  let r: LocalPos[] = [];
  let l: LocalPos[] = [];
  let box = { x0: 0, y0: 0, x1: 0, y1: 0 };
  for (;;) {
    const halfW = (width / 2 - pad) / unit;
    r = layoutArm(right, startX, halfW);
    l = layoutArm(left, startX, halfW).map(rotate180);
    box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const p of [originPos, ...r, ...l]) {
      const b = boxOf(p);
      box.x0 = Math.min(box.x0, b.x0);
      box.y0 = Math.min(box.y0, b.y0);
      box.x1 = Math.max(box.x1, b.x1);
      box.y1 = Math.max(box.y1, b.y1);
    }
    const fits = (box.x1 - box.x0) * unit <= width - 2 * pad && (box.y1 - box.y0) * unit <= height - 2 * pad;
    if (fixed || fits || unit <= minUnit) break;
    unit = Math.max(minUnit, unit * 0.95);
  }

  const cx = fixed ? fixed.cx : (box.x0 + box.x1) / 2;
  const cy = fixed ? fixed.cy : (box.y0 + box.y1) / 2;
  const toPx = (p: LocalPos, t: { double: boolean; entry: number | null; exit: number | null }): TilePos => {
    const vertical = p.rot % 180 !== 0;
    return {
      x: width / 2 + (p.x - cx) * unit,
      y: height / 2 + (p.y - cy) * unit,
      rot: p.rot,
      a: t.entry,
      b: t.exit,
      double: t.double,
      w: (vertical ? 1 : 2) * unit,
      h: (vertical ? 2 : 1) * unit,
    };
  };

  const tiles: TilePos[] = line.map((_, i) => {
    if (i === origin) return toPx(originPos, { double: originDouble, entry: o.left, exit: o.right });
    if (i > origin) return toPx(r[i - origin - 1], right[i - origin - 1]);
    return toPx(l[origin - 1 - i], left[origin - 1 - i]);
  });
  return {
    unit,
    cx,
    cy,
    tiles,
    slots: {
      left: ghosts?.left ? toPx(l[l.length - 1], left[left.length - 1]) : null,
      right: ghosts?.right ? toPx(r[r.length - 1], right[right.length - 1]) : null,
    },
  };
}
