import type { CSSProperties } from 'react';
import { ShapeIcon } from '../../components/shapes';
import { SEAT_COLORS } from '../common/players';
import type { FlagChoice } from './rules';
import { playerName } from './rules';
import { SEAT_SHAPES, TileIcon } from './TileArt';
import { FEATURE_NAMES, TILES } from './tiles';
import type { Rot, VillageState } from './types';

interface DockProps {
  state: VillageState;
  /** 사람이 지금 할 수 있는지 (연출 중이 아니고 사람 차례) */
  canAct: boolean;
  sel: number;
  rot: Rot;
  /** 손 조각마다 놓을 수 있는 자리 수 */
  spotCounts: number[];
  pending: boolean;
  canConfirm: boolean;
  stuck: boolean;
  flagChoices: FlagChoice[] | null;
  flagSel: number | null;
  notice: string | null;
  onSelect: (i: number) => void;
  onRotate: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDiscard: (i: number) => void;
  onFlagHover: (seg: number | null) => void;
  onFlag: (seg: number) => void;
  onSkip: () => void;
  onShowResult: () => void;
}

/** 지도 아래 막대: 손에 든 조각, 돌리기·놓기, 깃발 고르기 */
export function Dock(props: DockProps) {
  const { state, canAct } = props;
  const cur = state.players[state.current];
  const color = SEAT_COLORS[cur.seat];
  const over = state.phase === 'gameover';
  const style = { '--seat': color.main, '--seat-light': color.light, '--seat-dark': color.dark } as CSSProperties;

  if (over) {
    return (
      <section className="vl-dock vl-dock-over" aria-label="게임 끝">
        <p className="vl-dock-msg">🗺️ 지도가 완성됐어요! 미완성 지형은 절반 점수를 받았어요.</p>
        <button type="button" className="btn btn-primary" onClick={props.onShowResult} data-testid="vl-show-result">
          결과 보기
        </button>
      </section>
    );
  }

  const flagging = state.phase === 'flag';
  const human = cur.kind === 'human';
  const placedTile = state.placed !== null ? state.board[state.placed] : null;

  return (
    <section className={`vl-dock${canAct ? ' vl-dock-active' : ''}`} style={style} aria-label={`${playerName(cur)}의 손 조각`} data-testid="vl-dock">
      <div className="vl-dock-who">
        <ShapeIcon shape={SEAT_SHAPES[cur.seat]} color={color.main} size={18} />
        <span>
          <b>{playerName(cur)}</b>
          <small>{flagging ? '깃발' : human ? '내 손 조각' : '컴퓨터 손 조각'}</small>
        </span>
      </div>

      {flagging && placedTile ? (
        <>
          <div className="vl-dock-hand">
            <div className="vl-hand-tile vl-hand-placed">
              <TileIcon t={placedTile.t} r={placedTile.r} size={70} title={`방금 놓은 ${TILES[placedTile.t].name}`} />
            </div>
          </div>
          <div className="vl-dock-actions">
            <p className="vl-dock-msg">
              🚩 깃발을 꽂을까요? <span className="vl-dock-flags">남은 깃발 {cur.flags}개</span>
            </p>
            {human && props.flagChoices && (
              <div className="vl-flag-choices" role="group" aria-label="깃발 꽂을 곳">
                {props.flagChoices.map((c) => (
                  <button
                    key={c.seg}
                    type="button"
                    className={`btn vl-flag-btn${props.flagSel === c.seg ? ' btn-selected' : ''}`}
                    disabled={!canAct || !c.ok}
                    title={c.reason ?? undefined}
                    onClick={() => props.onFlag(c.seg)}
                    onPointerEnter={() => props.onFlagHover(c.seg)}
                    onPointerLeave={() => props.onFlagHover(null)}
                    onFocus={() => props.onFlagHover(c.seg)}
                    data-testid={`vl-flag-${c.seg}`}
                  >
                    <span className={`vl-kind-dot vl-kind-${c.kind}`} aria-hidden="true" />
                    {FEATURE_NAMES[c.kind]} {c.feature.tiles}칸
                    <small>{c.ok ? (c.feature.complete ? `완성! +${c.feature.points}` : `지금 ${c.feature.points}점짜리`) : c.reason}</small>
                    {c.ok && <kbd>{props.flagChoices!.filter((x) => x.ok).indexOf(c) + 1}</kbd>}
                  </button>
                ))}
                <button type="button" className="btn vl-skip-btn" disabled={!canAct} onClick={props.onSkip} data-testid="vl-skip">
                  건너뛰기 <kbd>Space</kbd>
                </button>
              </div>
            )}
            {!human && <p className="vl-dock-sub vl-thinking">어디에 꽂을지 생각 중…</p>}
            {props.notice && (
              <p className="vl-notice" role="status">
                {props.notice}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="vl-dock-hand" role={human ? 'radiogroup' : undefined} aria-label="손 조각">
            {cur.hand.map((t, i) => {
              const on = human && i === props.sel;
              const none = props.spotCounts[i] === 0;
              return (
                <div key={`${i}-${t}`} className={`vl-hand-slot${props.stuck ? ' vl-hand-stuck' : ''}`}>
                  <button
                    type="button"
                    className={`vl-hand-tile${on ? ' vl-hand-on' : ''}${none && human ? ' vl-hand-none' : ''}`}
                    disabled={!human}
                    onClick={() => props.onSelect(i)}
                    role={human ? 'radio' : undefined}
                    aria-checked={human ? on : undefined}
                    aria-label={`${i + 1}번 조각: ${TILES[t].name}${human ? (none ? ' (놓을 곳 없음)' : ` (놓을 곳 ${props.spotCounts[i]}곳)`) : ''}`}
                    data-testid={`vl-hand-${i}`}
                  >
                    <TileIcon t={t} r={on ? props.rot : 0} size={70} />
                    {human && <kbd className="vl-hand-key">{i + 1}</kbd>}
                    {human && none && <span className="vl-hand-badge">놓을 곳 없음</span>}
                  </button>
                  <span className="vl-hand-name">{TILES[t].name}</span>
                  {props.stuck && human && (
                    <button type="button" className="btn btn-small vl-discard" disabled={!canAct} onClick={() => props.onDiscard(i)} data-testid={`vl-discard-${i}`}>
                      버리기
                    </button>
                  )}
                </div>
              );
            })}
            {cur.hand.length === 0 && <p className="vl-dock-sub">손에 조각이 없어요.</p>}
          </div>
          <div className="vl-dock-actions">
            {human ? (
              props.stuck ? (
                <p className="vl-dock-msg vl-warn">😥 {cur.hand.length > 1 ? '두 조각 모두' : '이 조각은'} 놓을 곳이 없어요! 버릴 조각을 고르면 새로 한 장 뽑아요.</p>
              ) : (
                <>
                  <div className="vl-dock-buttons">
                    <button type="button" className="btn" onClick={props.onRotate} disabled={!canAct} data-testid="vl-rotate" title="오른쪽 클릭으로도 돌려요">
                      ⟳ 돌리기 <kbd>R</kbd>
                    </button>
                    <button type="button" className="btn btn-primary" onClick={props.onConfirm} disabled={!canAct || !props.canConfirm} data-testid="vl-place">
                      ✓ 여기에 놓기 <kbd>Enter</kbd>
                    </button>
                    {props.pending && (
                      <button type="button" className="btn" onClick={props.onCancel} disabled={!canAct}>
                        ✕ 다시 고르기 <kbd>Esc</kbd>
                      </button>
                    )}
                  </div>
                  <p className="vl-dock-sub">
                    {props.pending
                      ? '한 번 더 누르면 놓아요. 화살표로 다른 자리를 골라요.'
                      : props.spotCounts[props.sel] > 0
                        ? `반짝이는 자리 ${props.spotCounts[props.sel]}곳 중 하나를 눌러요. 끌어서 지도를 움직여요.`
                        : '이 조각은 놓을 곳이 없어요. 다른 조각을 골라요.'}
                  </p>
                </>
              )
            ) : (
              <p className="vl-dock-sub vl-thinking">어느 조각을 어디에 놓을지 생각 중…</p>
            )}
            {props.notice && (
              <p className="vl-notice" role="status" data-testid="vl-notice">
                {props.notice}
              </p>
            )}
          </div>
        </>
      )}
      <div className="vl-dock-stack" title="남은 조각 더미">
        <span className="vl-stack-pile" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>
          <b data-testid="vl-stack-count">{state.stack.length}</b>
          <small>남은 조각</small>
        </span>
      </div>
    </section>
  );
}
