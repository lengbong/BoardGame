import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { AirlineGame } from './Game';
import { createGame } from './rules';
import { AirlineSetupScreen } from './Setup';
import { AIRLINE_SETTINGS_KEY, loadAirlineSetup, loadSavedAirlineGame, saveAirlineSetup, type SavedAirlineGame } from './storage';
import type { AirlineSetup, AirlineState } from './types';
import './airline.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: AirlineSetup; state: AirlineState; key: number };

/** 하늘길 항공사: 설정 화면 ↔ 게임 화면 */
export function AirlineApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(AIRLINE_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedAirlineGame | null>(loadSavedAirlineGame);
  const [lastSetup, setLastSetup] = useState<AirlineSetup>(loadAirlineSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: AirlineSetup) => {
    saveAirlineSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedAirlineGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <AirlineGame
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
    <AirlineSetupScreen
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
