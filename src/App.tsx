import { useEffect, useMemo } from 'react';
import { CATEGORIES, GAMES } from './games/registry';
import { loadStats, statsText } from './lib/stats';
import { openFromHub, useHashRoute } from './lib/useHashRoute';

/** 하던 판이 저장되어 있는 게임들 (게임마다 'family-boardgame.<id>.save.v1'에 저장하고, 끝나면 지운다) */
function gamesInProgress(): Set<string> {
  const out = new Set<string>();
  try {
    for (const g of GAMES) if (window.localStorage.getItem(`family-boardgame.${g.id}.save.v1`)) out.add(g.id);
  } catch {
    // 저장소를 못 쓰는 환경이면 표시하지 않는다
  }
  return out;
}

export function App() {
  const [gameId, setGameId] = useHashRoute();
  const game = GAMES.find((g) => g.id === gameId);
  // 목록으로 돌아올 때마다 다시 살펴본다
  const saved = useMemo(() => (game ? new Set<string>() : gamesInProgress()), [game]);
  const resumable = GAMES.filter((g) => saved.has(g.id));
  // 컴퓨터와 겨룬 전적 (목록으로 돌아올 때마다 다시 읽는다)
  const stats = useMemo(() => (game ? {} : loadStats()), [game]);
  const totalWins = Object.values(stats).reduce((n, st) => n + st.wins, 0);

  // 게임을 열거나 닫을 때 맨 위에서 시작한다. (좁은 화면에서 처음 화면의 스크롤 위치가 남지 않게)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [gameId]);

  if (game) {
    const Game = game.component;
    return (
      <main className="app">
        <Game onExit={() => setGameId(null)} />
      </main>
    );
  }

  return (
    <main className="app hub">
      <header className="hub-header">
        <h1>우리 가족 보드게임</h1>
        <p>한 대의 컴퓨터에 둘러앉아 함께 즐겨요. 사람이 모자라면 컴퓨터가 같이 놀아줘요.</p>
      </header>
      {resumable.length > 0 && (
        <section className="hub-resume" aria-labelledby="hub-resume-title">
          <h2 id="hub-resume-title">⏯ 하던 게임 이어하기</h2>
          <ul>
            {resumable.map((g) => (
              <li key={g.id}>
                <button type="button" className="hub-resume-chip" onClick={() => openFromHub(g.id)} data-testid={`resume-${g.id}`}>
                  <span className="hub-resume-icon" aria-hidden="true">
                    {g.icon}
                  </span>
                  {g.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {CATEGORIES.map((cat) => {
        const games = GAMES.filter((g) => g.category === cat.id);
        if (games.length === 0) return null;
        return (
          <section key={cat.id} className="hub-category" aria-labelledby={`hub-cat-${cat.id}`}>
            <h2 id={`hub-cat-${cat.id}`}>{cat.title}</h2>
            <ul className="game-list">
              {games.map((g) => (
                <li key={g.id}>
                  <button type="button" className="game-card" onClick={() => openFromHub(g.id)} data-testid={`game-${g.id}`}>
                    <span className="game-icon" aria-hidden="true">
                      {g.icon}
                    </span>
                    <span className="game-info">
                      <strong>
                        {g.title}
                        {saved.has(g.id) && <em className="game-saved">하던 게임</em>}
                      </strong>
                      <span>{g.description}</span>
                      <small>
                        <span className="nowrap">👨‍👩‍👧‍👦 {g.players}</span> · <span className="nowrap">⏱ {g.playTime}</span>
                      </small>
                      {statsText(stats[g.id]) && (
                        <span className="game-stats" title="컴퓨터와 겨룬 전적" data-testid={`stats-${g.id}`}>
                          🏆 {statsText(stats[g.id])}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <footer className="hub-footer">
        인터넷 없이도 실행돼요 · 진행 중인 게임은 자동으로 저장돼요
        {totalWins > 0 && <> · 지금까지 컴퓨터를 {totalWins}번 이겼어요 🏆</>}
      </footer>
    </main>
  );
}
