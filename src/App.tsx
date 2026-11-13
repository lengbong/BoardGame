import { useState } from 'react';
import { CATEGORIES, GAMES } from './games/registry';

export function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const game = GAMES.find((g) => g.id === gameId);

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
      {CATEGORIES.map((cat) => {
        const games = GAMES.filter((g) => g.category === cat.id);
        if (games.length === 0) return null;
        return (
          <section key={cat.id} className="hub-category" aria-labelledby={`hub-cat-${cat.id}`}>
            <h2 id={`hub-cat-${cat.id}`}>{cat.title}</h2>
            <ul className="game-list">
              {games.map((g) => (
                <li key={g.id}>
                  <button type="button" className="game-card" onClick={() => setGameId(g.id)} data-testid={`game-${g.id}`}>
                    <span className="game-icon" aria-hidden="true">
                      {g.icon}
                    </span>
                    <span className="game-info">
                      <strong>{g.title}</strong>
                      <span>{g.description}</span>
                      <small>
                        <span className="nowrap">👨‍👩‍👧‍👦 {g.players}</span> · <span className="nowrap">⏱ {g.playTime}</span>
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <footer className="hub-footer">인터넷 없이도 실행돼요 · 진행 중인 게임은 자동으로 저장돼요</footer>
    </main>
  );
}
