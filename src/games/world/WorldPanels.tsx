import { useEffect } from 'react';
import { KIND_LABEL, SEAT_COLORS } from '../common/players';
import { SPEEDS, SPEED_LABELS, type Speed } from '../common/speed';
import { LEVEL_ICONS, LEVEL_NAMES, REGION_INFO, SQUARES, buildCost, rentFor } from './board';
import { CITY_IMAGES } from './cityImages';
import { IMAGE_CREDITS } from './imageCredits';
import { ownedSquares, playerName, totalAssets } from './rules';
import type { WorldState } from './types';

function coins(n: number): string {
  return `${n.toLocaleString('ko-KR')}코인`;
}

// ---------------------------------------------------------------- 오른쪽 패널

interface SidePanelProps {
  state: WorldState;
  speed: Speed;
  muted: boolean;
  onSpeed: (speed: Speed) => void;
  onToggleMute: () => void;
  onCredits: () => void;
  onNewGame: () => void;
  onExit: () => void;
}

export function SidePanel({ state, speed, muted, onSpeed, onToggleMute, onCredits, onNewGame, onExit }: SidePanelProps) {
  const recent = state.log.slice(-14).reverse();
  return (
    <aside className="panel world-panel">
      <section className="players">
        <h2>플레이어</h2>
        <ul>
          {state.players.map((p, i) => {
            const c = SEAT_COLORS[p.seat];
            const cities = ownedSquares(state, i).length;
            return (
              <li
                key={p.seat}
                className={`${i === state.current && state.phase !== 'gameover' ? 'is-current' : ''}${p.bankrupt ? ' is-bankrupt' : ''}`}
                data-testid={`world-player-${i}`}
              >
                <span className="dot" style={{ background: c.main }} />
                <span className="wp-main">
                  <span className="player-name">{playerName(p)}</span>
                  <span className="player-kind">
                    {KIND_LABEL[p.kind]}
                    {p.escapeCards > 0 && ` · 📘${p.escapeCards}`}
                    {p.freePasses > 0 && ` · 🎫${p.freePasses}`}
                    {p.stuckTurns > 0 && ' · 🛂'}
                  </span>
                </span>
                <span className="wp-money">
                  {p.bankrupt ? (
                    <strong>파산</strong>
                  ) : (
                    <>
                      <strong>{coins(p.cash)}</strong>
                      <small>
                        도시 {cities}개 · 총 {coins(totalAssets(state, i))}
                      </small>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="log">
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

      <section className="controls">
        <label>
          속도
          <select value={speed} onChange={(e) => onSpeed(e.target.value as Speed)}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={onToggleMute}>
          {muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'}
        </button>
        <button type="button" className="btn" onClick={onCredits} data-testid="credits-open">
          🖼️ 이미지 출처
        </button>
        <button type="button" className="btn" onClick={onNewGame}>
          새 게임
        </button>
        <button type="button" className="btn" onClick={onExit}>
          처음 화면
        </button>
      </section>
    </aside>
  );
}

// ---------------------------------------------------------------- 모달

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`modal-card${wide ? ' modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
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

export function CityDetail({ state, index, onClose }: { state: WorldState; index: number; onClose: () => void }) {
  const sq = SQUARES[index];
  const prop = state.properties[index]!;
  const owner = prop.owner !== null ? state.players[prop.owner] : null;
  const festival = state.festivalSquare === index;
  const credit = IMAGE_CREDITS.find((c) => c.id === sq.cityId);
  return (
    <Modal title={`${sq.name} (${sq.country})`} onClose={onClose}>
      <img className="detail-img" src={CITY_IMAGES[sq.cityId!]} alt={sq.name} />
      <p className="detail-meta">
        <span className="region-chip" style={{ background: REGION_INFO[sq.region!].color }}>
          {REGION_INFO[sq.region!].name}
        </span>
        땅값 {coins(sq.price!)} · 건물 1단계 {coins(buildCost(sq))}
        {festival && ' · 🎉 축제 중 (통행료 2배)'}
      </p>
      <p>
        주인:{' '}
        {owner ? (
          <strong style={{ color: SEAT_COLORS[owner.seat].dark }}>
            {playerName(owner)} ({LEVEL_ICONS[prop.level] || '🚩'} {LEVEL_NAMES[prop.level]})
          </strong>
        ) : (
          '없음'
        )}
      </p>
      <table className="rent-table">
        <tbody>
          {[0, 1, 2, 3].map((lv) => (
            <tr key={lv} className={owner && prop.level === lv ? 'current' : ''}>
              <td>
                {LEVEL_ICONS[lv] || '🚩'} {LEVEL_NAMES[lv]}
              </td>
              <td>통행료 {coins(rentFor(sq, lv, festival))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {credit && (
        <p className="detail-credit">
          사진: {credit.author} / {credit.license} /{' '}
          <a href={credit.source} target="_blank" rel="noopener noreferrer">
            위키미디어 공용
          </a>
        </p>
      )}
    </Modal>
  );
}

export function CreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="🖼️ 이미지 출처" onClose={onClose} wide>
      <p className="credits-intro">
        도시 사진은 모두 위키미디어 공용(Wikimedia Commons)의 자유 라이선스 이미지이며, 게임 판에 맞게 잘라서 크기를 줄였습니다.
      </p>
      <ul className="credits-list" data-testid="credits-list">
        {IMAGE_CREDITS.map((c) => {
          const sq = SQUARES.find((s) => s.cityId === c.id);
          return (
            <li key={c.id}>
              <img src={CITY_IMAGES[c.id]} alt="" />
              <div>
                <strong>{sq?.name}</strong>
                <a href={c.source} target="_blank" rel="noopener noreferrer">
                  {c.file}
                </a>
                <span>
                  {c.author} ·{' '}
                  {c.licenseUrl ? (
                    <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                      {c.license}
                    </a>
                  ) : (
                    c.license
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
