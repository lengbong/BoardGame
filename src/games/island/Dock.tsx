import type { ReactNode } from 'react';
import { ShapeIcon } from '../../components/shapes';
import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { BuildIcon, ResourceIcon, SEAT_SHAPES } from './Art';
import { BUILD_INFO, BUILD_KINDS, COSTS, HAND_LIMIT, RESOURCES, RES_INFO, bankRate, buildBlocker, playerName, previewChoice, totalRes } from './rules';
import type { BuildKind, IslandState, Resource, ResourceCount } from './types';

export type DockTab = 'build' | 'trade';

interface DockProps {
  state: IslandState;
  /** 아래 칸에 자원을 보여 줄 사람 */
  viewer: number;
  /** 보여 줄 자원 수 (날아오는 중인 자원은 아직 빼고) */
  shownRes: ResourceCount;
  /** 지금 사람이 행동할 수 있다 */
  canAct: boolean;
  tab: DockTab;
  onTab: (tab: DockTab) => void;
  placing: BuildKind | null;
  onChooseBuild: (kind: BuildKind) => void;
  give: Resource | null;
  onGive: (r: Resource | null) => void;
  onBank: (get: Resource) => void;
  onMarket: (slot: number) => void;
  discardSel: ResourceCount;
  onDiscardSel: (sel: ResourceCount) => void;
  onDiscard: () => void;
  onRoll: () => void;
  onEndTurn: () => void;
  /** 골라 쓰는 주사위: die번째 눈 쓰기 */
  onChoose: (die: 0 | 1) => void;
  /** 고르기 전에 마우스를 올린 눈 (판에 미리 보기) */
  onPreview: (die: 0 | 1 | null) => void;
  reg: (key: string) => (el: HTMLElement | null) => void;
  helper: boolean;
}

const KIND_POINTS: Record<BuildKind, string> = { road: '이어 가기', house: '+1점', hall: '+1점 · 2개씩', lighthouse: '+2점 · 2:1' };

export function Dock(props: DockProps) {
  const { state, viewer, shownRes, canAct, tab, onTab, reg } = props;
  const player = state.players[viewer];
  const color = SEAT_COLORS[player.seat];
  const total = totalRes(shownRes);
  const isMine = viewer === state.current;
  const phase = state.phase;

  let body: ReactNode;
  let action: ReactNode = null;
  if (phase === 'setup') {
    const second = state.setupStep >= state.players.length;
    body = (
      <div className="is-dock-note">
        {isMine && canAct ? (
          state.setupHouse === null ? (
            <>
              <strong>{second ? '두 번째 집 놓기' : '첫 집 놓기'} (무료)</strong>
              <span>반짝이는 모서리를 눌러 집을 놓아요. 숫자가 다른 땅 3칸에 닿으면 자원이 잘 나와요.{second && ' 이 집에 닿은 땅마다 자원을 하나씩 받아요!'}</span>
            </>
          ) : (
            <>
              <strong>길 놓기 (무료)</strong>
              <span>방금 놓은 집에 붙은 변 중 하나를 골라 길을 놓아요. 다음 집을 지을 쪽으로!</span>
            </>
          )
        ) : (
          <>
            <strong>처음 집 놓는 중</strong>
            <span>
              {playerName(state.players[state.current])} 차례예요. 순서대로 집 1채와 길 1개를 놓고, 마지막 사람부터 거꾸로 한 번 더 놓아요.
            </span>
          </>
        )}
      </div>
    );
  } else if (phase === 'discard' && isMine) {
    body = <DiscardPanel {...props} />;
    action = (
      <button
        type="button"
        className="btn btn-primary is-main-btn"
        disabled={!canAct || totalRes(props.discardSel) !== state.discardNeed}
        onClick={props.onDiscard}
        data-testid="is-discard"
      >
        <span>🧺 내려놓기</span>
        <kbd>Enter</kbd>
      </button>
    );
  } else if (phase === 'choose') {
    body = <ChoosePanel {...props} />;
  } else if (phase === 'gameover') {
    body = <div className="is-dock-note">게임이 끝났어요!</div>;
  } else {
    const disabled = !canAct || phase !== 'main';
    body = (
      <div className="is-tabs-wrap">
        <div className="is-tabs" role="tablist" aria-label="할 일">
          <button type="button" role="tab" aria-selected={tab === 'build'} className={`is-tab${tab === 'build' ? ' is-tab-on' : ''}`} onClick={() => onTab('build')} data-testid="is-tab-build">
            🔨 짓기 <kbd>B</kbd>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'trade'} className={`is-tab${tab === 'trade' ? ' is-tab-on' : ''}`} onClick={() => onTab('trade')} data-testid="is-tab-trade">
            🔄 바꾸기 <kbd>T</kbd>
          </button>
          {!isMine ? (
            <span className="is-tabs-note">{playerName(state.players[state.current])} 차례예요</span>
          ) : (
            phase === 'roll' && <span className="is-tabs-note">먼저 주사위를 굴려요</span>
          )}
        </div>
        {tab === 'build' ? <BuildMenu {...props} disabled={disabled} /> : <TradeMenu {...props} disabled={disabled} />}
      </div>
    );
    if (phase === 'roll') {
      action = (
        <button type="button" className="btn btn-primary is-main-btn" disabled={!canAct} onClick={props.onRoll} data-testid="is-roll">
          <span>🎲 굴리기</span>
          <kbd>Space</kbd>
        </button>
      );
    } else if (phase === 'main') {
      action = (
        <button type="button" className="btn btn-primary is-main-btn" disabled={!canAct} onClick={props.onEndTurn} data-testid="is-end">
          <span>✅ 차례 마치기</span>
          <kbd>Enter</kbd>
        </button>
      );
    }
  }

  return (
    <section className="is-dock" aria-label="내 자원과 할 일">
      <div className="is-hand">
        <div className="is-hand-title">
          <ShapeIcon shape={SEAT_SHAPES[player.seat]} color={color.main} size={14} />
          <span className="is-hand-name">
            <strong>{playerName(player)}</strong>의 자원
          </span>
          <span className={`is-hand-total${total > HAND_LIMIT && isMine ? ' is-over' : ''}`} title={`내 차례를 마칠 때 ${HAND_LIMIT}개까지 들 수 있어요`}>
            {total}/{HAND_LIMIT}
          </span>
        </div>
        <div className="is-hand-tiles">
          {RESOURCES.map((r) => (
            <div key={r} className={`is-res-tile${shownRes[r] === 0 ? ' is-res-zero' : ''}`} ref={reg(`hand-${r}`)} aria-label={`${RES_INFO[r].name} ${shownRes[r]}개`} data-testid={`is-hand-${r}`}>
              <ResourceIcon res={r} size={28} />
              <span>
                <b>{shownRes[r]}</b>
                <small>{RES_INFO[r].name}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="is-dock-body">{body}</div>
      {action && <div className="is-dock-action">{action}</div>}
    </section>
  );
}

function CostRow({ have, kind }: { have: ResourceCount; kind: BuildKind }) {
  const cost = COSTS[kind];
  return (
    <span className="is-cost">
      {RESOURCES.filter((r) => cost[r] > 0).map((r) => {
        const ok = have[r] >= cost[r];
        return (
          <span key={r} className={`is-cost-item${ok ? ' is-ok' : ' is-no'}`} title={`${RES_INFO[r].name} ${cost[r]}개 (${have[r]}개 있음)`}>
            <ResourceIcon res={r} size={17} />
            {cost[r] > 1 && <small>{cost[r]}</small>}
            <i aria-hidden="true">{ok ? '✓' : '✗'}</i>
          </span>
        );
      })}
    </span>
  );
}

function BuildMenu({ state, viewer, placing, onChooseBuild, disabled, helper }: DockProps & { disabled: boolean }) {
  const player = state.players[viewer];
  const color = SEAT_COLORS[player.seat];
  const shape = SEAT_SHAPES[player.seat];
  return (
    <div className="is-build-menu" role="group" aria-label="짓기">
      {BUILD_KINDS.map((kind, i) => {
        const blocker = disabled ? null : buildBlocker(state, viewer, kind);
        const can = !disabled && blocker === null;
        const on = placing === kind;
        const why = disabled ? '' : blocker ?? (on ? '자리를 골라요' : '지을 수 있어요!');
        return (
          <button
            key={kind}
            type="button"
            className={`is-build-card${on ? ' is-on' : ''}${can ? ' is-can' : ''}${can && helper && !placing ? ' is-pulse' : ''}`}
            aria-pressed={on}
            aria-disabled={!can}
            disabled={disabled}
            onClick={() => onChooseBuild(kind)}
            data-testid={`is-build-${kind}`}
            title={blocker ?? `${BUILD_INFO[kind].name} 짓기 (${i + 1})`}
          >
            <span className="is-build-head">
              <BuildIcon kind={kind} color={color.main} dark={color.dark} shape={shape} size={30} />
              <span>
                <b>{BUILD_INFO[kind].name}</b>
                <small>{KIND_POINTS[kind]}</small>
              </span>
              <kbd>{i + 1}</kbd>
            </span>
            <CostRow have={player.res} kind={kind} />
            <span className={`is-build-why${can ? ' is-ok' : ''}`}>{why}</span>
          </button>
        );
      })}
    </div>
  );
}

function TradeMenu({ state, viewer, give, onGive, onBank, onMarket, disabled }: DockProps & { disabled: boolean }) {
  const have = state.players[viewer].res;
  const rate = bankRate(state, viewer);
  const marketOn = state.options.market;
  const marketOpen = marketOn && !state.marketUsed;
  return (
    <div className="is-trade-menu">
      <div className="is-trade-col">
        <span className="is-trade-cap">① 줄 것</span>
        <div className="is-give-grid">
          {RESOURCES.map((r) => (
            <button
              key={r}
              type="button"
              className={`is-res-btn${give === r ? ' is-on' : ''}`}
              disabled={disabled || have[r] === 0}
              aria-pressed={give === r}
              onClick={() => onGive(give === r ? null : r)}
              aria-label={`${RES_INFO[r].name} 주기 (${have[r]}개 있음)`}
              data-testid={`is-give-${r}`}
            >
              <ResourceIcon res={r} size={20} />
              <small>{have[r]}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="is-trade-col">
        <span className="is-trade-cap">
          🏦 은행 <b>{rate}:1</b> {rate === 2 && <em>등대 덕분!</em>}
        </span>
        <div className="is-get-row">
          {RESOURCES.map((r) => {
            const ok = !disabled && !!give && give !== r && have[give] >= rate;
            return (
              <button key={r} type="button" className="is-res-btn" disabled={!ok} onClick={() => onBank(r)} aria-label={`은행에서 ${RES_INFO[r].name} 받기`} data-testid={`is-bank-${r}`}>
                <ResourceIcon res={r} size={20} />
              </button>
            );
          })}
        </div>
        <small className="is-trade-help">
          {!give ? '줄 것을 먼저 골라요' : have[give] < rate ? `${RES_INFO[give].emoji} ${rate}개가 있어야 해요` : `${RES_INFO[give].emoji}${rate} → 받을 것을 눌러요`}
        </small>
      </div>
      <div className="is-trade-col">
        <span className="is-trade-cap">🧺 장터 <b>1:1</b> {marketOn && <em>{marketOpen ? '차례마다 한 번' : '이번 차례엔 썼어요'}</em>}</span>
        {marketOn ? (
          <>
            <div className="is-get-row">
              {state.market.map((r, slot) => {
                const ok = !disabled && marketOpen && !!give && give !== r && have[give] >= 1;
                return (
                  <button
                    key={slot}
                    type="button"
                    className="is-res-btn is-market-btn"
                    disabled={!ok}
                    onClick={() => onMarket(slot)}
                    aria-label={`장터의 ${RES_INFO[r].name}와 바꾸기`}
                    data-testid={`is-market-${slot}`}
                  >
                    <ResourceIcon res={r} size={20} />
                  </button>
                );
              })}
            </div>
            <small className="is-trade-help">{give && marketOpen ? `${RES_INFO[give].emoji} 1개 ↔ 장터 1개` : '내가 준 자원은 장터에 남아요'}</small>
          </>
        ) : (
          <small className="is-trade-help">장터를 끈 게임이에요.</small>
        )}
      </div>
    </div>
  );
}

function DiscardPanel({ state, viewer, discardSel, onDiscardSel, canAct }: DockProps) {
  const have = state.players[viewer].res;
  const need = state.discardNeed;
  const chosen = totalRes(discardSel);
  const set = (r: Resource, d: number) => {
    const v = Math.max(0, Math.min(have[r], discardSel[r] + d));
    if (d > 0 && chosen >= need) return;
    onDiscardSel({ ...discardSel, [r]: v });
  };
  return (
    <div className="is-discard">
      <p>
        <strong>자원이 {totalRes(have)}개라서 {need}개를 내려놓아요.</strong> <span>({chosen}/{need} 골랐어요)</span>
      </p>
      <div className="is-discard-row">
        {RESOURCES.map((r) => (
          <div key={r} className="is-discard-item">
            <ResourceIcon res={r} size={24} />
            <button type="button" className="btn btn-small" disabled={!canAct || discardSel[r] === 0} onClick={() => set(r, -1)} aria-label={`${RES_INFO[r].name} 하나 덜`}>
              −
            </button>
            <b>{discardSel[r]}</b>
            <button
              type="button"
              className="btn btn-small"
              disabled={!canAct || discardSel[r] >= have[r] || chosen >= need}
              onClick={() => set(r, 1)}
              aria-label={`${RES_INFO[r].name} 하나 더`}
              data-testid={`is-discard-${r}`}
            >
              +
            </button>
            <small>/{have[r]}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

/** 작은 주사위 그림 (고르기 칸) */
export function DieFace({ value, size = 30 }: { value: number; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="is-die-face">
      <rect x={5} y={5} width={90} height={90} rx={20} fill="#fffdf6" stroke="#8a6a3a" strokeWidth={5} />
      {PIPS[value]?.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill="#3a2f26" />)}
    </svg>
  );
}

/** 골라 쓰는 주사위: 두 눈 중 하나를 고르고, 누가 무엇을 받는지 미리 본다 */
function ChoosePanel({ state, viewer, canAct, onChoose, onPreview }: DockProps) {
  const dice = state.dice ?? [1, 1];
  const roller = state.players[state.current];
  const mine = state.current === viewer;
  return (
    <div className="is-choose">
      <p className="is-choose-q">
        <strong>{mine ? '어느 눈을 쓸까요?' : `${withJosa(playerName(roller), '이/가')} 쓸 눈을 고르고 있어요`}</strong>
        <span>고른 숫자의 땅만 자원을 내요. 모두가 받아요!</span>
      </p>
      <div className="is-choose-row">
        {([0, 1] as const).map((die) => {
          const per = previewChoice(state, die);
          const rows = per.map((r, i) => ({ i, r })).filter((x) => totalRes(x.r) > 0);
          const myGain = totalRes(per[viewer]);
          return (
            <button
              key={die}
              type="button"
              className="is-choose-opt"
              disabled={!canAct || !mine}
              onClick={() => onChoose(die)}
              onMouseEnter={() => onPreview(die)}
              onMouseLeave={() => onPreview(null)}
              onFocus={() => onPreview(die)}
              onBlur={() => onPreview(null)}
              aria-label={`${dice[die]} 쓰기: ${rows.length === 0 ? '아무도 못 받아요' : rows.map(({ i, r }) => `${playerName(state.players[i])} ${RESOURCES.filter((k) => r[k] > 0).map((k) => `${RES_INFO[k].name} ${r[k]}`).join(' ')}`).join(', ')}`}
              data-testid={`is-choose-${die}`}
            >
              <span className="is-choose-head">
                <DieFace value={dice[die]} />
                <b>{dice[die]}</b>
                <small>{myGain > 0 ? `나 +${myGain}` : '나는 0'}</small>
                {mine && <kbd>{die + 1}</kbd>}
              </span>
              <span className="is-choose-gains">
                {rows.length === 0 ? (
                  <em>아무도 못 받아요</em>
                ) : (
                  rows.map(({ i, r }) => {
                    const c = SEAT_COLORS[state.players[i].seat];
                    return (
                      <span key={i} className={`is-gain-chip${i === viewer ? ' is-mine' : ''}`} style={i === viewer ? { borderColor: c.main } : undefined}>
                        <ShapeIcon shape={SEAT_SHAPES[state.players[i].seat]} color={c.main} size={11} />
                        {playerName(state.players[i])}
                        {RESOURCES.filter((k) => r[k] > 0).map((k) => (
                          <span key={k} className="is-gain-res">
                            <ResourceIcon res={k} size={14} />
                            {r[k]}
                          </span>
                        ))}
                      </span>
                    );
                  })
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
