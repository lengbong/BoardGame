import { useState } from 'react';
import {
  BOARD_SIZE,
  SEAT_COLORS,
  STAR_SQUARES,
  START_SQUARES,
  TRACK,
  cellKey,
  homeColumnCells,
  progressToPoint,
  rotate,
  type Point,
} from './board';
import type { GameState, Move, SeatIndex } from './types';

export interface PieceOverride {
  playerIndex: number;
  pieceIndex: number;
  progress: number;
}

interface BoardProps {
  state: GameState;
  /** 클릭할 수 있는 말: pieceIndex → Move (현재 플레이어의 말만) */
  movable: Map<number, Move>;
  onMove: (move: Move) => void;
  override: PieceOverride | null;
}

const SEATS: SeatIndex[] = [0, 1, 2, 3];
const YARD_ORIGIN: Record<SeatIndex, Point> = { 0: { x: 0, y: 0 }, 1: { x: 9, y: 0 }, 2: { x: 9, y: 9 }, 3: { x: 0, y: 9 } };

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + radius * Math.cos(a)).toFixed(3)},${(cy + radius * Math.sin(a)).toFixed(3)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** 겹친 말들의 위치를 칸 안에서 조금씩 벌려 놓는다. */
const STACK_OFFSETS: Point[][] = [
  [{ x: 0, y: 0 }],
  [{ x: -0.18, y: 0 }, { x: 0.18, y: 0 }],
  [{ x: 0, y: -0.17 }, { x: -0.18, y: 0.15 }, { x: 0.18, y: 0.15 }],
  [{ x: -0.18, y: -0.18 }, { x: 0.18, y: -0.18 }, { x: -0.18, y: 0.18 }, { x: 0.18, y: 0.18 }],
];

interface PieceView {
  key: string;
  playerIndex: number;
  pieceIndex: number;
  seat: SeatIndex;
  point: Point;
  radius: number;
  move: Move | undefined;
}

export function Board({ state, movable, onMove, override }: BoardProps) {
  const [hoverRaw, setHover] = useState<Move | null>(null);
  const current = state.players[state.current];
  // 이미 움직일 수 없게 된 말의 미리보기는 지운다.
  const hover =
    hoverRaw && hoverRaw.playerIndex === state.current && movable.get(hoverRaw.pieceIndex)?.to === hoverRaw.to ? hoverRaw : null;
  const activeSeats = new Set(state.players.map((p) => p.seat));

  // 말 위치 계산 (겹침 처리 포함)
  const raw = state.players.flatMap((player, playerIndex) =>
    player.pieces.map((progress, pieceIndex) => {
      const p =
        override && override.playerIndex === playerIndex && override.pieceIndex === pieceIndex ? override.progress : progress;
      return { playerIndex, pieceIndex, seat: player.seat, progress: p, cell: cellKey(player.seat, pieceIndex, p) };
    }),
  );
  const groups = new Map<string, typeof raw>();
  for (const r of raw) groups.set(r.cell, [...(groups.get(r.cell) ?? []), r]);

  const pieces: PieceView[] = raw.map((r) => {
    const group = groups.get(r.cell)!;
    const n = Math.min(group.length, 4);
    const idx = Math.min(group.indexOf(r), 3);
    const base = progressToPoint(r.seat, r.pieceIndex, r.progress);
    const off = STACK_OFFSETS[n - 1][idx];
    const inGoal = r.progress >= 56;
    return {
      key: `${r.playerIndex}-${r.pieceIndex}`,
      playerIndex: r.playerIndex,
      pieceIndex: r.pieceIndex,
      seat: r.seat,
      point: { x: base.x + off.x, y: base.y + off.y },
      radius: inGoal ? 0.2 : n > 1 ? 0.27 : 0.36,
      move: r.playerIndex === state.current ? movable.get(r.pieceIndex) : undefined,
    };
  });
  // 현재 플레이어의 말을 맨 위에 그려서 클릭하기 쉽게
  pieces.sort((a, b) => Number(a.playerIndex === state.current) - Number(b.playerIndex === state.current));

  const hoverTarget = hover ? progressToPoint(current.seat, hover.pieceIndex, hover.to) : null;
  const capturedKeys = new Set(hover?.captures.map((c) => `${c.playerIndex}-${c.pieceIndex}`) ?? []);

  return (
    <svg className="board" viewBox={`-0.2 -0.2 ${BOARD_SIZE + 0.4} ${BOARD_SIZE + 0.4}`} role="img" aria-label="말판">
      <rect x={-0.1} y={-0.1} width={BOARD_SIZE + 0.2} height={BOARD_SIZE + 0.2} rx={0.4} className="board-bg" />

      {/* 대기실 */}
      {SEATS.map((seat) => {
        const o = YARD_ORIGIN[seat];
        const c = SEAT_COLORS[seat];
        const player = state.players.find((p) => p.seat === seat);
        const isCurrent = current.seat === seat && state.phase !== 'gameover';
        const top = seat === 0 || seat === 1;
        return (
          <g key={seat} className={`yard${activeSeats.has(seat) ? '' : ' yard-empty'}${isCurrent ? ' yard-current' : ''}`}>
            <rect x={o.x + 0.05} y={o.y + 0.05} width={5.9} height={5.9} rx={0.35} fill={c.main} stroke={c.dark} strokeWidth={0.06} />
            <rect x={o.x + 0.8} y={o.y + 0.8} width={4.4} height={4.4} rx={0.4} fill="#fff" stroke={c.dark} strokeWidth={0.04} />
            {[0, 1, 2, 3].map((i) => {
              const s = progressToPoint(seat, i, -1);
              return <circle key={i} cx={s.x} cy={s.y} r={0.48} fill={c.light} stroke={c.main} strokeWidth={0.06} strokeDasharray="0.12 0.08" />;
            })}
            <text x={o.x + 3} y={top ? o.y + 0.56 : o.y + 5.66} className="yard-label">
              {player ? player.name : '비어 있음'}
              {player && player.kind !== 'human' ? ' 🤖' : ''}
            </text>
          </g>
        );
      })}

      {/* 공용 트랙 */}
      {TRACK.map((p, i) => {
        const startSeat = START_SQUARES.indexOf(i);
        const fill = startSeat >= 0 ? SEAT_COLORS[startSeat as SeatIndex].main : '#fff';
        return (
          <g key={i}>
            <rect x={p.x - 0.5} y={p.y - 0.5} width={1} height={1} fill={fill} className="cell" />
            {state.rules.safeSquares && STAR_SQUARES.includes(i) && <path d={starPath(p.x, p.y, 0.32)} className="star" />}
            {state.rules.safeSquares && startSeat >= 0 && <path d={starPath(p.x, p.y, 0.32)} className="star star-start" />}
          </g>
        );
      })}

      {/* 결승 통로 */}
      {SEATS.map((seat) =>
        homeColumnCells(seat).map((p, i) => (
          <rect key={`${seat}-${i}`} x={p.x - 0.5} y={p.y - 0.5} width={1} height={1} fill={SEAT_COLORS[seat].main} className="cell" opacity={0.85} />
        )),
      )}

      {/* 가운데 골인 지점 */}
      {SEATS.map((seat) => {
        const pts = [
          { x: 6, y: 6 },
          { x: 6, y: 9 },
          { x: 7.5, y: 7.5 },
        ].map((p) => rotate(p, seat));
        return (
          <polygon
            key={seat}
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={SEAT_COLORS[seat].main}
            stroke={SEAT_COLORS[seat].dark}
            strokeWidth={0.04}
          />
        );
      })}

      {/* 마우스를 올린 말의 도착 위치 미리보기 */}
      {hoverTarget && (
        <circle cx={hoverTarget.x} cy={hoverTarget.y} r={0.42} className="target-ring" stroke={SEAT_COLORS[current.seat].dark} />
      )}

      {/* 말 */}
      {pieces.map((pv) => {
        const c = SEAT_COLORS[pv.seat];
        const clickable = !!pv.move;
        return (
          <g
            key={pv.key}
            className={`piece${clickable ? ' piece-movable' : ''}${capturedKeys.has(pv.key) ? ' piece-threatened' : ''}`}
            style={{ transform: `translate(${pv.point.x}px, ${pv.point.y}px)` }}
            onClick={
              clickable
                ? () => {
                    setHover(null);
                    onMove(pv.move!);
                  }
                : undefined
            }
            onMouseEnter={clickable ? () => setHover(pv.move!) : undefined}
            onMouseLeave={clickable ? () => setHover(null) : undefined}
            data-testid={clickable ? `movable-piece-${pv.pieceIndex + 1}` : undefined}
          >
            {clickable && <circle r={pv.radius + 0.12} className="piece-glow" stroke={c.dark} />}
            <circle r={pv.radius} fill={c.main} stroke={c.dark} strokeWidth={0.07} />
            <circle r={pv.radius * 0.55} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={0.05} />
            {clickable && (
              <text className="piece-number" fontSize={pv.radius * 1.05}>
                {pv.pieceIndex + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
