import type { CardId } from './types';

export interface CardInfo {
  id: CardId;
  emoji: string;
  title: string;
  text: string;
}

export const CARDS: Record<CardId, CardInfo> = {
  lottery: { id: 'lottery', emoji: '🎟️', title: '복권 당첨!', text: '여행 중에 산 복권이 당첨됐어요. 150코인을 받아요.' },
  photo: { id: 'photo', emoji: '📸', title: '사진 공모전 1등', text: '여행 사진이 공모전에서 1등! 상금 100코인을 받아요.' },
  birthday: { id: 'birthday', emoji: '🎂', title: '생일 축하해요', text: '모든 플레이어에게 축하금 30코인씩 받아요.' },
  refund: { id: 'refund', emoji: '💸', title: '세금 환급', text: '면세점 세금을 돌려받아요. 50코인을 받아요.' },
  speeding: { id: 'speeding', emoji: '🚗', title: '렌터카 과속 벌금', text: '과속 딱지를 받았어요. 60코인을 내요.' },
  hospital: { id: 'hospital', emoji: '🏥', title: '배탈이 났어요', text: '병원비 100코인을 내요.' },
  souvenir: { id: 'souvenir', emoji: '🎁', title: '기념품 선물', text: '모든 플레이어에게 기념품 값 20코인씩 줘요.' },
  repair: { id: 'repair', emoji: '🔧', title: '건물 수리', text: '내 건물 1단계마다 수리비 25코인을 내요.' },
  'go-start': { id: 'go-start', emoji: '🏁', title: '집에 다녀와요', text: '출발 칸으로 바로 가서 월급을 받아요.' },
  'go-plane': { id: 'go-plane', emoji: '✈️', title: '공항으로 가요', text: '비행기 칸으로 가서 원하는 곳으로 날아가요.' },
  'go-stuck': { id: 'go-stuck', emoji: '🛂', title: '여권을 잃어버렸어요', text: '여권 분실 칸으로 가요. 출발 칸을 지나도 월급은 없어요.' },
  back3: { id: 'back3', emoji: '↩️', title: '길을 잘못 들었어요', text: '뒤로 3칸 가요.' },
  'next-city': { id: 'next-city', emoji: '🚄', title: '고속열차 탑승', text: '바로 앞의 도시까지 열차를 타고 가요.' },
  escape: { id: 'escape', emoji: '📘', title: '여권 재발급 카드', text: '가지고 있다가 여권 분실 칸에 갇히면 바로 나올 수 있어요.' },
  'free-pass': { id: 'free-pass', emoji: '🎫', title: '무료 통행권', text: '가지고 있다가 통행료를 한 번 안 내도 돼요.' },
  festival: { id: 'festival', emoji: '🎉', title: '축제 개최권', text: '내 도시 하나를 골라 축제를 열어요. 그 도시 통행료가 2배!' },
};

export const CARD_IDS = Object.keys(CARDS) as CardId[];
