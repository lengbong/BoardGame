import { useState } from 'react';
import { useGameSettings } from '../common/settings';
import { DiscDefs } from './DiscArt';
import { ReversiGame } from './ReversiGame';
import { ReversiSetup } from './ReversiSetup';
import { createGame } from './rules';
import {
  SETTINGS_KEY,
  loadReversiSetup,
  loadSavedReversiGame,
  saveReversiSetup,
  type SavedReversiGame,
} from './storage';
import type { ReversiSetup as Setup, ReversiState } from './types';
import './reversi.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: Setup; state: ReversiState; key: number };

export function ReversiApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedReversiGame | null>(loadSavedReversiGame);
  const [lastSetup, setLastSetup] = useState<Setup>(loadReversiSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });

  const start = (setup: Setup) => {
    saveReversiSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedReversiGame());
    setScreen({ type: 'setup' });
  };

  return (
    <>
      <DiscDefs />
      {screen.type === 'game' ? (
        <ReversiGame
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
        <ReversiSetup
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
