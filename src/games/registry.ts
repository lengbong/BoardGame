import type { ComponentType } from 'react';
import { LastCardApp } from './lastcard/LastCardApp';
import { RaceApp } from './race/RaceApp';
import { TilesApp } from './tiles/TilesApp';
import { WorldApp } from './world/WorldApp';

export interface GameEntry {
  id: string;
  title: string;
  description: string;
  players: string;
  playTime: string;
  /** 카드에 보여줄 그림 (이모지) */
  icon: string;
  component: ComponentType<{ onExit: () => void }>;
}

/** 새 게임을 만들면 여기에 추가한다. */
export const GAMES: GameEntry[] = [
  {
    id: 'race',
    title: '말판 경주',
    description: '주사위를 굴려 말 4개를 먼저 골인시키는 가족 경주 게임. 상대 말을 잡아 대기실로 돌려보낼 수 있어요!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '20~40분',
    icon: '🎲',
    component: RaceApp,
  },
  {
    id: 'world',
    title: '지구 한 바퀴',
    description: '세계 22개 도시를 여행하며 땅을 사고 건물을 지어요. 내 도시에 온 사람에게 통행료를 받는 부자 되기 게임!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '30~60분',
    icon: '🌏',
    component: WorldApp,
  },
  {
    id: 'lastcard',
    title: '한 장 남았다!',
    description: '같은 색이나 같은 숫자 카드를 내려놓아 손에 든 카드를 먼저 다 내면 이겨요. 한 장 남으면 "한 장!"을 외치세요!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '10~30분',
    icon: '🃏',
    component: LastCardApp,
  },
  {
    id: 'tiles',
    title: '숫자 타일 줄세우기',
    description: '같은 색 연속 숫자나 같은 숫자 다른 색으로 줄을 만들어요. 판의 타일을 뜯어 다시 조합하며 내 타일을 먼저 다 내면 이겨요!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '20~40분',
    icon: '🔢',
    component: TilesApp,
  },
];
