#!/usr/bin/env python3
"""
'하늘길 항공사' 공항 도면을 오픈스트리트맵(OpenStreetMap)에서 받아 src/games/airline/airportMaps.ts 로 만든다.

- 공항마다 노미나팀(Nominatim)으로 공항 경계(aeroway=aerodrome)를 찾고,
  OSM API(api.openstreetmap.org)의 map 호출로 그 둘레만 받는다. 한 번에 받을 수 있는 점 수(5만 개)를
  넘으면 네 조각으로 나눠 받는다. 서버에 부담이 적게 1초에 한 번씩만 묻는다.
- 활주로·유도로·계류장·터미널·격납고·관제탑·주기장(비행기 세우는 자리)·바다·호수를 골라
  공항 한가운데를 기준으로 m 단위 좌표로 바꾸고, 점을 줄여(더글러스-포이커) SVG 경로 글자로 저장한다.
- 바다는 해안선(natural=coastline, 왼쪽이 땅)을 틀 가장자리에서 이어 붙여 땅 모양을 만든다.
- 문 닫은 옛 공항(카이탁·엘리니콘)은 OSM에 활주로가 남아 있지 않아서, 아래 MANUAL에 적은
  활주로·계류장·터미널 자리(옛 지도와 지금 남은 땅 모양으로 어림)를 쓰고 주변 바다·땅만 OSM에서 받는다.
- 지도 데이터 © OpenStreetMap 기여자, ODbL 1.0 (게임 화면과 사진 출처 창에 적는다).
- CI에서는 실행하지 않는다. 공항을 더하거나 다시 받고 싶을 때만 직접 실행한다.

사용법:
  python3 scripts/fetch-airport-maps.py --cache /tmp/osm-cache              # 전부 (받은 응답은 캐시에 둔다)
  python3 scripts/fetch-airport-maps.py --cache /tmp/osm-cache --only RKSI,VHHH
  python3 scripts/fetch-airport-maps.py --cache /tmp/osm-cache --preview /tmp/airports.html
      # 만든 도면을 한 장의 HTML로 모아 본다
필요: 파이썬 3.9+ (표준 라이브러리만)
"""
import argparse
import gzip
import hashlib
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_TS = ROOT / "src" / "games" / "airline" / "airportMaps.ts"
OSM_API = "https://api.openstreetmap.org/api/0.6"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "BoardGameAirportMapFetcher/1.0 (one-time import of airport layouts)"

# ICAO → 공항 기준점 (OurAirports의 위도·경도). 노미나팀으로 경계를 찾을 때 이 둘레에서 찾는다.
AIRPORTS = {
    "RKSS": (37.5583, 126.791),
    "RKSI": (37.469101, 126.450996),
    "RKPK": (35.179501, 128.938004),
    "RKPC": (33.512058, 126.492548),
    "RJTT": (35.549678, 139.786958),
    "RJAA": (35.76858, 140.388714),
    "RJOO": (34.780853, 135.440829),
    "RJBB": (34.427299, 135.244003),
    "ZBAA": (40.077349, 116.596702),
    "ZSSS": (31.198104, 121.33426),
    "ZSPD": (31.1434, 121.805),
    "VHHH": (22.31184, 113.914862),
    "RCSS": (25.067244, 121.552822),
    "RCTP": (25.0777, 121.233002),
    "WSAP": (1.36042, 103.910004),
    "WSSS": (1.35019, 103.994003),
    "VTBD": (13.9126, 100.607002),
    "VTBS": (13.6811, 100.747002),
    "WMSA": (3.13058, 101.549004),
    "WMKK": (2.74558, 101.709999),
    "WIHH": (-6.266989, 106.890318),
    "WIII": (-6.12557, 106.655998),
    "RPLL": (14.5086, 121.019997),
    "VVTS": (10.8188, 106.652),
    "WADD": (-8.748409, 115.167123),
    "YSSY": (-33.946098, 151.177002),
    "NZAA": (-37.01199, 174.786331),
    "PHNL": (21.318387, -157.92567),
    "PGUM": (13.485, 144.797282),
    "VIDP": (28.55563, 77.09519),
    "VABB": (19.088699, 72.867897),
    "VCCC": (6.821638, 79.885859),
    "VCBI": (7.180759906768799, 79.88410186767578),
    "VRMM": (4.19183, 73.529099),
    "VNKT": (27.6966, 85.3591),
    "OMDB": (25.24979, 55.370992),
    "OTBD": (25.259431, 51.565528),
    "OTHH": (25.273056, 51.608056),
    "EGLL": (51.470748, -0.459909),
    "LFPO": (48.729499, 2.358963),
    "LFPG": (49.00896, 2.554117),
    "EDDF": (50.026706, 8.55835),
    "EHAM": (52.308601, 4.76389),
    "LSZH": (47.458056, 8.548056),
    "LIRF": (41.804532, 12.251998),
    "LIML": (45.445099, 9.27674),
    "LIMC": (45.6306, 8.72811),
    "LEBL": (41.2971, 2.07846),
    "LEMD": (40.493407, -3.572249),
    "LGAV": (37.936401, 23.9445),
    "LTBA": (40.971913, 28.823714),
    "LTFM": (41.274874, 28.732136),
    "UUEE": (55.977486, 37.386677),
    "HECA": (30.111534, 31.396694),
    "HKJK": (-1.318886, 36.928233),
    "FAOR": (-26.140081, 28.246801),
    "FACT": (-33.97403, 18.604333),
    "DNMM": (6.57737, 3.32116),
    "GMMN": (33.3675, -7.58997),
    "KJFK": (40.639447, -73.779317),
    "KLAX": (33.942501, -118.407997),
    "KSFO": (37.619806, -122.374821),
    "KORD": (41.9786, -87.9048),
    "KMIA": (25.796011, -80.289751),
    "CYVR": (49.193901, -123.183998),
    "CYYZ": (43.675935, -79.629421),
    "CYUL": (45.467837, -73.742294),
    "CYMX": (45.679501, -74.038696),
    "MMMX": (19.435822, -99.07033),
    "SBSP": (-23.627657, -46.654601),
    "SBGR": (-23.431274, -46.469954),
    "SBGL": (-22.809999, -43.250557),
    "SAEZ": (-34.8222, -58.5358),
}

# 문 닫은 옛 공항: OSM에 활주로가 없어서 직접 적는다 (위도, 경도).
#   frame: 받아 올 틀 (남, 서, 북, 동)
#   runways: (끝1, 끝2, 폭 m, 이름)
#   aprons / terminals: 다각형
MANUAL = {
    # 홍콩 카이탁 (1925~1998). 바다로 뻗은 활주로 13/31 (3,390 m × 61 m).
    # 활주로 자리는 지금도 길쭉한 땅(크루즈 터미널·활주로 공원)으로 남아 있어, 그 땅의 해안선 방향(131°)과 끝으로 활주로를 어림했다.
    # 터미널과 계류장은 활주로 뿌리 쪽 북동편 (옛 사진으로 어림).
    "VHHX": {
        "frame": (22.296, 114.181, 22.340, 114.226),
        "runways": [((22.324196, 114.191946), (22.304001, 114.216715), 61, "13/31")],
        "taxiways": [[(22.324136, 114.193568), (22.305252, 114.216729)]],
        "field": [[(22.323702, 114.190708), (22.302861, 114.216418), (22.304733, 114.218177), (22.320042, 114.199399), (22.322934, 114.202118), (22.328534, 114.19525)]],
        "aprons": [[(22.325233, 114.193696), (22.320646, 114.199322), (22.322415, 114.200985), (22.327002, 114.195359)]],
        "terminals": [[(22.326713, 114.195861), (22.323675, 114.199587), (22.324151, 114.200035), (22.327189, 114.196309)]],
    },
    # 아테네 엘리니콘 (1938~2001). 바닷가를 따라 난 활주로 두 개는 OSM에 abandoned:aeroway=runway로 남아 있다.
    # 서쪽(사리넨이 지은 서 터미널, 지금도 남은 건물 옆)과 동쪽(동 터미널) 계류장은 남은 건물 자리로 어림.
    "LGAT": {
        "frame": (37.866, 23.708, 37.912, 23.760),
        "runways": [],
        "refs": {1491361828: "15L/33R", 1491361829: "15R/33L"},
        "field_pad": (230, 160),
        "aprons": [
            [(37.897142, 23.723924), (37.892224, 23.726811), (37.89146, 23.724748), (37.896377, 23.721861)],
            [(37.887339, 23.734331), (37.882418, 23.737212), (37.88299, 23.73876), (37.887911, 23.735879)],
        ],
        "terminals": [
            [(37.895148, 23.722583), (37.892935, 23.723882), (37.892705, 23.723263), (37.894918, 23.721964)],
            [(37.885861, 23.73708), (37.8834, 23.73852), (37.883591, 23.739036), (37.886051, 23.737596)],
        ],
    },
}

# 노미나팀이 공군 기지 경계를 먼저 찾는 곳: 민간 공항 경계를 직접 고른다
PICK = {
    "VTBD": ("way", 159466978),
    "WIHH": ("way", 155963037),
    "OTBD": ("way", 1040912576),
}

# 지금은 OSM에서 지워졌지만 그 공항이 대표 공항이던 때 쓰던 활주로 (OurAirports 기록, 위도·경도)
EXTRA_RUNWAYS = {
    # 아타튀르크: 남북 활주로 둘은 2019년 뒤 공원·병원 자리가 되었다
    "LTBA": [
        ((40.996399, 28.8085), (40.969501, 28.8095), 45, "17L/35R"),
        ((40.996399, 28.806), (40.969299, 28.806999), 45, "17R/35L"),
    ],
}

MILITARY_NAME = re.compile(r"air ?base|pangkalan udara|ฐานทัพ|قاعدة|base a[ée]rea|military|공군", re.I)


# ------------------------------------------------------------------ 받기


class Http:
    def __init__(self, cache: Path | None):
        self.cache = cache
        self.last: dict[str, float] = {}
        if cache:
            cache.mkdir(parents=True, exist_ok=True)

    def get(self, url: str, retries: int = 6) -> tuple[int, bytes]:
        key = hashlib.sha1(url.encode()).hexdigest()
        if self.cache:
            hit = self.cache / f"{key}.bin"
            meta = self.cache / f"{key}.status"
            if hit.exists() and meta.exists():
                return int(meta.read_text()), hit.read_bytes()
        host = urllib.parse.urlparse(url).netloc
        delay = 5.0
        for attempt in range(retries):
            wait = self.last.get(host, 0) + 1.1 - time.time()
            if wait > 0:
                time.sleep(wait)
            self.last[host] = time.time()
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    body = r.read()
                    if r.headers.get("Content-Encoding") == "gzip":
                        body = gzip.decompress(body)
                    status = r.status
            except urllib.error.HTTPError as e:
                body = e.read()
                if e.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
                status = e.code
                if status in (429, 500, 502, 503, 504) and attempt < retries - 1:
                    print(f"    {status} → {delay:.0f}초 쉬고 다시", file=sys.stderr)
                    time.sleep(delay)
                    delay *= 2
                    continue
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                if attempt < retries - 1:
                    print(f"    {e} → {delay:.0f}초 쉬고 다시", file=sys.stderr)
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise
            if self.cache:
                (self.cache / f"{key}.bin").write_bytes(body)
                (self.cache / f"{key}.status").write_text(str(status))
            return status, body
        raise RuntimeError(f"못 받았어요: {url}")


def find_aerodrome(http: Http, icao: str, lat: float, lon: float) -> dict:
    """노미나팀으로 기준점 둘레의 공항 경계를 찾는다"""
    d = 0.04
    best = None
    for q in ("airport", "aerodrome", icao):
        params = {
            "format": "json",
            "q": q,
            "viewbox": f"{lon - d},{lat + d},{lon + d},{lat - d}",
            "bounded": 1,
            "extratags": 1,
            "limit": 10,
        }
        status, body = http.get(f"{NOMINATIM}?{urllib.parse.urlencode(params)}")
        if status != 200:
            continue
        for r in json.loads(body):
            if r.get("class") != "aeroway" or r.get("type") != "aerodrome" or r.get("osm_type") == "node":
                continue
            s, n, w, e = (float(x) for x in r["boundingbox"])
            tags = r.get("extratags") or {}
            score = (n - s) * (e - w)
            if tags.get("icao") == icao:
                score *= 100
            if MILITARY_NAME.search(r.get("name") or "") or tags.get("military"):
                score *= 0.05
            if "international" in (tags.get("aerodrome") or "") + (tags.get("aerodrome:type") or ""):
                score *= 3
            if s <= lat <= n and w <= lon <= e:
                score *= 10
            if best is None or score > best[0]:
                best = (score, r)
        if best and best[0] > 0:
            break
    if not best:
        raise RuntimeError(f"{icao}: 공항 경계를 못 찾았어요")
    return best[1]


def fetch_full(http: Http, osm_type: str, osm_id: int) -> dict:
    status, body = http.get(f"{OSM_API}/{osm_type}/{osm_id}/full.json")
    if status != 200:
        raise RuntimeError(f"{osm_type}/{osm_id}: {status} {body[:200]!r}")
    return json.loads(body)


def fetch_map(http: Http, s: float, w: float, n: float, e: float, depth: int = 0) -> list:
    """틀 안의 OSM 요소 전부 (너무 많으면 네 조각으로 나눠 받는다)"""
    if (n - s) * (e - w) > 0.24:
        return split_fetch(http, s, w, n, e, depth)
    url = f"{OSM_API}/map.json?bbox={w:.5f},{s:.5f},{e:.5f},{n:.5f}"
    status, body = http.get(url)
    if status == 400 and b"too many nodes" in body.lower() or status == 509:
        return split_fetch(http, s, w, n, e, depth)
    if status != 200:
        raise RuntimeError(f"map {url}: {status} {body[:200]!r}")
    print(f"    {'  ' * depth}조각 {len(body) / 1e6:.1f} MB", file=sys.stderr)
    return json.loads(body)["elements"]


def split_fetch(http: Http, s, w, n, e, depth):
    if depth > 6:
        raise RuntimeError("너무 잘게 나눠야 해요")
    mlat = (s + n) / 2
    mlon = (w + e) / 2
    out = []
    for bb in ((s, w, mlat, mlon), (s, mlon, mlat, e), (mlat, w, n, mlon), (mlat, mlon, n, e)):
        out.extend(fetch_map(http, *bb, depth=depth + 1))
    return out


# ------------------------------------------------------------------ 기하


class Proj:
    """위경도 → 틀 왼쪽 위를 (0,0)으로 하는 m 좌표 (x 동쪽, y 남쪽)"""

    def __init__(self, s, w, n, e):
        self.s, self.w, self.n, self.e = s, w, n, e
        lat0 = math.radians((s + n) / 2)
        self.mx = 111320.0 * math.cos(lat0)
        self.my = 110574.0
        self.W = (e - w) * self.mx
        self.H = (n - s) * self.my

    def __call__(self, lat, lon):
        return ((lon - self.w) * self.mx, (self.n - lat) * self.my)


def area(ring):
    """넓이 (y가 아래로 가는 좌표에서 시계 방향이 +)"""
    a = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        a += x1 * y2 - x2 * y1
    return a / 2


def centroid(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def point_in(pt, ring):
    x, y = pt
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def dp(pts, tol):
    """더글러스-포이커로 점 줄이기"""
    if len(pts) < 3:
        return list(pts)
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L < 1e-9:
                dist = math.hypot(px - ax, py - ay)
            else:
                dist = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if dist > best:
                best, bi = dist, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def dp_ring(ring, tol):
    if len(ring) < 4:
        return ring
    # 가장 먼 두 점으로 나눠서 줄인다 (닫힌 고리는 시작점 근처가 뭉개지지 않게)
    i0 = 0
    far = max(range(len(ring)), key=lambda i: (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2)
    a = dp(ring[i0 : far + 1], tol)
    b = dp(ring[far:] + [ring[0]], tol)
    return a[:-1] + b[:-1]


def clip_poly(ring, W, H):
    """사각형 [0,W]×[0,H]로 다각형 자르기 (서덜랜드-호지먼)"""

    def clip(pts, inside, inter):
        out = []
        if not pts:
            return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
            prev = cur
        return out

    def ix(x0):
        return lambda p, q: (x0, p[1] + (q[1] - p[1]) * (x0 - p[0]) / ((q[0] - p[0]) or 1e-12))

    def iy(y0):
        return lambda p, q: (p[0] + (q[0] - p[0]) * (y0 - p[1]) / ((q[1] - p[1]) or 1e-12), y0)

    pts = ring
    pts = clip(pts, lambda p: p[0] >= 0, ix(0))
    pts = clip(pts, lambda p: p[0] <= W, ix(W))
    pts = clip(pts, lambda p: p[1] >= 0, iy(0))
    pts = clip(pts, lambda p: p[1] <= H, iy(H))
    return pts


def clip_line(pts, W, H):
    """선을 사각형으로 잘라 안에 든 토막들 (리앙-바스키)"""
    out = []
    cur = []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        t0, t1 = 0.0, 1.0
        ok = True
        for p, q in ((-dx, x0), (dx, W - x0), (-dy, y0), (dy, H - y0)):
            if abs(p) < 1e-12:
                if q < 0:
                    ok = False
                    break
            else:
                r = q / p
                if p < 0:
                    t0 = max(t0, r)
                else:
                    t1 = min(t1, r)
        if not ok or t0 > t1:
            if cur:
                out.append(cur)
                cur = []
            continue
        a = (x0 + t0 * dx, y0 + t0 * dy)
        b = (x0 + t1 * dx, y0 + t1 * dy)
        if not cur:
            cur = [a]
        elif math.hypot(cur[-1][0] - a[0], cur[-1][1] - a[1]) > 1e-6:
            out.append(cur)
            cur = [a]
        cur.append(b)
        if t1 < 1.0:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return [c for c in out if len(c) >= 2]


# ------------------------------------------------------------------ 해안선 → 땅


def perim_pos(p, W, H):
    """틀 둘레 위의 자리 (왼쪽 위에서 시작해 화면 기준 시계 반대 방향: 왼쪽 변 아래로 → 아래 변 → 오른쪽 변 위로 → 위 변)"""
    x, y = p
    eps = 0.5
    if abs(x) <= eps:
        return y
    if abs(y - H) <= eps:
        return H + x
    if abs(x - W) <= eps:
        return H + W + (H - y)
    if abs(y) <= eps:
        return 2 * H + W + (W - x)
    return None


def perim_point(t, W, H):
    P = 2 * (W + H)
    t %= P
    if t <= H:
        return (0.0, t)
    if t <= H + W:
        return (t - H, H)
    if t <= 2 * H + W:
        return (W, H - (t - H - W))
    return (W - (t - 2 * H - W), 0.0)


def land_polygons(chains, W, H):
    """해안선 토막(왼쪽이 땅)들로 틀 안의 땅 다각형을 만든다.
    화면 좌표(y 아래)에서 해안선을 따라 걸으면 땅은 왼쪽, 곧 화면에서 반시계 쪽이 아니라…
    → y가 아래로 가므로 '왼쪽'은 진행 방향을 반시계로 90° 돌린 쪽이 화면에서는 시계 방향이 된다.
    틀 가장자리를 따라 갈 때는 땅을 왼쪽에 두도록, 화면 기준 '시계 반대'로 둘레를 돈다 (perim_pos의 방향)."""
    pieces = []
    islands = []
    for ch in chains:
        closed = len(ch) > 3 and math.hypot(ch[0][0] - ch[-1][0], ch[0][1] - ch[-1][1]) < 0.01
        inside_all = all(0 <= x <= W and 0 <= y <= H for x, y in ch)
        if closed and inside_all:
            islands.append(ch[:-1])
            continue
        for seg in clip_line(ch, W, H):
            a = perim_pos(seg[0], W, H)
            b = perim_pos(seg[-1], W, H)
            if a is None or b is None:
                continue  # 틀 안에서 끊긴 해안선 (자료가 모자람)
            pieces.append({"pts": seg, "a": a, "b": b, "used": False})
    polys = []
    P = 2 * (W + H)
    for start in pieces:
        if start["used"]:
            continue
        ring = []
        cur = start
        guard = 0
        while True:
            guard += 1
            if guard > 10000:
                break
            cur["used"] = True
            ring.extend(cur["pts"])
            # 나간 자리에서 둘레를 따라 다음으로 들어오는 토막까지
            t = cur["b"]
            cands = [p for p in pieces if not p["used"] or p is start]
            nxt = min(cands, key=lambda p: (p["a"] - t) % P)
            dist = (nxt["a"] - t) % P
            # 사이에 있는 모서리
            corners = [0.0, H, H + W, 2 * H + W]
            for c in sorted(((c - t) % P, c) for c in corners):
                if 1e-9 < c[0] < dist:
                    ring.append(perim_point(c[1], W, H))
            if nxt is start or nxt["used"]:
                break
            cur = nxt
        if len(ring) >= 3:
            polys.append(ring)
    return polys, islands


def join_chains(ways):
    """끝이 이어진 선(노드 id 목록)들을 길게 잇는다 (방향은 유지)"""
    ways = [list(w) for w in ways if len(w) >= 2]
    by_start = {}
    for i, w in enumerate(ways):
        by_start.setdefault(w[0], []).append(i)
    used = [False] * len(ways)
    chains = []
    for i, w in enumerate(ways):
        if used[i]:
            continue
        used[i] = True
        ch = list(w)
        # 앞으로 잇기
        while True:
            nx = [j for j in by_start.get(ch[-1], []) if not used[j]]
            if not nx or ch[-1] == ch[0]:
                break
            used[nx[0]] = True
            ch.extend(ways[nx[0]][1:])
        chains.append(ch)
    # 뒤에서 잇기 (앞 사슬의 끝이 다른 사슬의 시작인 경우를 한 번 더)
    changed = True
    while changed:
        changed = False
        starts = {c[0]: k for k, c in enumerate(chains) if c[0] != c[-1]}
        for k, c in enumerate(chains):
            if c is None or c[0] == c[-1]:
                continue
            j = starts.get(c[-1])
            if j is not None and j != k and chains[j] is not None:
                c.extend(chains[j][1:])
                chains[j] = None
                changed = True
                starts = {cc[0]: kk for kk, cc in enumerate(chains) if cc is not None and cc[0] != cc[-1]}
        chains = [c for c in chains if c is not None]
    return chains


def join_undirected(ways, coord):
    """방향이 섞인 선들을 갈림길에서 가장 곧게 이어지는 쪽으로 이어 붙인다 (유도로)"""
    ways = [list(w) for w in ways if len(w) >= 2]
    at = {}
    for i, w in enumerate(ways):
        at.setdefault(w[0], []).append(i)
        at.setdefault(w[-1], []).append(i)
    used = [False] * len(ways)

    def heading(a, b):
        pa, pb = coord(a), coord(b)
        if pa is None or pb is None:
            return None
        return math.atan2(pb[1] - pa[1], pb[0] - pa[0])

    def extend(ch):
        while True:
            end = ch[-1]
            h0 = heading(ch[-2], ch[-1])
            best = None
            for j in at.get(end, []):
                if used[j]:
                    continue
                w = ways[j] if ways[j][0] == end else list(reversed(ways[j]))
                h1 = heading(w[0], w[1])
                if h0 is None or h1 is None:
                    continue
                turn = abs((h1 - h0 + math.pi) % (2 * math.pi) - math.pi)
                if turn < math.radians(70) and (best is None or turn < best[0]):
                    best = (turn, j, w)
            if not best:
                return ch
            used[best[1]] = True
            ch.extend(best[2][1:])

    chains = []
    order = sorted(range(len(ways)), key=lambda i: -len(ways[i]))
    for i in order:
        if used[i]:
            continue
        used[i] = True
        ch = extend(list(ways[i]))
        ch = extend(list(reversed(ch)))
        chains.append(ch)
    return chains


def rings_from_ways(ways):
    """방향이 섞인 선들을 이어 닫힌 고리들로 (멀티폴리곤 조립)"""
    ways = [list(w) for w in ways if len(w) >= 2]
    rings = []
    while ways:
        cur = ways.pop()
        progressed = True
        while cur[0] != cur[-1] and progressed:
            progressed = False
            for i, w in enumerate(ways):
                if w[0] == cur[-1]:
                    cur.extend(w[1:])
                elif w[-1] == cur[-1]:
                    cur.extend(reversed(w[:-1]))
                elif w[-1] == cur[0]:
                    cur = w[:-1] + cur
                elif w[0] == cur[0]:
                    cur = list(reversed(w[1:])) + cur
                else:
                    continue
                ways.pop(i)
                progressed = True
                break
        if cur[0] == cur[-1] and len(cur) >= 4:
            rings.append(cur[:-1])
    return rings


# ------------------------------------------------------------------ 글자로


def fmt_path(polys, closed=True):
    out = []
    pen = None  # 지금 펜 자리 (z 뒤에는 그 경로의 시작점, 열린 선 뒤에는 끝점)
    for pts in polys:
        q = [(round(x), round(y)) for x, y in pts]
        # 같은 점 겹침 지우기
        qq = [q[0]]
        for p in q[1:]:
            if p != qq[-1]:
                qq.append(p)
        if closed and len(qq) > 1 and qq[0] == qq[-1]:
            qq.pop()
        if len(qq) < (3 if closed else 2):
            continue
        s = f"M{qq[0][0]} {qq[0][1]}" if pen is None else f"m{qq[0][0] - pen[0]} {qq[0][1] - pen[1]}"
        pen = qq[0] if closed else qq[-1]
        parts = []
        for (x0, y0), (x1, y1) in zip(qq, qq[1:]):
            parts.append(f"{x1 - x0} {y1 - y0}")
        s += "l" + " ".join(parts)
        s = s.replace(" -", "-")
        if closed:
            s += "z"
        out.append(s)
    return "".join(out)


def parse_width(v, default):
    if not v:
        return default
    m = re.match(r"\s*([\d.]+)\s*(m|ft|')?", str(v))
    if not m:
        return default
    w = float(m.group(1))
    if m.group(2) in ("ft", "'"):
        w *= 0.3048
    return w if 5 <= w <= 120 else default


LABEL_KO = [
    (r"^International (Passenger )?Terminal$", "국제선 터미널"),
    (r"^Domestic (Passenger )?Terminal$", "국내선 터미널"),
    (r"^International Terminal\s*T?(\d+)$", r"국제선 제\1터미널"),
    (r"^Domestic Terminal\s*T?(\d+)$", r"국내선 제\1터미널"),
    (r"^(Passenger )?Terminal\s*T?(\d+)$", r"제\2터미널"),
    (r"^Terminal\s*([A-Z0-9]{1,3})$", r"\1 터미널"),
    (r"^(Concourse|Pier)\s*([A-Z0-9]{1,3})$", r"\2 탑승동"),
    (r"^(Concourse|Pier)( Area)?$", "탑승동"),
    (r"^Satellite.*$", "위성 탑승동"),
    (r"^(Passenger )?Terminal( Building)?$", "여객 터미널"),
    (r"^Terminal de Passageiros$", "여객 터미널"),
    (r"^Cargo Terminal$|^Terminal de Cargas$", "화물 터미널"),
]


def clean_label(tags: dict) -> str | None:
    """터미널 이름을 짧게: 한국어 이름이 있으면 그것(공항 이름은 떼고), 아니면 영어 이름에서 공항 이름을 떼고 흔한 말은 우리말로"""
    ko = tags.get("name:ko")
    if ko:
        rest = re.sub(r"^.*?공항\s*", "", ko).strip()
        if not rest or rest == "터미널 빌딩":
            return "여객 터미널" if rest else None
        return rest[:20]
    name = tags.get("name:en") or tags.get("name")
    if not name:
        return None
    m = re.search(r"((?:International|Domestic|Passenger)\s+)?(Terminal|Concourse|Satellite|Pier)\b.*$", name)
    if m:
        name = m.group(0).strip()
    # 'Terminal 5 - International', 'Terminal 3 (Building #8)' → 'Terminal 5', 'Terminal 3'
    name = re.split(r"\s+[-–]\s+|\s*\(", name)[0].strip().rstrip(")")
    # 'Terminal 1 Flugsteig B', 'Terminal 2 South Wing' → 'Terminal 1'
    short = re.match(r"^((?:International |Domestic )?Terminal\s*T?\d+[A-Z]?)\b", name)
    if short:
        name = short.group(1)
    for pat, rep in LABEL_KO:
        if re.match(pat, name):
            return re.sub(pat, rep, name)
    if re.search(r"Terminal|Concourse|Pier|Satellite", name):
        return name[:24]
    return None


# ------------------------------------------------------------------ 공항 하나


def is_aero(tags, key, manual):
    if tags.get("aeroway") == key:
        return True
    if manual:
        for pre in ("disused:", "abandoned:", "was:", "historic:", "razed:"):
            if tags.get(pre + "aeroway") == key:
                return True
    return False


def build_airport(http: Http, icao: str) -> dict:
    manual = MANUAL.get(icao)
    boundary_rings_ll = []
    if manual:
        s, w, n, e = manual["frame"]
    else:
        lat, lon = AIRPORTS[icao]
        if icao in PICK:
            r = {"osm_type": PICK[icao][0], "osm_id": PICK[icao][1], "name": icao}
        else:
            r = find_aerodrome(http, icao, lat, lon)
        full = fetch_full(http, r["osm_type"], int(r["osm_id"]))
        nodes = {el["id"]: (el["lat"], el["lon"]) for el in full["elements"] if el["type"] == "node"}
        ways = {el["id"]: el["nodes"] for el in full["elements"] if el["type"] == "way"}
        if r["osm_type"] == "way":
            wnodes = ways[int(r["osm_id"])]
            boundary_rings_ll.append([nodes[i] for i in wnodes[:-1] if i in nodes])
        else:
            rel = next(el for el in full["elements"] if el["type"] == "relation" and el["id"] == int(r["osm_id"]))
            outer = [ways[m["ref"]] for m in rel["members"] if m["type"] == "way" and m.get("role", "outer") in ("outer", "") and m["ref"] in ways]
            for ring in rings_from_ways(outer):
                boundary_rings_ll.append([nodes[i] for i in ring if i in nodes])
        lats = [p[0] for ring in boundary_rings_ll for p in ring]
        lons = [p[1] for ring in boundary_rings_ll for p in ring]
        # 옛 활주로도 틀 안에
        for p1, p2, _, _ in EXTRA_RUNWAYS.get(icao, []):
            lats += [p1[0], p2[0]]
            lons += [p1[1], p2[1]]
        s, n, w, e = min(lats), max(lats), min(lons), max(lons)
        # 둘레를 조금 넓힌다 (바다·주변이 조금 보이게)
        dlat = max((n - s) * 0.06, 250 / 110574)
        dlon = max((e - w) * 0.06, 250 / (111320 * math.cos(math.radians((s + n) / 2))))
        s, n, w, e = s - dlat, n + dlat, w - dlon, e + dlon
        print(f"  {icao}: {r['osm_type']}/{r['osm_id']} {r.get('name')}", file=sys.stderr)

    proj = Proj(s, w, n, e)
    W, H = proj.W, proj.H
    els = fetch_map(http, s, w, n, e)
    nodes = {}
    ways = {}
    rels = {}
    for el in els:
        if el["type"] == "node":
            nodes[el["id"]] = el
        elif el["type"] == "way":
            ways[el["id"]] = el
        else:
            rels[el["id"]] = el

    def xy(nid):
        nd = nodes.get(nid)
        return proj(nd["lat"], nd["lon"]) if nd else None

    def way_pts(wid):
        w_ = ways.get(wid)
        if not w_:
            return None
        pts = [xy(i) for i in w_["nodes"]]
        if any(p is None for p in pts):
            return None
        return pts

    def polys_of(pred, with_rel=True):
        """조건에 맞는 닫힌 길 + 멀티폴리곤 → [(tags, ring)]"""
        out = []
        for w_ in ways.values():
            t = w_.get("tags") or {}
            if not pred(t) or w_["nodes"][0] != w_["nodes"][-1] or len(w_["nodes"]) < 4:
                continue
            pts = way_pts(w_["id"])
            if pts:
                out.append((t, pts[:-1]))
        if with_rel:
            for r_ in rels.values():
                t = r_.get("tags") or {}
                if t.get("type") != "multipolygon" or not pred(t):
                    continue
                outer = [ways[m["ref"]]["nodes"] for m in r_["members"] if m["type"] == "way" and m.get("role") in ("outer", "") and m["ref"] in ways]
                for ring in rings_from_ways(outer):
                    pts = [xy(i) for i in ring]
                    if all(p is not None for p in pts):
                        out.append((t, pts))
        return out

    # 공항 경계 (잔디)
    if manual:
        field = [ring for t, ring in polys_of(lambda t: is_aero(t, "aerodrome", True))]
        field = [r_ for r_ in field if abs(area(r_)) > 200000]
        field += [[proj(*p) for p in ring] for ring in manual.get("field", [])]
    else:
        field = [[proj(la, lo) for la, lo in ring] for ring in boundary_rings_ll]
    # 옛 활주로 둘레도 잔디로
    for p1, p2, width, _ in EXTRA_RUNWAYS.get(icao, []):
        a, b = proj(*p1), proj(*p2)
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        nv = (-u[1], u[0])
        side, end = 110, 90
        field.append([(q[0] + u[0] * du + nv[0] * dn, q[1] + u[1] * du + nv[1] * dn) for q, du, dn in ((a, -end, -side), (b, end, -side), (b, end, side), (a, -end, side))])
    if manual and manual.get("field_pad"):
        # 활주로들을 감싸는 긴 네모 (활주로 방향으로 돌린)
        ends = []
        for w_ in ways.values():
            t = w_.get("tags") or {}
            if is_aero(t, "runway", True) and w_["nodes"][0] != w_["nodes"][-1]:
                pts = way_pts(w_["id"])
                if pts and math.hypot(pts[-1][0] - pts[0][0], pts[-1][1] - pts[0][1]) > 800:
                    ends.append((pts[0], pts[-1]))
        ends += [(proj(*p1), proj(*p2)) for p1, p2, _, _ in manual["runways"]]
        if ends:
            a, b = max(ends, key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1]))
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
            nv = (-u[1], u[0])
            allp = [q for ab in ends for q in ab]
            us = [q[0] * u[0] + q[1] * u[1] for q in allp]
            ns = [q[0] * nv[0] + q[1] * nv[1] for q in allp]
            side, end = manual["field_pad"]
            u0, u1, n0, n1 = min(us) - end, max(us) + end, min(ns) - side, max(ns) + side
            field.append([(uu * u[0] + nn * nv[0], uu * u[1] + nn * nv[1]) for uu, nn in ((u0, n0), (u1, n0), (u1, n1), (u0, n1))])
    field_check = field or ([] if manual else [[(0, 0), (W, 0), (W, H), (0, H)]])

    def in_field(pt):
        return any(point_in(pt, r_) for r_ in field_check)

    def near_field(pt, dist):
        if in_field(pt):
            return True
        for ring in field_check:
            for i in range(len(ring)):
                a = ring[i]
                b = ring[(i + 1) % len(ring)]
                dx, dy = b[0] - a[0], b[1] - a[1]
                L2 = dx * dx + dy * dy or 1e-9
                u = max(0.0, min(1.0, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2))
                if math.hypot(pt[0] - a[0] - u * dx, pt[1] - a[1] - u * dy) < dist:
                    return True
        return False

    # 바다
    coast_ways = [w_["nodes"] for w_ in ways.values() if (w_.get("tags") or {}).get("natural") == "coastline"]
    chains = []
    for ch in join_chains(coast_ways):
        pts = [xy(i) for i in ch]
        if all(p is not None for p in pts):
            chains.append(pts)
    land, islands = land_polygons(chains, W, H)
    # 해안선이 틀 안에서 끊겨 땅을 못 만들었으면 바다로 칠하지 않는다
    sea = bool(land or islands)
    land_all = [dp_ring(r_, 6) for r_ in land + islands]

    # 호수·강 (닫힌 것만)
    def is_water(t):
        return t.get("natural") == "water" or t.get("waterway") == "riverbank" or t.get("landuse") in ("reservoir", "basin")

    water = []
    for t, ring in polys_of(is_water):
        if abs(area(ring)) < 15000:
            continue
        c = clip_poly(dp_ring(ring, 8), W, H)
        if len(c) >= 3:
            water.append(c)

    def keep_poly(pred, tol, min_area, need_in_field=True):
        out = []
        for t, ring in polys_of(pred):
            if abs(area(ring)) < min_area:
                continue
            if need_in_field and not in_field(centroid(ring)):
                continue
            c = clip_poly(dp_ring(ring, tol), W, H)
            if len(c) >= 3:
                out.append((t, c))
        return out

    aprons = keep_poly(lambda t: is_aero(t, "apron", bool(manual)), 5, 1500)

    def is_terminal(t):
        return is_aero(t, "terminal", bool(manual)) or t.get("building") == "terminal"

    def is_hangar(t):
        return is_aero(t, "hangar", bool(manual)) or t.get("building") == "hangar"

    terminals = keep_poly(is_terminal, 2.5, 300)
    hangars = keep_poly(lambda t: is_hangar(t) and not is_terminal(t), 2.5, 300)
    # 옛 공항 자리에 지금 선 건물(크루즈 터미널·경기장 등)은 그리지 않는다
    others = [] if manual else keep_poly(lambda t: bool(t.get("building")) and not is_terminal(t) and not is_hangar(t), 4, 5000)

    # 활주로 (가운데 선)
    runways = {}
    for w_ in ways.values():
        t = w_.get("tags") or {}
        if not is_aero(t, "runway", bool(manual)):
            continue
        if t.get("area") == "yes" or w_["nodes"][0] == w_["nodes"][-1]:
            continue
        if any(k in t for k in ("construction", "proposed")) or t.get("disused") == "yes" and not manual:
            continue
        pts = way_pts(w_["id"])
        if not pts or not near_field(centroid(pts), 300):
            continue
        if t.get("runway") in ("displaced_threshold", "blast_pad"):
            continue
        ref = (t.get("ref") or "").replace(" ", "")
        if manual:
            ref = manual.get("refs", {}).get(w_["id"], ref)
        width = parse_width(t.get("width"), 45)
        key = ref or f"w{w_['id']}"
        runways.setdefault(key, []).append((pts, width, ref))
    rwy = []
    for key, items in runways.items():
        allpts = [p for pts, _, _ in items for p in pts]
        # 가장 먼 두 점
        best = (0, allpts[0], allpts[-1])
        for i in range(len(allpts)):
            for j in range(i + 1, len(allpts)):
                d = math.hypot(allpts[i][0] - allpts[j][0], allpts[i][1] - allpts[j][1])
                if d > best[0]:
                    best = (d, allpts[i], allpts[j])
        L, a, b = best
        if L < 800:
            continue
        width = max(w for _, w, _ in items)
        ref = items[0][2]
        # 이름이 있으면 '작은 번호' 끝을 a로 (예: 15L/33R → a가 15L 쪽 끝)
        if ref and "/" in ref:
            first = ref.split("/")[0]
            m = re.match(r"(\d+)", first)
            if m:
                hdg = int(m.group(1)) * 10  # 이 끝에서 이륙하는 방향 (자북 기준이지만 어림으로 충분)
                ang = math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1]))) % 360  # a→b 방위
                if abs(((ang - hdg + 180) % 360) - 180) > 90:
                    a, b = b, a
        rwy.append([round(a[0]), round(a[1]), round(b[0]), round(b[1]), round(width), ref])
    for (p1, p2, width, ref) in EXTRA_RUNWAYS.get(icao, []):
        if any(r_[5] == ref for r_ in rwy):
            continue
        a = proj(*p1)
        b = proj(*p2)
        rwy.append([round(a[0]), round(a[1]), round(b[0]), round(b[1]), width, ref])
    if manual:
        for (p1, p2, width, ref) in manual["runways"]:
            a = proj(*p1)
            b = proj(*p2)
            rwy.append([round(a[0]), round(a[1]), round(b[0]), round(b[1]), width, ref])
        for ring in manual.get("aprons", []):
            aprons.append(({}, [proj(*p) for p in ring]))
        for ring in manual.get("terminals", []):
            terminals.append(({"name:ko": "여객 터미널"}, [proj(*p) for p in ring]))
    rwy.sort(key=lambda r_: -math.hypot(r_[2] - r_[0], r_[3] - r_[1]))

    # 유도로
    twy_ways = []
    for w_ in ways.values():
        t = w_.get("tags") or {}
        if not is_aero(t, "taxiway", bool(manual)):
            continue
        if t.get("area") == "yes":
            continue
        pts = way_pts(w_["id"])
        if not pts or not in_field(pts[len(pts) // 2]):
            continue
        width = parse_width(t.get("width"), 23)
        wclass = 15 if width < 18 else 23 if width < 30 else 30
        twy_ways.append((wclass, w_["nodes"]))
    twy = {}
    for wclass in sorted({c for c, _ in twy_ways}):
        chains_ = join_undirected([nds for c, nds in twy_ways if c == wclass], xy)
        lines = []
        for ch in chains_:
            pts = [xy(i) for i in ch]
            if any(p is None for p in pts):
                continue
            for seg in clip_line(pts, W, H):
                seg = dp(seg, 6)
                if sum(math.hypot(seg[i + 1][0] - seg[i][0], seg[i + 1][1] - seg[i][1]) for i in range(len(seg) - 1)) >= 30:
                    lines.append(seg)
        if lines:
            twy[wclass] = fmt_path(lines, closed=False)
    if manual and manual.get("taxiways"):
        extra = fmt_path([[proj(*q) for q in line] for line in manual["taxiways"]], closed=False)
        twy[23] = (twy.get(23, "") + extra) if 23 in twy else extra

    # 관제탑
    tower = None
    for nd in nodes.values():
        t = nd.get("tags") or {}
        if is_aero(t, "control_tower", bool(manual)):
            p = proj(nd["lat"], nd["lon"])
            if in_field(p):
                tower = [round(p[0]), round(p[1])]
                break
    if not tower:
        for w_ in ways.values():
            t = w_.get("tags") or {}
            if is_aero(t, "control_tower", bool(manual)):
                pts = way_pts(w_["id"])
                if pts and in_field(centroid(pts)):
                    c = centroid(pts)
                    tower = [round(c[0]), round(c[1])]
                    break

    # 주기장: 비행기 코가 터미널 쪽을 보게
    term_rings = [r_ for _, r_ in terminals] + [r_ for _, r_ in others if abs(area(r_)) > 8000]

    def nearest_edge(p):
        best = (1e18, None)
        for ring in term_rings:
            for i in range(len(ring)):
                a = ring[i]
                b = ring[(i + 1) % len(ring)]
                dx, dy = b[0] - a[0], b[1] - a[1]
                L2 = dx * dx + dy * dy or 1e-9
                u = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
                q = (a[0] + u * dx, a[1] + u * dy)
                d = math.hypot(p[0] - q[0], p[1] - q[1])
                if d < best[0]:
                    best = (d, q)
        return best

    stands = []
    for nd in nodes.values():
        t = nd.get("tags") or {}
        if t.get("aeroway") != "parking_position":
            continue
        p = proj(nd["lat"], nd["lon"])
        if not in_field(p) or not (0 <= p[0] <= W and 0 <= p[1] <= H):
            continue
        d, q = nearest_edge(p)
        hdg = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0])) if q and d < 200 else None
        stands.append((p, hdg, d))
    for w_ in ways.values():
        t = w_.get("tags") or {}
        if t.get("aeroway") != "parking_position":
            continue
        pts = way_pts(w_["id"])
        if not pts or len(pts) < 2:
            continue
        a, b = pts[0], pts[-1]
        if math.hypot(b[0] - a[0], b[1] - a[1]) < 8:
            continue
        da, _ = nearest_edge(a)
        db, _ = nearest_edge(b)
        if da < db and da < 150:
            a, b = b, a
        if not in_field(b) or not (0 <= b[0] <= W and 0 <= b[1] <= H):
            continue
        hdg = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        stands.append((b, hdg, min(da, db)))
    # 너무 붙은 자리는 하나만
    stands.sort(key=lambda s_: s_[2])
    kept = []
    for p, hdg, d in stands:
        if all(math.hypot(p[0] - q[0], p[1] - q[1]) > 28 for q, _, _ in kept):
            kept.append((p, hdg, d))
    if len(kept) < 6:
        # 주기장이 그려지지 않은 공항: 계류장 안에 고르게 세운다
        for _, ring in aprons:
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            step = 75
            y = min(ys) + step / 2
            while y < max(ys):
                x = min(xs) + step / 2
                while x < max(xs):
                    p = (x, y)
                    if point_in(p, ring) and not any(point_in(p, r_) for r_ in term_rings) and all(math.hypot(p[0] - q[0], p[1] - q[1]) > 60 for q, _, _ in kept):
                        d, q = nearest_edge(p)
                        hdg = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0])) if q else 0
                        kept.append((p, hdg, d))
                    x += step
                y += step
        kept.sort(key=lambda s_: s_[2])
    kept = kept[:120]
    stand_out = []
    for p, hdg, d in kept:
        stand_out.extend([round(p[0]), round(p[1]), round(hdg) % 360 if hdg is not None else -1])

    # 터미널 이름표 (넓은 것부터)
    labels = []
    for t, ring in sorted(terminals, key=lambda tr: -abs(area(tr[1]))):
        name = clean_label(t)
        if not name or any(name == l_[2] for l_ in labels):
            continue
        c = centroid(ring)
        labels.append([round(c[0]), round(c[1]), name])
        if len(labels) >= 6:
            break

    def paths(items, tol=None):
        return fmt_path([r_ for _, r_ in items])

    data = {
        "w": round(W),
        "h": round(H),
    }
    if sea:
        data["sea"] = 1
        data["land"] = fmt_path([clip_poly(r_, W, H) for r_ in land_all])
    if water:
        data["water"] = fmt_path(water)
    data["field"] = fmt_path([clip_poly(dp_ring(r_, 6), W, H) for r_ in field]) if field else ""
    if aprons:
        data["apron"] = paths(aprons)
    if twy:
        data["twy"] = [[k, v] for k, v in twy.items()]
    data["rwy"] = rwy
    if terminals:
        data["term"] = paths(terminals)
    if hangars:
        data["hangar"] = paths(hangars)
    if others:
        data["bldg"] = paths(others)
    if tower:
        data["tower"] = tower
    if stand_out:
        data["stands"] = stand_out
    if labels:
        data["labels"] = labels
    return data


# ------------------------------------------------------------------ 저장


def write_ts(all_data: dict):
    lines = [
        "// 이 파일은 scripts/fetch-airport-maps.py 가 만들어요. 직접 고치지 마세요.",
        "// 지도 데이터 © OpenStreetMap 기여자 (https://www.openstreetmap.org/copyright), ODbL 1.0",
        "// 좌표는 틀 왼쪽 위를 (0,0)으로 한 m 단위 (x 동쪽, y 남쪽). 경로는 SVG path 글자.",
        "import type { AirportMapData } from './airportTypes';",
        "",
        "export const AIRPORT_MAPS: Record<string, AirportMapData> = {",
    ]
    for icao in sorted(all_data):
        lines.append(f"  {icao}: {json.dumps(all_data[icao], ensure_ascii=False, separators=(',', ':'))},")
    lines.append("};")
    lines.append("")
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")


def read_existing() -> dict:
    if not OUT_TS.exists():
        return {}
    out = {}
    for line in OUT_TS.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^  ([A-Z0-9]{4}): (\{.*\}),$", line)
        if m:
            out[m.group(1)] = json.loads(m.group(2))
    return out


def preview(all_data: dict, path: Path):
    parts = ["<html><body style='background:#ddd;font:12px sans-serif'>"]
    for icao, d in sorted(all_data.items()):
        W, H = d["w"], d["h"]
        svg = [f"<svg viewBox='0 0 {W} {H}' width='300' height='{300 * H / W:.0f}' style='background:{'#9cc4e4' if d.get('sea') else '#e8e4d8'}'>"]
        if d.get("sea"):
            svg.append(f"<path d='{d.get('land', '')}' fill='#e8e4d8'/>")
        if d.get("water"):
            svg.append(f"<path d='{d['water']}' fill='#9cc4e4'/>")
        svg.append(f"<path d='{d['field']}' fill='#cfe3b4'/>")
        if d.get("apron"):
            svg.append(f"<path d='{d['apron']}' fill='#c4c4c4'/>")
        for wcls, p in d.get("twy", []):
            svg.append(f"<path d='{p}' fill='none' stroke='#9a9a9a' stroke-width='{wcls}' stroke-linejoin='round' stroke-linecap='round'/>")
        for x1, y1, x2, y2, wd, ref in d["rwy"]:
            svg.append(f"<line x1='{x1}' y1='{y1}' x2='{x2}' y2='{y2}' stroke='#444' stroke-width='{wd}'/>")
        for k, col in (("bldg", "#bbb"), ("hangar", "#c9b48c"), ("term", "#7f9fbf")):
            if d.get(k):
                svg.append(f"<path d='{d[k]}' fill='{col}' stroke='#555' stroke-width='1'/>")
        st = d.get("stands", [])
        for i in range(0, len(st), 3):
            svg.append(f"<circle cx='{st[i]}' cy='{st[i + 1]}' r='12' fill='red'/>")
        svg.append("</svg>")
        size = len(json.dumps(d, separators=(",", ":")))
        parts.append(f"<div style='display:inline-block;margin:6px;vertical-align:top'><b>{icao}</b> {size / 1000:.1f} KB<br>{''.join(svg)}</div>")
    parts.append("</body></html>")
    path.write_text("".join(parts), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="쉼표로 나눈 ICAO 목록")
    ap.add_argument("--cache", type=Path, help="받은 응답을 둘 폴더")
    ap.add_argument("--preview", type=Path, help="도면을 모아 볼 HTML")
    args = ap.parse_args()
    http = Http(args.cache)
    targets = args.only.split(",") if args.only else sorted(set(AIRPORTS) | set(MANUAL))
    data = read_existing()
    for icao in targets:
        print(f"{icao}", file=sys.stderr)
        data[icao] = build_airport(http, icao)
        print(f"  → {len(json.dumps(data[icao], separators=(',', ':'))) / 1000:.1f} KB", file=sys.stderr)
    write_ts(data)
    total = sum(len(json.dumps(d, separators=(",", ":"))) for d in data.values())
    print(f"공항 {len(data)}곳, 모두 {total / 1000:.0f} KB → {OUT_TS.relative_to(ROOT)}", file=sys.stderr)
    if args.preview:
        preview(data, args.preview)


if __name__ == "__main__":
    main()
