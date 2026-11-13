import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { MancalaGame } from './MancalaGame';
import { MancalaSetup } from './MancalaSetup';
import { createGame } from './rules';
import { SETTINGS_KEY, loadMancalaSetup, loadSavedMancalaGame, saveMancalaSetup, type SavedMancalaGame } from './storage';
import type { MancalaSetup as Setup, MancalaState } from './types';
import './mancala.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: MancalaState; key: number };

export function MancalaApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedMancalaGame | null>(loadSavedMancalaGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadMancalaSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: Setup) => {
    saveMancalaSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedMancalaGame());
    setLastSetup(loadMancalaSetup());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <MancalaGame
        key={screen.key}
        setup={screen.setup}
        initialState={screen.state}
        settings={settings}
        onSettings={setSettings}
        onRestart={start}
        onChangeSetup={backToSetup}
        onExit={onExit}
      />
    );
  }

  return (
    <MancalaSetup
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
