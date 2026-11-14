import type { CSSProperties } from 'react';
import { SEAT_COLORS } from '../common/players';
import { BagIcon, HiveIcon, PlantPicture, Rosette, TokenIcon } from './Art';
import { GOALS, KINDS, KIND_EMOJI, KIND_LABEL, RES, RES_LABEL, TOKENS, card } from './cards';
import { PlantCardView } from './PlantCard';
import { GREENHOUSE_SIZE, MARKET_SIZE, SALE_SLOTS, STORAGE_LIMIT, gardenCards, lineCells, lineLabel, lineTokens, playerName, production, scoreOf, tokenTotal } from './rules';
import type { GardenState, LineId, Token } from './types';

export type Reg = (key: string) => (el: HTMLElement | null) => void;

/** 사람이 고른 것 */
export type Selection = { kind: 'card'; id: number } | { kind: 'line'; line: LineId } | null;

/** 사람이 볼 카드 정보: 심을 수 있는지, 내 값 */
export interface CardInfo {
  canBuy: boolean;
  price: number | null;
}

// ------------------------------------------------------------------ 꽃시장

interface MarketProps {
  state: GardenState;
  reg: Reg;
  /** 사람이 고를 수 있다 */
  active: boolean;
  info: (id: number) => CardInfo | null;
  selected: number | null;
  entering: ReadonlySet<number>;
  wiltGhost: { cardId: number; key: number } | null;
  onPick: (id: number) => void;
  onQuick: (id: number) => void;
}

export function Market({ state, reg, active, info, selected, entering, wiltGhost, onPick, onQuick }: MarketProps) {
  const offset = MARKET_SIZE - state.market.length;
  const top = state.deck[0];
  return (
    <section className="gd-stall" aria-label="꽃시장">
      <div className="gd-awning" aria-hidden="true" />
      <div className="gd-stall-head">
        <h2>🌼 꽃시장</h2>
        <span className="gd-stall-flow">
          새 식물이 왼쪽으로 들어와요 → 오른쪽 끝 두 장은 <b className="gd-sale-word">떨이</b> → 라운드가 끝나면 맨 끝 식물이 시들어요
        </span>
      </div>
      <div className="gd-stall-body">
        <div className="gd-deck" ref={reg('deck')} title={`식물 더미 ${state.deck.length}장`}>
          <div className={`gd-deck-pile${top !== undefined ? ` gd-season-${card(top).season}` : ' gd-deck-empty'}`}>
            <span className="gd-deck-season">{top !== undefined ? ['', '봄', '여름', '가을'][card(top).season] : '없음'}</span>
            <span className="gd-deck-count">{state.deck.length}장</span>
          </div>
          <span className="gd-deck-label">더미</span>
        </div>
        <div className="gd-market-row" role="list" aria-label="꽃시장 식물 (왼쪽이 새로 들어온 것)">
          {Array.from({ length: MARKET_SIZE }, (_, slot) => (
            <div key={`s${slot}`} className={`gd-slot${state.options.sale && slot >= MARKET_SIZE - SALE_SLOTS ? ' gd-slot-sale' : ''}`} style={{ '--slot': slot } as CSSProperties} aria-hidden="true">
            </div>
          ))}
          {state.market.map((id, i) => {
            const slot = offset + i;
            const ci = info(id);
            const sale = state.options.sale && i >= state.market.length - SALE_SLOTS;
            return (
              <div key={id} className={`gd-market-cell${entering.has(id) ? ' gd-entering' : ''}`} style={{ '--slot': slot } as CSSProperties} role="listitem">
                <PlantCardView
                  card={card(id)}
                  sale={sale}
                  canBuy={active && !!ci?.canBuy}
                  price={active ? (ci?.price ?? null) : null}
                  selected={selected === id}
                  interactive={active}
                  onClick={active ? () => onPick(id) : undefined}
                  onDoubleClick={active ? () => onQuick(id) : undefined}
                  innerRef={reg(`card-${id}`)}
                  testId={`gd-market-${slot}`}
                />
              </div>
            );
          })}
          {wiltGhost && (
            <div key={`w${wiltGhost.key}`} className="gd-market-cell gd-wilting" style={{ '--slot': MARKET_SIZE - 1 } as CSSProperties} aria-hidden="true">
              <PlantCardView card={card(wiltGhost.cardId)} />
            </div>
          )}
        </div>
        <div className="gd-compost" ref={reg('wilt')} title={`시든 식물 ${state.wilted.length}장`}>
          <span className="gd-compost-heap" aria-hidden="true">
            🥀
          </span>
          <span className="gd-deck-label">시든 식물 {state.wilted.length}</span>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 텃밭

interface FieldProps {
  state: GardenState;
  reg: Reg;
  active: boolean;
  /** 강조할 줄 (마우스·키보드) */
  focus: LineId | null;
  drops: ReadonlyMap<number, number>;
  onHover: (line: LineId | null) => void;
  onHarvest: (line: LineId) => void;
  onSelect: (line: LineId) => void;
}

const ROWS: LineId[] = ['r0', 'r1', 'r2'];
const COLS: LineId[] = ['c0', 'c1', 'c2'];

export function FieldBed({ state, reg, active, focus, drops, onHover, onHarvest, onSelect }: FieldProps) {
  const hot = new Set(focus ? lineCells(focus) : []);
  const handle = (line: LineId, dir: 'row' | 'col') => {
    const toks = lineTokens(state, line);
    const empty = toks.length === 0;
    const label = `${lineLabel(line)} 거두기: ${toks.map((t) => RES_LABEL[t]).join(', ') || '비어 있어요'}`;
    return (
      <button
        key={line}
        type="button"
        className={`gd-handle gd-handle-${dir}${focus === line ? ' gd-handle-on' : ''}${active && !empty ? ' gd-handle-live' : ''}`}
        disabled={!active || empty}
        onMouseEnter={() => onHover(line)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onSelect(line)}
        onClick={() => onHarvest(line)}
        aria-label={label}
        title={label}
        data-testid={`gd-line-${line}`}
      >
        <span aria-hidden="true">{dir === 'row' ? '▶' : '▼'}</span>
      </button>
    );
  };
  return (
    <section className="gd-field-box" aria-label="텃밭">
      <div className="gd-box-head">
        <h2>🧺 텃밭</h2>
        <span className="gd-supply" ref={reg('bag')} title={`주머니에 남은 토큰 ${tokenTotal(state.bag)}개`}>
          <BagIcon size={22} />
          {tokenTotal(state.bag)}
        </span>
        <span className="gd-supply" ref={reg('hive')} title={`벌통에 남은 꿀벌 ${state.hive}마리 (온실에 맡기면 1마리)`}>
          <HiveIcon size={22} />
          🐝{state.hive}
        </span>
      </div>
      <div className={`gd-field${active ? ' gd-field-live' : ''}`}>
        <span className="gd-field-corner" aria-hidden="true" />
        {COLS.map((c) => handle(c, 'col'))}
        {ROWS.map((r, ri) => (
          <div key={r} className="gd-field-row">
            {handle(r, 'row')}
            {[0, 1, 2].map((k) => {
              const i = ri * 3 + k;
              const t = state.field[i];
              const drop = drops.get(i);
              return (
                <div key={i} className={`gd-cell${hot.has(i) ? ' gd-cell-hot' : ''}`} ref={reg(`cell-${i}`)}>
                  {t && (
                    <span key={drop ?? 0} className={`gd-cell-token${drop !== undefined ? ' gd-drop' : ''}`} title={RES_LABEL[t]}>
                      <TokenIcon token={t} size={44} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 상장

export function RibbonBoard({ state, viewer, pulse }: { state: GardenState; viewer: number | null; pulse: string | null }) {
  if (state.ribbons.length === 0) {
    return (
      <section className="gd-ribbons" aria-label="박람회 상장">
        <div className="gd-box-head">
          <h2>🏵️ 박람회 상장</h2>
        </div>
        <p className="gd-muted">이번 판은 상장 없이 해요.</p>
      </section>
    );
  }
  return (
    <section className="gd-ribbons" aria-label="박람회 상장">
      <div className="gd-box-head">
        <h2>🏵️ 박람회 상장</h2>
        <span className="gd-muted">먼저 이루면 +3점</span>
      </div>
      <ul>
        {state.ribbons.map((r) => {
          const g = GOALS[r.goal];
          const owner = r.owner !== null ? state.players[r.owner] : null;
          const mine = viewer !== null ? g.progress(gardenCards(state.players[viewer])) : null;
          return (
            <li key={r.goal} className={`gd-ribbon${owner ? ' gd-ribbon-won' : ''}${pulse === r.goal ? ' gd-ribbon-pulse' : ''}`} data-testid={`gd-ribbon-${r.goal}`}>
              <Rosette goal={r.goal} ownerColor={owner ? SEAT_COLORS[owner.seat].main : undefined} size={46} dim={false} />
              <div className="gd-ribbon-text">
                <strong>{g.title}</strong>
                <span>{g.text}</span>
                {owner ? (
                  <em style={{ color: SEAT_COLORS[owner.seat].dark }}>🏅 {playerName(owner)}</em>
                ) : (
                  mine && (
                    <span className="gd-progress" aria-label={`내 진행 ${mine.have}/${mine.need}`}>
                      <span style={{ width: `${(mine.have / mine.need) * 100}%` }} />
                      <i>
                        {mine.have}/{mine.need}
                      </i>
                    </span>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ 정원 (자리마다)

export interface PlotFx {
  id: number;
  player: number;
  text: string;
  tone: 'harvest' | 'plant' | 'reserve' | 'points' | 'ribbon' | 'info';
  /** 몇 ms 뒤에 떠오를지 */
  delay: number;
  until: number;
}

interface PlotProps {
  state: GardenState;
  index: number;
  reg: Reg;
  isCurrent: boolean;
  thinking: boolean;
  /** 이 사람의 온실 카드를 지금 고를 수 있다 */
  active: boolean;
  info: (id: number) => CardInfo | null;
  selected: number | null;
  fx: PlotFx[];
  onPick: (id: number) => void;
  onQuick: (id: number) => void;
}

export function Plot({ state, index, reg, isCurrent, thinking, active, info, selected, fx, onPick, onQuick }: PlotProps) {
  const p = state.players[index];
  const color = SEAT_COLORS[p.seat];
  const prod = production(p);
  const cards = gardenCards(p);
  const total = tokenTotal(p.tokens);
  const ribbons = state.ribbons.filter((r) => r.owner === index);
  const score = scoreOf(state, index);
  const winner = state.phase === 'gameover' && state.winners.includes(index);
  return (
    <section
      className={`gd-plot${isCurrent ? ' gd-plot-current' : ''}${thinking ? ' gd-plot-thinking' : ''}${winner ? ' gd-plot-winner' : ''}`}
      style={{ '--sc': color.main, '--sc-dark': color.dark, '--sc-light': color.light } as CSSProperties}
      ref={reg(`plot-${index}`)}
      aria-label={`${playerName(p)}의 정원, ${score}점`}
      data-testid={`gd-plot-${index}`}
    >
      <header className="gd-plot-head">
        <span className="gd-avatar" aria-hidden="true">
          {playerName(p).slice(0, 1)}
        </span>
        <strong className="gd-plot-name">{playerName(p)}</strong>
        {p.kind !== 'human' && <span className="gd-plot-tag">{p.kind === 'ai-easy' ? '컴퓨터·쉬움' : '컴퓨터·보통'}</span>}
        {isCurrent && state.phase !== 'gameover' && <span className="gd-plot-turn">{thinking ? '생각 중…' : '차례'}</span>}
        <span className="gd-plot-ribbons" aria-label={`상장 ${ribbons.length}개`}>
          {ribbons.map((r) => (
            <span key={r.goal} title={GOALS[r.goal].title}>
              <Rosette goal={r.goal} size={22} />
            </span>
          ))}
        </span>
        <span className="gd-plot-score" title="꽃 점수" data-testid={`gd-score-${index}`}>
          🌼 <b>{score}</b>점
        </span>
      </header>

      <div className="gd-plot-body">
        <div className="gd-plot-col">
          <div className="gd-plot-row" ref={reg(`plot-${index}-tokens`)}>
            <span className={`gd-plot-label${total > STORAGE_LIMIT ? ' gd-over' : ''}`} title="바구니 (차례가 끝날 때 10개까지)">
              바구니 {total}/{STORAGE_LIMIT}
            </span>
            <span className="gd-token-list">
              {TOKENS.map((t: Token) => (
                <span key={t} className={`gd-tok${p.tokens[t] === 0 ? ' gd-tok-zero' : ''}`} title={`${RES_LABEL[t]} ${p.tokens[t]}개`}>
                  <TokenIcon token={t} size={20} />
                  <b key={p.tokens[t]}>{p.tokens[t]}</b>
                </span>
              ))}
            </span>
          </div>

          <div className="gd-plot-row">
            <span className="gd-plot-label" title="심은 식물이 만드는 자원: 식물을 살 때 그만큼 덜 내요">
              생산
            </span>
            <span className="gd-token-list">
              {RES.map((r) => (
                <span key={r} className={`gd-tok gd-prod${prod[r] === 0 ? ' gd-tok-zero' : ''}`} title={`${RES_LABEL[r]} 생산 ${prod[r]}`}>
                  <TokenIcon token={r} size={20} />
                  <b>{prod[r]}</b>
                </span>
              ))}
            </span>
          </div>
          <div className="gd-greenhouse" ref={reg(`plot-${index}-gh`)}>
            <span className="gd-plot-label" title="온실: 꽃시장에서 맡겨 둔 식물 (2칸, 모두에게 보여요)">
              🏡 온실
          <br />
          {p.greenhouse.length}/{GREENHOUSE_SIZE}
            </span>
            <div className="gd-gh-slots">
              {Array.from({ length: GREENHOUSE_SIZE }, (_, k) => {
                const id = p.greenhouse[k];
                if (id === undefined) return <span key={`e${k}`} className="gd-gh-empty" aria-hidden="true" />;
                const ci = info(id);
                return (
                  <PlantCardView
                    key={id}
                    card={card(id)}
                    size="mini"
                    canBuy={active && !!ci?.canBuy}
                    price={active ? (ci?.price ?? null) : null}
                    selected={selected === id}
                    interactive={active}
                    onClick={active ? () => onPick(id) : undefined}
                    onDoubleClick={active ? () => onQuick(id) : undefined}
                    innerRef={reg(`card-${id}`)}
                    testId={`gd-gh-${index}-${k}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="gd-plot-col gd-plot-col-bed">
          <div className="gd-bed" ref={reg(`plot-${index}-garden`)} aria-label={`심은 식물 ${cards.length}장`}>
            {KINDS.map((k) => {
              const list = cards.filter((c) => c.kind === k);
              return (
                <div key={k} className="gd-bed-group" title={`${KIND_LABEL[k]} ${list.length}장`}>
                  <span className="gd-bed-kind">
                    <span aria-hidden="true">{KIND_EMOJI[k]}</span>
                    <small>{list.length}</small>
                  </span>
                  <span className="gd-bed-plants">
                    {list.map((c) => (
                      <span key={c.id} className="gd-sprout" title={`${c.name} (${c.points}점, ${RES_LABEL[c.produce]} 생산)`}>
                        <PlantPicture art={c.art} />
                        <small className="gd-sprout-name">{c.name}</small>
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="gd-plot-fx" aria-hidden="true">
        {fx.map((f) => (
          <span key={f.id} className={`gd-fx gd-fx-${f.tone}`} style={{ animationDelay: `${f.delay}ms` }}>
            {f.text}
          </span>
        ))}
      </div>
    </section>
  );
}
