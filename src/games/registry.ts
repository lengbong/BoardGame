import type { ComponentType, ReactNode } from 'react';
import { createElement } from 'react';
import { BaseballApp } from './baseball/BaseballApp';
import { BoxesApp } from './boxes/BoxesApp';
import { CheatApp } from './cheat/CheatApp';
import { DominoApp } from './domino/DominoApp';
import { DominoIcon } from './domino/DominoIcon';
import { FourLineApp } from './fourline/FourLineApp';
import { GardenApp } from './garden/GardenApp';
import { IslandApp } from './island/IslandApp';
import { LastCardApp } from './lastcard/LastCardApp';
import { MalangIcon } from './malang/JellyArt';
import { MalangApp } from './malang/MalangApp';
import { MancalaApp } from './mancala/MancalaApp';
import { MancalaIcon } from './mancala/MancalaIcon';
import { MemoryApp } from './memory/MemoryApp';
import { OldMaidApp } from './oldmaid/OldMaidApp';
import { OmokApp } from './omok/OmokApp';
import { OmokIcon } from './omok/StoneArt';
import { RailsApp } from './rails/RailsApp';
import { RaceApp } from './race/RaceApp';
import { ReversiApp } from './reversi/ReversiApp';
import { ReversiIcon } from './reversi/ReversiIcon';
import { SevensApp } from './sevens/SevensApp';
import { ShipsApp } from './ships/ShipsApp';
import { SudokuApp } from './sudoku/SudokuApp';
import { TilesApp } from './tiles/TilesApp';
import { VillageApp } from './village/VillageApp';
import { WorldApp } from './world/WorldApp';

export type GameCategory = 'board' | 'strategy' | 'cards' | 'duel' | 'action' | 'paper' | 'puzzle';

/** 처음 화면에서 게임을 묶어 보여 주는 순서와 제목 */
export const CATEGORIES: { id: GameCategory; title: string }[] = [
  { id: 'board', title: '🎲 말판·주사위' },
  { id: 'strategy', title: '🏆 전략 보드게임' },
  { id: 'cards', title: '🃏 카드·타일' },
  { id: 'duel', title: '♟️ 둘이서 수 싸움' },
  { id: 'action', title: '🕹️ 실시간 퍼즐' },
  { id: 'paper', title: '✏️ 종이·연필 놀이' },
  { id: 'puzzle', title: '🧩 혼자 푸는 퍼즐' },
];

export interface GameEntry {
  id: string;
  title: string;
  description: string;
  players: string;
  playTime: string;
  category: GameCategory;
  /** 카드에 보여줄 그림 (이모지, 또는 이모지가 없는 게임은 직접 그린 SVG) */
  icon: ReactNode;
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
    category: 'board',
    icon: '🎲',
    component: RaceApp,
  },
  {
    id: 'world',
    title: '지구 한 바퀴',
    description: '세계 22개 도시를 여행하며 땅을 사고 건물을 지어요. 내 도시에 온 사람에게 통행료를 받는 부자 되기 게임!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '30~60분',
    category: 'board',
    icon: '🌏',
    component: WorldApp,
  },
  {
    id: 'garden',
    title: '꽃밭 가꾸기',
    description: '텃밭에서 물·햇빛·씨앗·거름을 거두어 꽃시장에서 식물을 사 심어요. 심은 식물이 다음 식물을 싸게 해 주는 정원 키우기 게임!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '20~40분',
    category: 'strategy',
    icon: '🌷',
    component: GardenApp,
  },
  {
    id: 'rails',
    title: '기차로 전국 일주',
    description: '기차표를 모아 우리나라 도시 사이에 기찻길을 깔아요. 비밀 여행 계획을 이루고 관광 도장을 모으면 점수!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '30~50분',
    category: 'strategy',
    icon: '🚂',
    component: RailsApp,
  },
  {
    id: 'village',
    title: '우리 마을 지도',
    description: '길·냇물·논이 그려진 땅 조각을 이어 붙여 마을 지도를 만들어요. 깃발을 꽂은 길과 논이 완성되면 점수!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '20~40분',
    category: 'strategy',
    icon: '🗺️',
    component: VillageApp,
  },
  {
    id: 'island',
    title: '섬마을 개척',
    description: '주사위 두 개 중 쓸 눈을 골라 섬의 숲·돌산·밭·어장에서 자원을 얻고, 길과 집, 마을회관, 등대를 지어요. 먼저 10점을 모으면 승리!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '30~50분',
    category: 'strategy',
    icon: '🏝️',
    component: IslandApp,
  },
  {
    id: 'lastcard',
    title: '한 장 남았다!',
    description: '같은 색이나 같은 숫자 카드를 내려놓아 손에 든 카드를 먼저 다 내면 이겨요. 한 장 남으면 "한 장!"을 외치세요!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '10~30분',
    category: 'cards',
    icon: '🃏',
    component: LastCardApp,
  },
  {
    id: 'tiles',
    title: '숫자 타일 줄세우기',
    description: '같은 색 연속 숫자나 같은 숫자 다른 색으로 줄을 만들어요. 판의 타일을 뜯어 다시 조합하며 내 타일을 먼저 다 내면 이겨요!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '20~40분',
    category: 'cards',
    icon: '🔢',
    component: TilesApp,
  },
  {
    id: 'memory',
    title: '짝 맞추기',
    description: '뒤집힌 그림 카드를 두 장씩 뒤집어 같은 그림을 찾아요. 짝을 맞히면 한 번 더! 기억력 좋은 사람이 이겨요.',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '5~15분',
    category: 'cards',
    icon: '🧠',
    component: MemoryApp,
  },
  {
    id: 'oldmaid',
    title: '도둑잡기',
    description: '옆 사람 카드를 한 장씩 뽑아 같은 숫자 두 장을 버려요. 마지막까지 도둑(조커)을 들고 있는 사람이 져요!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '5~15분',
    category: 'cards',
    icon: '🤡',
    component: OldMaidApp,
  },
  {
    id: 'sevens',
    title: '칠 이어놓기',
    description: '7을 가운데 놓고 같은 무늬로 위아래 숫자를 이어 내요. 낼 카드가 없으면 통과! 손에 든 카드를 먼저 다 내면 이겨요.',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '10~20분',
    category: 'cards',
    icon: '7️⃣',
    component: SevensApp,
  },
  {
    id: 'domino',
    title: '도미노',
    description: '끝 숫자가 같은 도미노 패를 이어 붙여요. 내 패를 먼저 다 내면 이기고, 다른 사람 손에 남은 점이 내 점수가 돼요!',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '10~30분',
    category: 'cards',
    icon: createElement(DominoIcon),
    component: DominoApp,
  },
  {
    id: 'cheat',
    title: '거짓말쟁이',
    description: 'A, 2, 3… 순서대로 그 숫자라고 말하며 카드를 뒷면으로 내요. 없으면 시치미 뚝! 거짓말 같으면 "거짓말이야!"를 외쳐요.',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '10~25분',
    category: 'cards',
    icon: '🤥',
    component: CheatApp,
  },
  {
    id: 'reversi',
    title: '뒤집기',
    description: '상대 돌을 내 돌 사이에 끼우면 내 색으로 뒤집혀요. 판이 다 찼을 때 돌이 많은 쪽이 이겨요!',
    players: '2명 (컴퓨터 상대 가능)',
    playTime: '10~20분',
    category: 'duel',
    icon: createElement(ReversiIcon),
    component: ReversiApp,
  },
  {
    id: 'fourline',
    title: '사목',
    description: '세워진 판에 돌을 떨어뜨려 가로·세로·대각선으로 4개를 먼저 이으면 이겨요!',
    players: '2명 (컴퓨터 상대 가능)',
    playTime: '5~15분',
    category: 'duel',
    icon: '🔴',
    component: FourLineApp,
  },
  {
    id: 'mancala',
    title: '만칼라',
    description: '구멍의 씨앗을 한 알씩 뿌려 내 창고에 더 많이 모아요. 창고에서 끝나면 한 번 더, 빈 구멍에서 끝나면 건너편 씨앗을 가져와요!',
    players: '2명 (컴퓨터 상대 가능)',
    playTime: '10~20분',
    category: 'duel',
    icon: createElement(MancalaIcon),
    component: MancalaApp,
  },
  {
    id: 'omok',
    title: '오목',
    description: '흑과 백이 번갈아 바둑판에 돌을 놓아 가로·세로·대각선으로 다섯 개를 먼저 이으면 이겨요. 쌍삼 금지·렌주 규칙도 골라요!',
    players: '2명 (컴퓨터 상대 가능)',
    playTime: '5~20분',
    category: 'duel',
    icon: createElement(OmokIcon),
    component: OmokApp,
  },
  {
    id: 'malang',
    title: '말랑 팡팡',
    description: '두 개씩 떨어지는 젤리를 돌려서 같은 색 4개를 이으면 팡! 연쇄로 상대에게 방해 젤리를 보내요. 둘이서 한 키보드로도 해요.',
    players: '1~2명 (컴퓨터 상대 가능)',
    playTime: '3~10분',
    category: 'action',
    icon: createElement(MalangIcon),
    component: MalangApp,
  },
  {
    id: 'boxes',
    title: '점과 상자',
    description: '점 사이에 선을 하나씩 그어요. 네 번째 선을 그어 상자를 완성하면 내 것이 되고 한 번 더! 상자가 많은 사람이 이겨요.',
    players: '2~4명 (컴퓨터 참가 가능)',
    playTime: '5~20분',
    category: 'paper',
    icon: '✏️',
    component: BoxesApp,
  },
  {
    id: 'ships',
    title: '배 찾기',
    description: '바다에 배를 숨기고 번갈아 좌표를 불러 상대 배를 찾아요. 상대 배를 먼저 모두 가라앉히면 이겨요!',
    players: '2명 (컴퓨터 상대 가능)',
    playTime: '15~30분',
    category: 'paper',
    icon: '🚢',
    component: ShipsApp,
  },
  {
    id: 'baseball',
    title: '숫자야구',
    description: '숨긴 숫자를 스트라이크·볼 힌트로 추리해서 맞혀요. 숫자와 자리가 맞으면 스트라이크! 혼자 기록에 도전할 수도 있어요.',
    players: '1~2명 (컴퓨터 상대 가능)',
    playTime: '5~15분',
    category: 'paper',
    icon: '⚾',
    component: BaseballApp,
  },
  {
    id: 'sudoku',
    title: '스도쿠',
    description: '가로줄·세로줄·3×3 칸마다 1~9를 겹치지 않게 채우는 숫자 퍼즐. 화면에서 풀거나 문제지를 인쇄해서 풀어요!',
    players: '1명 (같이 풀어도 좋아요)',
    playTime: '10~40분',
    category: 'puzzle',
    icon: '📝',
    component: SudokuApp,
  },
];
