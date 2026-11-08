import type { ComponentType } from 'react';
import { RaceApp } from './race/RaceApp';

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
];
