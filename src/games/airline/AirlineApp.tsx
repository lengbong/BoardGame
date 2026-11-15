import { useEffect, useLayoutEffect, useState } from 'react';
import { useScrollTop } from '../../lib/useScrollTop';
import { useGameSettings } from '../common/settings';
import { AirlineGame } from './Game';
import { createGame } from './rules';
import { AirlineSetupScreen } from './Setup';
import { AIRLINE_SETTINGS_KEY, loadAirlineSetup, loadSavedAirlineGameAsync, saveAirlineGame, saveAirlineSetup, type SavedAirlineGame } from './storage';
import type { AirlineSetup, AirlineState } from './types';
import './airline.css';
import './theme.css'; // 운항 관제실 테마: 다른 항공사 CSS보다 나중에 불러야 덮어쓸 수 있다

type Screen = { type: 'setup' } | { type: 'game'; setup: AirlineSetup; state: AirlineState; key: number };

/** 하늘길 항공사: 설정 화면 ↔ 게임 화면 */
export function AirlineApp({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useGameSettings(AIRLINE_SETTINGS_KEY);
  const [saved, setSaved] = useState<SavedAirlineGame | null>(null);
  const [lastSetup, setLastSetup] = useState<AirlineSetup>(loadAirlineSetup);
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  useScrollTop('key' in screen ? screen.key : screen.type);
  // 항공사 게임이 떠 있는 동안은 페이지 전체(몸통 배경, ❓ 단추, 안내 창)도 관제실 색으로
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-al-ops', '');
    return () => document.documentElement.removeAttribute('data-al-ops');
  }, []);

  const start = (setup: AirlineSetup) => {
    saveAirlineSetup(setup);
    setLastSetup(setup);
    setScreen({ type: 'game', setup, state: createGame(setup), key: Date.now() });
  };

  // 설정 화면에 올 때마다 하던 게임을 다시 읽는다 (큰 저장소는 읽는 데 잠깐 걸린다: 게임 화면이 닫히며 마지막 저장을 마친 뒤에 읽는다)
  const onSetup = screen.type === 'setup';
  useEffect(() => {
    if (!onSetup) return;
    let live = true;
    void loadSavedAirlineGameAsync().then((s) => live && setSaved(s));
    return () => {
      live = false;
    };
  }, [onSetup]);

  const backToSetup = () => setScreen({ type: 'setup' });

  /** 저장 파일을 불러왔다: 저장해 두고 바로 이어서 한다 */
  const importSaved = (s: SavedAirlineGame) => {
    saveAirlineGame(s.setup, s.state);
    setSaved(s);
    setScreen({ type: 'game', setup: s.setup, state: s.state, key: Date.now() });
  };

  if (screen.type === 'game') {
    return (
      <AirlineGame
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
    <AirlineSetupScreen
      initialSetup={lastSetup}
      saved={saved}
      settings={settings}
      onSettings={setSettings}
      onStart={start}
      onImport={importSaved}
      onResume={() => saved && setScreen({ type: 'game', setup: saved.setup, state: saved.state, key: Date.now() })}
      onBack={onExit}
    />
  );
}
