import { useState, type DragEvent, type ReactNode } from 'react';
import { analyzeSet } from './sets';
import { TileFace } from './TileArt';
import type { TableSet } from './types';
import type { Target } from './work';

interface BoardProps {
  sets: TableSet[];
  interactive: boolean;
  selected: ReadonlySet<number>;
  /** 방금 놓인 타일 (반짝임) */
  fresh: ReadonlySet<number>;
  /** 이번 차례에 내가 내 칸에서 꺼낸 타일 (작은 점 표시) */
  ownPlayed: ReadonlySet<number>;
  canPick: (id: number) => boolean;
  canDrop: (target: Target) => boolean;
  onTile: (id: number) => void;
  onDrop: (target: Target) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  status: ReactNode;
  toast: { id: number; text: string } | null;
}

export function Board(props: BoardProps) {
  const { sets, interactive, selected, fresh, ownPlayed } = props;
  const [hover, setHover] = useState<Target | null>(null);
  const hasSelection = selected.size > 0;

  const dropHandlers = (target: Target) => ({
    onDragOver: (e: DragEvent) => {
      if (!props.canDrop(target)) return;
      e.preventDefault();
      setHover(target);
    },
    onDragLeave: () => setHover((h) => (h === target ? null : h)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setHover(null);
      props.onDrop(target);
    },
  });

  return (
    <section className="tl-board" data-testid="tl-board">
      <div className="tl-status">{props.status}</div>
      <div className="tl-sets">
        {sets.length === 0 && !interactive && <p className="tl-empty">아직 판이 비어 있어요.</p>}
        {sets.map((set) => {
          const a = analyzeSet(set.tiles);
          const droppable = interactive && hasSelection && props.canDrop(set.id);
          const cls = [
            'tl-set',
            a.valid ? 'tl-set-ok' : 'tl-set-bad',
            droppable ? 'tl-set-droppable' : '',
            hover === set.id ? 'tl-set-hover' : '',
            set.tiles.some((t) => fresh.has(t.id)) ? 'tl-set-fresh' : '',
          ].join(' ');
          return (
            <div
              key={set.id}
              className={cls}
              onClick={() => droppable && props.onDrop(set.id)}
              {...dropHandlers(set.id)}
              title={a.valid ? undefined : a.reason}
              data-testid={`tl-set-${set.id}`}
            >
              {a.arranged.map((t, i) => {
                const pickable = interactive && props.canPick(t.id);
                const tileCls = [
                  'tl-tile-btn',
                  selected.has(t.id) ? 'tl-selected' : '',
                  fresh.has(t.id) ? 'tl-fresh' : '',
                  ownPlayed.has(t.id) ? 'tl-own' : '',
                  pickable ? 'tl-pickable' : '',
                ].join(' ');
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={tileCls}
                    disabled={!pickable}
                    draggable={pickable}
                    onDragStart={() => props.onDragStart(t.id)}
                    onDragEnd={props.onDragEnd}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onTile(t.id);
                    }}
                    data-testid={`tl-tile-${t.id}`}
                  >
                    <TileFace tile={t} jokerValue={t.joker && a.valid ? a.values[i] : undefined} />
                  </button>
                );
              })}
              {!a.valid && (
                <span className="tl-set-badge" aria-label={a.reason}>
                  ✕
                </span>
              )}
              {droppable && (
                <button
                  type="button"
                  className="tl-set-slot"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDrop(set.id);
                  }}
                  aria-label="여기에 붙이기"
                  title="여기에 붙이기"
                  data-testid={`tl-slot-${set.id}`}
                >
                  ＋
                </button>
              )}
            </div>
          );
        })}
        {interactive && (
          <button
            type="button"
            className={`tl-newset${hasSelection && props.canDrop('new') ? ' tl-newset-ready' : ''}${hover === 'new' ? ' tl-set-hover' : ''}`}
            disabled={!hasSelection || !props.canDrop('new')}
            onClick={() => props.onDrop('new')}
            {...dropHandlers('new')}
            data-testid="tl-newset"
          >
            ＋ 새 줄 만들기 <kbd>N</kbd>
          </button>
        )}
      </div>
      {props.toast && (
        <div key={props.toast.id} className="tl-toast">
          {props.toast.text}
        </div>
      )}
    </section>
  );
}
