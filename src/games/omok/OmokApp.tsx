import { useEffect, useState } from 'react';
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

  // 설정 화면 맨 아래에서 시작해도 게임은 맨 위부터 보이게 (좁은 화면에서 판이 가려지지 않게)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

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
