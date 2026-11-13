import { useState } from 'react';
import { useGameSettings } from '../common/settings';
import { DominoGame } from './DominoGame';
import { DominoSetup } from './DominoSetup';
import { createGame } from './rules';
import { DOMINO_SETTINGS_KEY, loadDominoSetup, loadSavedDominoGame, saveDominoSetup, type SavedDominoGame } from './storage';
import type { DominoSetup as Setup, DominoState } from './types';
import './domino.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: DominoState; key: number };

export function DominoApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(DOMINO_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedDominoGame | null>(loadSavedDominoGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadDominoSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });

  const start = (setup: Setup) => {
    saveDominoSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedDominoGame());
    setLastSetup(loadDominoSetup());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <DominoGame
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
    <DominoSetup
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
