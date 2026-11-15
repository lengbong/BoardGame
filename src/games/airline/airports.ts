import { AIRPORT_MAPS } from './airportMaps';
import type { AirportInfo, AirportMapData, CityAirportEra } from './airportTypes';

/**
 * 도시마다 그 해에 쓰던 대표 공항 (도면은 airportMaps.ts, 오픈스트리트맵).
 * 큰 새 공항이 생겨 국제선이 옮겨 간 도시는 해에 따라 공항이 바뀐다 (예: 서울 김포 → 2001년 인천).
 * 부호(IATA)는 그 공항이 대표 공항이던 때의 부호예요 (지금 부호가 다르면 now).
 */
type Row = [icao: string, iata: string, name: string, en: string, opened?: number, closed?: number, now?: string];

const ROWS: Row[] = [
  // 동아시아
  ['RKSS', 'GMP', '김포국제공항', 'Gimpo International', 1958],
  ['RKSI', 'ICN', '인천국제공항', 'Incheon International', 2001],
  ['RKPK', 'PUS', '김해국제공항', 'Gimhae International', 1976],
  ['RKPC', 'CJU', '제주국제공항', 'Jeju International', 1968],
  ['RJTT', 'HND', '하네다 공항 (도쿄국제공항)', 'Tokyo Haneda', 1931],
  ['RJAA', 'NRT', '나리타 국제공항', 'Narita International', 1978],
  ['RJOO', 'ITM', '이타미 공항 (오사카국제공항)', 'Osaka Itami', 1939],
  ['RJBB', 'KIX', '간사이 국제공항', 'Kansai International', 1994],
  ['ZBAA', 'PEK', '베이징 서우두 국제공항', 'Beijing Capital International', 1958],
  ['ZSSS', 'SHA', '상하이 훙차오 국제공항', 'Shanghai Hongqiao International', 1921],
  ['ZSPD', 'PVG', '상하이 푸둥 국제공항', 'Shanghai Pudong International', 1999],
  ['VHHX', 'HKG', '카이탁 공항', 'Kai Tak Airport', 1925, 1998],
  ['VHHH', 'HKG', '홍콩 국제공항 (첵랍콕)', 'Hong Kong International (Chek Lap Kok)', 1998],
  ['RCSS', 'TSA', '타이베이 쑹산 공항', 'Taipei Songshan', 1936],
  ['RCTP', 'TPE', '타오위안 국제공항', 'Taiwan Taoyuan International', 1979],
  // 동남아·오세아니아
  ['WSAP', 'SIN', '파야레바 공항', 'Paya Lebar Airport', 1955, 1981, 'QPG'],
  ['WSSS', 'SIN', '싱가포르 창이 공항', 'Singapore Changi', 1981],
  ['VTBD', 'BKK', '돈므앙 국제공항', 'Don Mueang International', 1914, undefined, 'DMK'],
  ['VTBS', 'BKK', '수완나품 공항', 'Suvarnabhumi Airport', 2006],
  ['WMSA', 'KUL', '수방 공항 (술탄 압둘 아지즈 샤)', 'Subang (Sultan Abdul Aziz Shah)', 1965, undefined, 'SZB'],
  ['WMKK', 'KUL', '쿠알라룸푸르 국제공항', 'Kuala Lumpur International', 1998],
  ['WIHH', 'HLP', '할림 페르다나쿠수마 공항', 'Halim Perdanakusuma'],
  ['WIII', 'CGK', '수카르노-하타 국제공항', 'Soekarno–Hatta International', 1985],
  ['RPLL', 'MNL', '니노이 아키노 국제공항', 'Ninoy Aquino International', 1948],
  ['VVTS', 'SGN', '떤선녓 국제공항', 'Tan Son Nhat International', 1930],
  ['WADD', 'DPS', '응우라라이 국제공항', 'I Gusti Ngurah Rai International', 1931],
  ['YSSY', 'SYD', '시드니 킹스퍼드 스미스 공항', 'Sydney Kingsford Smith', 1920],
  ['NZAA', 'AKL', '오클랜드 국제공항', 'Auckland International', 1966],
  ['PHNL', 'HNL', '호놀룰루 국제공항', 'Honolulu (Daniel K. Inouye) International', 1927],
  ['PGUM', 'GUM', '괌 국제공항', 'Guam (A. B. Won Pat) International'],
  // 남아시아·중동
  ['VIDP', 'DEL', '인디라 간디 국제공항', 'Indira Gandhi International', 1962],
  ['VABB', 'BOM', '차트라파티 시바지 마하라지 국제공항', 'Chhatrapati Shivaji Maharaj International', 1942],
  ['VCCC', 'RML', '라트말라나 공항', 'Colombo Ratmalana', 1938],
  ['VCBI', 'CMB', '반다라나이케 국제공항', 'Bandaranaike International', 1967],
  ['VRMM', 'MLE', '벨라나 국제공항', 'Velana International', 1966],
  ['VNKT', 'KTM', '트리부반 국제공항', 'Tribhuvan International', 1949],
  ['OMDB', 'DXB', '두바이 국제공항', 'Dubai International', 1960],
  ['OTBD', 'DOH', '옛 도하 국제공항', 'Doha International (old)', undefined, 2014, 'DIA'],
  ['OTHH', 'DOH', '하마드 국제공항', 'Hamad International', 2014],
  // 유럽
  ['EGLL', 'LHR', '런던 히스로 공항', 'London Heathrow', 1946],
  ['LFPO', 'ORY', '파리 오를리 공항', 'Paris Orly', 1932],
  ['LFPG', 'CDG', '파리 샤를드골 공항', 'Paris Charles de Gaulle', 1974],
  ['EDDF', 'FRA', '프랑크푸르트 공항', 'Frankfurt Airport', 1936],
  ['EHAM', 'AMS', '암스테르담 스히폴 공항', 'Amsterdam Schiphol', 1916],
  ['LSZH', 'ZRH', '취리히 공항', 'Zürich Airport', 1948],
  ['LIRF', 'FCO', '로마 피우미치노 공항', 'Rome Fiumicino (Leonardo da Vinci)', 1961],
  ['LIML', 'LIN', '밀라노 리나테 공항', 'Milan Linate', 1937],
  ['LIMC', 'MXP', '밀라노 말펜사 공항', 'Milan Malpensa', 1948],
  ['LEBL', 'BCN', '바르셀로나 엘프라트 공항', 'Barcelona–El Prat'],
  ['LEMD', 'MAD', '마드리드 바라하스 공항', 'Madrid–Barajas', 1931],
  ['LGAT', 'ATH', '엘리니콘 국제공항', 'Ellinikon International', 1938, 2001],
  ['LGAV', 'ATH', '아테네 국제공항 (엘레프테리오스 베니젤로스)', 'Athens International (Eleftherios Venizelos)', 2001],
  ['LTBA', 'IST', '아타튀르크 공항', 'Istanbul Atatürk', 1953, 2019, 'ISL'],
  ['LTFM', 'IST', '이스탄불 공항', 'Istanbul Airport', 2018],
  ['UUEE', 'SVO', '셰레메티예보 국제공항', 'Moscow Sheremetyevo', 1959],
  // 아프리카
  ['HECA', 'CAI', '카이로 국제공항', 'Cairo International', 1963],
  ['HKJK', 'NBO', '조모 케냐타 국제공항', 'Jomo Kenyatta International', 1958],
  ['FAOR', 'JNB', 'O.R. 탐보 국제공항', 'O. R. Tambo International', 1952],
  ['FACT', 'CPT', '케이프타운 국제공항', 'Cape Town International', 1954],
  ['DNMM', 'LOS', '무르탈라 무하마드 국제공항', 'Murtala Muhammed International'],
  ['GMMN', 'CMN', '무함마드 5세 국제공항', 'Mohammed V International'],
  // 아메리카
  ['KJFK', 'JFK', '존 F. 케네디 국제공항', 'New York JFK', 1948],
  ['KLAX', 'LAX', '로스앤젤레스 국제공항', 'Los Angeles International', 1928],
  ['KSFO', 'SFO', '샌프란시스코 국제공항', 'San Francisco International', 1927],
  ['KORD', 'ORD', '시카고 오헤어 국제공항', "Chicago O'Hare International", 1944],
  ['KMIA', 'MIA', '마이애미 국제공항', 'Miami International', 1928],
  ['CYVR', 'YVR', '밴쿠버 국제공항', 'Vancouver International', 1931],
  ['CYYZ', 'YYZ', '토론토 피어슨 국제공항', 'Toronto Pearson International', 1939],
  ['CYUL', 'YUL', '몬트리올 트뤼도 국제공항', 'Montréal–Trudeau (Dorval)', 1941],
  ['CYMX', 'YMX', '몬트리올 미라벨 국제공항', 'Montréal–Mirabel', 1975],
  ['MMMX', 'MEX', '멕시코시티 국제공항', 'Mexico City International'],
  ['SBSP', 'CGH', '콩고냐스 공항', 'São Paulo Congonhas', 1936],
  ['SBGR', 'GRU', '과룰류스 국제공항', 'São Paulo Guarulhos', 1985],
  ['SBGL', 'GIG', '갈레앙 국제공항', 'Rio de Janeiro Galeão'],
  ['SAEZ', 'EZE', '에세이사 국제공항', 'Buenos Aires Ezeiza', 1949],
  // 대표 공항 말고 함께 쓰는 공항 (탭)
  ['ZBAD', 'PKX', '베이징 다싱 국제공항', 'Beijing Daxing International', 2019],
  ['OMDW', 'DWC', '알막툼 국제공항', 'Dubai Al Maktoum International', 2010],
  ['VANM', 'NMI', '나비 뭄바이 국제공항', 'Navi Mumbai International', 2025],
  ['EGKK', 'LGW', '런던 개트윅 공항', 'London Gatwick', 1958],
  ['EGSS', 'STN', '런던 스탠스테드 공항', 'London Stansted'],
  ['EGGW', 'LTN', '런던 루턴 공항', 'London Luton', 1938],
  ['EGLC', 'LCY', '런던 시티 공항', 'London City', 1987],
  ['LIRA', 'CIA', '로마 참피노 공항', 'Rome Ciampino', 1916],
  ['LIME', 'BGY', '밀라노 베르가모 공항', 'Milan Bergamo (Orio al Serio)'],
  ['LTFJ', 'SAW', '사비하 괵첸 국제공항', 'Istanbul Sabiha Gökçen', 2001],
  ['UUDD', 'DME', '도모데도보 국제공항', 'Moscow Domodedovo', 1964],
  ['UUWW', 'VKO', '브누코보 국제공항', 'Moscow Vnukovo', 1941],
  ['KLGA', 'LGA', '라과디아 공항', 'New York LaGuardia', 1939],
  ['KEWR', 'EWR', '뉴어크 리버티 국제공항', 'Newark Liberty International', 1928],
  ['KMDW', 'MDW', '시카고 미드웨이 국제공항', 'Chicago Midway', 1927],
  ['MMSM', 'NLU', '펠리페 앙헬레스 국제공항', 'Felipe Ángeles International', 2022],
  ['SBRJ', 'SDU', '산투스 두몽 공항', 'Rio de Janeiro Santos Dumont', 1936],
  ['SABE', 'AEP', '호르헤 뉴베리 공항 (아에로파르케)', 'Buenos Aires Aeroparque Jorge Newbery', 1947],
];

export const AIRPORT_INFO_BY_ICAO: Record<string, AirportInfo & { now?: string }> = Object.fromEntries(
  ROWS.map(([icao, iata, name, en, opened, closed, now]) => [icao, { icao, iata, name, en, opened, closed, now }]),
);

/** 도시 → 해마다 쓰는 공항 (앞에서부터 차례로) */
export const CITY_AIRPORTS: Record<string, CityAirportEra[]> = {
  seoul: [{ icao: 'RKSS', to: 2000 }, { icao: 'RKSI', from: 2001, note: '김포공항은 국내선과 가까운 나라를 오가는 노선을 맡아요.' }],
  busan: [{ icao: 'RKPK', note: '1976년 김해로 옮기기 전에는 해운대 가까운 수영비행장을 썼어요 (지금은 센텀시티가 되어 도면이 없어요).' }],
  jeju: [{ icao: 'RKPC' }],
  tokyo: [
    { icao: 'RJTT', to: 1977 },
    { icao: 'RJAA', from: 1978, to: 2009, note: '하네다는 국내선을 맡고, 나라 밖으로 가는 비행기는 대부분 나리타에서 떠요.' },
    { icao: 'RJTT', from: 2010, note: '2010년 새 활주로와 국제선 터미널이 생겨 하네다가 다시 도쿄의 대표 관문이 돼요.' },
  ],
  osaka: [{ icao: 'RJOO', to: 1993 }, { icao: 'RJBB', from: 1994, note: '바다를 메운 섬 위에 지은 공항이에요.' }],
  beijing: [{ icao: 'ZBAA', note: '2019년에 다싱 국제공항도 생기지만, 서우두 공항이 여전히 가장 붐벼요.' }],
  shanghai: [{ icao: 'ZSSS', to: 1998 }, { icao: 'ZSPD', from: 1999 }],
  hongkong: [
    { icao: 'VHHX', to: 1997, note: '빌딩 사이로 낮게 내려와 바다로 뻗은 활주로에 내리는 아슬아슬한 공항이었어요. 지금은 활주로 자리만 길쭉한 땅으로 남아 있어 옛 지도로 어림해 그렸어요.' },
    { icao: 'VHHH', from: 1998, note: '섬 두 개를 깎고 메워 만든 공항이에요.' },
  ],
  taipei: [{ icao: 'RCSS', to: 1978 }, { icao: 'RCTP', from: 1979 }],
  singapore: [{ icao: 'WSAP', to: 1980, note: '지금은 공군 기지로 쓰여요.' }, { icao: 'WSSS', from: 1981 }],
  bangkok: [{ icao: 'VTBD', to: 2005, note: '활주로 두 줄 사이에 골프장이 있는 공항이에요.' }, { icao: 'VTBS', from: 2006 }],
  kualalumpur: [{ icao: 'WMSA', to: 1997 }, { icao: 'WMKK', from: 1998 }],
  jakarta: [{ icao: 'WIHH', to: 1984, note: '1974년까지는 시내의 크마요란 공항을 썼어요 (지금은 없어져 도면이 없어요).' }, { icao: 'WIII', from: 1985 }],
  manila: [{ icao: 'RPLL' }],
  hochiminh: [{ icao: 'VVTS' }],
  bali: [{ icao: 'WADD', note: '활주로가 바다 쪽으로 뻗어 있어요.' }],
  sydney: [{ icao: 'YSSY', note: '활주로가 보터니만 바다 위로 뻗어 있어요.' }],
  auckland: [{ icao: 'NZAA' }],
  honolulu: [{ icao: 'PHNL', note: '바다 위 산호초를 메워 만든 활주로가 있어요.' }],
  guam: [{ icao: 'PGUM' }],
  delhi: [{ icao: 'VIDP' }],
  mumbai: [{ icao: 'VABB', note: '활주로 두 줄이 X자로 엇갈려요.' }],
  colombo: [{ icao: 'VCCC', to: 1966 }, { icao: 'VCBI', from: 1967 }],
  male: [{ icao: 'VRMM', note: '섬 하나가 통째로 공항이에요.' }],
  kathmandu: [{ icao: 'VNKT', note: '산으로 둘러싸인 분지 속에 활주로가 하나뿐이에요.' }],
  dubai: [{ icao: 'OMDB' }],
  doha: [{ icao: 'OTBD', to: 2013 }, { icao: 'OTHH', from: 2014 }],
  london: [{ icao: 'EGLL' }],
  paris: [{ icao: 'LFPO', to: 1973 }, { icao: 'LFPG', from: 1974 }],
  frankfurt: [{ icao: 'EDDF' }],
  amsterdam: [{ icao: 'EHAM', note: '바다보다 낮은 땅에 활주로가 여섯 줄이나 있어요.' }],
  zurich: [{ icao: 'LSZH' }],
  rome: [{ icao: 'LIRF' }],
  milan: [{ icao: 'LIML', to: 1997 }, { icao: 'LIMC', from: 1998 }],
  barcelona: [{ icao: 'LEBL' }],
  madrid: [{ icao: 'LEMD' }],
  athens: [
    { icao: 'LGAT', to: 2000, note: '바닷가에 있던 옛 공항이에요. 지금은 없어져서 남은 터와 옛 지도로 어림해 그렸어요.' },
    { icao: 'LGAV', from: 2001 },
  ],
  istanbul: [{ icao: 'LTBA', to: 2018 }, { icao: 'LTFM', from: 2019 }],
  moscow: [{ icao: 'UUEE' }],
  cairo: [{ icao: 'HECA' }],
  nairobi: [{ icao: 'HKJK' }],
  johannesburg: [{ icao: 'FAOR' }],
  capetown: [{ icao: 'FACT' }],
  lagos: [{ icao: 'DNMM' }],
  casablanca: [{ icao: 'GMMN' }],
  newyork: [{ icao: 'KJFK', note: '1963년까지는 아이들와일드 공항이라고 불렀어요.' }],
  losangeles: [{ icao: 'KLAX' }],
  sanfrancisco: [{ icao: 'KSFO', note: '활주로 끝이 샌프란시스코만 바다에 닿아 있어요.' }],
  chicago: [{ icao: 'KORD' }],
  miami: [{ icao: 'KMIA' }],
  vancouver: [{ icao: 'CYVR' }],
  toronto: [{ icao: 'CYYZ' }],
  montreal: [
    { icao: 'CYUL', to: 1974 },
    { icao: 'CYMX', from: 1975, to: 1997, note: '이 무렵 미국 말고 다른 나라로 가는 국제선은 멀리 새로 지은 미라벨 공항에서만 떴어요.' },
    { icao: 'CYUL', from: 1998 },
  ],
  mexicocity: [{ icao: 'MMMX', note: '해발 2,200m 고원 위 공항이에요.' }],
  saopaulo: [{ icao: 'SBSP', to: 1984, note: '도시 한가운데 언덕 위 공항이에요.' }, { icao: 'SBGR', from: 1985 }],
  rio: [{ icao: 'SBGL' }],
  buenosaires: [{ icao: 'SAEZ' }],
};

/**
 * 그 해 대표 공항 말고도 손님을 받던 공항 (탭으로 골라 본다).
 * 게임에서는 도시를 공항 하나로 셈하므로 그림만 보여 주고, 회사 비행기는 대표 공항에 선다.
 * 대표 공항이던 곳이 새 공항이 생긴 뒤에도 국내선 등으로 남은 경우도 여기 적는다.
 */
export const CITY_SIDE_AIRPORTS: Record<string, CityAirportEra[]> = {
  seoul: [{ icao: 'RKSS', from: 2001, note: '국내선과 가까운 나라(도쿄 하네다·상하이 훙차오 등)를 오가는 노선을 맡아요.' }],
  tokyo: [
    { icao: 'RJTT', from: 1978, to: 2009, note: '국내선과 가까운 나라 노선을 맡아요.' },
    { icao: 'RJAA', from: 2010, note: '저가항공과 먼 나라로 가는 비행기가 많이 떠요.' },
  ],
  osaka: [{ icao: 'RJOO', from: 1994, note: '간사이 공항이 생긴 뒤로는 국내선만 다녀요.' }],
  beijing: [{ icao: 'ZBAD', from: 2019, note: '불가사리 모양 터미널이 있는 새 공항이에요.' }],
  shanghai: [{ icao: 'ZSSS', from: 1999, note: '국내선과 가까운 나라 노선을 맡아요.' }],
  taipei: [{ icao: 'RCSS', from: 1979, note: '도시 한가운데 있어 국내선과 가까운 나라 노선을 맡아요.' }],
  bangkok: [{ icao: 'VTBD', from: 2007, note: '다시 문을 열어 국내선과 저가항공이 많이 떠요.' }],
  kualalumpur: [{ icao: 'WMSA', from: 1998, note: '프로펠러기가 다니는 가까운 노선을 맡아요.' }],
  jakarta: [{ icao: 'WIHH', from: 2014, note: '2014년부터 다시 여객기가 다녀요.' }],
  mumbai: [{ icao: 'VANM', from: 2025, note: '바다 건너 새로 지은 두 번째 공항이에요.' }],
  colombo: [{ icao: 'VCCC', from: 1967, note: '국내선과 작은 비행기가 다녀요.' }],
  dubai: [{ icao: 'OMDW', from: 2013, note: '사막 위에 아주 크게 넓힐 계획인 새 공항이에요.' }],
  london: [
    { icao: 'EGKK', from: 1958, note: '활주로 하나로 아주 많은 비행기가 뜨고 내리는 공항이에요.' },
    { icao: 'EGSS', note: '저가항공이 많이 떠요.' },
    { icao: 'EGGW', note: '1960년대부터 휴가 전세기로 붐볐어요.' },
    { icao: 'EGLC', from: 1987, note: '시내 옛 부두 자리에 있는, 활주로가 짧은 공항이에요.' },
  ],
  paris: [{ icao: 'LFPO', from: 1974, note: '국내선과 가까운 나라 노선을 많이 맡아요.' }],
  rome: [{ icao: 'LIRA', note: '1961년까지 로마의 대표 공항이었어요. 지금은 저가항공이 많이 떠요.' }],
  milan: [
    { icao: 'LIMC', to: 1997, note: '먼 나라로 가는 비행기는 이 무렵 말펜사에서 떠요.' },
    { icao: 'LIML', from: 1998, note: '시내에서 가까워 국내선과 유럽 노선을 맡아요.' },
    { icao: 'LIME', from: 2002, note: '2000년대부터 저가항공이 많이 떠요.' },
  ],
  istanbul: [{ icao: 'LTFJ', from: 2001, note: '바다 건너 아시아 쪽에 있는 공항이에요.' }],
  moscow: [
    { icao: 'UUWW', note: '지금 쓰는 모스크바 공항 가운데 가장 오래됐어요.' },
    { icao: 'UUDD', from: 1964 },
  ],
  newyork: [
    { icao: 'KLGA', note: '시내에서 가까워 국내선이 많이 떠요.' },
    { icao: 'KEWR', note: '강 건너 뉴저지에 있어요.' },
  ],
  chicago: [{ icao: 'KMDW', note: '오헤어가 생기기 전에는 시카고의 대표 공항이었어요.' }],
  montreal: [
    { icao: 'CYUL', from: 1975, to: 1997, note: '국내선과 미국 가는 비행기는 그대로 도발 공항에서 떴어요.' },
    { icao: 'CYMX', from: 1998, to: 2004, note: '2004년까지 전세기가 다녔어요.' },
  ],
  mexicocity: [{ icao: 'MMSM', from: 2022, note: '공군 기지를 넓혀 새로 연 공항이에요.' }],
  saopaulo: [{ icao: 'SBSP', from: 1985, note: '국내선, 특히 리우를 오가는 셔틀 비행기가 많이 떠요.' }],
  rio: [{ icao: 'SBRJ', note: '바닷가 시내에 있어 국내선이 많이 떠요.' }],
  buenosaires: [{ icao: 'SABE', note: '강가 시내에 있어 국내선과 가까운 나라 노선이 떠요.' }],
};

export interface CityAirport {
  /** 그 해 도시의 대표 공항인지 (아니면 탭으로 보는 다른 공항) */
  main: boolean;
  era: CityAirportEra;
  info: AirportInfo & { now?: string };
  map: AirportMapData | undefined;
  /** 바로 앞·뒤 공항 (해가 바뀌면 옮겨 가는 곳) */
  prev?: { era: CityAirportEra; info: AirportInfo };
  next?: { era: CityAirportEra; info: AirportInfo };
}

/** 그 해 그 도시의 대표 공항 */
export function cityAirport(cityId: string, year: number): CityAirport | null {
  const eras = CITY_AIRPORTS[cityId];
  if (!eras?.length) return null;
  let i = eras.findIndex((e) => (e.from === undefined || year >= e.from) && (e.to === undefined || year <= e.to));
  if (i < 0) i = year < (eras[0].from ?? -Infinity) ? 0 : eras.length - 1;
  const era = eras[i];
  const info = AIRPORT_INFO_BY_ICAO[era.icao];
  const side = (e: CityAirportEra | undefined) => (e && e.icao !== era.icao ? { era: e, info: AIRPORT_INFO_BY_ICAO[e.icao] } : undefined);
  return { main: true, era, info, map: AIRPORT_MAPS[era.icao], prev: side(eras[i - 1]), next: side(eras[i + 1]) };
}

const operating = (e: CityAirportEra, year: number) => (e.from === undefined || year >= e.from) && (e.to === undefined || year <= e.to);

/** 그 해 그 도시에서 손님을 받던 공항들 (대표 공항이 먼저, 도면이 있는 것만) */
export function cityAirports(cityId: string, year: number): CityAirport[] {
  const main = cityAirport(cityId, year);
  if (!main) return [];
  const out: CityAirport[] = [main];
  for (const e of CITY_SIDE_AIRPORTS[cityId] ?? []) {
    if (!operating(e, year) || out.some((a) => a.info.icao === e.icao) || !AIRPORT_MAPS[e.icao]) continue;
    out.push({ main: false, era: e, info: AIRPORT_INFO_BY_ICAO[e.icao], map: AIRPORT_MAPS[e.icao] });
  }
  return out;
}

/** 탭에 쓰는 짧은 이름: '런던 히스로 공항' → '히스로', '하네다 공항 (도쿄국제공항)' → '하네다', '이스탄불 공항' → '이스탄불' */
export function airportShortName(info: AirportInfo, cityName: string): string {
  const base = info.name
    .replace(/\s*\(.*\)$/, '')
    .replace(/^옛\s+/, '')
    .replace(/\s*(국제)?공항$/, '')
    .trim();
  return base.startsWith(`${cityName} `) ? base.slice(cityName.length + 1) : base || info.name;
}

/** 활주로 길이 (m) */
export function runwayLength(r: AirportMapData['rwy'][number]): number {
  return Math.round(Math.hypot(r[2] - r[0], r[3] - r[1]));
}
