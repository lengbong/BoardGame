import { Dice3D } from '../../components/Dice3D';
import { withJosa } from '../../lib/korean';
import { SEAT_COLORS } from '../common/players';
import { CityArt } from './art/cities';
import { BuildingIcon, CardArt, GlobeLogo, Pawn } from './art/tiles';
import { LEVEL_NAMES, REGION_INFO, SQUARES, rentFor } from './board';
import { CARDS } from './cards';
import { buildOptions, buyOptions, playerName } from './rules';
import type { WorldAction, WorldState } from './types';

interface CenterPanelProps {
  state: WorldState;
  dice: [number, number] | null;
  rollId: number;
  diceDuration: number;
  /** 사람이 지금 조작할 수 있는지 (애니메이션·컴퓨터 차례가 아님) */
  interactive: boolean;
  banner: { id: number; playerIndex: number } | null;
  onAction: (action: WorldAction) => void;
}

function coins(n: number): string {
  return n.toLocaleString('ko-KR');
}

const BUY_LABELS = ['땅만', '집까지', '빌딩까지', '호텔까지'];

function OptionButton({
  level,
  label,
  cost,
  disabled,
  color,
  dark,
  onClick,
  testId,
}: {
  level: number;
  label: string;
  cost: number;
  disabled: boolean;
  color: string;
  dark: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button type="button" className="opt-btn" disabled={disabled} onClick={onClick} data-testid={testId}>
      <BuildingIcon level={level} color={color} dark={dark} className="opt-icon" />
      <span className="opt-label">{label}</span>
      <span className="opt-cost">
        <span className="coin" />
        {coins(cost)}
      </span>
    </button>
  );
}

function DealPanel({ state, canAct, onAction }: { state: WorldState; canAct: boolean; onAction: (a: WorldAction) => void }) {
  const player = state.players[state.current];
  const c = SEAT_COLORS[player.seat];
  const sq = SQUARES[player.position];
  const prop = state.properties[sq.index]!;
  const region = REGION_INFO[sq.region!];
  const buying = state.phase === 'buy';
  const options = buying ? buyOptions(state) : buildOptions(state);
  const festival = state.festivalSquare === sq.index;

  return (
    <div className="deal pop-in" key={`${sq.index}-${state.phase}`}>
      <div className="deal-head" style={{ background: region.color }}>
        <strong>{sq.name}</strong>
        <span>{sq.country}</span>
        <span className="deal-head-tag">{buying ? `땅값 ${coins(sq.price!)}` : '내 도시'}</span>
      </div>
      <div className="deal-body">
        <CityArt id={sq.cityId!} className="deal-art" />
        <table className="rent-table">
          <tbody>
            {[0, 1, 2, 3].map((lv) => (
              <tr key={lv} className={!buying && prop.level === lv ? 'current' : ''}>
                <td>
                  <BuildingIcon level={lv} color={c.main} dark={c.dark} className="rent-icon" />
                  {LEVEL_NAMES[lv]}
                </td>
                <td className="num">통행료 {coins(rentFor(sq, lv, festival))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canAct ? (
        <div className="deal-actions">
          {options.map((o) => (
            <OptionButton
              key={o.levels}
              level={o.levels}
              label={buying ? BUY_LABELS[o.levels] : `${LEVEL_NAMES[o.levels]}까지`}
              cost={o.cost}
              disabled={!o.affordable}
              color={c.main}
              dark={c.dark}
              onClick={() => onAction({ type: buying ? 'buy' : 'build', levels: o.levels })}
              testId={`option-${o.levels}`}
            />
          ))}
          <button type="button" className="opt-btn opt-pass" onClick={() => onAction({ type: 'decline' })} data-testid="decline">
            <span className="opt-label">{buying ? '안 살래요' : '안 지을래요'}</span>
          </button>
        </div>
      ) : (
        <p className="cp-thinking">{withJosa(playerName(player), '이/가')} 고르는 중…</p>
      )}
    </div>
  );
}

function TravelCard({ state, canAct, onAction }: { state: WorldState; canAct: boolean; onAction: (a: WorldAction) => void }) {
  const card = CARDS[state.pendingCard!];
  return (
    <div className="tcard-wrap">
      <div className="tcard" key={`${state.nextLogId}`}>
        <div className="tcard-face tcard-back">
          <CardArt className="tcard-back-art" />
          <span>여행 카드</span>
        </div>
        <div className="tcard-face tcard-front">
          <span className="tcard-emoji">{card.emoji}</span>
          <strong>{card.title}</strong>
          <p>{card.text}</p>
        </div>
      </div>
      {canAct ? (
        <button type="button" className="btn btn-primary btn-big" onClick={() => onAction({ type: 'card' })} data-testid="card-ok">
          확인 <small>Enter</small>
        </button>
      ) : (
        <p className="cp-thinking">카드를 읽는 중…</p>
      )}
    </div>
  );
}

export function CenterPanel({ state, dice, rollId, diceDuration, interactive, banner, onAction }: CenterPanelProps) {
  const player = state.players[state.current];
  const c = SEAT_COLORS[player.seat];
  const isHuman = player.kind === 'human';
  const canAct = interactive && isHuman;
  const recent = state.log.slice(-3).reverse();
  const roundText =
    state.options.endMode === 'rounds' ? `${state.round} / ${state.options.maxRounds} 라운드` : `${state.round} 라운드`;

  let action: React.ReactNode = null;
  if (state.phase === 'buy' || state.phase === 'build') {
    action = <DealPanel state={state} canAct={canAct} onAction={onAction} />;
  } else if (state.phase === 'card' && state.pendingCard) {
    action = <TravelCard state={state} canAct={canAct} onAction={onAction} />;
  } else if (state.phase === 'select-festival' || state.phase === 'select-plane') {
    action = (
      <div className="select-prompt pop-in" key={state.phase}>
        <span className="select-emoji">{state.phase === 'select-festival' ? '🎉' : '✈️'}</span>
        <div>
          <strong>{state.phase === 'select-festival' ? '축제를 열 내 도시를 고르세요' : '날아갈 칸을 고르세요'}</strong>
          <span>
            {!isHuman
              ? '컴퓨터가 고르는 중…'
              : state.phase === 'select-festival'
                ? '반짝이는 내 도시를 클릭하면 통행료가 2배가 돼요.'
                : '판에서 아무 칸이나 클릭하세요. 출발 칸을 지나면 월급!'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="cp">
      <svg className="cp-deco" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M8 78 Q30 30 62 40 T94 18" />
        <path d="M6 30 Q40 52 70 70 T96 86" />
      </svg>

      <header className="cp-header">
        <GlobeLogo className="cp-globe" />
        <div className="cp-title-wrap">
          <h2 className="cp-title">지구 한 바퀴</h2>
          <span className="cp-sub">AROUND THE WORLD</span>
        </div>
        <span className="cp-round">{roundText}</span>
      </header>

      {state.phase !== 'gameover' && (
        <div className="cp-turn" style={{ '--pc': c.main, '--pc-light': c.light } as React.CSSProperties}>
          <Pawn color={c.main} dark={c.dark} className="cp-turn-pawn" />
          <strong data-testid="world-turn">{playerName(player)}</strong>
          <span>차례</span>
          {!isHuman && <span className="tag">컴퓨터</span>}
          {player.stuckTurns > 0 && <span className="tag">🛂 여권 분실 ({player.stuckTurns})</span>}
        </div>
      )}

      <div className="cp-tray">
        <Dice3D value={dice?.[0] ?? null} rollId={rollId} duration={diceDuration} accent={c.main} />
        <Dice3D value={dice?.[1] ?? null} rollId={rollId} duration={diceDuration} accent={c.main} />
        {state.phase === 'rolling' && (
          <button type="button" className="btn-roll-big" disabled={!canAct} onClick={() => onAction({ type: 'roll' })} data-testid="world-roll">
            <span>🎲 주사위 굴리기</span>
            <small>{canAct ? 'Space' : isHuman ? '이동 중…' : '컴퓨터 차례'}</small>
          </button>
        )}
      </div>

      <div className="cp-action">{action}</div>

      <ol className="cp-ticker">
        {recent.map((e) => (
          <li key={e.id}>
            {e.seat !== null && <span className="dot small" style={{ background: SEAT_COLORS[e.seat].main }} />}
            {e.text}
          </li>
        ))}
      </ol>

      {banner && (
        <div className="turn-banner" key={banner.id} style={{ '--pc': SEAT_COLORS[state.players[banner.playerIndex].seat].main } as React.CSSProperties}>
          <Pawn
            color={SEAT_COLORS[state.players[banner.playerIndex].seat].main}
            dark={SEAT_COLORS[state.players[banner.playerIndex].seat].dark}
            className="turn-banner-pawn"
          />
          <span>{playerName(state.players[banner.playerIndex])} 차례!</span>
        </div>
      )}
    </div>
  );
}
