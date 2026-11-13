import { useEffect, useState } from 'react';
import { useGameSettings } from '../common/settings';
import { createGame } from './engine';
import { MalangGame } from './MalangGame';
import { MalangSetupScreen } from './MalangSetup';
import { SETTINGS_KEY, clearSavedMalangGame, loadMalangSetup, loadSavedMalangGame, saveMalangSetup, type SavedMalangGame } from './storage';
import type { MalangSetup, MalangState } from './types';
import './malang.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: MalangSetup; state: MalangState; resumed: boolean; key: number };

export function MalangApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedMalangGame | null>(loadSavedMalangGame);
  const [lastSetup, setLastSetup] = useState<MalangSetup>(loadMalangSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });

  // 설정 화면 맨 아래에서 시작해도 게임은 맨 위부터 보이게 (좁은 화면에서 판이 가려지지 않게)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const start = (setup: MalangSetup) => {
    saveMalangSetup(setup);
    setLastSetup(setup);
    clearSavedMalangGame();
    setScreen({ type: 'game', setup, state: createGame(setup), resumed: false, key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedMalangGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <MalangGame
        key={screen.key}
        setup={screen.setup}
        initialState={screen.state}
        resumed={screen.resumed}
        settings={settings}
        onSettings={setSettings}
        onRestart={() => start(screen.setup)}
        onChangeSetup={backToSetup}
        onExit={onExit}
      />
    );
  }

  return (
    <MalangSetupScreen
      initialSetup={lastSetup}
      saved={saved}
      settings={settings}
      onSettings={setSettings}
      onStart={start}
      onResume={() => saved && setScreen({ type: 'game', setup: saved.setup, state: saved.state, resumed: true, key: Date.now() })}
      onBack={onExit}
    />
  );
}
