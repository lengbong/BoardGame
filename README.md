# 우리 가족 보드게임 🎲

가족이 **한 대의 PC 브라우저**에 둘러앉아 함께 하는 보드게임 모음입니다.
사람이 모자라면 컴퓨터가 빈 자리를 채워 줍니다. 서버나 인터넷 연결 없이 동작합니다.

## 바로 하기

| 방법 | 주소 |
| --- | --- |
| 🌐 설치 없이 웹에서 하기 | https://lengbong.github.io/BoardGame/ |
| 💾 내려받아서 하기 | [family-boardgame.zip 다운로드](https://github.com/lengbong/BoardGame/releases/latest/download/family-boardgame.zip) |

내려받은 경우: 압축을 풀고 `family-boardgame/index.html`을 더블클릭하면 브라우저에서 바로 실행됩니다.

## 게임 목록

### 말판 경주 (2~4명)

주사위를 굴려 내 말 4개를 먼저 가운데 골인 지점까지 보내면 이기는 경주 게임입니다.

- 자리마다 **사람 / 컴퓨터(쉬움·보통) / 비움** 선택
- 상대 말이 있는 칸에 도착하면 잡아서 대기실로 돌려보내기
- 조작: 주사위는 버튼 클릭 또는 `Space`, 말은 클릭 또는 숫자키 `1`~`4`
- 하던 게임은 자동 저장되어 새로고침해도 이어서 할 수 있음
- 규칙은 게임 시작 전에 켜고 끌 수 있음 (정통 규칙 / 쉬운 규칙 프리셋 제공)

| 규칙 | 정통 | 쉬운 |
| --- | :---: | :---: |
| 6이 나와야 출발 | ✅ | ❌ |
| 6이 나오면 한 번 더 | ✅ | ✅ |
| 6이 세 번 연속이면 차례 끝 | ✅ | ❌ |
| 잡거나 골인하면 한 번 더 | ✅ | ✅ |
| 안전칸(★)에서는 잡히지 않음 | ✅ | ✅ |
| 정확한 수로만 골인 | ✅ | ❌ |
| 1등이 나오면 끝 | ❌ | ❌ |

### 지구 한 바퀴 (2~4명)

세계 22개 도시를 여행하며 땅을 사고 건물을 지어 통행료를 받는 부자 되기 게임입니다.

- 주사위 2개, 더블이면 한 번 더 (세 번 연속이면 🛂 여권 분실)
- 도시를 사면서 🏠 집 → 🏢 빌딩 → 🏨 호텔까지 지을 수 있고, 내 도시에 다시 오면 더 올릴 수 있음
- 🧳 여행 카드 16종, 🎉 세계 축제(통행료 2배), ✈️ 비행기(원하는 칸으로 이동)
- 돈이 모자라면 건물·땅을 반값에 자동으로 팔고, 그래도 모자라면 파산
- 끝내는 방법 선택: 정해진 라운드 / 한 명 파산하면 끝 / 끝까지
- 조작: 주사위는 버튼 또는 `Space`, 카드 확인은 `Enter`, 도시 칸을 클릭하면 자세한 정보

## 이미지 출처

"지구 한 바퀴"의 도시 사진은 모두 [위키미디어 공용](https://commons.wikimedia.org/)의 자유 라이선스 이미지
(퍼블릭 도메인, CC0, CC BY, CC BY-SA, 공공누리 제1유형)를 판에 맞게 잘라 크기를 줄인 것입니다.

- 사진마다 저작자·라이선스·원본 주소는 게임 안 **🖼️ 이미지 출처** 버튼과
  [`src/games/world/imageCredits.ts`](src/games/world/imageCredits.ts)에 있습니다.
- `src/games/world/assets/cities/`의 사진은 이 저장소의 코드와 별개로 **각 원본의 라이선스**를 따릅니다.
- 사진을 바꾸려면 `scripts/fetch-city-images.py`의 `CITIES`를 고치고 `python3 scripts/fetch-city-images.py`를 실행합니다. (Pillow 필요)

## 자동 빌드와 배포

`.github/workflows/build.yml`이 push할 때마다 실행됩니다.

1. **모든 브랜치·PR**: 타입 검사 → 테스트 → 빌드 → zip을 Actions 아티팩트로 보관
2. **기본 브랜치에 push**:
   - [Releases](https://github.com/lengbong/BoardGame/releases)의 `최신 빌드`(태그 `latest`)를 새 zip으로 교체
   - GitHub Pages에 배포
3. **`v*` 태그 push** (예: `v1.0.0`): 그 버전의 릴리스를 따로 만들어 보관

> Pages 배포는 저장소 **Settings → Pages → Source**가 **GitHub Actions**로 되어 있어야 동작합니다. (설정 완료됨)

## 개발

Node.js 22 이상이 필요합니다.

```bash
npm install
```

```bash
npm run dev        # 개발 서버 (http://localhost:5173)
```

```bash
npm test           # 규칙·컴퓨터 플레이어 테스트
```

```bash
npm run build      # dist/index.html 한 파일로 빌드
```

빌드 결과는 JS·CSS가 모두 들어간 `dist/index.html` 한 파일이라서 `file://`로 열어도 실행됩니다.

### 구조

```
src/
  App.tsx                 처음 화면 (게임 선택)
  games/registry.ts       게임 목록 — 새 게임은 여기에 추가
  games/common/           여러 게임이 함께 쓰는 자리·속도 정의
  games/race/             말판 경주
    rules.ts              규칙 (순수 함수, UI와 분리)
    ai.ts                 컴퓨터 플레이어
    board.ts              판 좌표
    RaceGame.tsx …        화면
  games/world/            지구 한 바퀴 (같은 구조 + 도시 사진)
  components/             공용 화면 조각 (주사위, 자리 선택)
  lib/                    공용 도구 (저장, 효과음, 타이머)
scripts/                  도시 사진 받기 스크립트
```

새 게임 추가: `src/games/<게임>/`에 컴포넌트를 만들고 `src/games/registry.ts`의 `GAMES`에 등록하면 처음 화면에 나타납니다.
