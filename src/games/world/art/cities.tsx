import type { ReactElement } from 'react';
import { Cloud, Ground, Palm, Scene, Shade, Tree, Water, useArtId } from './common';

type Art = (props: { className?: string; title?: string }) => ReactElement;

// ---------------------------------------------------------------- 부품

function Prang({ x, base, scale }: { x: number; base: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${scale}) translate(-80 -82)`}>
      <rect x="58" y="78" width="44" height="6" fill="#e2cda1" />
      <rect x="62" y="74" width="36" height="4" fill="#ead8b2" />
      <path d="M64 74 Q68 52 76 34 L78 22 L80 12 L82 22 L84 34 Q92 52 96 74 Z" fill="#f3e5c8" />
      <path d="M80 12 L82 22 L84 34 Q92 52 96 74 L80 74 Z" fill="#000" opacity="0.08" />
      {[40, 47, 54, 61, 68].map((y) => {
        const half = 4 + (y - 34) * 0.42;
        return <line key={y} x1={80 - half} y1={y} x2={80 + half} y2={y} stroke="#c9a676" strokeWidth="1" />;
      })}
      <circle cx="80" cy="30" r="1.6" fill="#e07a5f" />
    </g>
  );
}

function Onion({ x, y, r, base, stripe }: { x: number; y: number; r: number; base: string; stripe: string }) {
  const clip = useArtId(`onion-${x}-${y}`);
  const d = `M${x - r} ${y} Q${x - r * 1.35} ${y - r * 1.1} ${x} ${y - r * 2.3} Q${x + r * 1.35} ${y - r * 1.1} ${x + r} ${y} Z`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={base} />
      <g clipPath={`url(#${clip})`}>
        {[-2, -1, 0, 1, 2].map((k) => (
          <path
            key={k}
            d={`M${x - r * 1.6 + k * r * 0.9} ${y + 1} Q${x + k * r * 0.9} ${y - r} ${x + r * 0.6 + k * r * 0.9} ${y - r * 2.4}`}
            stroke={stripe}
            strokeWidth={r * 0.32}
            fill="none"
          />
        ))}
      </g>
      <line x1={x} y1={y - r * 2.3} x2={x} y2={y - r * 2.3 - 3} stroke="#e0b341" strokeWidth="0.8" />
      <circle cx={x} cy={y - r * 2.3 - 3.4} r="0.8" fill="#e0b341" />
    </g>
  );
}

function Spire({ x, top, w, color, cap }: { x: number; top: number; w: number; color: string; cap: string }) {
  const dots: ReactElement[] = [];
  for (let y = top + w * 3; y < 70; y += 5) dots.push(<circle key={y} cx={x} cy={y} r="0.7" fill="#000" opacity="0.25" />);
  return (
    <g>
      <path d={`M${x - w} 84 L${x - w} ${top + w * 2.2} Q${x} ${top - 1} ${x + w} ${top + w * 2.2} L${x + w} 84 Z`} fill={color} />
      <path d={`M${x} ${top} Q${x + w} ${top + w} ${x + w} ${top + w * 2.2} L${x + w} 84 L${x} 84 Z`} fill="#000" opacity="0.12" />
      {dots}
      <circle cx={x} cy={top - 1.5} r={w * 0.55} fill={cap} />
    </g>
  );
}

function CanalHouse({ x, w, top, color, trim, gable }: { x: number; w: number; top: number; color: string; trim: string; gable: 'step' | 'bell' | 'point' }) {
  const bodyTop = top + 8;
  let gablePath: string;
  if (gable === 'step') {
    const s = w / 6;
    gablePath = `M${x} ${bodyTop} V${top + 5} H${x + s} V${top + 2.5} H${x + 2 * s} V${top} H${x + 4 * s} V${top + 2.5} H${x + 5 * s} V${top + 5} H${x + w} V${bodyTop} Z`;
  } else if (gable === 'bell') {
    gablePath = `M${x} ${bodyTop} Q${x} ${top + 4} ${x + w * 0.3} ${top + 3} Q${x + w * 0.3} ${top} ${x + w / 2} ${top} Q${x + w * 0.7} ${top} ${x + w * 0.7} ${top + 3} Q${x + w} ${top + 4} ${x + w} ${bodyTop} Z`;
  } else {
    gablePath = `M${x} ${bodyTop} L${x + w / 2} ${top} L${x + w} ${bodyTop} Z`;
  }
  const windows: ReactElement[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      const wx = x + w * 0.2 + col * w * 0.38;
      const wy = bodyTop + 3 + row * 8;
      if (wy + 5 > 72) continue;
      windows.push(<rect key={`${row}-${col}`} x={wx} y={wy} width={w * 0.24} height="5" fill="#dff0fb" stroke={trim} strokeWidth="0.8" />);
    }
  }
  return (
    <g>
      <path d={gablePath} fill={color} />
      <rect x={x} y={bodyTop} width={w} height={74 - bodyTop} fill={color} />
      <rect x={x + w - 2} y={top + 3} width="2" height={74 - top - 3} fill="#000" opacity="0.1" />
      <rect x={x + w / 2 - 1.2} y={top + 2.5} width="2.4" height="2.4" fill={trim} />
      {windows}
    </g>
  );
}

// ---------------------------------------------------------------- 도시

const cairo: Art = (p) => (
  <Scene {...p} sky={['#7ec8ef', '#fbe3b4']} sun={{ x: 132, y: 22, r: 9, color: '#ffd166' }} clouds={[[34, 20, 0.8]]}>
    <path d="M0 80 Q30 72 60 78 T120 75 T160 78 V100 H0Z" fill="#efc77a" />
    <polygon points="12,84 34,60 56,84" fill="#e5b45f" />
    <polygon points="34,60 56,84 42,84" fill="#c9923f" />
    <polygon points="98,84 122,55 146,84" fill="#e5b45f" />
    <polygon points="122,55 146,84 130,84" fill="#c9923f" />
    <polygon points="44,84 80,32 116,84" fill="#edbc63" />
    <polygon points="80,32 116,84 92,84" fill="#c98f3c" />
    <path d="M59.6 62 H100.4 M51.7 73 H108.3" stroke="#b9833a" strokeWidth="0.8" opacity="0.5" />
    <path d="M0 85 Q40 80 80 86 T160 83 V100 H0Z" fill="#f6d792" />
    <Palm x={150} y={88} s={0.9} />
    <Palm x={8} y={90} s={0.75} />
  </Scene>
);

const istanbul: Art = (p) => (
  <Scene {...p} sky={['#8fd0f7', '#eaf7ff']} clouds={[[26, 18, 1], [122, 13, 0.8]]}>
    <Ground y={84} color="#93c97a" edge="#7cb565" />
    {[44, 116].map((x) => (
      <g key={x}>
        <rect x={x - 1.6} y="40" width="3.2" height="44" fill="#e8ddcc" />
        <rect x={x - 2.4} y="56" width="4.8" height="1.6" fill="#cfc2ae" />
        <polygon points={`${x - 1.6},40 ${x + 1.6},40 ${x},30`} fill="#8796a3" />
      </g>
    ))}
    <rect x="50" y="62" width="60" height="22" fill="#e9b9a0" />
    <Shade x={86} y={62} w={24} h={22} opacity={0.1} />
    <path d="M50 62 A10 7 0 0 1 70 62 Z" fill="#aab6bf" />
    <path d="M90 62 A10 7 0 0 1 110 62 Z" fill="#9eabb5" />
    <rect x="62" y="55" width="36" height="7" fill="#e3ad92" />
    <path d="M62 56 A18 15 0 0 1 98 56 Z" fill="#b6c2ca" />
    <path d="M80 41 A18 15 0 0 1 98 56 L80 56 Z" fill="#000" opacity="0.1" />
    <line x1="80" y1="41" x2="80" y2="35" stroke="#d4a62a" strokeWidth="0.9" />
    {[54, 62, 70, 78, 86, 94, 102].map((x) => (
      <rect key={x} x={x} y="68" width="3" height="7" rx="1.5" fill="#8f5c48" />
    ))}
    {[30, 130].map((x) => (
      <g key={x}>
        <rect x={x - 2} y="30" width="4" height="54" fill="#f4e9da" />
        <rect x={x - 3} y="50" width="6" height="2" fill="#d8cab5" />
        <rect x={x - 3} y="38" width="6" height="1.6" fill="#d8cab5" />
        <polygon points={`${x - 2},30 ${x + 2},30 ${x},17`} fill="#8796a3" />
      </g>
    ))}
  </Scene>
);

const hanoi: Art = (p) => (
  <Scene {...p} sky={['#9fd8ee', '#eaf8f0']} clouds={[[122, 18, 0.9]]}>
    <path d="M0 70 Q20 62 40 68 T80 66 T120 67 T160 64 V74 H0Z" fill="#5d9c5a" />
    <Water y={72} color="#58b0c2" light="#8fd2de" />
    <ellipse cx="80" cy="75" rx="21" ry="3.6" fill="#6fae5a" />
    <g opacity="0.25" transform="translate(0 150) scale(1 -1)">
      <rect x="69" y="58" width="22" height="16" fill="#d8c39a" />
      <rect x="72" y="49" width="16" height="9" fill="#d8c39a" />
    </g>
    <rect x="69" y="58" width="22" height="16" fill="#dcc79e" />
    <rect x="72" y="49" width="16" height="9" fill="#dcc79e" />
    <rect x="75" y="42" width="10" height="7" fill="#dcc79e" />
    <Shade x={84} y={42} w={7} h={32} opacity={0.08} />
    {[71.5, 78, 84.5].map((x) => (
      <rect key={x} x={x} y="63" width="4" height="8" rx="2" fill="#7a6545" />
    ))}
    {[74.5, 81.5].map((x) => (
      <rect key={x} x={x} y="51.5" width="3.5" height="5" rx="1.7" fill="#7a6545" />
    ))}
    <path d="M72 43 Q80 33 88 43 Z" fill="#9a5f36" />
    <path d="M16 72 Q14 50 22 36" stroke="#6b4a2b" strokeWidth="2" fill="none" />
    {[0, 1, 2, 3, 4, 5].map((k) => (
      <path key={k} d={`M${20 + k * 2.4} ${36 + k} Q${26 + k * 3} ${48} ${24 + k * 3} ${62 - k}`} stroke="#79b553" strokeWidth="1.6" fill="none" />
    ))}
    <path d="M112 74 Q130 61 148 74" stroke="#d94b3c" strokeWidth="2.6" fill="none" />
    {[118, 124, 130, 136, 142].map((x) => (
      <line key={x} x1={x} y1={x === 130 ? 67.5 : 70} x2={x} y2="74" stroke="#b73a2d" strokeWidth="0.8" />
    ))}
  </Scene>
);

const bangkok: Art = (p) => (
  <Scene {...p} sky={['#ffae7b', '#ffe8c2']} sun={{ x: 134, y: 28, r: 10, color: '#fff1c1' }}>
    <path d="M0 76 Q10 70 20 75 T40 74 T60 75 T80 73 T100 75 T120 73 T140 75 T160 73 V84 H0Z" fill="#5f8f4a" />
    <Prang x={34} base={82} scale={0.55} />
    <Prang x={126} base={82} scale={0.55} />
    <Prang x={80} base={82} scale={1} />
    <Water y={82} color="#e8996a" light="#ffd2a8" />
  </Scene>
);

const newdelhi: Art = (p) => (
  <Scene {...p} sky={['#8fcff0', '#f6f1d9']} clouds={[[28, 18, 0.9], [134, 24, 0.7]]}>
    <Ground y={82} color="#8cc56a" edge="#77b057" />
    <path d="M70 100 L76 82 H84 L90 100 Z" fill="#e5d3a8" />
    <Tree x={20} y={84} s={1.3} />
    <Tree x={140} y={84} s={1.3} />
    <rect x="58" y="32" width="44" height="52" fill="#e2a66c" />
    <Shade x={88} y={32} w={14} h={52} opacity={0.12} />
    <path d="M70 84 V58 A10 10 0 0 1 90 58 V84 Z" fill="#8e5a35" />
    <path d="M73 84 V59 A7 7 0 0 1 87 59 V84 Z" fill="#f2dfb8" opacity="0.35" />
    <rect x="60.5" y="60" width="6" height="14" rx="3" fill="#b77a46" />
    <rect x="93.5" y="60" width="6" height="14" rx="3" fill="#b77a46" />
    <rect x="62" y="37" width="36" height="6" fill="#c98a52" />
    <path d="M66 40 H94" stroke="#f3d9b0" strokeWidth="0.8" strokeDasharray="2 1.5" />
    <rect x="54" y="28" width="52" height="5" fill="#d59456" />
    <rect x="63" y="21" width="34" height="7" fill="#e2a66c" />
    <path d="M72 21 Q80 11 88 21 Z" fill="#d59456" />
  </Scene>
);

const taipei: Art = (p) => {
  const segments: ReactElement[] = [];
  for (let i = 0; i < 8; i++) {
    const y1 = 72 - i * 5.4;
    const y0 = y1 - 5.4;
    segments.push(
      <g key={i}>
        <polygon points={`73.5,${y1} 86.5,${y1} 88.5,${y0} 71.5,${y0}`} fill={i % 2 ? '#62b3a8' : '#57a79c'} />
        <polygon points={`80,${y1} 86.5,${y1} 88.5,${y0} 80,${y0}`} fill="#000" opacity="0.12" />
      </g>,
    );
  }
  return (
    <Scene {...p} sky={['#7fc4ee', '#d9f0ff']} clouds={[[30, 16, 0.9], [128, 22, 0.7]]}>
      <path d="M0 70 Q30 46 60 66 Q90 44 120 62 Q140 52 160 60 V100 H0Z" fill="#86bb8f" />
      <path d="M0 78 Q40 64 80 74 T160 70 V100 H0Z" fill="#6aa474" />
      {[
        [30, 68, 8, 16],
        [42, 72, 6, 12],
        [104, 70, 7, 14],
        [114, 66, 8, 18],
        [126, 72, 6, 12],
      ].map(([x, y, w, h]) => (
        <rect key={x} x={x} y={y} width={w} height={h} fill="#a9bccb" />
      ))}
      <polygon points="72,84 88,84 87,72 73,72" fill="#4f9b93" />
      {segments}
      <rect x="76" y="22.8" width="8" height="6" fill="#57a79c" />
      <rect x="78" y="18" width="4" height="4.8" fill="#4f9b93" />
      <line x1="80" y1="18" x2="80" y2="7" stroke="#5b6670" strokeWidth="1.2" />
      <Ground y={86} color="#5f9a6a" />
    </Scene>
  );
};

const singapore: Art = (p) => (
  <Scene {...p} sky={['#4c5cb6', '#f7aaa3']} clouds={[[24, 22, 0.7]]}>
    {[8, 18, 128, 140, 150].map((x, i) => (
      <rect key={x} x={x} y={62 - (i % 3) * 6} width="8" height="40" fill="#3d4378" />
    ))}
    {[50, 74, 98].map((x) => (
      <g key={x}>
        <rect x={x} y="42" width="12" height="38" fill="#e2e8f0" />
        <rect x={x + 8} y="42" width="4" height="38" fill="#b9c4d4" />
        {[46, 50, 54, 58, 62, 66, 70, 74].map((y) => (
          <line key={y} x1={x} y1={y} x2={x + 12} y2={y} stroke="#8e9bb3" strokeWidth="0.4" />
        ))}
      </g>
    ))}
    <path d="M44 40 L128 38 Q135 38 137 41 L44 43 Z" fill="#eef2f8" />
    <path d="M44 43 L137 41 L136 42.2 L44 44 Z" fill="#7e8aa3" />
    <Water y={80} color="#2c66a0" light="#6f9fd0" />
    {[56, 80, 104].map((x) => (
      <rect key={x} x={x} y="82" width="1.4" height="12" fill="#ffd27a" opacity="0.6" />
    ))}
  </Scene>
);

const beijing: Art = (p) => (
  <Scene {...p} sky={['#8ccaf0', '#eaf6ff']} clouds={[[26, 18, 0.9], [130, 14, 0.8]]}>
    <rect x="0" y="84" width="160" height="16" fill="#cfc5b3" />
    <Tree x={18} y={86} s={1.2} color="#4d8c4a" />
    <Tree x={142} y={86} s={1.2} color="#4d8c4a" />
    <rect x="40" y="80" width="80" height="5" fill="#f4f1ea" />
    <rect x="48" y="75" width="64" height="5" fill="#ece7dd" />
    <rect x="56" y="70" width="48" height="5" fill="#f4f1ea" />
    <rect x="62" y="60" width="36" height="10" fill="#c0392b" />
    <rect x="67" y="44" width="26" height="8" fill="#c0392b" />
    <rect x="71" y="35" width="18" height="7" fill="#c0392b" />
    <path d="M50 62 Q64 56 80 50 Q96 56 110 62 Z" fill="#2f60aa" />
    <path d="M56 51 Q68 46 80 41 Q92 46 104 51 Z" fill="#2f60aa" />
    <path d="M62 41 Q71 35 80 29 Q89 35 98 41 Z" fill="#2f60aa" />
    <path d="M80 50 Q96 56 110 62 L80 62 Z M80 41 Q92 46 104 51 L80 51 Z M80 29 Q89 35 98 41 L80 41 Z" fill="#000" opacity="0.12" />
    <path d="M50 62 H110 M56 51 H104 M62 41 H98" stroke="#e4b343" strokeWidth="0.9" />
    <circle cx="80" cy="27" r="2.3" fill="#f2c14e" />
  </Scene>
);

const rio: Art = (p) => (
  <Scene {...p} sky={['#6fc0ef', '#dff4ff']} sun={{ x: 28, y: 22, r: 8, color: '#ffe08a' }} clouds={[[70, 16, 0.8]]}>
    <Water y={74} color="#2f93c7" light="#79c5e8" />
    <path d="M40 79 C46 60 58 54 70 56 C80 58 86 68 90 79 Z" fill="#5f8f63" />
    <path d="M86 79 C88 44 104 26 116 28 C130 30 138 52 142 79 Z" fill="#6b7f73" />
    <path d="M100 36 C106 28 122 26 130 38 C120 34 108 36 100 42 Z" fill="#5a9a5a" />
    <path d="M86 79 C88 60 92 52 98 48 C96 60 100 70 104 79 Z" fill="#5a9a5a" opacity="0.8" />
    <line x1="64" y1="56" x2="116" y2="29" stroke="#3d3d3d" strokeWidth="0.5" />
    <rect x="88" y="42" width="5" height="3.6" rx="0.6" fill="#e74c3c" />
    <line x1="90.5" y1="42" x2="90.5" y2="40.6" stroke="#3d3d3d" strokeWidth="0.5" />
    <path d="M0 86 Q50 80 100 86 T160 84 V100 H0Z" fill="#f3dca6" />
    <path d="M30 76 L30 68 L36 75 Z" fill="#fff" />
    <path d="M27 76 H38 L36 78 H29 Z" fill="#8a5a3a" />
  </Scene>
);

const sydney: Art = (p) => (
  <Scene {...p} sky={['#7cc4f0', '#e3f5ff']} clouds={[[120, 16, 0.9]]}>
    <path d="M2 70 Q32 38 62 70" stroke="#6e7b86" strokeWidth="2.4" fill="none" />
    <path d="M8 66 Q32 45 56 66" stroke="#8a96a0" strokeWidth="0.8" fill="none" />
    <rect x="0" y="69" width="68" height="2" fill="#6e7b86" />
    <rect x="2" y="60" width="4" height="11" fill="#c9b99a" />
    <rect x="58" y="60" width="4" height="11" fill="#c9b99a" />
    <Water y={72} color="#2d7fb8" light="#76b6e0" />
    <polygon points="50,80 134,80 130,72 54,72" fill="#d9c3a1" />
    <path d="M54 76 H130" stroke="#bfa57f" strokeWidth="0.7" />
    {[
      'M100 72 Q104 58 118 52 Q114 62 118 72 Z',
      'M84 72 Q88 50 108 42 Q102 58 106 72 Z',
      'M70 72 Q74 46 94 36 Q88 54 92 72 Z',
      'M58 72 Q61 54 76 46 Q72 60 76 72 Z',
    ].map((d, i) => (
      <g key={i}>
        <path d={d} fill="#fbfbfb" />
        <path d={d} fill="none" stroke="#d6dde3" strokeWidth="0.7" />
      </g>
    ))}
    <path d="M94 36 Q88 54 92 72 L88 72 Q86 54 94 36 Z M108 42 Q102 58 106 72 L102 72 Q100 58 108 42 Z" fill="#dfe5ea" />
  </Scene>
);

const seoul: Art = (p) => (
  <Scene {...p} sky={['#8fd0f2', '#eef8ff']} clouds={[[26, 16, 0.9], [138, 20, 0.7]]}>
    <path d="M6 70 Q40 28 80 44 Q112 24 154 64 V100 H6Z" fill="#74ad7e" />
    <path d="M80 44 Q112 24 154 64 L150 70 Q120 40 82 52 Z" fill="#5f9a6c" />
    <rect x="0" y="82" width="160" height="18" fill="#dccdb0" />
    <rect x="34" y="72" width="92" height="10" fill="#c3b9a7" />
    <rect x="72" y="72" width="16" height="10" fill="#d6cdbc" />
    <path d="M72 75 H88 M72 78 H88" stroke="#b5aa96" strokeWidth="0.6" />
    <rect x="40" y="56" width="80" height="16" fill="#efe4cf" />
    {[40, 54, 68, 82, 96, 110].map((x) => (
      <rect key={x} x={x + 2} y="56" width="3" height="16" fill="#b8322a" />
    ))}
    {[46, 60, 74, 88, 102].map((x) => (
      <rect key={x} x={x + 2} y="58" width="9" height="12" fill="#5b8f74" opacity="0.85" />
    ))}
    <rect x="38" y="52" width="84" height="4" fill="#3a8f7a" />
    {[42, 50, 58, 66, 74, 82, 90, 98, 106, 114].map((x, i) => (
      <circle key={x} cx={x} cy="54" r="0.9" fill={['#e8644b', '#f2c14e', '#ffffff'][i % 3]} />
    ))}
    <path d="M24 55 Q36 52 44 45 L116 45 Q124 52 136 55 Q124 53 116 53 L44 53 Q36 53 24 55 Z" fill="#4a4f57" />
    <rect x="54" y="36" width="52" height="9" fill="#efe4cf" />
    <rect x="53" y="42" width="54" height="3" fill="#3a8f7a" />
    <path d="M38 38 Q50 35 58 28 L102 28 Q110 35 122 38 Q110 36 102 36 L58 36 Q50 36 38 38 Z" fill="#4a4f57" />
    <rect x="58" y="25.5" width="44" height="2.6" rx="1" fill="#383c43" />
  </Scene>
);

const moscow: Art = (p) => (
  <Scene {...p} sky={['#9bd2f5', '#f0f8ff']} clouds={[[24, 16, 0.8], [136, 22, 0.8]]}>
    <rect x="0" y="84" width="160" height="16" fill="#d7d0c4" />
    <path d="M0 90 H160 M0 95 H160" stroke="#c4bcae" strokeWidth="0.6" />
    <rect x="34" y="62" width="92" height="22" fill="#b5413a" />
    <path d="M34 66 H126 M34 76 H126" stroke="#f1e3d6" strokeWidth="1" />
    {[42, 54, 66, 94, 106, 118].map((x) => (
      <rect key={x} x={x} y="68" width="4" height="7" rx="2" fill="#7a2620" />
    ))}
    <rect x="74" y="36" width="12" height="26" fill="#c9554b" />
    <polygon points="73,36 87,36 80,13" fill="#d98b3a" />
    <path d="M76 30 L84 30 M77 24 L83 24" stroke="#f3d27a" strokeWidth="1" />
    <circle cx="80" cy="12" r="1.8" fill="#e0b341" />
    {[
      [52, 50, 7, '#c8402f', '#3f8f4f'],
      [64, 44, 6, '#3d6fb6', '#f4f4f4'],
      [96, 44, 6, '#e7b33b', '#3f8f4f'],
      [108, 50, 7, '#3f8f4f', '#c8402f'],
    ].map(([x, y, r, base, stripe]) => (
      <g key={x as number}>
        <rect x={(x as number) - (r as number) * 0.7} y={y as number} width={(r as number) * 1.4} height={62 - (y as number)} fill="#d46a54" />
        <Onion x={x as number} y={y as number} r={r as number} base={base as string} stripe={stripe as string} />
      </g>
    ))}
  </Scene>
);

const athens: Art = (p) => (
  <Scene {...p} sky={['#79c3f2', '#e6f6ff']} sun={{ x: 134, y: 20, r: 8, color: '#ffe08a' }}>
    <path d="M0 84 Q30 66 80 68 Q130 66 160 84 V100 H0Z" fill="#c8b28f" />
    <path d="M20 80 L34 76 M118 78 L132 82 M60 72 L70 74" stroke="#a8916c" strokeWidth="0.8" />
    <path d="M0 90 Q80 82 160 90 V100 H0Z" fill="#b39c78" />
    <Tree x={22} y={80} s={1.1} color="#7a9a5a" dark="#5f7f45" />
    <Tree x={140} y={80} s={1.1} color="#7a9a5a" dark="#5f7f45" />
    <rect x="40" y="66" width="80" height="3" fill="#e5dbc3" />
    <rect x="42" y="63" width="76" height="3" fill="#f1e8d4" />
    {[46, 55.4, 64.8, 74.2, 83.6, 93, 102.4, 111.8].map((x) => (
      <g key={x}>
        <rect x={x} y="42" width="4.4" height="21" fill="#f5eedd" />
        <rect x={x + 3} y="42" width="1.4" height="21" fill="#d6c9ad" />
      </g>
    ))}
    <rect x="42" y="37" width="76" height="5" fill="#eadfc6" />
    <path d="M42 39.5 H118" stroke="#d1c3a4" strokeWidth="0.6" strokeDasharray="1.6 1.2" />
    <polygon points="42,37 118,37 80,26" fill="#f0e6cf" />
    <polygon points="50,36 110,36 80,28.5" fill="#e2d5b8" />
  </Scene>
);

const rome: Art = (p) => {
  const arches: ReactElement[] = [];
  const rows: [number, number][] = [
    [45, 116],
    [57, 124],
    [69, 140],
  ];
  rows.forEach(([y, maxX]) => {
    for (let x = 32; x < 128; x += 8) {
      if (x >= maxX) continue;
      arches.push(<rect key={`${y}-${x}`} x={x} y={y} width="5" height="8" rx="2.5" fill="#7a5536" />);
    }
  });
  return (
    <Scene {...p} sky={['#86c9f2', '#f1f8ff']} clouds={[[24, 18, 0.9], [132, 14, 0.8]]}>
      <rect x="0" y="84" width="160" height="16" fill="#cdbd94" />
      <path d="M100 33 Q120 35 132 41 L132 60 L124 60 L124 52 L116 52 L116 44 L108 44 L108 36 L104 36 Z" fill="#b98e62" />
      <path d="M28 84 L28 41 Q60 32 100 33 L104 36 L108 36 L108 44 L116 44 L116 52 L124 52 L124 60 L132 60 L132 84 Z" fill="#dab48b" />
      {[32, 40, 48, 56, 64, 72, 80, 88].map((x) => (
        <rect key={x} x={x + 1} y="37" width="3" height="3" fill="#a77d55" />
      ))}
      <path d="M28 54 H116 M28 66 H124 M28 78 H132" stroke="#b98e62" strokeWidth="1" />
      {arches}
      <Tree x={10} y={86} s={1} />
      <Tree x={150} y={86} s={1} />
    </Scene>
  );
};

const barcelona: Art = (p) => (
  <Scene {...p} sky={['#8ccff2', '#f2f9ff']} clouds={[[24, 18, 0.9], [138, 26, 0.7]]}>
    <rect x="0" y="84" width="160" height="16" fill="#b8c5a2" />
    <rect x="44" y="60" width="72" height="24" fill="#c9a87e" />
    {[52, 66, 80, 94, 108].map((x) => (
      <path key={x} d={`M${x - 4} 84 V74 A4 4 0 0 1 ${x + 4} 74 V84 Z`} fill="#8a6a46" />
    ))}
    <Spire x={54} top={30} w={4} color="#c49e70" cap="#e8644b" />
    <Spire x={106} top={30} w={4} color="#c49e70" cap="#e8644b" />
    <Spire x={64} top={21} w={4.5} color="#c8a274" cap="#f2c14e" />
    <Spire x={96} top={21} w={4.5} color="#c8a274" cap="#f2c14e" />
    <Spire x={80} top={9} w={5} color="#e3d3b8" cap="#ffffff" />
    <Tree x={16} y={86} s={1.2} />
    <Tree x={144} y={86} s={1.2} />
  </Scene>
);

const berlin: Art = (p) => (
  <Scene {...p} sky={['#8fcdf2', '#eef7ff']} clouds={[[26, 16, 0.9], [134, 20, 0.8]]}>
    <rect x="0" y="82" width="160" height="18" fill="#d2cbbd" />
    <Tree x={14} y={84} s={1.3} />
    <Tree x={146} y={84} s={1.3} />
    {[38, 54, 70, 86, 102, 118].map((x) => (
      <g key={x}>
        <rect x={x} y="46" width="5" height="36" fill="#e9d6ad" />
        <rect x={x + 3.4} y="46" width="1.6" height="36" fill="#cdb98d" />
      </g>
    ))}
    <rect x="34" y="40" width="94" height="6" fill="#e3cea1" />
    <path d="M36 43 H126" stroke="#cdb98d" strokeWidth="0.7" strokeDasharray="2 2" />
    <rect x="50" y="32" width="62" height="8" fill="#e9d6ad" />
    <rect x="46" y="36" width="70" height="4" fill="#dcc694" />
    <path d="M66 32 L66 28 Q70 22 74 26 L76 22 Q80 18 84 22 L86 26 Q90 22 94 28 L94 32 Z" fill="#5f8f78" />
    <line x1="80" y1="22" x2="80" y2="12" stroke="#5f8f78" strokeWidth="1" />
    <circle cx="80" cy="11" r="1.8" fill="none" stroke="#5f8f78" strokeWidth="0.8" />
  </Scene>
);

const amsterdam: Art = (p) => {
  return (
    <Scene {...p} sky={['#8fc8ee', '#eef7ff']} clouds={[[22, 14, 0.9], [138, 18, 0.8]]}>
      <CanalHouse x={28} w={20} top={36} color="#b5523b" trim="#f4efe6" gable="step" />
      <CanalHouse x={48} w={18} top={30} color="#2f5d50" trim="#f4efe6" gable="bell" />
      <CanalHouse x={66} w={20} top={38} color="#e3b35a" trim="#ffffff" gable="point" />
      <CanalHouse x={86} w={18} top={32} color="#3b4f7a" trim="#f4efe6" gable="step" />
      <CanalHouse x={104} w={22} top={36} color="#f2ece0" trim="#3d3d3d" gable="bell" />
      <rect x="0" y="72" width="160" height="3" fill="#6b5a4a" />
      <Water y={75} color="#4a8fb5" light="#89c0dd" />
      <g opacity="0.22" transform="translate(0 150) scale(1 -1)">
        <rect x="28" y="44" width="98" height="30" fill="#7a5a4a" />
      </g>
      <path d="M60 86 H82 L79 90 H63 Z" fill="#8a5a3a" />
      <Tree x={12} y={74} s={1.2} />
      <Tree x={146} y={74} s={1.2} />
    </Scene>
  );
};

const london: Art = (p) => (
  <Scene {...p} sky={['#9ccff0', '#eef6fb']} clouds={[[30, 16, 1], [134, 12, 0.8]]}>
    <rect x="10" y="58" width="62" height="26" fill="#d9ba7d" />
    {[14, 22, 30, 38, 46, 54, 62].map((x) => (
      <rect key={x} x={x} y="62" width="2.5" height="18" fill="#bf9b5c" />
    ))}
    {[12, 40, 68].map((x) => (
      <polygon key={x} points={`${x},58 ${x + 4},58 ${x + 2},50`} fill="#bf9b5c" />
    ))}
    <rect x="82" y="30" width="16" height="54" fill="#ddbb78" />
    <rect x="93" y="30" width="5" height="54" fill="#c49f5c" />
    {[85, 89].map((x) => (
      <line key={x} x1={x} y1="50" x2={x} y2="84" stroke="#c49f5c" strokeWidth="0.6" />
    ))}
    <rect x="80" y="30" width="20" height="18" fill="#e6c789" />
    <circle cx="90" cy="39" r="6.5" fill="#fdf8ea" stroke="#3a3a3a" strokeWidth="0.8" />
    <line x1="90" y1="39" x2="90" y2="34.5" stroke="#222" strokeWidth="0.8" />
    <line x1="90" y1="39" x2="93.2" y2="40.5" stroke="#222" strokeWidth="0.8" />
    <rect x="82" y="24" width="16" height="6" fill="#d1ad6a" />
    {[84.5, 89, 93.5].map((x) => (
      <rect key={x} x={x} y="25" width="2" height="4" rx="1" fill="#8a6a3a" />
    ))}
    <polygon points="81,24 99,24 90,6" fill="#4b5563" />
    <circle cx="90" cy="5.5" r="1.2" fill="#e0b341" />
    <rect x="0" y="84" width="160" height="16" fill="#9aa3ab" />
    <path d="M0 92 H160" stroke="#f5f5f5" strokeWidth="0.8" strokeDasharray="6 5" />
    <g transform="translate(114 72)">
      <rect width="32" height="13" rx="2" fill="#d7263d" />
      <rect x="2" y="2" width="28" height="3.4" fill="#ffe9c9" />
      <rect x="2" y="7.4" width="28" height="3" fill="#ffe9c9" />
      <circle cx="7" cy="13.5" r="2.2" fill="#2b2b2b" />
      <circle cx="25" cy="13.5" r="2.2" fill="#2b2b2b" />
    </g>
  </Scene>
);

const paris: Art = (p) => (
  <Scene {...p} sky={['#a6d8f5', '#fde7d6']} clouds={[[28, 18, 1], [132, 24, 0.8]]}>
    <Ground y={84} color="#b8d48f" edge="#a3c477" />
    <path d="M66 100 L74 84 H86 L94 100 Z" fill="#e6d8b4" />
    {[8, 22, 36, 124, 138, 152].map((x) => (
      <circle key={x} cx={x} cy="82" r="6" fill="#6aa356" />
    ))}
    <path d="M56 84 Q68 72 72 58 L76 30 L78.5 14 L80 6 L81.5 14 L84 30 L88 58 Q92 72 104 84 L95 84 Q88 72 80 70 Q72 72 65 84 Z" fill="#7b5b3e" />
    <path d="M80 6 L81.5 14 L84 30 L88 58 Q92 72 104 84 L95 84 Q88 72 80 70 Z" fill="#000" opacity="0.12" />
    <path d="M70 74 L90 62 M90 74 L70 62 M74 52 L86 40 M86 52 L74 40 M76.5 34 L83.5 22 M83.5 34 L76.5 22" stroke="#a88160" strokeWidth="0.6" />
    <rect x="68" y="56" width="24" height="3" fill="#5e4530" />
    <rect x="74" y="29" width="12" height="2.4" fill="#5e4530" />
    <line x1="80" y1="6" x2="80" y2="2" stroke="#5e4530" strokeWidth="0.8" />
  </Scene>
);

const dubai: Art = (p) => {
  const layers: [number, number, number, number][] = [
    [84, 64, 12, 10],
    [64, 46, 9, 7],
    [46, 30, 6, 4.5],
    [30, 18, 3.5, 2.5],
    [18, 8, 1.7, 0.8],
  ];
  return (
    <Scene {...p} sky={['#7ec4ee', '#fbe9cc']} sun={{ x: 130, y: 22, r: 8, color: '#ffe08a' }}>
      {[
        [22, 62, 8],
        [32, 56, 7],
        [44, 66, 9],
        [104, 60, 8],
        [114, 52, 7],
        [126, 64, 9],
        [138, 58, 7],
      ].map(([x, y, w]) => (
        <rect key={x} x={x} y={y} width={w} height={84 - y} fill={x % 2 ? '#9fb6c9' : '#8ea5ba'} />
      ))}
      {layers.map(([y1, y0, b, t]) => (
        <g key={y1}>
          <polygon points={`${80 - b},${y1} ${80 + b},${y1} ${80 + t},${y0} ${80 - t},${y0}`} fill="#cddbe7" />
          <polygon points={`80,${y1} ${80 + b},${y1} ${80 + t},${y0} 80,${y0}`} fill="#9fb5c8" />
        </g>
      ))}
      <line x1="80" y1="8" x2="80" y2="1" stroke="#9fb5c8" strokeWidth="0.8" />
      <path d="M0 85 Q40 81 80 85 T160 84 V100 H0Z" fill="#edcf94" />
      <Palm x={14} y={90} s={0.8} />
      <Palm x={148} y={90} s={0.8} />
    </Scene>
  );
};

function TokyoTower() {
  const clip = useArtId('tokyo-tower');
  const tower = 'M60 84 Q70 70 74 56 L77 30 L79 12 L80 4 L81 12 L83 30 L86 56 Q90 70 100 84 L93 84 Q86 74 80 72 Q74 74 67 84 Z';
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={tower} />
        </clipPath>
      </defs>
      <path d={tower} fill="#e8452c" />
      <g clipPath={`url(#${clip})`}>
        {[20, 40, 62, 76].map((y) => (
          <rect key={y} x="50" y={y} width="60" height="4" fill="#fff" />
        ))}
        <rect x="80" y="0" width="30" height="90" fill="#000" opacity="0.1" />
      </g>
      <rect x="71" y="52" width="18" height="5" fill="#fff" stroke="#e8452c" strokeWidth="0.8" />
      <rect x="75" y="28" width="10" height="3" fill="#fff" stroke="#e8452c" strokeWidth="0.6" />
    </g>
  );
}

const tokyo: Art = (p) => {
  return (
    <Scene {...p} sky={['#8fd3f5', '#fde9ef']} clouds={[[130, 16, 0.8]]}>
      <path d="M6 78 Q30 46 44 38 L52 38 Q66 46 92 78 Z" fill="#7092c9" />
      <path d="M38 44 L44 38 L52 38 L58 44 L54 47 L50 43.5 L47 47.5 L43 44 Z" fill="#fff" />
      {[96, 106, 116, 130, 140].map((x, i) => (
        <rect key={x} x={x} y={68 - (i % 3) * 5} width="8" height="20" fill="#b3c0cc" />
      ))}
      <TokyoTower />
      <Ground y={85} color="#9cc985" />
      {[
        [140, 80],
        [152, 82],
        [12, 82],
      ].map(([x, y]) => (
        <g key={x}>
          <rect x={x - 0.9} y={y} width="1.8" height="6" fill="#7a5233" />
          <circle cx={x} cy={y - 2} r="5" fill="#f7b6c8" />
          <circle cx={x + 2} cy={y - 1} r="3" fill="#f39bb3" />
        </g>
      ))}
    </Scene>
  );
};

const newyork: Art = (p) => (
  <Scene {...p} sky={['#8ccdf2', '#eef8ff']} clouds={[[24, 16, 0.9]]}>
    {[
      [110, 58, 6],
      [117, 50, 7],
      [125, 44, 5],
      [131, 54, 8],
      [140, 60, 6],
      [147, 52, 7],
    ].map(([x, y, w]) => (
      <rect key={x} x={x} y={y} width={w} height={80 - y} fill="#a9bccb" />
    ))}
    <polygon points="126.5,44 128.5,44 127.5,36" fill="#a9bccb" />
    <Water y={80} color="#3d8fc0" light="#7fc0e3" />
    <polygon points="60,82 100,82 96,76 64,76" fill="#a89a7c" />
    <rect x="70" y="60" width="20" height="16" fill="#d6c7a3" />
    <rect x="68" y="58" width="24" height="3" fill="#c9b994" />
    <Shade x={84} y={58} w={8} h={18} opacity={0.12} />
    <path d="M73 58 Q74 44 76 36 L84 36 Q86 44 87 58 Z" fill="#6ab49b" />
    <path d="M80 36 L84 36 Q86 44 87 58 L80 58 Z" fill="#000" opacity="0.12" />
    <polygon points="82.5,37 85,37 89.5,19 87.5,18.5" fill="#6ab49b" />
    <rect x="86.8" y="14" width="3.2" height="5" fill="#5aa38a" />
    <path d="M88.4 14 Q86.4 11 88.4 8 Q90.4 11 88.4 14 Z" fill="#f6c244" />
    <circle cx="80" cy="32" r="3.4" fill="#6ab49b" />
    {[-60, -30, 0, 30, 60].map((a) => (
      <polygon key={a} points="79.4,28.8 80.6,28.8 80,25.6" fill="#6ab49b" transform={`rotate(${a} 80 32)`} />
    ))}
    <polygon points="73,44 76,42 77,49 74,50" fill="#4f9680" />
    <Cloud x={140} y={24} s={0.6} />
  </Scene>
);

export const CITY_ART: Record<string, Art> = {
  cairo,
  istanbul,
  hanoi,
  bangkok,
  newdelhi,
  taipei,
  singapore,
  beijing,
  rio,
  sydney,
  seoul,
  moscow,
  athens,
  rome,
  barcelona,
  berlin,
  amsterdam,
  london,
  paris,
  dubai,
  tokyo,
  newyork,
};

export function CityArt({ id, className, title }: { id: string; className?: string; title?: string }) {
  const Art = CITY_ART[id];
  return Art ? <Art className={className} title={title} /> : null;
}
