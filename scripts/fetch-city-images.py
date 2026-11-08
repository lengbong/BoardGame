#!/usr/bin/env python3
"""
'지구 한 바퀴' 도시 그림을 위키미디어 공용(Wikimedia Commons)에서 받아온다.

- 각 도시의 대표 명소 위키백과 문서에서 대표 이미지를 찾고,
  위키미디어 공용에 있는 자유 라이선스(퍼블릭 도메인, CC0, CC BY, CC BY-SA) 파일만 사용한다.
- 4:3으로 잘라 320x240 WebP로 저장하고, 출처/저작자/라이선스를 imageCredits.ts로 기록한다.
- CI에서는 실행하지 않는다. 그림을 바꾸고 싶을 때만 직접 실행한다.

사용법:  python3 scripts/fetch-city-images.py
필요:    Pillow
"""
import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "src" / "games" / "world" / "assets" / "cities"
CREDITS_TS = ROOT / "src" / "games" / "world" / "imageCredits.ts"
USER_AGENT = "FamilyBoardGameImageFetcher/1.0 (https://github.com/lengbong/BoardGame)"

# 도시 id → 설정
#   article: 대표 명소의 위키백과 영문 문서 (대표 이미지를 가져옴)
#   file:    대표 이미지 대신 쓸 위키미디어 공용 파일 (선택)
#   fx, fy:  자를 때 기준점 (0~1, 기본 0.5)
#   fit:     True면 자르지 않고 전체를 넣고 양옆을 흐린 배경으로 채움 (아주 높은 탑)
#   author:  저작자 표시를 직접 지정 (원본 저작자 칸이 너무 길 때)
CITIES = {
    "cairo": {"article": "Giza pyramid complex"},
    "istanbul": {"article": "Hagia Sophia"},
    "hanoi": {"article": "Hoàn Kiếm Lake"},
    "bangkok": {"article": "Wat Arun"},
    "newdelhi": {"article": "India Gate", "file": "File:India Gate, New Delhi from West.jpg"},
    # 문서 대표 이미지가 로고라서 사진으로 지정
    "taipei": {"article": "Taipei 101", "file": "File:Taipei Taiwan Taipei-101-Tower-01.jpg"},
    # 저작자 칸에 사용 안내문이 길게 들어 있어서 이름만 표시
    "singapore": {"article": "Marina Bay Sands", "author": "Supanut Arunoprayote"},
    "beijing": {"article": "Temple of Heaven"},
    "rio": {"article": "Sugarloaf Mountain"},
    "sydney": {"article": "Sydney Opera House"},
    "seoul": {"article": "Gyeongbokgung"},
    "moscow": {"article": "Saint Basil's Cathedral", "fy": 0.45},
    "athens": {"article": "Parthenon"},
    "rome": {"article": "Colosseum"},
    "barcelona": {"article": "Sagrada Família", "fy": 0.4},
    "berlin": {"article": "Brandenburg Gate"},
    "amsterdam": {
        "article": "Canals of Amsterdam",
        "file": "File:Colorful canal houses at golden hour in Damrak avenue Amsterdam the Netherlands.jpg",
    },
    "london": {"article": "Big Ben", "fy": 0.35},
    "paris": {"article": "Eiffel Tower", "fit": True},
    # 문서 대표 이미지가 어두운 실루엣이라 낮 사진으로 지정
    "dubai": {"article": "Burj Khalifa", "file": "File:The Dubai Fountain & Burj Khalifa Pixabay.jpg", "fx": 0.6},
    "tokyo": {"article": "Tokyo Tower", "fy": 0.4},
    "newyork": {"article": "Statue of Liberty", "fy": 0.4},
}

# KOGL Type 1(공공누리 제1유형)은 출처 표시만 하면 되는 한국 공공저작물 라이선스
ALLOWED_LICENSE = re.compile(r"^(public domain|pd|cc0|cc[ -]by(-sa)?[ -]?\d|kogl type 1$)", re.I)
_last_request = 0.0


def get(url: str, retries: int = 5) -> bytes:
    """위키미디어 API 이용 수칙에 맞춰 1초 간격으로 요청하고, 거절되면 점점 길게 기다렸다 다시 시도한다."""
    global _last_request
    for attempt in range(retries):
        wait = 1.0 - (time.time() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                body = res.read()
            if body.startswith(b"You are making too many requests"):
                raise RuntimeError("rate limited")
            return body
        except Exception as exc:  # noqa: BLE001
            delay = 5 * (2**attempt)
            print(f"  요청 실패({exc}), {delay}초 후 다시 시도: {url[:90]}", file=sys.stderr)
            time.sleep(delay)
    raise RuntimeError(f"요청 실패: {url}")


def api(base: str, params: dict) -> dict:
    params = {**params, "format": "json", "formatversion": "2"}
    return json.loads(get(base + "?" + urllib.parse.urlencode(params)))


def strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def lead_images(titles: list[str]) -> dict[str, str]:
    data = api(
        "https://en.wikipedia.org/w/api.php",
        {"action": "query", "prop": "pageimages", "piprop": "name", "redirects": "1", "titles": "|".join(titles)},
    )
    q = data["query"]
    alias = {}
    for group in ("normalized", "redirects"):
        for item in q.get(group, []):
            alias[item["to"]] = item["from"]
    result = {}
    for page in q["pages"]:
        name = page.get("pageimage")
        title = page["title"]
        while title in alias:
            title = alias[title]
        if name:
            result[title] = "File:" + name.replace("_", " ")
    return result


def commons_info(files: list[str]) -> dict[str, dict]:
    data = api(
        "https://commons.wikimedia.org/w/api.php",
        {
            "action": "query",
            "titles": "|".join(files),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size",
            "iiurlwidth": "800",
            "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|Credit",
        },
    )
    alias = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
    result = {}
    for page in data["query"]["pages"]:
        if page.get("missing") or "imageinfo" not in page:
            continue
        title = alias.get(page["title"], page["title"])
        result[title] = page["imageinfo"][0] | {"title": page["title"]}
    return result


def crop_4_3(img: Image.Image, fx: float, fy: float) -> Image.Image:
    w, h = img.size
    target = 4 / 3
    if w / h > target:  # 너무 넓으면 좌우를 자른다 (fx 기준)
        nw = int(h * target)
        left = int(min(max(fx * w - nw / 2, 0), w - nw))
        return img.crop((left, 0, left + nw, h))
    nh = int(w / target)  # 너무 길면 위아래를 자른다 (fy 기준)
    top = int(min(max(fy * h - nh / 2, 0), h - nh))
    return img.crop((0, top, w, top + nh))


def fit_4_3(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """그림 전체를 넣고 남는 부분은 같은 그림을 흐리게 깔아서 채운다."""
    bg = crop_4_3(img, 0.5, 0.5).resize(size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))
    fg = img.copy()
    fg.thumbnail(size, Image.LANCZOS)
    bg.paste(fg, ((size[0] - fg.width) // 2, (size[1] - fg.height) // 2))
    return bg


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("대표 이미지 찾는 중…")
    leads = lead_images([c["article"] for c in CITIES.values() if "file" not in c])
    files = {cid: c.get("file") or leads.get(c["article"]) for cid, c in CITIES.items()}
    missing = [cid for cid, f in files.items() if not f]
    if missing:
        sys.exit(f"대표 이미지를 찾지 못함: {missing}")

    print("라이선스 확인 중…")
    infos = commons_info(sorted(set(files.values())))
    credits = []
    problems = []
    for cid, file in files.items():
        info = infos.get(file)
        if not info:
            problems.append(f"{cid}: {file} 은(는) 위키미디어 공용에 없음 (비자유 이미지일 수 있음)")
            continue
        meta = info["extmetadata"]
        license_name = meta.get("LicenseShortName", {}).get("value", "")
        if not ALLOWED_LICENSE.match(license_name):
            problems.append(f"{cid}: {file} 라이선스 '{license_name}' 은(는) 허용 목록 밖")
            continue
        print(f"  {cid}: {file} [{license_name}]")
        raw = get(info["thumburl"])
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        conf = CITIES[cid]
        if conf.get("fit"):
            img = fit_4_3(img, (320, 240))
        else:
            img = crop_4_3(img, conf.get("fx", 0.5), conf.get("fy", 0.5)).resize((320, 240), Image.LANCZOS)
        img.save(OUT_DIR / f"{cid}.webp", "WEBP", quality=72, method=6)
        credits.append(
            {
                "id": cid,
                "file": info["title"].removeprefix("File:"),
                "author": conf.get("author") or strip_html(meta.get("Artist", {}).get("value", "")) or "알 수 없음",
                "license": license_name,
                "licenseUrl": meta.get("LicenseUrl", {}).get("value", ""),
                "source": info["descriptionurl"],
            }
        )

    if problems:
        print("\n문제가 있는 도시 (CITIES에서 파일을 직접 지정하세요):", *problems, sep="\n  ")
        sys.exit(1)

    body = json.dumps(credits, ensure_ascii=False, indent=2)
    CREDITS_TS.write_text(
        "// scripts/fetch-city-images.py 가 만든 파일입니다. 직접 고치지 마세요.\n"
        "export interface ImageCredit {\n  id: string;\n  file: string;\n  author: string;\n"
        "  license: string;\n  licenseUrl: string;\n  source: string;\n}\n\n"
        f"export const IMAGE_CREDITS: ImageCredit[] = {body};\n",
        encoding="utf-8",
    )
    print(f"\n완료: 그림 {len(credits)}개 → {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
