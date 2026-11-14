import { useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { createGame } from './rules';
import { VILLAGE_SETTINGS_KEY, loadSavedVillageGame, loadVillageSetup, saveVillageSetup, type SavedVillageGame } from './storage';
import { VillageDefs } from './TileArt';
import type { VillageSetup, VillageState } from './types';
import { VillageGame } from './VillageGame';
import { VillageSetupScreen } from './VillageSetup';
import './village.css';

type Screen = { type: 'setup' } | { type: 'game'; setup: VillageSetup; state: VillageState; key: number };

export function VillageApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(VILLAGE_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedVillageGame | null>(loadSavedVillageGame);
  const [lastSetup, setLastSetup] = useState<VillageSetup>(loadVillageSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);

  const start = (setup: VillageSetup) => {
    saveVillageSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  const backToSetup = () => {
    setSaved(loadSavedVillageGame());
    setScreen({ type: 'setup' });
  };

  return (
    <>
      <VillageDefs />
      {screen.type === 'game' ? (
        <VillageGame
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
        <VillageSetupScreen
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
