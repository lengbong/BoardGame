import type { CSSProperties, ReactNode } from 'react';
import { SEAT_COLORS } from '../common/players';
import { CityArt } from './art/cities';
import { AirportTaxArt, BuildingIcon, CardArt, FestivalArt, HotelTaxArt, Pawn, PlaneArt, StartArt, StuckArt } from './art/tiles';
import { REGION_INFO, SQUARES, squareGridPosition } from './board';
import type { Floater } from './Effects';
import { rentAt } from './rules';
import type { Square, WorldState } from './types';

interface WorldBoardProps {
  state: WorldState;
  /** 애니메이션 중인 말의 위치 덮어쓰기 */
  tokenOverride: { playerIndex: number; position: number } | null;
  /** 바뀔 때마다 움직이는 말이 한 번 깡충 뛴다 */
  hopKey: number;
  hopDuration: number;
  selectable: number[];
  popSquares: ReadonlySet<number>;
  floaters: Floater[];
  onSelect: (index: number) => void;
  onInspect: (index: number) => void;
  children: ReactNode;
}

/** 칸 안에서 말 4개가 설 자리 (칸 너비·높이에 대한 비율, 말의 발 위치) */
const TOKEN_SLOTS = [0.25, 0.42, 0.59, 0.76];
const TOKEN_FOOT = 0.6;

const CORNER_ART: Record<number, (p: { className?: string }) => ReactNode> = {
  0: StartArt,
  8: StuckArt,
  16: FestivalArt,
  24: PlaneArt,
};

function TileContent({ square, state }: { square: Square; state: WorldState }) {
  if (square.kind === 'city') {
    const prop = state.properties[square.index]!;
    const owner = prop.owner !== null ? state.players[prop.owner] : null;
    const c = owner ? SEAT_COLORS[owner.seat] : null;
    return (
      <>
        <div className="tile-art-wrap">
          <CityArt id={square.cityId!} className="tile-art" />
          {c && (
            <span className="tile-bicon-wrap" key={prop.level}>
              <BuildingIcon level={prop.level} color={c.main} dark={c.dark} className="tile-bicon" />
            </span>
          )}
          {state.festivalSquare === square.index && <span className="tile-festival">🎉</span>}
        </div>
        <div className="tile-band" style={{ background: REGION_INFO[square.region!].color }} />
        <div className="tile-info">
          <span className="tile-name">{square.name}</span>
          <span className="tile-price">
            <span className="coin" />
            {owner ? rentAt(state, square.index).toLocaleString('ko-KR') : square.price!.toLocaleString('ko-KR')}
          </span>
        </div>
      </>
    );
  }
  if (square.kind === 'card' || square.kind === 'tax') {
    const Art = square.kind === 'card' ? CardArt : square.index === 5 ? AirportTaxArt : HotelTaxArt;
    return (
      <>
        <div className="tile-art-wrap tile-art-square">
          <Art className="tile-art" />
        </div>
        <div className="tile-info">
          <span className="tile-name">{square.name}</span>
          {square.kind === 'tax' && (
            <span className="tile-price tile-tax">
              <span className="coin" />-{square.tax}
            </span>
          )}
        </div>
      </>
    );
  }
  const Art = CORNER_ART[square.index];
  return (
    <>
      <Art className="tile-art tile-art-full" />
      <span className="tile-corner-label">{square.name}</span>
    </>
  );
}

export function WorldBoard(props: WorldBoardProps) {
  const { state, tokenOverride, hopKey, hopDuration, selectable, popSquares, floaters, onSelect, onInspect, children } = props;
  const selecting = selectable.length > 0;

  const tokenPositions = state.players.map((p, i) =>
    tokenOverride && tokenOverride.playerIndex === i ? tokenOverride.position : p.position,
  );

  return (
    <div className="wb-frame" style={{ '--hop-duration': `${Math.max(hopDuration, 60)}ms` } as CSSProperties}>
      <div className="wb">
        {SQUARES.map((square) => {
          const { row, col } = squareGridPosition(square.index);
          const prop = state.properties[square.index];
          const owner = prop && prop.owner !== null ? state.players[prop.owner] : null;
          const canSelect = selectable.includes(square.index);
          const clickable = selecting ? canSelect : square.kind === 'city';
          const tileStyle: CSSProperties = {};
          if (owner) {
            const c = SEAT_COLORS[owner.seat];
            Object.assign(tileStyle, { '--owner': c.main, '--owner-dark': c.dark, '--owner-light': c.light });
          }
          const classes = [
            'sq',
            `sq-${square.kind}`,
            square.index % 8 === 0 ? 'sq-corner' : '',
            owner ? 'sq-owned' : '',
            canSelect ? 'sq-selectable' : '',
            selecting && !canSelect ? 'sq-dim' : '',
            popSquares.has(square.index) ? 'sq-pop' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              type="button"
              key={square.index}
              className={classes}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
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
              <div className="tile" style={tileStyle}>
                <TileContent square={square} state={state} />
              </div>
            </button>
          );
        })}

        <div className="wb-center">{children}</div>

        {/* 말: 판 전체를 덮는 층에 절대 위치로 그려서 칸 사이를 부드럽게 움직인다 */}
        <div className="wb-tokens" aria-hidden="true">
          {state.players.map((p, i) => {
            if (p.bankrupt) return null;
            const { row, col } = squareGridPosition(tokenPositions[i]);
            const c = SEAT_COLORS[p.seat];
            const moving = tokenOverride?.playerIndex === i;
            const isCurrent = i === state.current && state.phase !== 'gameover';
            return (
              <div
                key={p.seat}
                className={`wb-token${isCurrent ? ' wb-token-current' : ''}${moving ? ' wb-token-moving' : ''}`}
                style={{
                  left: `${((col + TOKEN_SLOTS[i]) / 9) * 100}%`,
                  top: `${((row + TOKEN_FOOT) / 9) * 100}%`,
                  zIndex: isCurrent ? 6 : 4 + i * 0.1,
                }}
              >
                <div className="wb-token-hop" key={moving ? hopKey : 'still'}>
                  <Pawn color={c.main} dark={c.dark} className="wb-pawn" />
                  {p.stuckTurns > 0 && <span className="wb-token-badge">🛂</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 돈이 오갈 때 떠오르는 숫자 */}
        <div className="wb-floaters" aria-hidden="true">
          {floaters.map((f) => {
            const { row, col } = squareGridPosition(f.square);
            return (
              <div
                key={f.id}
                className={`floater ${f.amount > 0 ? 'floater-plus' : 'floater-minus'}`}
                style={{ left: `${((col + 0.5) / 9) * 100}%`, top: `${((row + 0.15 + (f.playerIndex % 2) * 0.12) / 9) * 100}%` }}
              >
                {f.amount > 0 ? '+' : '−'}
                {Math.abs(f.amount).toLocaleString('ko-KR')}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
