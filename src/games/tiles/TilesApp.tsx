import { useEffect, useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { setMuted } from '../../lib/sound';
import { createGame } from './rules';
import {
  loadSavedTilesGame,
  loadTilesSettings,
  loadTilesSetup,
  saveTilesSettings,
  saveTilesSetup,
  type SavedTilesGame,
  type TilesSettings,
} from './storage';
import { TilesGame } from './TilesGame';
import { TilesSetup } from './TilesSetup';
import type { TilesSetup as Setup, TilesState } from './types';
import './tiles.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: TilesState; key: number };

export function TilesApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<TilesSettings>(loadTilesSettings);
  const [saved, setSaved] = useState<SavedTilesGame | null>(loadSavedTilesGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadTilesSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  useEffect(() => {
    setMuted(settings.muted);
    saveTilesSettings(settings);
  }, [settings]);

  const start = (setup: Setup) => {
    saveTilesSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedTilesGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <TilesGame
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
    <TilesSetup
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
