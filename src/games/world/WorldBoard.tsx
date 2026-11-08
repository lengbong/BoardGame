import type { ReactNode } from 'react';
import { SEAT_COLORS } from '../common/players';
import { CORNER_INFO, LEVEL_ICONS, REGION_INFO, SQUARES, squareGridPosition } from './board';
import { CITY_IMAGES } from './cityImages';
import { rentAt } from './rules';
import type { Square, WorldState } from './types';

interface WorldBoardProps {
  state: WorldState;
  /** 애니메이션 중인 말의 위치 덮어쓰기 */
  tokenOverride: { playerIndex: number; position: number } | null;
  selectable: number[];
  onSelect: (index: number) => void;
  onInspect: (index: number) => void;
  children: ReactNode;
}

const TOKEN_SLOTS = [
  { x: 0.22, y: 0.8 },
  { x: 0.42, y: 0.8 },
  { x: 0.62, y: 0.8 },
  { x: 0.82, y: 0.8 },
];

function coins(n: number): string {
  return n.toLocaleString('ko-KR');
}

function SquareView({ square, state }: { square: Square; state: WorldState }) {
  if (square.kind === 'city') {
    const prop = state.properties[square.index]!;
    const owner = prop.owner !== null ? state.players[prop.owner] : null;
    const region = REGION_INFO[square.region!];
    return (
      <>
        <div className="sq-band" style={{ background: region.color }} />
        <img className="sq-img" src={CITY_IMAGES[square.cityId!]} alt="" draggable={false} />
        <div className="sq-name">{square.name}</div>
        <div className="sq-sub">
          {owner ? (
            <>
              <span className="sq-level">{LEVEL_ICONS[prop.level] || '🚩'}</span>
              <span>{coins(rentAt(state, square.index))}</span>
            </>
          ) : (
            <span>{coins(square.price!)}</span>
          )}
        </div>
        {state.festivalSquare === square.index && <span className="sq-festival" title="축제 중 (통행료 2배)">🎉</span>}
      </>
    );
  }
  if (square.kind === 'card') {
    return (
      <div className="sq-special">
        <span className="sq-emoji">🧳</span>
        <span className="sq-name">{square.name}</span>
      </div>
    );
  }
  if (square.kind === 'tax') {
    return (
      <div className="sq-special">
        <span className="sq-emoji">💰</span>
        <span className="sq-name">{square.name}</span>
        <span className="sq-sub">{coins(square.tax!)} 내기</span>
      </div>
    );
  }
  const corner = CORNER_INFO[square.index];
  return (
    <div className="sq-special sq-corner-inner">
      <span className="sq-emoji big">{corner.emoji}</span>
      <span className="sq-name">{square.name}</span>
      <span className="sq-desc">{corner.desc}</span>
    </div>
  );
}

export function WorldBoard({ state, tokenOverride, selectable, onSelect, onInspect, children }: WorldBoardProps) {
  const selecting = selectable.length > 0;

  return (
    <div className="wb">
      {SQUARES.map((square) => {
        const { row, col } = squareGridPosition(square.index);
        const prop = state.properties[square.index];
        const owner = prop && prop.owner !== null ? state.players[prop.owner] : null;
        const canSelect = selectable.includes(square.index);
        const isCorner = square.index % 8 === 0;
        const style: React.CSSProperties = { gridRow: row + 1, gridColumn: col + 1 };
        if (owner) {
          style.borderColor = SEAT_COLORS[owner.seat].main;
          style.background = SEAT_COLORS[owner.seat].light;
        }
        const clickable = selecting ? canSelect : square.kind === 'city';
        return (
          <button
            type="button"
            key={square.index}
            className={`sq sq-${square.kind}${isCorner ? ' sq-corner' : ''}${owner ? ' sq-owned' : ''}${canSelect ? ' sq-selectable' : ''}${
              selecting && !canSelect ? ' sq-dim' : ''
            }`}
            style={style}
            disabled={!clickable}
            onClick={(e) => {
              // 클릭 후 포커스가 칸에 남으면 Space(주사위)가 이 칸을 다시 누르게 되므로 포커스를 뺀다.
              e.currentTarget.blur();
              if (selecting) onSelect(square.index);
              else onInspect(square.index);
            }}
            data-testid={`square-${square.index}`}
            aria-label={square.name}
          >
            <SquareView square={square} state={state} />
          </button>
        );
      })}

      <div className="wb-center">{children}</div>

      {/* 말: 판 전체를 덮는 층에 절대 위치로 그려서 칸 사이를 부드럽게 움직인다 */}
      <div className="wb-tokens" aria-hidden="true">
        {state.players.map((p, i) => {
          if (p.bankrupt) return null;
          const position = tokenOverride && tokenOverride.playerIndex === i ? tokenOverride.position : p.position;
          const { row, col } = squareGridPosition(position);
          const slot = TOKEN_SLOTS[i];
          const c = SEAT_COLORS[p.seat];
          return (
            <div
              key={p.seat}
              className={`wb-token${i === state.current && state.phase !== 'gameover' ? ' wb-token-current' : ''}`}
              style={{
                left: `${((col + slot.x) / 9) * 100}%`,
                top: `${((row + slot.y) / 9) * 100}%`,
                background: c.main,
                borderColor: c.dark,
              }}
            >
              {p.stuckTurns > 0 ? '🛂' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
