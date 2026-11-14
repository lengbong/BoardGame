import { useEffect, useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { setMuted } from '../../lib/sound';
import { createGame } from './rules';
import {
  loadLastWorldSetup,
  loadSavedWorldGame,
  loadWorldSettings,
  saveLastWorldSetup,
  saveWorldSettings,
  type SavedWorldGame,
  type WorldSettings,
} from './storage';
import type { WorldSetup as Setup, WorldState } from './types';
import { WorldGame } from './WorldGame';
import { WorldSetup } from './WorldSetup';
import './world.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: WorldState; key: number };

export function WorldApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<WorldSettings>(loadWorldSettings);
  const [saved, setSaved] = useState<SavedWorldGame | null>(loadSavedWorldGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadLastWorldSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  useEffect(() => {
    setMuted(settings.muted);
    saveWorldSettings(settings);
  }, [settings]);

  const start = (setup: Setup) => {
    saveLastWorldSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedWorldGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <WorldGame
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
    <WorldSetup
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
