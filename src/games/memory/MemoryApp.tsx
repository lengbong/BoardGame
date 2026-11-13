import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { MemoryGame } from './MemoryGame';
import { MemorySetupScreen } from './MemorySetup';
import { createGame } from './rules';
import { MEMORY_SETTINGS_KEY, loadMemorySetup, loadSavedMemoryGame, saveMemorySetup, type SavedMemoryGame } from './storage';
import type { MemorySetup, MemoryState } from './types';
import './memory.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: MemorySetup; state: MemoryState; key: number };

export function MemoryApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(MEMORY_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedMemoryGame | null>(loadSavedMemoryGame);
  const [lastSetup, setLastSetup] = useState<MemorySetup>(loadMemorySetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: MemorySetup) => {
    saveMemorySetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedMemoryGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <MemoryGame
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
    <MemorySetupScreen
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
