import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { GardenGame } from './GardenGame';
import { GardenSetupScreen } from './GardenSetup';
import { createGame } from './rules';
import { GARDEN_SETTINGS_KEY, loadGardenSetup, loadSavedGardenGame, saveGardenSetup, type SavedGardenGame } from './storage';
import type { GardenSetup, GardenState } from './types';
import './garden.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: GardenSetup; state: GardenState; key: number };

export function GardenApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(GARDEN_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedGardenGame | null>(loadSavedGardenGame);
  const [lastSetup, setLastSetup] = useState<GardenSetup>(loadGardenSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: GardenSetup) => {
    saveGardenSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedGardenGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <GardenGame
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
    <GardenSetupScreen
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
