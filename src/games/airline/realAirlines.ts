import type { RegionId } from './types';

/**
 * 실제 항공사 (값은 모두 근삿값).
 * 이름이 바뀌거나 합쳐진 회사는 이름마다 따로 적는다 (예: BOAC → 영국항공, 스위스에어 → 스위스국제항공).
 * 색은 비행기 칠을 어림한 두 가지 색일 뿐, 로고는 쓰지 않는다.
 */
export interface RealAirline {
  id: string;
  /** 우리말 이름 */
  name: string;
  nameEn: string;
  /** IATA 두 글자 부호 (지금 쓰는 부호) */
  iata: string;
  /** 이 이름으로 날기 시작한 해 */
  founded: number;
  /** 이 이름으로 더는 날지 않게 된 해 (없어지거나 합쳐지거나 이름이 바뀐 해). 이 해부터는 빠진다 */
  defunct?: number;
  /** 본거지 도시 id (cities.ts). 실제 본거지가 목록에 없으면 가까운 도시로 하고 note에 적는다 */
  hub: string;
  region: RegionId;
  /** 비행기 칠 색 [주된 색, 곁들인 색] (#rrggbb) */
  colors: [string, string];
  note?: string;
}

export const REAL_AIRLINES: readonly RealAirline[] = [
  // ---------------------------------------------------------------- 동아시아
  {
    id: 'korean', name: '대한항공', nameEn: 'Korean Air', iata: 'KE', founded: 1969, hub: 'seoul', region: 'eastasia',
    colors: ['#6cace4', '#003876'], note: '1962~1969년에는 나라가 운영한 대한항공공사',
  },
  {
    id: 'asiana', name: '아시아나항공', nameEn: 'Asiana Airlines', iata: 'OZ', founded: 1988, hub: 'seoul', region: 'eastasia',
    colors: ['#a2aab0', '#c8102e'], note: '2024년 대한항공의 자회사가 됐어요 (두 회사를 합칠 계획이 있어요)',
  },
  { id: 'jal', name: '일본항공', nameEn: 'Japan Airlines', iata: 'JL', founded: 1951, hub: 'tokyo', region: 'eastasia', colors: ['#e60012', '#222222'] },
  {
    id: 'ana', name: '전일본공수', nameEn: 'All Nippon Airways', iata: 'NH', founded: 1957, hub: 'tokyo', region: 'eastasia',
    colors: ['#13448f', '#4fa3dc'], note: '1952년 일본헬리콥터수송으로 시작해 1957년 지금 이름으로',
  },
  { id: 'cathay', name: '캐세이퍼시픽', nameEn: 'Cathay Pacific', iata: 'CX', founded: 1946, hub: 'hongkong', region: 'eastasia', colors: ['#006564', '#b1b3b3'] },
  { id: 'chinaairlines', name: '중화항공', nameEn: 'China Airlines', iata: 'CI', founded: 1959, hub: 'taipei', region: 'eastasia', colors: ['#c8326e', '#1f3a7a'] },
  {
    id: 'airchina', name: '중국국제항공', nameEn: 'Air China', iata: 'CA', founded: 1988, hub: 'beijing', region: 'eastasia',
    colors: ['#d7141a', '#8a8d8f'], note: '1988년 중국민항(CAAC)에서 나뉘어 나옴',
  },
  {
    id: 'chinaeastern', name: '중국동방항공', nameEn: 'China Eastern Airlines', iata: 'MU', founded: 1988, hub: 'shanghai', region: 'eastasia',
    colors: ['#1b2f6e', '#c8102e'], note: '1988년 중국민항(CAAC)에서 나뉘어 나옴',
  },

  // ---------------------------------------------------------------- 동남아·오세아니아
  {
    id: 'singapore', name: '싱가포르항공', nameEn: 'Singapore Airlines', iata: 'SQ', founded: 1972, hub: 'singapore', region: 'seaoc',
    colors: ['#00266b', '#f2a900'], note: '1972년 말레이시아·싱가포르항공(MSA)이 둘로 나뉘며 시작',
  },
  { id: 'thai', name: '타이항공', nameEn: 'Thai Airways', iata: 'TG', founded: 1960, hub: 'bangkok', region: 'seaoc', colors: ['#5b2c83', '#c9a227'] },
  {
    id: 'malaysia', name: '말레이시아항공', nameEn: 'Malaysia Airlines', iata: 'MH', founded: 1972, hub: 'kualalumpur', region: 'seaoc',
    colors: ['#0a2d6e', '#d71920'], note: '1972년 말레이시아·싱가포르항공(MSA)이 둘로 나뉘며 시작',
  },
  { id: 'garuda', name: '가루다인도네시아', nameEn: 'Garuda Indonesia', iata: 'GA', founded: 1949, hub: 'jakarta', region: 'seaoc', colors: ['#0b4f8a', '#20b2c4'] },
  { id: 'philippine', name: '필리핀항공', nameEn: 'Philippine Airlines', iata: 'PR', founded: 1941, hub: 'manila', region: 'seaoc', colors: ['#0038a8', '#ce1126'] },
  {
    id: 'vietnam', name: '베트남항공', nameEn: 'Vietnam Airlines', iata: 'VN', founded: 1993, hub: 'hochiminh', region: 'seaoc',
    colors: ['#00677f', '#d4a72c'], note: '1956년부터 이어 온 나라 항공이 1993년 베트남항공으로. 하노이(목록에 없음)와 호찌민 두 곳이 거점',
  },
  { id: 'qantas', name: '콴타스', nameEn: 'Qantas', iata: 'QF', founded: 1920, hub: 'sydney', region: 'seaoc', colors: ['#e40000', '#ffffff'] },
  {
    id: 'airnewzealand', name: '에어뉴질랜드', nameEn: 'Air New Zealand', iata: 'NZ', founded: 1965, hub: 'auckland', region: 'seaoc',
    colors: ['#111111', '#00b2a9'], note: '1940년 TEAL(태즈먼 제국 항공)로 시작해 1965년 지금 이름으로',
  },
  {
    id: 'hawaiian', name: '하와이안항공', nameEn: 'Hawaiian Airlines', iata: 'HA', founded: 1941, hub: 'honolulu', region: 'seaoc',
    colors: ['#5a2d82', '#e0457b'], note: '1929년 인터아일랜드 항공으로 시작. 2024년 알래스카항공과 한 회사가 됨',
  },

  // ---------------------------------------------------------------- 남아시아·중동
  {
    id: 'airindia', name: '에어인디아', nameEn: 'Air India', iata: 'AI', founded: 1946, hub: 'mumbai', region: 'southmid',
    colors: ['#d71a21', '#f29200'], note: '1932년 타타 항공으로 시작. 오랫동안 뭄바이가 본거지였고 지금은 델리도 큰 거점',
  },
  { id: 'airlanka', name: '에어랑카', nameEn: 'Air Lanka', iata: 'UL', founded: 1979, defunct: 1999, hub: 'colombo', region: 'southmid', colors: ['#d2232a', '#f7941d'] },
  {
    id: 'srilankan', name: '스리랑카항공', nameEn: 'SriLankan Airlines', iata: 'UL', founded: 1999, hub: 'colombo', region: 'southmid',
    colors: ['#1b3a8c', '#c8102e'], note: '에어랑카가 1999년 이름을 바꿈',
  },
  {
    id: 'gulfair', name: '걸프항공', nameEn: 'Gulf Air', iata: 'GF', founded: 1974, hub: 'doha', region: 'southmid',
    colors: ['#b8975a', '#7a1f2b'], note: '1950년 걸프 에이비에이션으로 시작. 실제 본거지 바레인이 목록에 없어 도하로 (1974~2002년 카타르도 공동 주인)',
  },
  { id: 'emirates', name: '에미레이트항공', nameEn: 'Emirates', iata: 'EK', founded: 1985, hub: 'dubai', region: 'southmid', colors: ['#d71921', '#c5a46d'] },
  { id: 'qatar', name: '카타르항공', nameEn: 'Qatar Airways', iata: 'QR', founded: 1994, hub: 'doha', region: 'southmid', colors: ['#5c0632', '#a7a9ac'] },

  // ---------------------------------------------------------------- 유럽
  {
    id: 'turkish', name: '터키항공', nameEn: 'Turkish Airlines', iata: 'TK', founded: 1956, hub: 'istanbul', region: 'europe',
    colors: ['#c70a0c', '#a7a9ac'], note: '1933년 나라 항공국으로 시작해 1956년 지금 회사로',
  },
  { id: 'lufthansa', name: '루프트한자', nameEn: 'Lufthansa', iata: 'LH', founded: 1955, hub: 'frankfurt', region: 'europe', colors: ['#05164d', '#ffad00'] },
  {
    id: 'boac', name: '영국해외항공', nameEn: 'BOAC', iata: 'BA', founded: 1940, defunct: 1974, hub: 'london', region: 'europe',
    colors: ['#0b2a5b', '#c9a227'], note: '1974년 영국유럽항공(BEA)과 합쳐 영국항공이 됨',
  },
  { id: 'britishairways', name: '영국항공', nameEn: 'British Airways', iata: 'BA', founded: 1974, hub: 'london', region: 'europe', colors: ['#1b2c6b', '#d0021b'] },
  { id: 'airfrance', name: '에어프랑스', nameEn: 'Air France', iata: 'AF', founded: 1933, hub: 'paris', region: 'europe', colors: ['#002157', '#e4002b'] },
  { id: 'klm', name: 'KLM 네덜란드항공', nameEn: 'KLM Royal Dutch Airlines', iata: 'KL', founded: 1919, hub: 'amsterdam', region: 'europe', colors: ['#00a1de', '#003145'] },
  {
    id: 'swissair', name: '스위스에어', nameEn: 'Swissair', iata: 'SR', founded: 1931, defunct: 2002, hub: 'zurich', region: 'europe',
    colors: ['#d52b1e', '#3a3a3a'], note: '2001년 말 운항을 멈추고 2002년 문을 닫음',
  },
  {
    id: 'swiss', name: '스위스국제항공', nameEn: 'Swiss International Air Lines', iata: 'LX', founded: 2002, hub: 'zurich', region: 'europe',
    colors: ['#e2001a', '#ffffff'], note: '스위스에어의 뒤를 이어 2002년 시작',
  },
  {
    id: 'alitalia', name: '알리탈리아', nameEn: 'Alitalia', iata: 'AZ', founded: 1946, defunct: 2021, hub: 'rome', region: 'europe',
    colors: ['#006643', '#d2232a'], note: '2021년 10월 운항을 마치고 ITA항공이 뒤를 이음',
  },
  { id: 'ita', name: 'ITA항공', nameEn: 'ITA Airways', iata: 'AZ', founded: 2021, hub: 'rome', region: 'europe', colors: ['#1c3f94', '#b4b8bd'] },
  { id: 'iberia', name: '이베리아항공', nameEn: 'Iberia', iata: 'IB', founded: 1927, hub: 'madrid', region: 'europe', colors: ['#d7192d', '#fcb813'] },

  // ---------------------------------------------------------------- 아프리카
  {
    id: 'egyptair', name: '이집트항공', nameEn: 'EgyptAir', iata: 'MS', founded: 1971, hub: 'cairo', region: 'africa',
    colors: ['#0b2e6f', '#c8a24b'], note: '1932년 미스르 항공으로 시작, 1960~1971년에는 아랍연합항공',
  },
  {
    id: 'ethiopian', name: '에티오피아항공', nameEn: 'Ethiopian Airlines', iata: 'ET', founded: 1945, hub: 'nairobi', region: 'africa',
    colors: ['#1f7a3a', '#fcd116'], note: '실제 본거지 아디스아바바가 목록에 없어 가까운 나이로비로',
  },
  { id: 'saa', name: '남아프리카항공', nameEn: 'South African Airways', iata: 'SA', founded: 1934, hub: 'johannesburg', region: 'africa', colors: ['#002395', '#e87722'] },
  { id: 'royalairmaroc', name: '로열에어모로코', nameEn: 'Royal Air Maroc', iata: 'AT', founded: 1957, hub: 'casablanca', region: 'africa', colors: ['#c1272d', '#006233'] },
  { id: 'kenya', name: '케냐항공', nameEn: 'Kenya Airways', iata: 'KQ', founded: 1977, hub: 'nairobi', region: 'africa', colors: ['#c8102e', '#1a1a1a'], note: '1977년 동아프리카항공이 나뉘며 시작' },

  // ---------------------------------------------------------------- 아메리카
  {
    id: 'panam', name: '팬암', nameEn: 'Pan Am', iata: 'PA', founded: 1927, defunct: 1991, hub: 'newyork', region: 'americas',
    colors: ['#1a6dc8', '#ffffff'], note: '1991년 12월 문을 닫음',
  },
  {
    id: 'twa', name: '트랜스월드항공', nameEn: 'TWA', iata: 'TW', founded: 1930, defunct: 2001, hub: 'newyork', region: 'americas',
    colors: ['#c8102e', '#ffffff'], note: '2001년 아메리칸항공에 합쳐짐. 큰 거점 세인트루이스가 목록에 없어 국제선 거점 뉴욕으로',
  },
  {
    id: 'american', name: '아메리칸항공', nameEn: 'American Airlines', iata: 'AA', founded: 1934, hub: 'chicago', region: 'americas',
    colors: ['#0078d2', '#c30019'], note: '가장 큰 거점 댈러스·포트워스가 목록에 없어 가까운 시카고로',
  },
  { id: 'united', name: '유나이티드항공', nameEn: 'United Airlines', iata: 'UA', founded: 1931, hub: 'chicago', region: 'americas', colors: ['#002244', '#1a6fd6'] },
  {
    id: 'delta', name: '델타항공', nameEn: 'Delta Air Lines', iata: 'DL', founded: 1929, hub: 'newyork', region: 'americas',
    colors: ['#003a70', '#e01933'], note: '가장 큰 거점 애틀랜타가 목록에 없어 또 다른 큰 거점 뉴욕으로',
  },
  {
    id: 'northwest', name: '노스웨스트항공', nameEn: 'Northwest Airlines', iata: 'NW', founded: 1926, defunct: 2010, hub: 'chicago', region: 'americas',
    colors: ['#d0021b', '#5b6770'], note: '2010년 델타항공에 합쳐짐. 거점 미니애폴리스·디트로이트가 목록에 없어 가까운 시카고로',
  },
  {
    id: 'aircanada', name: '에어캐나다', nameEn: 'Air Canada', iata: 'AC', founded: 1965, hub: 'toronto', region: 'americas',
    colors: ['#f01428', '#1a1a1a'], note: '1937년 트랜스캐나다항공으로 시작. 본사는 몬트리올',
  },
  {
    id: 'aeromexico', name: '아에로멕시코', nameEn: 'Aeroméxico', iata: 'AM', founded: 1972, hub: 'mexicocity', region: 'americas',
    colors: ['#0b2343', '#6f8fb5'], note: '1934년 아에로나베스 데 메히코로 시작',
  },
  {
    id: 'varig', name: '바리그', nameEn: 'VARIG', iata: 'RG', founded: 1927, defunct: 2006, hub: 'rio', region: 'americas',
    colors: ['#0b2f6b', '#d4a017'], note: '2006년 운항을 멈추고 이름이 골(GOL) 항공으로 넘어감. 본사는 포르투알레그리',
  },
  {
    id: 'lan', name: '란칠레항공', nameEn: 'LAN Airlines', iata: 'LA', founded: 1929, defunct: 2016, hub: 'buenosaires', region: 'americas',
    colors: ['#1b2b65', '#e2001a'], note: '2012년 TAM과 합쳐 2016년 라탐으로. 본거지 산티아고가 목록에 없어 가까운 부에노스아이레스로',
  },
  {
    id: 'latam', name: '라탐항공', nameEn: 'LATAM Airlines', iata: 'LA', founded: 2016, hub: 'saopaulo', region: 'americas',
    colors: ['#1b0088', '#e8114b'], note: '본사는 산티아고(목록에 없음). 가장 큰 거점 상파울루로',
  },
  { id: 'aerolineas', name: '아르헨티나항공', nameEn: 'Aerolíneas Argentinas', iata: 'AR', founded: 1950, hub: 'buenosaires', region: 'americas', colors: ['#5ba3d9', '#1a3a6b'] },
];

export const REAL_AIRLINE: Record<string, RealAirline> = Object.fromEntries(REAL_AIRLINES.map((a) => [a.id, a]));

/** 그 해에 날고 있는 항공사 (founded ≤ 해 < defunct) */
export function airlinesAt(year: number): RealAirline[] {
  return REAL_AIRLINES.filter((a) => a.founded <= year && (a.defunct === undefined || year < a.defunct));
}
