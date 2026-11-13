/** 임시 화면: 이 게임을 만드는 동안 게임 목록에서 열 수 있게 둔다. */
export function ShipsApp({ onExit }: { onExit: () => void }) {
  return (
    <div className="setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onExit}>
        ← 게임 목록
      </button>
      <p>준비 중이에요.</p>
    </div>
  );
}
