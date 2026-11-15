/**
 * 공항 도면 (airportMaps.ts, scripts/fetch-airport-maps.py가 오픈스트리트맵에서 만든다).
 * 좌표는 틀 왼쪽 위를 (0,0)으로 한 m 단위 (x 동쪽, y 남쪽). 경로는 SVG path 글자.
 */
export interface AirportMapData {
  /** 틀 너비·높이 (m) */
  w: number;
  h: number;
  /** 바탕이 바다 (land가 땅) */
  sea?: 1;
  land?: string;
  /** 호수·강 */
  water?: string;
  /** 공항 울타리 안 (잔디) */
  field: string;
  /** 계류장 */
  apron?: string;
  /** 유도로 [폭 m, 가운데 선 경로] */
  twy?: [number, string][];
  /** 활주로 [끝1 x, y, 끝2 x, y, 폭 m, 이름 '15L/33R'] — 끝1이 이름 앞쪽 번호 끝 */
  rwy: [number, number, number, number, number, string][];
  /** 여객 터미널 */
  term?: string;
  /** 격납고 */
  hangar?: string;
  /** 그 밖의 큰 건물 (화물 터미널 등) */
  bldg?: string;
  /** 관제탑 자리 */
  tower?: [number, number];
  /** 주기장 [x, y, 코가 보는 방향(도, 0 동쪽·90 남쪽, −1 모름), …] — 터미널에 가까운 것부터 */
  stands?: number[];
  /** 터미널 이름표 [x, y, 이름] */
  labels?: [number, number, string][];
}

/** 공항 이름·부호 (airports.ts) */
export interface AirportInfo {
  icao: string;
  iata: string;
  /** 한글 이름 */
  name: string;
  /** 영어 이름 (짧게) */
  en: string;
  /** 문 연 해 */
  opened?: number;
  /** 문 닫은 해 */
  closed?: number;
}

/** 도시가 어느 해에 어느 공항을 쓰는지 */
export interface CityAirportEra {
  icao: string;
  /** 이 해부터 (없으면 처음부터) */
  from?: number;
  /** 이 해까지 (없으면 끝까지) */
  to?: number;
  /** 이 무렵 이야기 (옛 공항을 대신 보여 줄 때 등) */
  note?: string;
}
