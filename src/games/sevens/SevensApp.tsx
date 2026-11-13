import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { createGame } from './rules';
import { SevensGame } from './SevensGame';
import { SevensSetupScreen } from './SevensSetup';
import { SEVENS_SETTINGS_KEY, loadSavedSevensGame, loadSevensSetup, saveSevensSetup, type SavedSevensGame } from './storage';
import type { SevensSetup, SevensState } from './types';
import './sevens.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: SevensSetup; state: SevensState; key: number };

export function SevensApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SEVENS_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedSevensGame | null>(loadSavedSevensGame);
  const [lastSetup, setLastSetup] = useState<SevensSetup>(loadSevensSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: SevensSetup) => {
    saveSevensSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedSevensGame());
    setScreen({ type: 'setup' });
  };

  if (screen.type === 'game') {
    return (
      <SevensGame
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
    <SevensSetupScreen
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
