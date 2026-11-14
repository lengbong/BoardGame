import { useEffect, useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { setMuted } from '../../lib/sound';
import { createGame } from './rules';
import { LastCardGame } from './LastCardGame';
import { LastCardSetup } from './LastCardSetup';
import {
  loadLastCardSettings,
  loadLastCardSetup,
  loadSavedLastCardGame,
  saveLastCardSettings,
  saveLastCardSetup,
  type LastCardSettings,
  type SavedLastCardGame,
} from './storage';
import type { LastCardSetup as Setup, LastCardState } from './types';
import './lastcard.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: LastCardState; key: number };

export function LastCardApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<LastCardSettings>(loadLastCardSettings);
  const [saved, setSaved] = useState<SavedLastCardGame | null>(loadSavedLastCardGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadLastCardSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  useEffect(() => {
    setMuted(settings.muted);
    saveLastCardSettings(settings);
  }, [settings]);

  const start = (setup: Setup) => {
    saveLastCardSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedLastCardGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <LastCardGame
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
    <LastCardSetup
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
