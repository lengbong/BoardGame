import { useEffect, useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { setMuted } from '../../lib/sound';
import { RaceGame } from './RaceGame';
import { createGame } from './rules';
import { Setup } from './Setup';
import {
  loadLastSetup,
  loadSavedGame,
  loadSettings,
  saveLastSetup,
  saveSettings,
  type SavedGame,
  type Settings,
} from './storage';
import type { GameSetup, GameState } from './types';

type Screen = { type: 'setup' } | { type: 'game'; setup: GameSetup; state: GameState; key: number };

export function RaceApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState<SavedGame | null>(loadSavedGame);
  const [lastSetup, setLastSetup] = useState<GameSetup>(loadLastSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  useEffect(() => {
    setMuted(settings.muted);
    saveSettings(settings);
  }, [settings]);

  const start = (setup: GameSetup) => {
    saveLastSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <RaceGame
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
    <Setup
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
