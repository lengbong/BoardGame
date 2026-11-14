import { useEffect, useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { BoxesGame } from './BoxesGame';
import { BoxesSetup } from './BoxesSetup';
import { createGame } from './rules';
import { SETTINGS_KEY, loadBoxesSetup, loadSavedBoxesGame, saveBoxesSetup, type SavedBoxesGame } from './storage';
import type { BoxesSetup as Setup, BoxesState } from './types';
import './boxes.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: BoxesState; key: number };

/** 점과 상자: 설정 화면 ↔ 게임 화면 */
export function BoxesApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedBoxesGame | null>(loadSavedBoxesGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadBoxesSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  // 화면이 바뀌면 맨 위부터 보이게 (좁은 화면에서 설정 화면 아래쪽 시작 버튼을 누른 경우)
  const screenKey = screen.type === 'game' ? screen.key : 0;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screenKey]);

  const start = (setup: Setup) => {
    saveBoxesSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedBoxesGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <BoxesGame
        key={screen.key}
        setup={screen.setup}
        initialState={screen.state}
        settings={settings}
        onSettings={setSettings}
        onRestart={() => start(screen.setup)}
        onChangeSetup={backToSetup}
        onExit={onExit}
      />
    );
  }

  return (
    <BoxesSetup
      initialSetup={lastSetup}
      saved={saved}
      settings={settings}
      onSettings={setSettings}
      onStart={start}
      onResume={() => saved && setScreen({ type: 'game', setup: saved.setup, state: saved.state, key: Date.now() })}
      onBack={onExit}
    />
  );
}
