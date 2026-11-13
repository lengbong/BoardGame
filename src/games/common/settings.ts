import { useEffect, useState } from 'react';
import { setMuted } from '../../lib/sound';
import { loadJson, saveJson } from '../../lib/storage';
import { parseSpeed, type Speed } from './speed';

/** 게임마다 따로 저장하는 화면 설정 (속도, 효과음, 배경음악) */
export interface GameSettings {
  speed: Speed;
  muted: boolean;
  music: boolean;
}

export function loadGameSettings(key: string): GameSettings {
  const s = loadJson<Partial<GameSettings>>(key);
  return { speed: parseSpeed(s?.speed), muted: s?.muted === true, music: s?.music !== false };
}

export function saveGameSettings(key: string, settings: GameSettings): void {
  saveJson(key, settings);
}

/**
 * 설정을 불러오고, 바뀔 때마다 저장하고 효과음 켜기/끄기를 반영한다.
 * 키 예: 'family-boardgame.sudoku.settings.v1'
 */
export function useGameSettings(key: string): [GameSettings, (settings: GameSettings) => void] {
  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings(key));
  useEffect(() => {
    setMuted(settings.muted);
    saveGameSettings(key, settings);
  }, [key, settings]);
  return [settings, setSettings];
}
