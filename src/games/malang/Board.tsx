import type { CSSProperties, ReactElement } from 'react';
import { DEATH_X, GARBAGE, H, W } from './types';
import type { PlayerState } from './types';
import { POP_TIME, fallTime, ghostCells, idx, pieceCells } from './engine';
import { Bridge, Jelly, colorOf } from './JellyArt';

/** 판 위에 잠깐 떠오르는 글자 (연쇄, 레벨 업 …) */
export interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: 'chain' | 'big' | 'clear' | 'info';
}

interface BoardProps {
  player: PlayerState;
  ghost: boolean;
  popups: Popup[];
  /** 가운데 줄이 위험할 만큼 높다 */
  danger: boolean;
  /** 흔들림 세기 (0이면 안 흔들림), 바뀔 때마다 다시 흔들린다 */
  shake: { id: number; power: number } | null;
  label: string;
}

/** 떨어지는 중인 젤리의 지금 높이 (가속하며 떨어진다) */
function fallingY(from: number, to: number, timer: number): number {
  const d = fallTime(to - from);
  if (d <= 0 || timer >= d) return to;
  const t = timer / d;
  return from + (to - from) * t * t;
}

export function Board({ player: p, ghost, popups, danger, shake, label }: BoardProps) {
  const falling = new Map(p.falls.map((f) => [f.id, f]));
  const popping = new Set(p.pop?.ids ?? []);
  const inMotion = (id: number) => falling.has(id) && p.timer < fallTime(falling.get(id)!.to - falling.get(id)!.from);

  // 붙어 있는 같은 색 젤리 사이의 다리 (떨어지는 중인 젤리는 빼고)
  const bridges: ReactElement[] = [];
  const blobs: ReactElement[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const b = p.grid[idx(x, y)];
      if (!b) continue;
      const still = (id: number) => !inMotion(id) && !popping.has(id);
      if (still(b.id) && b.c !== GARBAGE) {
        const right = x + 1 < W ? p.grid[idx(x + 1, y)] : null;
        const down = y + 1 < H ? p.grid[idx(x, y + 1)] : null;
        if (right && right.c === b.c && still(right.id)) bridges.push(<Bridge key={`h${b.id}`} x={x} y={y} dir="h" c={b.c} />);
        if (down && down.c === b.c && still(down.id)) bridges.push(<Bridge key={`v${b.id}`} x={x} y={y} dir="v" c={b.c} />);
      }
      const f = falling.get(b.id);
      const vy = f ? fallingY(f.from, f.to, p.timer) : y;
      const isPop = popping.has(b.id);
      blobs.push(
        <g key={b.id} transform={`translate(0 ${vy - y})`}>
          <g key={`l${y}`} className="mp-land" style={{ animationDelay: `${f ? fallTime(f.to - f.from) : 0}ms` } as CSSProperties}>
            <Jelly
              c={b.c}
              x={x}
              y={y}
              mood={isPop ? 'pop' : danger && b.c !== GARBAGE ? 'scared' : 'normal'}
              blink={(b.id * 0.73) % 5}
              className={isPop ? 'mp-popping' : ''}
            />
          </g>
        </g>,
      );
    }
  }

  const piece = p.phase === 'move' ? p.piece : null;
  const ghosts = piece && ghost ? ghostCells(p.grid, piece) : [];

  return (
    <div className={`mp-board${danger ? ' mp-board-danger' : ''}${p.phase === 'dead' ? ' mp-board-dead' : ''}`} aria-label={label} role="img">
      <svg
        key={shake?.id ?? 0}
        viewBox="-0.1 -1.1 6.2 13.2"
        className={shake && shake.power > 0 ? 'mp-shake' : ''}
        style={{ '--power': `${shake?.power ?? 0}` } as CSSProperties}
      >
        <defs>
          <pattern id="mp-dots" width={1} height={1} patternUnits="userSpaceOnUse">
            <circle cx={0.5} cy={0.5} r={0.04} fill="rgba(255,255,255,0.22)" />
          </pattern>
        </defs>
        <rect x={-0.1} y={-1.1} width={6.2} height={1.1} className="mp-sky" />
        <rect x={0} y={0} width={W} height={H} rx={0.25} className="mp-well" />
        <rect x={0} y={0} width={W} height={H} rx={0.25} fill="url(#mp-dots)" />
        <g className="mp-deathmark" transform={`translate(${DEATH_X} 0)`}>
          <path d="M0.25 0.25 L0.75 0.75 M0.75 0.25 L0.25 0.75" />
        </g>

        {ghosts.map((g, i) => (
          <circle key={`g${i}`} cx={g.x + 0.5} cy={g.y + 0.52} r={0.36} className="mp-ghost" stroke={colorOf(g.c).body} />
        ))}

        <g className="mp-bridges">{bridges}</g>
        {blobs}

        {piece &&
          pieceCells(piece).map(([x, y], i) => (
            <Jelly key={piece.ids[i]} c={piece.colors[i]} x={x} y={y + piece.fall} pivot={i === 0} blink={(piece.ids[i] * 0.73) % 5} />
          ))}

        {p.pop &&
          p.pop.ids.slice(0, 12).map((id, i) => {
            const k = p.grid.findIndex((b) => b?.id === id);
            if (k < 0) return null;
            const b = p.grid[k]!;
            const x = k % W;
            const y = Math.floor(k / W);
            return (
              <g key={`p${id}`} className="mp-burst" style={{ '--d': `${POP_TIME * 0.45}ms` } as CSSProperties}>
                {[0, 1, 2, 3, 4].map((j) => {
                  const a = ((j * 72 + i * 23) * Math.PI) / 180;
                  return (
                    <circle
                      key={j}
                      cx={x + 0.5}
                      cy={y + 0.5}
                      r={0.09}
                      fill={colorOf(b.c).light}
                      style={{ '--tx': `${Math.cos(a) * 0.9}px`, '--ty': `${Math.sin(a) * 0.9}px` } as CSSProperties}
                    />
                  );
                })}
              </g>
            );
          })}

        {popups.map((u) => (
          <text key={u.id} x={Math.min(W - 1.5, Math.max(1.5, u.x + 0.5))} y={Math.max(1, u.y + 0.5)} className={`mp-popup mp-popup-${u.tone}`} textAnchor="middle">
            {u.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
