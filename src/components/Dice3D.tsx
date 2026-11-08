import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './Dice3D.css';

/** 면 배치: 앞 1, 오른쪽 2, 위 3, 아래 4, 왼쪽 5, 뒤 6 — 각 면을 앞으로 보이게 하는 회전 */
const FACE_ROTATION: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
};

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

interface Dice3DProps {
  value: number | null;
  /** 값이 바뀔 때마다 1씩 늘리면 그 값으로 굴러간다 */
  rollId: number;
  duration: number;
  /** 1의 눈 색 */
  accent?: string;
  className?: string;
}

export function Dice3D({ value, rollId, duration, accent = '#e5484d', className }: Dice3DProps) {
  const target = FACE_ROTATION[value ?? 1];
  const [rotation, setRotation] = useState<[number, number]>(target);
  const lastRoll = useRef(rollId);
  const [tossing, setTossing] = useState(false);

  useEffect(() => {
    const [tx, ty] = FACE_ROTATION[value ?? 1];
    if (rollId === lastRoll.current) {
      setRotation([tx, ty]);
      return;
    }
    lastRoll.current = rollId;
    setRotation(([rx, ry]) => {
      const spinsX = 2 + Math.floor(Math.random() * 2);
      const spinsY = 2 + Math.floor(Math.random() * 2);
      return [Math.ceil(rx / 360) * 360 + spinsX * 360 + tx, Math.ceil(ry / 360) * 360 + spinsY * 360 + ty];
    });
    setTossing(true);
    const t = window.setTimeout(() => setTossing(false), duration);
    return () => window.clearTimeout(t);
  }, [rollId, value, duration]);

  const style = { '--d3-duration': `${duration}ms` } as CSSProperties;
  return (
    <div
      className={`d3${tossing ? ' d3-tossing' : ''}${value === null ? ' d3-idle' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      role="img"
      aria-label={value ? `주사위 ${value}` : '주사위'}
      data-value={value ?? ''}
    >
      <div className="d3-shadow" />
      <div className="d3-body">
        <div className="d3-cube" style={{ transform: `rotateX(${rotation[0]}deg) rotateY(${rotation[1]}deg)` }}>
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <div key={face} className={`d3-face d3-f${face}`}>
              {PIPS[face].map(([x, y], i) => (
                <span key={i} className="d3-pip" style={{ left: `${x}%`, top: `${y}%`, background: face === 1 ? accent : undefined }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
