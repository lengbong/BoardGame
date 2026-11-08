import { useEffect, type ReactNode } from 'react';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { CityArt } from './art/cities';
import { BuildingIcon, Pawn } from './art/tiles';
import { LEVEL_NAMES, REGION_INFO, SQUARES, buildCost, rentFor } from './board';
import { useAnimatedNumber } from './Effects';
import { ownedSquares, playerName, totalAssets } from './rules';
import type { WorldState } from './types';

function coins(n: number): string {
  return n.toLocaleString('ko-KR');
}

// ---------------------------------------------------------------- 플레이어 카드

function PlayerCard({ state, index, delta }: { state: WorldState; index: number; delta: { id: number; amount: number } | undefined }) {
  const p = state.players[index];
  const c = SEAT_COLORS[p.seat];
  const cash = useAnimatedNumber(p.cash);
  const assets = useAnimatedNumber(totalAssets(state, index));
  const owned = ownedSquares(state, index);
  const isCurrent = index === state.current && state.phase !== 'gameover';
  return (
    <li
      className={`pcard${isCurrent ? ' pcard-current' : ''}${p.bankrupt ? ' pcard-bankrupt' : ''}`}
      style={{ '--pc': c.main, '--pc-dark': c.dark, '--pc-light': c.light } as React.CSSProperties}
      data-testid={`world-player-${index}`}
    >
      <Pawn color={c.main} dark={c.dark} className="pcard-pawn" />
      <div className="pcard-main">
        <div className="pcard-top">
          <span className="pcard-name">{playerName(p)}</span>
          <span className="pcard-kind">{KIND_LABEL[p.kind]}</span>
          {isCurrent && <span className="pcard-turn">차례</span>}
        </div>
        <div className="pcard-money">
          <span className="coin big" />
          <strong>{coins(cash)}</strong>
          {delta && (
            <span key={delta.id} className={`pcard-delta ${delta.amount > 0 ? 'plus' : 'minus'}`}>
              {delta.amount > 0 ? '+' : '−'}
              {coins(Math.abs(delta.amount))}
            </span>
          )}
        </div>
        <div className="pcard-meta">
          <span>총자산 {coins(assets)}</span>
          {p.escapeCards > 0 && <span title="여권 재발급 카드">📘×{p.escapeCards}</span>}
          {p.freePasses > 0 && <span title="무료 통행권">🎫×{p.freePasses}</span>}
          {p.stuckTurns > 0 && <span title="여권 분실">🛂 {p.stuckTurns}</span>}
        </div>
        <div className="pcard-cities" aria-label={`도시 ${owned.length}개`}>
          {owned.map((i) => (
            <span
              key={i}
              className="pcard-city"
              title={`${SQUARES[i].name} (${LEVEL_NAMES[state.properties[i]!.level]})`}
              style={{ background: REGION_INFO[SQUARES[i].region!].color }}
            >
              {state.properties[i]!.level > 0 ? state.properties[i]!.level : ''}
            </span>
          ))}
          {owned.length === 0 && !p.bankrupt && <span className="pcard-none">아직 도시가 없어요</span>}
        </div>
      </div>
      {p.bankrupt && <span className="pcard-stamp">파산</span>}
    </li>
  );
}

// ---------------------------------------------------------------- 오른쪽 패널

interface SidePanelProps {
  state: WorldState;
  deltas: Record<number, { id: number; amount: number }>;
  speed: Speed;
  muted: boolean;
  music: boolean;
  onSpeed: (speed: Speed) => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onAtlas: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function SidePanel(props: SidePanelProps) {
  const { state, deltas, speed, muted, music } = props;
  const recent = state.log.slice(-12).reverse();
  return (
    <aside className="panel world-panel">
      <ul className="pcards">
        {state.players.map((_, i) => (
          <PlayerCard key={i} state={state} index={i} delta={deltas[i]} />
        ))}
      </ul>

      <section className="log world-log">
        <h2>진행 기록</h2>
        <ol>
          {recent.map((e) => (
            <li key={e.id}>
              {e.seat !== null && <span className="dot small" style={{ background: SEAT_COLORS[e.seat].main }} />}
              {e.text}
            </li>
          ))}
        </ol>
      </section>

      <section className="world-controls">
        <button type="button" className={`icon-btn${music ? ' on' : ''}`} onClick={props.onToggleMusic} title="배경음악" data-testid="music-toggle">
          🎵
          <span>{music ? '음악 켜짐' : '음악 꺼짐'}</span>
        </button>
        <button type="button" className={`icon-btn${muted ? '' : ' on'}`} onClick={props.onToggleMute} title="효과음">
          {muted ? '🔇' : '🔊'}
          <span>{muted ? '효과음 꺼짐' : '효과음 켜짐'}</span>
        </button>
        <label className="icon-btn speed">
          ⏩
          <select value={speed} onChange={(e) => props.onSpeed(e.target.value as Speed)} aria-label="속도">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="icon-btn" onClick={props.onAtlas} data-testid="atlas-open">
          📖<span>도시 도감</span>
        </button>
        <button type="button" className="icon-btn" onClick={props.onNewGame}>
          🔄<span>새 게임</span>
        </button>
        <button type="button" className="icon-btn" onClick={props.onExit}>
          🏠<span>처음 화면</span>
        </button>
      </section>
    </aside>
  );
}

// ---------------------------------------------------------------- 모달

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`modal-card pop-in${wide ? ' modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function OwnerLine({ state, index }: { state: WorldState; index: number }) {
  const prop = state.properties[index]!;
  if (prop.owner === null) return <span className="owner-chip none">주인 없음</span>;
  const owner = state.players[prop.owner];
  const c = SEAT_COLORS[owner.seat];
  return (
    <span className="owner-chip" style={{ background: c.light, color: c.dark, borderColor: c.main }}>
      <BuildingIcon level={prop.level} color={c.main} dark={c.dark} className="owner-icon" />
      {playerName(owner)} · {LEVEL_NAMES[prop.level]}
    </span>
  );
}

export function CityDetail({ state, index, onClose }: { state: WorldState; index: number; onClose: () => void }) {
  const sq = SQUARES[index];
  const prop = state.properties[index]!;
  const festival = state.festivalSquare === index;
  const ownerColor = prop.owner !== null ? SEAT_COLORS[state.players[prop.owner].seat] : SEAT_COLORS[0];
  return (
    <Modal title={`${sq.name} · ${sq.country}`} onClose={onClose}>
      <CityArt id={sq.cityId!} className="detail-art" />
      <div className="detail-meta">
        <span className="region-chip" style={{ background: REGION_INFO[sq.region!].color }}>
          {REGION_INFO[sq.region!].name}
        </span>
        <span>
          땅값 <strong>{coins(sq.price!)}</strong> · 건물 1단계 <strong>{coins(buildCost(sq))}</strong>
        </span>
        {festival && <span className="festival-chip">🎉 축제 중 · 통행료 2배</span>}
      </div>
      <OwnerLine state={state} index={index} />
      <table className="rent-table big">
        <tbody>
          {[0, 1, 2, 3].map((lv) => (
            <tr key={lv} className={prop.owner !== null && prop.level === lv ? 'current' : ''}>
              <td>
                <BuildingIcon level={lv} color={ownerColor.main} dark={ownerColor.dark} className="rent-icon" />
                {LEVEL_NAMES[lv]}
              </td>
              <td className="num">통행료 {coins(rentFor(sq, lv, festival))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

export function CityAtlas({ state, onClose, onPick }: { state: WorldState; onClose: () => void; onPick: (index: number) => void }) {
  const cities = SQUARES.filter((s) => s.kind === 'city');
  return (
    <Modal title="📖 도시 도감" onClose={onClose} wide>
      <ul className="atlas" data-testid="atlas-list">
        {cities.map((sq) => (
          <li key={sq.index}>
            <button type="button" className="atlas-card" onClick={() => onPick(sq.index)}>
              <CityArt id={sq.cityId!} className="atlas-art" />
              <span className="atlas-band" style={{ background: REGION_INFO[sq.region!].color }} />
              <span className="atlas-name">
                <strong>{sq.name}</strong>
                <small>{sq.country}</small>
              </span>
              <span className="atlas-price">
                <span className="coin" />
                {coins(sq.price!)}
              </span>
              <OwnerLine state={state} index={sq.index} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
