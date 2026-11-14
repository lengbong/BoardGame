import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { FourLineGame } from './FourLineGame';
import { FourLineSetup } from './FourLineSetup';
import { createGame } from './rules';
import { SETTINGS_KEY, loadFourLineSetup, loadSavedFourLineGame, saveFourLineSetup, type SavedFourLineGame } from './storage';
import { StoneDefs } from './StoneArt';
import type { FourLineSetup as Setup, FourLineState } from './types';
import './fourline.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: FourLineState; key: number };

export function FourLineApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedFourLineGame | null>(loadSavedFourLineGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadFourLineSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: Setup) => {
    saveFourLineSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedFourLineGame());
    setScreen({ type: 'setup' });
  };

  return (
    <>
      <StoneDefs />
      {screen.type === 'game' ? (
        <FourLineGame
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
        <FourLineSetup
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
