import type { ReactNode } from 'react';
import { SPEEDS, SPEED_LABELS, type Speed } from '../games/common/speed';
import type { GameSettings } from '../games/common/settings';

interface GameControlsProps {
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  /** 속도 고르기를 보여 줄지 (컴퓨터나 연출이 없는 게임은 false) */
  showSpeed?: boolean;
  onNewGame: () => void;
  onExit: () => void;
  /** 앞에 더 붙일 버튼 (예: 되돌리기, 인쇄) */
  children?: ReactNode;
}

/** 게임 화면 옆 패널 맨 아래의 공통 버튼 줄: 속도, 음악, 효과음, 새 게임, 처음 화면 */
export function GameControls({ settings, onSettings, showSpeed = true, onNewGame, onExit, children }: GameControlsProps) {
  return (
    <section className="controls game-controls">
      {children}
      {showSpeed && (
        <label>
          속도
          <select value={settings.speed} onChange={(e) => onSettings({ ...settings, speed: e.target.value as Speed })}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className="btn" onClick={() => onSettings({ ...settings, music: !settings.music })}>
        {settings.music ? '🎵 음악 켜짐' : '🎵 음악 꺼짐'}
      </button>
      <button type="button" className="btn" onClick={() => onSettings({ ...settings, muted: !settings.muted })}>
        {settings.muted ? '🔇 효과음 꺼짐' : '🔊 효과음 켜짐'}
      </button>
      <button type="button" className="btn" onClick={onNewGame}>
        새 게임
      </button>
      <button type="button" className="btn" onClick={onExit}>
        처음 화면
      </button>
    </section>
  );
}
