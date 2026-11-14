import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { OmokGame } from './OmokGame';
import { OmokSetupScreen } from './OmokSetup';
import { createGame } from './rules';
import { StoneDefs } from './StoneArt';
import { SETTINGS_KEY, loadOmokSetup, loadSavedOmokGame, saveOmokSetup, type SavedOmokGame } from './storage';
import type { OmokSetup, OmokState } from './types';
import './omok.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: OmokSetup; state: OmokState; key: number };

export function OmokApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedOmokGame | null>(loadSavedOmokGame);
  const [lastSetup, setLastSetup] = useState<OmokSetup>(loadOmokSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: OmokSetup) => {
    saveOmokSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedOmokGame());
    setScreen({ type: 'setup' });
  };

  return (
    <>
      <StoneDefs />
      {screen.type === 'game' ? (
        <OmokGame
          key={screen.key}
          setup={screen.setup}
          initialState={screen.state}
          settings={settings}
          onSettings={setSettings}
          onRestart={() => start(screen.setup)}
          onChangeSetup={backToSetup}
          onExit={onExit}
        />
      ) : (
        <OmokSetupScreen
          initialSetup={lastSetup}
          saved={saved}
          settings={settings}
          onSettings={setSettings}
          onStart={start}
          onResume={() => saved && setScreen({ type: 'game', setup: saved.setup, state: saved.state, key: Date.now() })}
          onBack={onExit}
        />
      )}
    </>
  );
}
