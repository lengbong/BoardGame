import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { SEAT_COLORS } from '../common/players';
import { playerName } from './rules';
import type { SortMode } from './storage';
import { TileFace } from './TileArt';
import { sortByColor, sortByNumber } from './tiles';
import type { Player, Tile } from './types';

interface RackProps {
  player: Player | null;
  tiles: Tile[];
  faceUp: boolean;
  interactive: boolean;
  /** '내 타일 보기'를 눌러야 하는지 */
  covered: boolean;
  selected: ReadonlySet<number>;
  recent: ReadonlySet<number>;
  sort: SortMode;
  hint: ReactNode;
  canDropBack: boolean;
  canUndo: boolean;
  canDraw: boolean;
  drawLabel: string;
  canCommit: boolean;
  onSort: (sort: SortMode) => void;
  onTile: (id: number) => void;
  onDropBack: () => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onUndo: () => void;
  onDraw: () => void;
  onCommit: () => void;
  onReveal: () => void;
}

export function Rack(props: RackProps) {
  const { player, faceUp, interactive, covered, selected, recent } = props;
  const [hover, setHover] = useState(false);
  if (!player) {
    return (
      <section className="tl-rack-area tl-rack-empty">
        <p>{props.hint}</p>
      </section>
    );
  }
  const c = SEAT_COLORS[player.seat];
  const tiles = props.sort === 'number' ? sortByNumber(props.tiles) : sortByColor(props.tiles);

  const drop = {
    onDragOver: (e: DragEvent) => {
      if (!props.canDropBack) return;
      e.preventDefault();
      setHover(true);
    },
    onDragLeave: () => setHover(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setHover(false);
      props.onDropBack();
    },
  };

  return (
    <section
      className={`tl-rack-area${interactive ? ' tl-rack-turn' : ''}`}
      style={{ '--pc': c.main, '--pc-light': c.light } as CSSProperties}
      data-testid="tl-rack"
    >
      <header className="tl-rack-head">
        <span className="tl-avatar">{playerName(player).slice(0, 1)}</span>
        <strong>{playerName(player)}의 타일</strong>
        <span className="tl-rack-count">{player.rack.length}개</span>
        <div className="tl-sort" role="group" aria-label="정렬">
          <button type="button" className={`btn btn-small${props.sort === 'color' ? ' btn-selected' : ''}`} onClick={() => props.onSort('color')}>
            색깔순 7·8·9
          </button>
          <button type="button" className={`btn btn-small${props.sort === 'number' ? ' btn-selected' : ''}`} onClick={() => props.onSort('number')}>
            숫자순 7·7·7
          </button>
        </div>
        <div className="tl-actions">
          <button type="button" className="btn" onClick={props.onUndo} disabled={!props.canUndo} data-testid="tl-undo">
            ↩ 되돌리기
          </button>
          <button type="button" className="btn" onClick={props.onDraw} disabled={!props.canDraw} data-testid="tl-draw">
            {props.drawLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={props.onCommit} disabled={!props.canCommit} data-testid="tl-commit">
            ✓ 완료 <kbd>Enter</kbd>
          </button>
        </div>
      </header>
      <div className="tl-hint" data-testid="tl-hint">
        {props.hint}
      </div>

      <div
        className={`tl-rack${props.canDropBack ? ' tl-rack-droppable' : ''}${hover ? ' tl-rack-hover' : ''}`}
        onClick={() => props.canDropBack && props.onDropBack()}
        {...drop}
      >
        {tiles.map((t) =>
          faceUp && !covered ? (
            <button
              key={t.id}
              type="button"
              className={`tl-tile-btn${selected.has(t.id) ? ' tl-selected' : ''}${recent.has(t.id) ? ' tl-recent' : ''}${interactive ? ' tl-pickable' : ''}`}
              disabled={!interactive}
              draggable={interactive}
              onDragStart={() => props.onDragStart(t.id)}
              onDragEnd={props.onDragEnd}
              onClick={(e) => {
                e.stopPropagation();
                props.onTile(t.id);
              }}
              data-testid={`tl-tile-${t.id}`}
            >
              <TileFace tile={t} />
            </button>
          ) : (
            <span key={t.id} className="tl-tile tl-tile-back" />
          ),
        )}
        {props.canDropBack && <span className="tl-rack-drop">여기를 누르면 내 칸으로 되돌려요</span>}
      </div>

      {covered && (
        <div className="tl-cover">
          <p>
            <strong>{playerName(player)}</strong> 차례예요. 다른 사람은 잠깐 눈을 감아 주세요! 🙈
          </p>
          <button type="button" className="btn btn-primary btn-large" onClick={props.onReveal} data-testid="tl-reveal">
            내 타일 보기 <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </section>
  );
}
