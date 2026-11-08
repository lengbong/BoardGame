import { Dice } from '../../components/Dice';
import { SEAT_COLORS } from '../common/players';
import { LEVEL_ICONS, LEVEL_NAMES, REGION_INFO, SQUARES, rentFor } from './board';
import { CARDS } from './cards';
import { CITY_IMAGES } from './cityImages';
import { buildOptions, buyOptions, playerName } from './rules';
import type { WorldAction, WorldState } from './types';

interface CenterPanelProps {
  state: WorldState;
  diceFaces: [number, number] | null;
  diceRolling: boolean;
  /** 사람이 지금 조작할 수 있는지 (애니메이션·컴퓨터 차례가 아님) */
  interactive: boolean;
  onAction: (action: WorldAction) => void;
}

function coins(n: number): string {
  return `${n.toLocaleString('ko-KR')}코인`;
}

const BUY_LABELS = ['땅만 사기', '집까지 짓기', '빌딩까지 짓기', '호텔까지 짓기'];

/** 도착한 도시 카드 (사기·짓기 단계에서 보여줌) */
function CityCard({ state, index }: { state: WorldState; index: number }) {
  const sq = SQUARES[index];
  const prop = state.properties[index]!;
  const festival = state.festivalSquare === index;
  return (
    <div className="city-card">
      <img src={CITY_IMAGES[sq.cityId!]} alt={sq.name} />
      <div className="city-card-body">
        <div className="city-card-title">
          <strong>{sq.name}</strong>
          <span className="region-chip" style={{ background: REGION_INFO[sq.region!].color }}>
            {sq.country}
          </span>
        </div>
        <table className="rent-table">
          <tbody>
            {[0, 1, 2, 3].map((lv) => (
              <tr key={lv} className={prop.owner !== null && prop.level === lv ? 'current' : ''}>
                <td>
                  {LEVEL_ICONS[lv] || '🚩'} {LEVEL_NAMES[lv]}
                </td>
                <td>통행료 {coins(rentFor(sq, lv, festival))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CenterPanel({ state, diceFaces, diceRolling, interactive, onAction }: CenterPanelProps) {
  const player = state.players[state.current];
  const color = SEAT_COLORS[player.seat];
  const isHuman = player.kind === 'human';
  const canAct = interactive && isHuman;
  const recent = state.log.slice(-3).reverse();
  const here = SQUARES[player.position];
  const roundText =
    state.options.endMode === 'rounds' ? `${state.round} / ${state.options.maxRounds} 라운드` : `${state.round} 라운드`;

  let action: React.ReactNode = null;
  if (state.phase === 'buy' || state.phase === 'build') {
    const options = state.phase === 'buy' ? buyOptions(state) : buildOptions(state);
    action = (
      <div className="action-box">
        <p className="action-title">
          {state.phase === 'buy'
            ? `${here.name}에 도착! 땅을 살까요? (땅값 ${coins(here.price!)})`
            : `내 도시 ${here.name}! 건물을 더 지을까요?`}
        </p>
        <CityCard state={state} index={here.index} />
        {canAct && (
          <div className="action-buttons">
            {options.map((o) => (
              <button
                key={o.levels}
                type="button"
                className="btn btn-primary"
                disabled={!o.affordable}
                onClick={() => onAction({ type: state.phase === 'buy' ? 'buy' : 'build', levels: o.levels })}
                data-testid={`option-${o.levels}`}
              >
                {state.phase === 'buy' ? BUY_LABELS[o.levels] : `${LEVEL_ICONS[o.levels]} ${LEVEL_NAMES[o.levels]}까지`}
                <small>{coins(o.cost)}</small>
              </button>
            ))}
            <button type="button" className="btn" onClick={() => onAction({ type: 'decline' })} data-testid="decline">
              {state.phase === 'buy' ? '안 살래요' : '안 지을래요'}
            </button>
          </div>
        )}
      </div>
    );
  } else if (state.phase === 'card' && state.pendingCard) {
    const card = CARDS[state.pendingCard];
    action = (
      <div className="action-box">
        <div className="travel-card">
          <span className="travel-card-emoji">{card.emoji}</span>
          <strong>{card.title}</strong>
          <p>{card.text}</p>
        </div>
        {canAct && (
          <button type="button" className="btn btn-primary btn-large" onClick={() => onAction({ type: 'card' })} data-testid="card-ok">
            확인 (Enter)
          </button>
        )}
      </div>
    );
  } else if (state.phase === 'select-festival' || state.phase === 'select-plane') {
    action = (
      <div className="action-box">
        <p className="action-title select-title">
          {state.phase === 'select-festival'
            ? '🎉 축제를 열 내 도시를 판에서 클릭하세요. (통행료 2배)'
            : '✈️ 날아갈 칸을 판에서 클릭하세요. (출발 칸을 지나면 월급)'}
        </p>
      </div>
    );
  }

  return (
    <div className="center-panel">
      <header className="cp-header">
        <h2>🌏 지구 한 바퀴</h2>
        <span className="cp-round">{roundText}</span>
      </header>

      {state.phase !== 'gameover' && (
        <div className="cp-turn" style={{ borderColor: color.main, background: color.light }}>
          <span className="dot" style={{ background: color.main }} />
          <strong data-testid="world-turn">{playerName(player)}</strong> 차례
          {!isHuman && <span className="tag">컴퓨터</span>}
          {player.stuckTurns > 0 && <span className="tag">🛂 여권 분실 ({player.stuckTurns})</span>}
        </div>
      )}

      <div className="cp-dice-row">
        <Dice value={diceFaces?.[0] ?? null} rolling={diceRolling} color={color.main} />
        <Dice value={diceFaces?.[1] ?? null} rolling={diceRolling} color={color.main} />
        {state.phase === 'rolling' && (
          <button
            type="button"
            className="btn btn-primary btn-roll"
            disabled={!canAct}
            onClick={() => onAction({ type: 'roll' })}
            data-testid="world-roll"
          >
            주사위 굴리기
            <small>Space</small>
          </button>
        )}
      </div>

      {action ?? (
        <p className="cp-hint">
          {state.phase === 'gameover'
            ? '게임이 끝났어요!'
            : !isHuman
              ? '컴퓨터가 생각 중이에요…'
              : !interactive
                ? '이동 중…'
                : '주사위를 굴리세요.'}
        </p>
      )}
      {!isHuman && state.phase !== 'gameover' && action && <p className="cp-hint">컴퓨터가 고르는 중…</p>}

      <ol className="cp-recent">
        {recent.map((e) => (
          <li key={e.id}>
            {e.seat !== null && <span className="dot small" style={{ background: SEAT_COLORS[e.seat].main }} />}
            {e.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
