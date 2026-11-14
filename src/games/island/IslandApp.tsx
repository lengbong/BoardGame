import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { IslandGame } from './IslandGame';
import { IslandSetupScreen } from './IslandSetup';
import { createGame } from './rules';
import { ISLAND_SETTINGS_KEY, loadIslandSetup, loadSavedIslandGame, saveIslandSetup, type SavedIslandGame } from './storage';
import type { IslandSetup, IslandState } from './types';
import './island.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: IslandSetup; state: IslandState; key: number };

export function IslandApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(ISLAND_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedIslandGame | null>(loadSavedIslandGame);
  const [lastSetup, setLastSetup] = useState<IslandSetup>(loadIslandSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: IslandSetup) => {
    saveIslandSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedIslandGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <IslandGame
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
    <IslandSetupScreen
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
