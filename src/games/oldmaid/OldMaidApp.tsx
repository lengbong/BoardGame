import { useState } from 'react';
import { useGameSettings } from '../common/settings';
import { createGame } from './rules';
import { OldMaidGame } from './OldMaidGame';
import { OldMaidSetupScreen } from './OldMaidSetup';
import {
  OLDMAID_SETTINGS_KEY,
  loadOldMaidSetup,
  loadSavedOldMaidGame,
  saveOldMaidSetup,
  type SavedOldMaidGame,
} from './storage';
import type { OldMaidSetup, OldMaidState } from './types';
import './oldmaid.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: OldMaidSetup; state: OldMaidState; key: number };

export function OldMaidApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(OLDMAID_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedOldMaidGame | null>(loadSavedOldMaidGame);
  const [lastSetup, setLastSetup] = useState<OldMaidSetup>(loadOldMaidSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });

  const start = (setup: OldMaidSetup) => {
    saveOldMaidSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedOldMaidGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <OldMaidGame
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
    <OldMaidSetupScreen
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
