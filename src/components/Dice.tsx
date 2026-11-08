const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

interface DiceProps {
  value: number | null;
  rolling: boolean;
  color: string;
}

export function Dice({ value, rolling, color }: DiceProps) {
  return (
    <svg
      className={`dice${rolling ? ' dice-rolling' : ''}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={value ? `주사위 ${value}` : '주사위'}
      data-testid="dice"
      data-value={value ?? ''}
    >
      <rect x={4} y={4} width={92} height={92} rx={18} fill="#fff" stroke={color} strokeWidth={6} />
      {value === null ? (
        <text x={50} y={64} textAnchor="middle" fontSize={44} fill="#b8b0a0" fontWeight={700}>
          ?
        </text>
      ) : (
        PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill={value === 1 ? color : '#2b2b2b'} />)
      )}
    </svg>
  );
}
