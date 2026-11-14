import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { BaseballGame } from './BaseballGame';
import { BaseballSetupScreen } from './BaseballSetup';
import { createGame } from './rules';
import { SETTINGS_KEY, loadBaseballSetup, loadSavedBaseballGame, saveBaseballSetup, type SavedBaseballGame } from './storage';
import type { BaseballSetup, BaseballState } from './types';
import './baseball.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: BaseballSetup; state: BaseballState; key: number };

export function BaseballApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedBaseballGame | null>(loadSavedBaseballGame);
  const [lastSetup, setLastSetup] = useState<BaseballSetup>(loadBaseballSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: BaseballSetup) => {
    saveBaseballSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedBaseballGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <BaseballGame
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
    <BaseballSetupScreen
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
