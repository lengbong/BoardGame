import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { RailsGame } from './RailsGame';
import { RailsSetupScreen } from './RailsSetup';
import { createGame } from './rules';
import { RAILS_SETTINGS_KEY, loadRailsSetup, loadSavedRailsGame, saveRailsSetup, type SavedRailsGame } from './storage';
import type { RailsSetup, RailsState } from './types';
import './rails.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: RailsSetup; state: RailsState; key: number };

export function RailsApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(RAILS_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedRailsGame | null>(loadSavedRailsGame);
  const [lastSetup, setLastSetup] = useState<RailsSetup>(loadRailsSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: RailsSetup) => {
    saveRailsSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedRailsGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <RailsGame
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
    <RailsSetupScreen
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
