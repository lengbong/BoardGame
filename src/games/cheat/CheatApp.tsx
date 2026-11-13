import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { CheatGame } from './CheatGame';
import { CheatSetupScreen } from './CheatSetup';
import { createGame } from './rules';
import { CHEAT_SETTINGS_KEY, loadCheatSetup, loadSavedCheatGame, saveCheatSetup, type SavedCheatGame } from './storage';
import type { CheatSetup, CheatState } from './types';
import './cheat.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: CheatSetup; state: CheatState; key: number };

export function CheatApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(CHEAT_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedCheatGame | null>(loadSavedCheatGame);
  const [lastSetup, setLastSetup] = useState<CheatSetup>(loadCheatSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: CheatSetup) => {
    saveCheatSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedCheatGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <CheatGame
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
    <CheatSetupScreen
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
