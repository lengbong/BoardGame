#!/usr/bin/env python3
"""
'하늘길 항공사' 사진을 위키미디어 공용(Wikimedia Commons)에서 받아온다.

- 기종(aircraft) · 도시(cities) · 실제 항공사(airlines) 사진을 위키미디어 공용 검색으로 찾고,
  자유 라이선스(퍼블릭 도메인, CC0, CC BY, CC BY-SA) 사진만 쓴다. GFDL만 있는 것, NC/ND, 알 수 없는 것은 쓰지 않는다.
- 로고·문장·도색 그림 같은 그림 파일은 받지 않고 사진(JPEG)만 받는다. 사람이 주인공인 사진도 피한다.
- 기종·항공사는 16:9로 잘라 400x225, 도시는 4:3으로 잘라 320x240 WebP로 저장하고,
  출처/저작자/라이선스를 src/games/airline/imageCredits.ts로 기록한다.
- 한 번 고른 사진은 아래 FILES에 파일 이름을 적어 두어서 다시 실행해도 같은 사진을 받는다.
  FILES에 없는 것만 검색해서 고른다.
- CI에서는 실행하지 않는다. 사진을 바꾸고 싶을 때만 직접 실행한다.

사용법:
  python3 scripts/fetch-airline-images.py                              # 전부 받기 (FILES에 고정한 사진)
  python3 scripts/fetch-airline-images.py --only cities/seoul,aircraft # 일부만
  python3 scripts/fetch-airline-images.py --list --search --only aircraft/f27 --preview /tmp/f27.png
      # FILES를 무시하고 검색 후보를 번호와 함께 보여 주고, 후보 사진을 한 장으로 모아 저장 (받지는 않음)
      # → 마음에 드는 후보의 파일 이름을 FILES에 적고 --only 로 다시 받는다
  --cache 폴더를 주면 받은 응답·사진을 저장해 두어 여러 번 해 볼 때 서버에 다시 묻지 않는다.
위키미디어 서버는 요청이 많으면 잠시 거절(429)하므로 천천히 받는다 (전부 받는 데 15~40분).
필요: Pillow
"""
import argparse
import hashlib
import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / "src" / "games" / "airline"
ASSETS = GAME / "assets"
CREDITS_TS = GAME / "imageCredits.ts"
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "FamilyBoardGameImageFetcher/1.0 (https://github.com/lengbong/BoardGame)"
# 위키미디어 썸네일은 정해진 너비(…500, 960, 1280…)로 받는 것이 서버에 부담이 적다
THUMB_WIDTH = 960
# 전체 WebP 크기 한도 (게임이 한 파일로 묶이므로)
TOTAL_LIMIT = 2_200_000

# 종류마다: 저장 크기, id를 읽어 올 파일과 정규식
KINDS = {
    "aircraft": {"size": (400, 225), "ids": (GAME / "aircraft.ts", r"^\s*\['([a-z0-9-]+)',")},
    "cities": {"size": (320, 240), "ids": (GAME / "cities.ts", r"^\s*\['([a-z0-9-]+)',")},
    "airlines": {"size": (400, 225), "ids": (GAME / "realAirlines.ts", r"\bid: '([a-z0-9-]+)'")},
}

# 항목 설정
#   q:     위키미디어 공용 검색어
#   must:  파일 이름에 꼭 들어 있어야 하는 정규식 (기종 이름 등)
#   not:   파일 이름에 있으면 안 되는 정규식
#   fx, fy: 자를 때 기준점 (0~1, 기본 0.5)
#   zoom:  1보다 크면 그만큼 더 가까이 잘라 냄 (비행기가 작게 찍힌 사진)
#   fit:   True면 자르지 않고 전체를 넣고 남는 곳은 흐린 배경으로 채움 (아주 높은 탑)
#   author: 저작자 표시를 직접 지정 (원본 저작자 칸이 너무 길 때)
AIRCRAFT = {
    "f27": {"q": "Fokker F27 Friendship", "must": r"F\.? ?27|Fokker"},
    "caravelle": {"q": "Sud Aviation Caravelle airliner", "must": r"Caravelle"},
    # 남은 자유 라이선스 사진이 드물어 박물관 전시기. 옆으로 긴 사진이라 자르지 않고 전체를 넣는다
    "dc8-50": {"q": "DC-8-53 OR DC-8-55 OR DC-8-52 OR DC-8-54", "must": r"DC-8-5\d", "fit": True},
    "b707": {"q": "Boeing 707-320B", "must": r"707-3\w\w"},
    "b727-100": {"q": "Boeing 727-100 airliner", "must": r"727-1\w\w", "not": r"[Mm]useum"},
    "dc9": {"q": "McDonnell Douglas DC-9-30", "must": r"DC-9-3\d"},
    "b727-200": {"q": "Boeing 727-200", "must": r"727-2\w\w"},
    "dc8-63": {"q": "Douglas DC-8-63", "must": r"DC-8-6\d"},
    "b737-200": {"q": "Boeing 737-200", "must": r"737-2\w\w"},
    "b747-100": {"q": "Boeing 747-100", "must": r"747-1\w\w"},
    "b747-200": {"q": "Boeing 747-200", "must": r"747-2\w\w"},
    "dc10": {"q": "McDonnell Douglas DC-10-30", "must": r"DC-10"},
    "l1011": {"q": "Lockheed L-1011 TriStar", "must": r"1011|Tri[Ss]tar"},
    "a300b4": {"q": "Airbus A300B4", "must": r"A300 ?B4", "not": r"B4-6"},
    "concorde": {"q": "Concorde airliner", "must": r"Concorde"},
    "md82": {"q": "McDonnell Douglas MD-82", "must": r"MD-8[12]", "not": r"Volandia|[Mm]useum"},
    "b767-200": {"q": "Boeing 767-200", "must": r"767-2\w\w"},
    "b757": {"q": "Boeing 757-200", "must": r"757-2\w\w"},
    "b737-300": {"q": "Boeing 737-300", "must": r"737-3\w\w"},
    "a310": {"q": "Airbus A310-300", "must": r"A310"},
    "a300-600": {"q": "Airbus A300-600R", "must": r"A300-6|A300B4-6|A300-600"},
    "b767-300": {"q": "Boeing 767-300ER", "must": r"767-3\w\w"},
    "a320": {"q": "Airbus A320-200", "must": r"A320-2\d\d|A320-200", "not": r"neo|A320-2\d\dN"},
    "f100": {"q": "Fokker 100", "must": r"Fokker 100|F100|F-100"},
    "atr72": {"q": "ATR 72-600", "must": r"ATR[ -]?72"},
    "b747-400": {"q": "Boeing 747-400", "must": r"747-4\w\w"},
    "md11": {"q": "McDonnell Douglas MD-11 landing", "must": r"MD-11"},
    "crj200": {"q": "Bombardier CRJ200", "must": r"CRJ[ -]?200|CL-600-2B19"},
    "a340-300": {"q": "Airbus A340-300", "must": r"A340-3\d\d"},
    "a330-300": {"q": "Airbus A330-300", "must": r"A330-3\d\d", "not": r"neo|A330-9"},
    "a321": {"q": "Airbus A321-200", "must": r"A321-[12]\d\d", "not": r"neo|A321-2\d\dN"},
    "b777-200": {"q": "Boeing 777-200ER", "must": r"777-2\w\w ?\(?ER|777-200ER"},
    "b737-800": {"q": "Boeing 737-800", "must": r"737-8\w\w\b", "not": r"MAX"},
    "q400": {"q": "Bombardier Dash 8 Q400", "must": r"Q400|DHC-8-4\d\d|Dash 8-400", "zoom": 1.6, "fy": 0.55},
    "a340-600": {"q": "Airbus A340-642", "must": r"A340-6\d\d"},
    "b777-300": {"q": "Boeing 777-300ER", "must": r"777-3\w\w ?\(?ER|777-300ER"},
    "e190": {"q": "Embraer E190", "must": r"E190|E-190|ERJ[ -]?190|Embraer 190"},
    "a380": {"q": "Airbus A380-800", "must": r"A380"},
    "b787-8": {"q": "Boeing 787-8 Dreamliner", "must": r"787-8"},
    "b787-9": {"q": "Boeing 787-9 Dreamliner", "must": r"787-9"},
    "a350-900": {"q": "Airbus A350-941 landing", "must": r"A350-9\d\d"},
    "a220-300": {"q": "Airbus A220-300", "must": r"A220-300|BD-500-1A11|CS300"},
    "a320neo": {"q": "Airbus A320neo", "must": r"A320 ?neo|A320-2\d\dN"},
    "a321neo": {"q": "Airbus A321neo", "must": r"A321 ?neo|A321-2\d\dN"},
    "a330-900": {"q": "Airbus A330-900neo", "must": r"A330-9\d\d|A330 ?neo"},
    "a350-1000": {"q": "Airbus A350-1000", "must": r"A350-10\d\d|A350-1000"},
}

CITIES = {
    "seoul": {"q": "Gyeongbokgung Geunjeongjeon", "must": r"Gyeongbok|Geunjeong"},
    "busan": {"q": "Haeundae Busan skyline"},
    "jeju": {"q": "Seongsan Ilchulbong"},
    "tokyo": {"q": "Tokyo Tower skyline"},
    "osaka": {"q": "Osaka Castle"},
    "beijing": {"q": "Tiananmen gate Beijing"},
    "shanghai": {"q": "Lujiazui skyline from the Bund"},
    "hongkong": {"q": "Hong Kong skyline from Victoria Peak", "must": r"Hong Kong|Victoria"},
    "taipei": {"q": "Taipei 101 skyline"},
    "singapore": {"q": "Marina Bay Sands skyline"},
    "bangkok": {"q": "Wat Arun prang Chao Phraya river", "must": r"Wat Arun"},
    "kualalumpur": {"q": "Petronas Towers Kuala Lumpur"},
    "jakarta": {"q": "Monas Jakarta National Monument", "must": r"Monas|Monumen Nasional|Jakarta"},
    "manila": {"q": "Manila Cathedral Intramuros", "must": r"Manila"},
    "hochiminh": {"q": "Ho Chi Minh City skyline Saigon River"},
    "bali": {"q": "Pura Ulun Danu Bratan"},
    "sydney": {"q": "Sydney Opera House Harbour Bridge"},
    "auckland": {"q": "Auckland Sky Tower skyline harbour", "must": r"Auckland"},
    "honolulu": {"q": "Waikiki Diamond Head"},
    "guam": {"q": "Tumon Bay beach Guam hotels", "must": r"Tumon|Guam", "not": r"coral|fish|underwater"},
    "delhi": {"q": "India Gate New Delhi"},
    "mumbai": {"q": "Gateway of India Mumbai"},
    "colombo": {"q": "Colombo skyline"},
    "male": {"q": "Malé Maldives aerial"},
    "kathmandu": {"q": "Boudhanath stupa Kathmandu"},
    "dubai": {"q": "Burj Khalifa Dubai skyline"},
    "doha": {"q": "Doha skyline West Bay"},
    "london": {"q": "Palace of Westminster Big Ben Thames"},
    "paris": {"q": "Eiffel Tower from Trocadéro", "must": r"Eiffel|Tour Eiffel"},
    "frankfurt": {"q": "Frankfurt skyline Main"},
    "amsterdam": {"q": "Amsterdam canal houses"},
    "zurich": {"q": "Zürich Grossmünster Limmat"},
    "rome": {"q": "Colosseum Rome"},
    "milan": {"q": "Milan Cathedral Duomo"},
    "barcelona": {"q": "Sagrada Família exterior", "must": r"Sagrada", "not": r"interior|inside|ceiling|nave|vault", "fy": 0.4},
    "madrid": {"q": "Royal Palace of Madrid"},
    "athens": {"q": "Parthenon Acropolis Athens"},
    "istanbul": {"q": "Sultan Ahmed Mosque Istanbul"},
    "cairo": {"q": "Giza pyramids"},
    "nairobi": {"q": "Nairobi skyline"},
    "johannesburg": {"q": "Johannesburg skyline Hillbrow Tower", "must": r"Johannesburg|Hillbrow"},
    "capetown": {"q": "Table Mountain Cape Town from Bloubergstrand", "must": r"Table Mountain|Cape Town"},
    "lagos": {"q": "Lagos Nigeria skyline Victoria Island", "must": r"Lagos|Victoria Island"},
    "casablanca": {"q": "Hassan II Mosque Casablanca minaret", "must": r"Hassan"},
    "newyork": {"q": "Manhattan skyline"},
    "losangeles": {"q": "Los Angeles downtown skyline"},
    "sanfrancisco": {"q": "Golden Gate Bridge from Battery Spencer", "must": r"Golden Gate"},
    "chicago": {"q": "Chicago skyline"},
    "miami": {"q": "Downtown Miami skyline Biscayne Bay", "must": r"Miami"},
    "vancouver": {"q": "Vancouver skyline"},
    "toronto": {"q": "Toronto skyline CN Tower"},
    "montreal": {"q": "Montreal Biosphere", "must": r"Biosph"},
    "mexicocity": {"q": "Palacio de Bellas Artes Mexico City"},
    "saopaulo": {"q": "São Paulo downtown skyline Edifício Copan", "must": r"S[ãa]o Paulo|Copan"},
    "rio": {"q": "Sugarloaf Mountain Botafogo", "must": r"Sugarloaf|P[ãa]o de A[çc][úu]car|Botafogo"},
    "buenosaires": {"q": "Obelisco Buenos Aires Avenida 9 de Julio", "must": r"Obelisco|Obelisk"},
}

# 항공사: 그 회사가 날던 때에 어울리는 기종 사진
AIRLINES = {
    "korean": {"q": "Korean Air Boeing 747-400", "must": r"Korean Air", "not": r"Cargo"},
    "asiana": {"q": "Asiana Airlines Airbus A350", "must": r"Asiana", "not": r"Cargo"},
    "jal": {"q": "Japan Airlines Boeing 787", "must": r"Japan Airlines|JAL", "not": r"Cargo"},
    "ana": {"q": "All Nippon Airways Boeing 787-9 landing", "must": r"All Nippon|ANA", "not": r"Cargo"},
    "cathay": {"q": "Cathay Pacific Airbus A350", "must": r"Cathay", "not": r"Cargo|Dragon"},
    "chinaairlines": {"q": "China Airlines Airbus A350", "must": r"China Airlines", "not": r"Cargo"},
    "airchina": {"q": "Air China Boeing 747-8", "must": r"Air China", "not": r"Cargo"},
    "chinaeastern": {"q": "China Eastern Airlines Airbus A330", "must": r"China Eastern", "not": r"Cargo", "zoom": 1.7},
    "singapore": {"q": "Singapore Airlines Airbus A350-941 landing", "must": r"Singapore Airlines", "not": r"Cargo"},
    "thai": {"q": "Thai Airways Boeing 777-300ER", "must": r"Thai Airways|Thai International"},
    "malaysia": {"q": "Malaysia Airlines Airbus A330", "must": r"Malaysia Airlines|Malaysian Airline"},
    "garuda": {"q": "Garuda Indonesia Airbus A330 landing", "must": r"Garuda"},
    "philippine": {"q": "Philippine Airlines Airbus A350", "must": r"Philippine Airlines"},
    "vietnam": {"q": "Vietnam Airlines Boeing 787", "must": r"Vietnam Airlines"},
    "qantas": {"q": "Qantas Boeing 747-438 landing", "must": r"Qantas", "not": r"Freight|Link"},
    "airnewzealand": {"q": "Air New Zealand Boeing 777", "must": r"Air New Zealand"},
    "hawaiian": {"q": "Hawaiian Airlines Airbus A330", "must": r"Hawaiian Airlines"},
    "airindia": {"q": "Air India Boeing 777", "must": r"Air India", "not": r"Express|Regional"},
    "airlanka": {"q": "Air Lanka Lockheed L-1011 TriStar", "must": r"Air Lanka"},
    "srilankan": {"q": "SriLankan Airlines Airbus A330", "must": r"Sri ?Lankan"},
    "gulfair": {"q": "Gulf Air Boeing 787", "must": r"Gulf Air"},
    "emirates": {"q": "Emirates Boeing 777-300ER", "must": r"Emirates", "not": r"Cargo"},
    "qatar": {"q": "Qatar Airways Boeing 777-300ER", "must": r"Qatar Airways", "not": r"Cargo"},
    "turkish": {"q": "Turkish Airlines Boeing 777", "must": r"Turkish Airlines|THY", "not": r"Cargo"},
    "lufthansa": {"q": "Lufthansa Boeing 747-8", "must": r"Lufthansa", "not": r"Cargo|CityLine|Technik"},
    "boac": {"q": "BOAC Boeing 707", "must": r"BOAC"},
    "britishairways": {"q": "British Airways Boeing 747-436 landing", "must": r"British Airways", "not": r"Cargo"},
    "airfrance": {"q": "Air France Airbus A350", "must": r"Air France", "not": r"Cargo|HOP"},
    "klm": {"q": "KLM Boeing 777", "must": r"KLM", "not": r"Cargo|Cityhopper"},
    "swissair": {"q": "Swissair McDonnell Douglas MD-11", "must": r"Swissair"},
    "swiss": {"q": "Swiss International Air Lines Airbus A340-313", "must": r"Swiss", "zoom": 1.25, "fy": 0.35},
    "alitalia": {"q": "Alitalia Boeing 747", "must": r"Alitalia"},
    "ita": {"q": "ITA Airways Airbus A350", "must": r"ITA Airways"},
    "iberia": {"q": "Iberia Airbus A350", "must": r"Iberia", "not": r"Express|Regional"},
    "egyptair": {"q": "EgyptAir Boeing 777", "must": r"Egypt ?[Aa]ir", "not": r"Cargo|Express"},
    "ethiopian": {"q": "Ethiopian Airlines Boeing 787", "must": r"Ethiopian", "not": r"Cargo"},
    "saa": {"q": "South African Airways Airbus A340-600", "must": r"South African Airways"},
    "royalairmaroc": {"q": "Royal Air Maroc Boeing 787", "must": r"Royal Air Maroc"},
    "kenya": {"q": "Kenya Airways Boeing 787", "must": r"Kenya Airways"},
    "panam": {"q": "Pan Am Boeing 747", "must": r"Pan Am|Pan American"},
    "twa": {"q": "TWA Trans World Airlines Boeing 747", "must": r"TWA|Trans World"},
    "american": {"q": "American Airlines Boeing 777", "must": r"American Airlines", "not": r"Eagle"},
    "united": {"q": "United Airlines Boeing 777-200 landing", "must": r"United Airlines", "not": r"Express"},
    "delta": {"q": "Delta Air Lines Airbus A350", "must": r"Delta", "not": r"Connection"},
    "northwest": {"q": "Northwest Airlines Boeing 747-400", "must": r"Northwest"},
    "aircanada": {"q": "Air Canada Boeing 787", "must": r"Air Canada", "not": r"Express|Jazz|Rouge|Cargo"},
    "aeromexico": {"q": "Aeromexico Boeing 787", "must": r"Aerom[eé]xico", "not": r"Connect"},
    "varig": {"q": "Varig McDonnell Douglas MD-11", "must": r"Varig|VARIG"},
    "lan": {"q": "LAN Airlines Boeing 767", "must": r"\bLAN\b", "not": r"LATAM|Cargo"},
    "latam": {"q": "LATAM Boeing 787", "must": r"LATAM", "not": r"Cargo"},
    "aerolineas": {"q": "Aerolineas Argentinas Airbus A330", "must": r"Aerol[ií]neas Argentinas"},
}

CONFIG = {"aircraft": AIRCRAFT, "cities": CITIES, "airlines": AIRLINES}

# 고른 사진 (다시 실행해도 같은 사진을 받도록 고정). 키는 '종류/id'
FILES: dict[str, str] = {
    # aircraft
    "aircraft/a220-300": "File:JetBlue Airways Airbus A220-300 N3132J departing Boston November 2025.jpg",
    "aircraft/a300-600": "File:Airbus A300-600R Egyptair SU-GAR.jpg",
    "aircraft/a300b4": "File:Airbus A300B4-203 Airbus Industrie (AIB) F-WUAB - MSN 238 (3291919477).jpg",
    "aircraft/a310": "File:Leipzig Halle Airport Pakistan International Airlines Airbus A310-308 AP-BEQ (DSC07738).jpg",
    "aircraft/a320": "File:Lufthansa Airbus A320-211 D-AIQT 01.jpg",
    "aircraft/a320neo": "File:IndiGo VT-IJB A320neo Mumbai Apr22 R16 05934.jpg",
    "aircraft/a321": "File:Middle East Airlines A321-200 (F-ORMF) landing at London Heathrow Airport.jpg",
    "aircraft/a321neo": "File:China Airlines Airbus A321neo B-18102 departing Taoyuan February 2026.jpg",
    "aircraft/a330-300": "File:Oman Air Airbus A330-343 A4O-DI MUC 2015 02.jpg",
    "aircraft/a330-900": "File:Virgin Atlantic Airbus A330-900neo G-VLDY on final approach to Boston Feb 2025.jpg",
    "aircraft/a340-300": "File:South African Airways Airbus A340-313 ZS-SXE MUC 2015 02.jpg",
    "aircraft/a340-600": "File:Airbus A340-642 - Iberia - EC-JLE.jpg",
    "aircraft/a350-1000": "File:Starlux Airbus A350-1000 B-58551 departing Taoyuan February 2026 4.jpg",
    "aircraft/a350-900": "File:Lufthansa Airbus A350-941 D-AIXA STR 2016 02.jpg",
    "aircraft/a380": "File:Emirates Airbus A380-861 A6-EER MUC 2015 01.jpg",
    "aircraft/atr72": "File:Indigo ATR72 VT-IYG Approach Chennai Aug22 A7C 02270.jpg",
    "aircraft/b707": "File:Boeing 707-330B (Lufthansa D-ABUF \"Hannover\", Anfang 1980er Jahre).jpg",
    "aircraft/b727-100": "File:Avianca Boeing 727-100 HK-1272.jpg",
    "aircraft/b727-200": "File:VR-CBQ Boeing 727-212 STN.jpg",
    "aircraft/b737-200": "File:YV2559 Conviasa Boeing 737-200.jpg",
    "aircraft/b737-300": "File:Lufthansa - Boeing 737-300 (D-ABEP).jpg",
    "aircraft/b737-800": "File:Southwest Boeing 737-800 N8676A BWI MD1.jpg",
    "aircraft/b747-100": "File:Sabena Boeing 747-100 Marmet.jpg",
    "aircraft/b747-200": "File:Southern Air Boeing 747-230B(SF) N760SA 01.jpg",
    "aircraft/b747-400": "File:Thai Airways International Boeing 747-4D7 HS-TGP MUC 2015 03.jpg",
    "aircraft/b757": "File:Delta Boeing 757-200 N699DL BWI MD1.jpg",
    "aircraft/b767-200": "File:United Boeing 767-200 N74007 MD1.jpg",
    "aircraft/b767-300": "File:Atlas Air Boeing 767-300ER N662GT BWI MD1.jpg",
    "aircraft/b777-200": "File:British Airways Boeing 777-200ER G-VIIH IAD VA1.jpg",
    "aircraft/b777-300": "File:United Boeing 777-300ER N2136U IAD VA2.jpg",
    "aircraft/b787-8": "File:Qatar Airways Boeing 787-8 Dreamliner A7-BCO MUC 2015 02.jpg",
    "aircraft/b787-9": "File:N1015X Air Tahiti Nui Boeing 787-9 Dreamliner 46.jpg",
    "aircraft/caravelle": "File:Thai Airways International Sud Aviation Caravelle (OY-KRE) at Stockholm-Arlanda Airport.jpg",
    "aircraft/concorde": "File:238cq - British Airways Concorde, G-BOAD@LHR,24.05.2003 - Flickr - Aero Icarus.jpg",
    "aircraft/crj200": "File:Braunschweig Airport Copenhagen AirTaxi Global Reach Aviation Bombardier CRJ-200LR OY-CRJ (DSC03384).jpg",
    "aircraft/dc10": "File:N313FE Fedex 1988 McDonnell Douglas DC-10-30(F) CN- 48311-440 \"Bilal\" (13929394625).jpg",
    "aircraft/dc8-50": "File:F-RAFE Douglas DC-8-53 Armee de l'Air, Le Bourget museee.jpg",
    "aircraft/dc8-63": "File:McDonnell Douglas DC-8-63, CP Air AN0344516.jpg",
    "aircraft/dc9": "File:YV2220 Aserca Airlines McDonnell Douglas DC-9-30.jpg",
    "aircraft/e190": "File:JetBlue Embraer E190 N337JB with paint damage departing Boston March 2025.jpg",
    "aircraft/f100": "File:QantasLink Fokker 100 VH-NHZ Perth 2024 (03).jpg",
    "aircraft/f27": "File:Fokker F27 Friendship (6013754795).jpg",
    "aircraft/l1011": "File:Lockheed L-1011-300 Tristar N172DA Delta ATL GA1.jpg",
    "aircraft/md11": "File:PH-KCA KLM Royal Dutch Airlines McDonnell Douglas MD-11, landing at Schiphol (AMS - EHAM), Netherlands, pic2.JPG",
    "aircraft/md82": "File:Hannover Airport European Air Charter McDonnell Douglas MD-82 LZ-LDT (DSC09492).jpg",
    "aircraft/q400": "File:Bombardier Dash 8 Q400 VH-LQL Domestic Terminal Brisbane Airport P1350067.jpg",
    # cities
    "cities/amsterdam": "File:Water reflection of canal houses at blue hour in Damrak Amsterdam the Netherlands.jpg",
    "cities/athens": "File:Attica 06-13 Athens 50 View from Philopappos - Acropolis Hill.jpg",
    "cities/auckland": "File:Auckland CBD skyline from Waitemata Harbour entrance.jpg",
    "cities/bali": "File:Brantan Bali Pura-Ulun-Danu-Bratan-01.jpg",
    "cities/bangkok": "File:Wat Arun from Chao Phraya River.jpg",
    "cities/barcelona": "File:SF maig 2 cropped.jpg",
    "cities/beijing": "File:天安门夜景.jpg",
    "cities/buenosaires": "File:Obelisco de Buenos Aires visto desde Avenida 9 de Julio y Lavalle.jpg",
    "cities/busan": "File:Korea-Busan-Haeundae-Beach-08.jpg",
    "cities/cairo": "File:All Gizah Pyramids.jpg",
    "cities/capetown": "File:Table Mountain, Cape Town. Official 7 new Wonder of Nature. 9 (cropped).JPG",
    "cities/casablanca": "File:Hassan II Mosque and Its Minaret in Casablanca, Morocco 2.jpg",
    "cities/chicago": "File:Skyline de Chicago desde el centro, Illinois, Estados Unidos, 2012-10-20, DD 06.jpg",
    "cities/colombo": "File:Colombo Skyline Jan 2022.jpg",
    "cities/delhi": "File:India Gate, New Delhi from West.jpg",
    "cities/doha": "File:Doha - West Bay Skyline 04.jpg",
    "cities/dubai": "File:Dubai Skyline mit Burj Khalifa (18241030269).jpg",
    "cities/frankfurt": "File:Skyline Frankfurt am Main 2015.jpg",
    "cities/guam": "File:Hotel and beach at Guam.JPG",
    "cities/hochiminh": "File:Ho Chi Minh City - Saigon1324.jpg",
    "cities/hongkong": "File:Tsim Tsa Chui Star Ferry Pier, Central Skyline and Victoria Peak, Hong Kong.jpg",
    "cities/honolulu": "File:Diamond Head from Waikiki Beach.jpg",
    "cities/istanbul": "File:Exterior of Sultan Ahmed I Mosque in Istanbul, Turkey 002.jpg",
    "cities/jakarta": "File:Monumen Nasional, Jakarta, Indonesia.jpg",
    "cities/jeju": "File:Hydrangea macrophylla in front of Seongsan Ilchulbong volcano at blue hour in Jeju Island South Korea.jpg",
    "cities/johannesburg": "File:View of Hillbrow skyline with Hillbrow Tower, Johannesburg, South Africa.jpg",
    "cities/kathmandu": "File:Boudha Stupa 2018 04.jpg",
    "cities/kualalumpur": "File:The Twins SE Asia 2019 (49171985716).jpg",
    "cities/lagos": "File:Lagos skyline.jpg",
    "cities/london": "File:Palace of Westminster, London - Feb 2007.jpg",
    "cities/losangeles": "File:Skyline of Los Angeles, Downtown Los Angeles, California 13.jpg",
    "cities/madrid": "File:Palacio Real de Madrid - 13.jpg",
    "cities/male": "File:Male-total.jpg",
    "cities/manila": "File:Manila Cathedral, Intramuros Manila.jpg",
    "cities/mexicocity": "File:Mexico City Palacio de bellas artes.jpg",
    "cities/miami": "File:Miami - Skyline from Harbor.jpg",
    "cities/milan": "File:View west along Duomo roof, Milan.jpg",
    "cities/montreal": "File:Biosphère de Montréal en juillet 2011.jpg",
    "cities/mumbai": "File:Panoramic view of Taj Palace Hotel and Taj Tower with the iconic Gateway of India in the background.jpg",
    "cities/nairobi": "File:Buffalo Nairobi Skyline Savannah Kenya May19 R1600769.jpg",
    "cities/newyork": "File:Lower Manhattan from Jersey City November 2016 002.jpg",
    "cities/osaka": "File:Osaka Castle Outer Moat and Osaka Business Park, November 2016.jpg",
    "cities/paris": "File:Eiffel tower from trocadero.jpg",
    "cities/rio": "File:Botafogo Beach and the Sugarloaf Mountain.jpg",
    "cities/rome": "File:Colosseum in Rome-April 2007-1- copie 2B.jpg",
    "cities/sanfrancisco": "File:Golden Gate Bridge in 2012 as seen from Battery Spencer.jpg",
    "cities/saopaulo": "File:Copanhilton.jpg",
    "cities/seoul": "File:Front view of the Eastern side of the Imperial Throne Hall Geunjeongjeon at Gyeongbokgung Palace in Seoul.jpg",
    "cities/shanghai": "File:Lujiazui from The Bund.jpg",
    "cities/singapore": "File:ArtScience Museum, Marina Bay Sands, Singapore.jpg",
    "cities/sydney": "File:Sydney Opera House - Dec 2008.jpg",
    "cities/taipei": "File:Taipei Taiwan Taipei-101-Tower-01.jpg",
    "cities/tokyo": "File:Minato City, Tokyo, Japan.jpg",
    "cities/toronto": "File:Toronto - ON - Skyline bei Nacht.jpg",
    "cities/vancouver": "File:Vancouver Skyline 04.jpg",
    "cities/zurich": "File:Zürich view Quaibrücke 20200702.jpg",
    # airlines
    "airlines/aerolineas": "File:02142019 Aerolineas Argentinas A332 LV-GKO KMIA NASEDIT (47110425222).jpg",
    "airlines/aeromexico": "File:(KOR-Incheon) Aeromexico Boeing 787-9 N815AM @ RKSI 2026-06-04.jpg",
    "airlines/aircanada": "File:Air Canada 787-9 C-FVLZ @YYZ.jpg",
    "airlines/airchina": "File:Air China Boeing 747-8 B-2485 MD1.jpg",
    "airlines/airfrance": "File:Air France Airbus A350-900 F-HUVE departing Boston June 2025.jpg",
    "airlines/airindia": "File:Air India, Boeing 777-237(LR), VT-ALG.jpg",
    "airlines/airlanka": "File:Air Lanka L-1011-385-3 Tristar 500 (4R-ULB 293F-1236) (3975768431).jpg",
    "airlines/airnewzealand": "File:Air New Zealand Boeing 777-300ER ZK-OKV taxiing at Taoyuan February 2026 2.jpg",
    "airlines/alitalia": "File:Alitalia Boeing 777-3Q8(ER) EI-WLA departing JFK Airport (cropped).jpg",
    "airlines/american": "File:140ak - American Airlines Boeing 777-223ER; N799AN@ZRH;25.07.2001 (8592693854).jpg",
    "airlines/ana": "File:ANA JA934A 787-9 HND 17-09-2024 (2).jpg",
    "airlines/asiana": "File:Asiana Airlines, Airbus A350-941, HL8078.jpg",
    "airlines/boac": "File:BOAC Boeing 707-336C G-AXGX.jpg",
    "airlines/britishairways": "File:British Airways 747 landing at LAS, June 2011.jpg",
    "airlines/cathay": "File:Cathay Pacific (B-LRA) Airbus A350-941 departing Sydney Airport (3).jpg",
    "airlines/chinaairlines": "File:China Airlines Airbus A350-900 B-18901 departing Taoyuan February 2026.jpg",
    "airlines/chinaeastern": "File:China Eastern Airlines Airbus A330-300 B-6096 landing at Taipei Songshan April 2026.jpg",
    "airlines/delta": "File:N571DZ - Airbus A350-941 - Delta Air Lines (52837747345).jpg",
    "airlines/egyptair": "File:EgyptAir Boeing 777-300ER SU-GDM London Heathrow Airport.jpg",
    "airlines/emirates": "File:Emirates Airlines, Boeing 777-300ER.jpg",
    "airlines/ethiopian": "File:ET-AOP Boeing 787-8 Dreamliner Ethiopian Airlines MSN-34744 VGHS.jpg",
    "airlines/garuda": "File:Garuda Indonesia A330-343 (PK-GPZ) landing at Ngurah Rai Airport.jpg",
    "airlines/gulfair": "File:A9C-FG - Gulf Air - Boeing 787-9 Dreamliner - 39986 - VGHS.jpg",
    "airlines/hawaiian": "File:N385HA Hawaiian Airlines Airbus A330-200 in 2021.jpg",
    "airlines/iberia": "File:(GBR-London) Iberia Airbus A350-941 EC-OAX @ EGLL 2025-06-17.jpg",
    "airlines/ita": "File:ITA Airways EI-IFF Airbus A350-941, FCO, 23022023.jpg",
    "airlines/jal": "File:Japan Airlines Boeing 787 JA876J Singapore 2024 (03).jpg",
    "airlines/kenya": "File:Kenya Airways Boeing 787-8 5Y-KZD at Schiphol 15-03-2020 (1).jpg",
    "airlines/klm": "File:KLM Boeing 777-300ER PH-BVK at Schiphol 27-08-2021.jpg",
    "airlines/korean": "File:Korean Air Boeing 747-400 HL7491.jpg",
    "airlines/lan": "File:LAN Airlines Boeing 767-316-ER CC-CZT (21162514474).jpg",
    "airlines/latam": "File:LATAM Chile Boeing 787-9 at Santiago Airport (2017).jpg",
    "airlines/lufthansa": "File:Lufthansa Boeing 747-8 D-ABYI IAD VA1.jpg",
    "airlines/malaysia": "File:9M-MTB - Malaysia Airlines - Airbus A330-323 - 1219 - VGHS.jpg",
    "airlines/northwest": "File:Northwest Airlines Boeing 747-451 (N661US 23719 696) (6853201992).jpg",
    "airlines/panam": "File:Boeing 747-100 (Pan Am) (8664189574).jpg",
    "airlines/philippine": "File:Philippine Airlines Airbus A350-900 (RP-C3501) landing at Davao International Airport.jpg",
    "airlines/qantas": "File:Qantas, Boeing 747-438, VH-OJS.jpg",
    "airlines/qatar": "File:Qatar Airways Boeing 777-300ER A7-BEW MD1.jpg",
    "airlines/royalairmaroc": "File:Royal Air Maroc Boeing 787-8 CN-RGC MD3.jpg",
    "airlines/saa": "File:South African Airways Airbus A340-642 ZS-SNA (21570177024).jpg",
    "airlines/singapore": "File:Singapore Airlines A350-941 (9V-SMI) landing at Singapore Changi Airport.jpg",
    "airlines/srilankan": "File:Left Sri Lankan A330 4R-ALT Chennai Jul25 R16 07938.jpg",
    "airlines/swiss": "File:Swiss International Air Lines Airbus A340-313 HB-JMM (21627801264).jpg",
    "airlines/swissair": "File:HB-IWT McDonnell Douglas MD-11 (cn 48486 509) Swissair. (6784582753).jpg",
    "airlines/thai": "File:Thai Airways International Boeing 777-300ER (HS-TKK) at Frankfurt Airport.jpg",
    "airlines/turkish": "File:Turkish Airlines Boeing 777-300ER TC-JJJ MD1.jpg",
    "airlines/twa": "File:Trans World Airlines - TWA Boeing 747-131 N53116 (28513996150).jpg",
    "airlines/united": "File:United Airlines - N772UA - Boeing 777-200 - San Francisco International Airport-0406.jpg",
    "airlines/varig": "File:VARIG McDonnell Douglas MD-11 PP-VPN (25250841704).jpg",
    "airlines/vietnam": "File:Vietnam Airlines Boeing 787-9 (VN-A862) at Frankfurt Airport.jpg",
}

ALLOWED_LICENSE = re.compile(r"^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?[ -]\d)", re.I)
# 그림·로고·사람 사진 등을 거르는 낱말 (파일 이름·분류에서 찾음)
REJECT = re.compile(
    r"logo|emblem|insignia|coat of arms|\bflag\b|\bseal\b|\bmap\b|diagram|drawing|illustration|render|painting|poster|"
    r"stamp|livery|scale model|\bmodel\b|\btoy\b|lego|diecast|simulator|screenshot|cockpit|cabin|interior|\bseats?\b|"
    r"galley|crash|wreck|accident|memorial|scrapp|portrait|selfie|crowd|wedding|passengers|\bcrew\b|tekening|zeichnung|dessin|"
    r"air ?show|parachut|miniliner|graphic|vector|clip ?art|artwork|\bicon\b",
    re.I,
)
REJECT_CATEGORY = re.compile(r"logos|emblems|scale models|aircraft models|cockpits|cabins|interiors|accidents|portraits|selfies|crowds|drawings|diagrams", re.I)
# 비행기가 옆으로 잘 보이는 사진일 가능성이 높은 낱말
GOOD_PLANE = re.compile(r"take-?off|takeoff|landing|approach|taxi|depart|arriv|line-?up|in flight|airborne|rotat|climb|final", re.I)
# 비행기 일부만 보이거나 어두운 사진일 가능성이 높은 낱말
BAD_PLANE = re.compile(
    r"night|museum|stored|preserved|snow|detail|nose|tail|close-?up|rear|front|underside|belly|fog|silhouette|engine|gear|wing|"
    r"winglet|door|boarding|jetway|jet bridge|maintenance|hangar|tow|pushback|parked|gate|apron|retire|boneyard|derelict",
    re.I,
)
# 등록 번호가 이름에 있으면 비행기 전체를 찍은 사진일 가능성이 높다 (항공 사진가들의 이름 짓는 방식)
REGISTRATION = re.compile(r"\b([A-Z]{1,2}-[A-Z0-9]{3,5}|N\d{1,5}[A-Z]{0,2}|JA\d{2,4}[A-Z]?|HL\d{4}|B-\d{4,5})\b")
QUALITY = re.compile(r"Quality[ _]images|Featured[ _]pictures|Valued[ _]images", re.I)
BAD_CITY = re.compile(
    r"night|nacht|panorama|interior|inside|detail|ceiling|statue of|\bplan\b|people|\(bw\)|black[- ]and[- ]white|monochrome|silhouette|sunset",
    re.I,
)
META_FIELDS = "LicenseShortName|LicenseUrl|Artist|Restrictions|Categories|UsageTerms"

_last_request = 0.0
CACHE: Path | None = None


def get(url: str, retries: int = 6) -> bytes:
    """위키미디어 API 이용 수칙에 맞춰 3초 간격으로 천천히 요청한다.
    너무 많다고 거절(429)되면 서버가 알려 준 시간(Retry-After)만큼 기다렸다가 다시 묻고,
    다른 오류는 점점 길게 기다렸다 다시 시도한다."""
    global _last_request
    attempt = waited = 0
    while True:
        wait = 3.0 - (time.time() - _last_request)
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
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and waited < 30:
                waited += 1
                delay = int(exc.headers.get("Retry-After") or 30)
                print(f"  요청이 많다고 해서 {delay}초 기다림…", file=sys.stderr)
                time.sleep(delay)
                continue
            error: Exception = exc
        except Exception as exc:  # noqa: BLE001
            error = exc
        attempt += 1
        if attempt >= retries:
            raise RuntimeError(f"요청 실패: {url}") from error
        delay = 10 * (2**attempt)
        print(f"  요청 실패({error}), {delay}초 후 다시 시도: {url[:90]}", file=sys.stderr)
        time.sleep(delay)


def get_cached(url: str) -> bytes:
    """--cache 폴더가 있으면 받은 응답과 사진을 저장해 두고 다시 쓴다 (고르는 방법·자르기만 바꿔 볼 때)."""
    if CACHE is None:
        return get(url)
    path = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".bin")
    if path.exists():
        return path.read_bytes()
    body = get(url)
    path.write_bytes(body)
    return body


def api(params: dict) -> dict:
    params = {**params, "format": "json", "formatversion": "2"}
    return json.loads(get_cached(API + "?" + urllib.parse.urlencode(params)))


def strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def short_author(raw: str) -> str:
    text = strip_html(raw)
    # 위키 서명·안내 문구를 걷어 내고 이름만 남긴다
    text = re.sub(r"\s*\d{1,2}:\d{2}, \d{1,2} \w+ \d{4} \(UTC\)", "", text)
    text = re.sub(r"\s*\((talk|contribs?|website|homepage|blog)[^)]*\)", "", text, flags=re.I)
    text = re.sub(r"^.*?(?:photo|picture|image) (?:was )?taken by (.+?)\.(?:\s+[A-Z][a-z]+\s.*)?$", r"\1", text, flags=re.I)
    text = re.sub(r"^The original uploader was (.+?) at (.+?)\.?$", r"\1 (\2)", text)
    text = re.sub(r"^Myself \((.+)\)\.?$", r"\1", text)
    text = re.sub(r"^(User:|by )\s*", "", text, flags=re.I)
    text = text.strip(" .")
    if len(text) > 60:
        text = re.split(r"[,;(]| from | - ", text)[0].strip()
    if len(text) > 60:
        text = text[:57].rstrip() + "…"
    return text or "알 수 없음"


def meta_value(meta: dict, key: str) -> str:
    value = meta.get(key, {}).get("value", "")
    return value if isinstance(value, str) else str(value)


def license_of(info: dict) -> str | None:
    """허용 목록 안의 라이선스면 그 이름, 아니면 None"""
    meta = info.get("extmetadata", {})
    name = meta_value(meta, "LicenseShortName")
    terms = meta_value(meta, "UsageTerms")
    if not ALLOWED_LICENSE.match(name) or re.search(r"non-?commercial|no ?deriv|\bNC\b|\bND\b", name + " " + terms, re.I):
        return None
    return name


def problem_of(page: dict, conf: dict, kind: str) -> str | None:
    """후보 사진이 쓸 수 없는 이유 (괜찮으면 None)"""
    info = page.get("imageinfo", [{}])[0]
    title = page["title"]
    meta = info.get("extmetadata", {})
    if info.get("mime") != "image/jpeg":
        return "사진(JPEG)이 아님"
    if not license_of(info):
        return f"라이선스 '{meta_value(meta, 'LicenseShortName')}'"
    if "personality" in meta_value(meta, "Restrictions").lower():
        return "사람이 주인공인 사진"
    if REJECT.search(title) or REJECT_CATEGORY.search(meta_value(meta, "Categories")):
        return "그림·로고·실내·사람 사진으로 보임"
    if conf.get("must") and not re.search(conf["must"], title):
        return "이름이 맞지 않음"
    if conf.get("not") and re.search(conf["not"], title):
        return "빼기로 한 이름"
    w, h = info.get("width", 0), info.get("height", 0)
    if w < 800 or h < 400:
        return "너무 작음"
    aspect = w / h
    if aspect < (1.0 if kind == "cities" else 1.25) or aspect > 3.0:
        return "가로세로 비율이 맞지 않음"
    return None


def pinned_problem(page: dict) -> str | None:
    """직접 고른 사진은 형식과 라이선스만 다시 확인한다"""
    info = page["imageinfo"][0]
    meta = info.get("extmetadata", {})
    if info.get("mime") != "image/jpeg":
        return "사진(JPEG)이 아님"
    if not license_of(info):
        return f"라이선스 '{meta_value(meta, 'LicenseShortName')}'"
    if "personality" in meta_value(meta, "Restrictions").lower():
        return "사람이 주인공인 사진"
    return None


def score_of(page: dict, kind: str) -> float:
    """검색 순서를 바탕으로, 잘 보일 것 같은 사진에 점수를 더한다 (같은 결과면 늘 같은 사진)"""
    info = page["imageinfo"][0]
    title = page["title"]
    w, h = info["width"], info["height"]
    target = KINDS[kind]["size"][0] / KINDS[kind]["size"][1]
    score = -0.15 * page.get("index", 0)
    # 위키미디어 공용에서 품질 사진·우수 사진으로 뽑힌 것
    if QUALITY.search(meta_value(info.get("extmetadata", {}), "Categories")):
        score += 4
    if target * 0.85 <= w / h <= target * 1.5:
        score += 3
    if w >= 1600:
        score += 1
    if kind == "cities":
        if BAD_CITY.search(title):
            score -= 4
    else:
        if GOOD_PLANE.search(title):
            score += 2
        if REGISTRATION.search(title):
            score += 2
        if BAD_PLANE.search(title):
            score -= 4
    return score


def search(query: str, limit: int = 50) -> list[dict]:
    data = api(
        {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"{query} filetype:bitmap",
            "gsrnamespace": "6",
            "gsrlimit": str(limit),
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": str(THUMB_WIDTH),
            "iiextmetadatafilter": META_FIELDS,
        }
    )
    pages = [p for p in data.get("query", {}).get("pages", []) if "imageinfo" in p]
    return sorted(pages, key=lambda p: p.get("index", 0))


def commons_info(files: list[str]) -> dict[str, dict]:
    """파일 이름 → 페이지 정보 (한 번에 40개씩 나눠서 묻는다)"""
    result = {}
    for i in range(0, len(files), 40):
        chunk = files[i : i + 40]
        data = api(
            {
                "action": "query",
                "titles": "|".join(chunk),
                "prop": "imageinfo",
                "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": str(THUMB_WIDTH),
                "iiextmetadatafilter": META_FIELDS,
            }
        )
        alias = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for page in data["query"]["pages"]:
            if page.get("missing") or "imageinfo" not in page:
                continue
            result[alias.get(page["title"], page["title"])] = page
    return result


def crop_to(img: Image.Image, target: float, fx: float, fy: float, zoom: float) -> Image.Image:
    """가로세로 비율 target으로 자른다. (fx, fy)를 가운데에 두려 하고, zoom만큼 더 가까이."""
    w, h = img.size
    if w / h > target:
        ch = h / zoom
        cw = ch * target
    else:
        cw = w / zoom
        ch = cw / target
    left = min(max(fx * w - cw / 2, 0), w - cw)
    top = min(max(fy * h - ch / 2, 0), h - ch)
    return img.crop((int(left), int(top), int(left + cw), int(top + ch)))


def fit_into(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """그림 전체를 넣고 남는 부분은 같은 그림을 흐리게 깔아서 채운다."""
    bg = crop_to(img, size[0] / size[1], 0.5, 0.5, 1).resize(size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))
    fg = img.copy()
    fg.thumbnail(size, Image.LANCZOS)
    bg.paste(fg, ((size[0] - fg.width) // 2, (size[1] - fg.height) // 2))
    return bg


def read_ids(kind: str) -> list[str]:
    path, pattern = KINDS[kind]["ids"]
    ids = re.findall(pattern, path.read_text(encoding="utf-8"), re.M)
    return list(dict.fromkeys(ids))


def read_credits() -> dict[str, dict]:
    if not CREDITS_TS.exists():
        return {}
    text = CREDITS_TS.read_text(encoding="utf-8")
    m = re.search(r"IMAGE_CREDITS[^=]*=\s*(\{.*\});", text, re.S)
    return json.loads(m.group(1)) if m else {}


def write_credits(credits: dict[str, dict]) -> None:
    body = json.dumps(dict(sorted(credits.items())), ensure_ascii=False, indent=2)
    CREDITS_TS.write_text(
        "// scripts/fetch-airline-images.py 가 만든 파일입니다. 직접 고치지 마세요.\n"
        "// 위키미디어 공용(Wikimedia Commons)의 자유 라이선스 사진. 키는 'aircraft/<기종 id>' | 'cities/<도시 id>' | 'airlines/<항공사 id>'\n"
        "export interface ImageCredit {\n  file: string;\n  author: string;\n  license: string;\n  licenseUrl: string;\n  source: string;\n}\n\n"
        f"export const IMAGE_CREDITS: Record<string, ImageCredit> = {body};\n",
        encoding="utf-8",
    )


def save_preview(previews: list[tuple[str, list[dict]]], path: Path) -> None:
    """항목마다 한 줄에 후보 사진을 번호와 함께 늘어놓는다 (번호는 --list 에 나온 번호)"""
    tw, th = 240, 160
    sheet = Image.new("RGB", (tw * 6, (th + 14) * len(previews)), "white")
    draw = ImageDraw.Draw(sheet)
    for row, (key, pages) in enumerate(previews):
        for col, page in enumerate(pages):
            url = page["imageinfo"][0]["thumburl"].replace(f"/{THUMB_WIDTH}px-", "/330px-")
            img = Image.open(io.BytesIO(get_cached(url))).convert("RGB")
            img.thumbnail((tw, th))
            x, y = col * tw, row * (th + 14)
            sheet.paste(img, (x, y))
            draw.text((x + 2, y + th + 1), f"{key} #{col}", fill="black")
    sheet.save(path)
    print(f"\n후보 사진 모음: {path}")


def main() -> None:
    global CACHE
    parser = argparse.ArgumentParser(description="하늘길 항공사 사진 받기")
    parser.add_argument("--only", help="쉼표로 나눈 '종류' 또는 '종류/id' (예: cities,aircraft/f27)")
    parser.add_argument("--list", action="store_true", help="검색 후보만 보여 주고 받지 않음")
    parser.add_argument("--preview", help="--list 와 함께: 후보 사진을 작게 받아 한 장(PNG)으로 모아 저장")
    parser.add_argument("--search", action="store_true", help="FILES에 고정한 사진을 무시하고 새로 검색")
    parser.add_argument("--quality", type=int, default=70, help="WebP 품질 (기본 70)")
    parser.add_argument("--cache", help="받은 원본을 저장해 둘 폴더 (같은 사진을 다시 받지 않음)")
    args = parser.parse_args()
    if args.cache:
        CACHE = Path(args.cache)
        CACHE.mkdir(parents=True, exist_ok=True)

    only = set(filter(None, (args.only or "").split(",")))
    items = []
    for kind in KINDS:
        for item_id in read_ids(kind):
            key = f"{kind}/{item_id}"
            if not only or kind in only or key in only:
                items.append((kind, item_id, key))
    print(f"사진 {len(items)}개 준비…")

    pinned = {key: FILES[key] for _, _, key in items if key in FILES and not args.search}
    infos = commons_info(sorted(set(pinned.values()))) if pinned else {}

    credits = read_credits()
    problems = []
    previews: list[tuple[str, list[dict]]] = []
    for kind, item_id, key in items:
        conf = CONFIG[kind].get(item_id)
        if conf is None:
            problems.append(f"{key}: 설정이 없음 ({kind} 설정에 검색어를 넣으세요)")
            continue
        if key in pinned:
            page = infos.get(pinned[key])
            why = "위키미디어 공용에 없음" if page is None else pinned_problem(page)
            if why:
                problems.append(f"{key}: {pinned[key]} — {why}")
                continue
        else:
            pages = search(conf["q"])
            ok = [p for p in pages if not problem_of(p, conf, kind)]
            ok.sort(key=lambda p: -score_of(p, kind))
            if args.list:
                print(f"\n[{key}] '{conf['q']}' 후보 {len(ok)}/{len(pages)}")
                for i, p in enumerate(ok[:8]):
                    ii = p["imageinfo"][0]
                    print(f"  {i}: {score_of(p, kind):5.1f}  {ii['width']}x{ii['height']}  {license_of(ii)}  {p['title']}")
                previews.append((key, ok[:6]))
                continue
            if not ok:
                problems.append(f"{key}: '{conf['q']}' 검색에서 쓸 만한 사진을 찾지 못함")
                continue
            page = ok[0]
        if args.list:
            continue

        info = page["imageinfo"][0]
        meta = info["extmetadata"]
        print(f"  {key}: {page['title']} [{license_of(info)}]")
        img = Image.open(io.BytesIO(get_cached(info["thumburl"]))).convert("RGB")
        size = KINDS[kind]["size"]
        if conf.get("fit"):
            img = fit_into(img, size)
        else:
            img = crop_to(img, size[0] / size[1], conf.get("fx", 0.5), conf.get("fy", 0.5), conf.get("zoom", 1.0))
            img = img.resize(size, Image.LANCZOS)
        out = ASSETS / kind / f"{item_id}.webp"
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, "WEBP", quality=args.quality, method=6)
        credits[key] = {
            "file": page["title"].removeprefix("File:"),
            "author": conf.get("author") or short_author(meta_value(meta, "Artist")),
            "license": license_of(info),
            "licenseUrl": meta_value(meta, "LicenseUrl"),
            "source": info["descriptionurl"],
        }

    if args.list:
        if args.preview and previews:
            save_preview(previews, Path(args.preview))
        return
    # 사진 파일이 없는 출처는 지운다
    credits = {k: v for k, v in credits.items() if (ASSETS / f"{k}.webp").exists()}
    write_credits(credits)

    total = sum(p.stat().st_size for p in ASSETS.glob("*/*.webp"))
    print(f"\n완료: 사진 {len(credits)}개, 모두 {total / 1e6:.2f} MB")
    if total > TOTAL_LIMIT:
        print(f"  ! 한도 {TOTAL_LIMIT / 1e6:.1f} MB를 넘었어요. --quality를 낮춰 보세요.")
    if problems:
        print("\n사진을 받지 못한 항목 (설정에서 검색어나 파일을 직접 지정하세요):", *problems, sep="\n  ")


if __name__ == "__main__":
    main()
