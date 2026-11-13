import { useState } from 'react';
import { useGameSettings } from '../common/settings';
import { createGame } from './rules';
import { ShipsGame } from './ShipsGame';
import { ShipsSetup } from './ShipsSetup';
import { SHIPS_SETTINGS_KEY, loadSavedShipsGame, loadShipsSetup, saveShipsSetup, type SavedShipsGame } from './storage';
import type { ShipsSetup as Setup, ShipsState } from './types';
import './ships.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: ShipsState; key: number };

/** 배 찾기: 설정 화면 ↔ 게임 화면 */
export function ShipsApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SHIPS_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedShipsGame | null>(loadSavedShipsGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadShipsSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });

  const start = (setup: Setup) => {
    saveShipsSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedShipsGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <ShipsGame
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
    <ShipsSetup
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
