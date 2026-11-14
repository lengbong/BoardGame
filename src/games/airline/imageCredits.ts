// scripts/fetch-airline-images.py 가 만든 파일입니다. 직접 고치지 마세요.
// 위키미디어 공용(Wikimedia Commons)의 자유 라이선스 사진. 키는 'aircraft/<기종 id>' | 'cities/<도시 id>' | 'airlines/<항공사 id>'
export interface ImageCredit {
  file: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

export const IMAGE_CREDITS: Record<string, ImageCredit> = {
  "aircraft/a220-300": {
    "file": "JetBlue Airways Airbus A220-300 N3132J departing Boston November 2025.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:JetBlue_Airways_Airbus_A220-300_N3132J_departing_Boston_November_2025.jpg"
  },
  "aircraft/a300-600": {
    "file": "Airbus A300-600R Egyptair SU-GAR.jpg",
    "author": "Arcturus",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/",
    "source": "https://commons.wikimedia.org/wiki/File:Airbus_A300-600R_Egyptair_SU-GAR.jpg"
  },
  "aircraft/a300b4": {
    "file": "Airbus A300B4-203 Airbus Industrie (AIB) F-WUAB - MSN 238 (3291919477).jpg",
    "author": "Laurent ERRERA from L'Union, France",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Airbus_A300B4-203_Airbus_Industrie_(AIB)_F-WUAB_-_MSN_238_(3291919477).jpg"
  },
  "aircraft/a310": {
    "file": "Leipzig Halle Airport Pakistan International Airlines Airbus A310-308 AP-BEQ (DSC07738).jpg",
    "author": "MarcelX42",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Leipzig_Halle_Airport_Pakistan_International_Airlines_Airbus_A310-308_AP-BEQ_(DSC07738).jpg"
  },
  "aircraft/a320": {
    "file": "Lufthansa Airbus A320-211 D-AIQT 01.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lufthansa_Airbus_A320-211_D-AIQT_01.jpg"
  },
  "aircraft/a320neo": {
    "file": "IndiGo VT-IJB A320neo Mumbai Apr22 R16 05934.jpg",
    "author": "Timothy A. Gonsalves",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:IndiGo_VT-IJB_A320neo_Mumbai_Apr22_R16_05934.jpg"
  },
  "aircraft/a321": {
    "file": "Middle East Airlines A321-200 (F-ORMF) landing at London Heathrow Airport.jpg",
    "author": "Adrian Pingstone",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Middle_East_Airlines_A321-200_(F-ORMF)_landing_at_London_Heathrow_Airport.jpg"
  },
  "aircraft/a321neo": {
    "file": "China Airlines Airbus A321neo B-18102 departing Taoyuan February 2026.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:China_Airlines_Airbus_A321neo_B-18102_departing_Taoyuan_February_2026.jpg"
  },
  "aircraft/a330-300": {
    "file": "Oman Air Airbus A330-343 A4O-DI MUC 2015 02.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Oman_Air_Airbus_A330-343_A4O-DI_MUC_2015_02.jpg"
  },
  "aircraft/a330-900": {
    "file": "Virgin Atlantic Airbus A330-900neo G-VLDY on final approach to Boston Feb 2025.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Virgin_Atlantic_Airbus_A330-900neo_G-VLDY_on_final_approach_to_Boston_Feb_2025.jpg"
  },
  "aircraft/a340-300": {
    "file": "South African Airways Airbus A340-313 ZS-SXE MUC 2015 02.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:South_African_Airways_Airbus_A340-313_ZS-SXE_MUC_2015_02.jpg"
  },
  "aircraft/a340-600": {
    "file": "Airbus A340-642 - Iberia - EC-JLE.jpg",
    "author": "Carlos Delgado",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Airbus_A340-642_-_Iberia_-_EC-JLE.jpg"
  },
  "aircraft/a350-1000": {
    "file": "Starlux Airbus A350-1000 B-58551 departing Taoyuan February 2026 4.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Starlux_Airbus_A350-1000_B-58551_departing_Taoyuan_February_2026_4.jpg"
  },
  "aircraft/a350-900": {
    "file": "Lufthansa Airbus A350-941 D-AIXA STR 2016 02.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lufthansa_Airbus_A350-941_D-AIXA_STR_2016_02.jpg"
  },
  "aircraft/a380": {
    "file": "Emirates Airbus A380-861 A6-EER MUC 2015 01.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Emirates_Airbus_A380-861_A6-EER_MUC_2015_01.jpg"
  },
  "aircraft/atr72": {
    "file": "Indigo ATR72 VT-IYG Approach Chennai Aug22 A7C 02270.jpg",
    "author": "Timothy A. Gonsalves",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Indigo_ATR72_VT-IYG_Approach_Chennai_Aug22_A7C_02270.jpg"
  },
  "aircraft/b707": {
    "file": "Boeing 707-330B (Lufthansa D-ABUF \"Hannover\", Anfang 1980er Jahre).jpg",
    "author": "Roland Arhelger",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Boeing_707-330B_(Lufthansa_D-ABUF_%22Hannover%22,_Anfang_1980er_Jahre).jpg"
  },
  "aircraft/b727-100": {
    "file": "Avianca Boeing 727-100 HK-1272.jpg",
    "author": "Michael Bernhard",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Avianca_Boeing_727-100_HK-1272.jpg"
  },
  "aircraft/b727-200": {
    "file": "VR-CBQ Boeing 727-212 STN.jpg",
    "author": "kitmasterbloke",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:VR-CBQ_Boeing_727-212_STN.jpg"
  },
  "aircraft/b737-200": {
    "file": "YV2559 Conviasa Boeing 737-200.jpg",
    "author": "Wilfredor",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:YV2559_Conviasa_Boeing_737-200.jpg"
  },
  "aircraft/b737-300": {
    "file": "Lufthansa - Boeing 737-300 (D-ABEP).jpg",
    "author": "Raimond Spekking",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lufthansa_-_Boeing_737-300_(D-ABEP).jpg"
  },
  "aircraft/b737-800": {
    "file": "Southwest Boeing 737-800 N8676A BWI MD1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Southwest_Boeing_737-800_N8676A_BWI_MD1.jpg"
  },
  "aircraft/b747-100": {
    "file": "Sabena Boeing 747-100 Marmet.jpg",
    "author": "Eduard Marmet",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Sabena_Boeing_747-100_Marmet.jpg"
  },
  "aircraft/b747-200": {
    "file": "Southern Air Boeing 747-230B(SF) N760SA 01.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Southern_Air_Boeing_747-230B(SF)_N760SA_01.jpg"
  },
  "aircraft/b747-400": {
    "file": "Thai Airways International Boeing 747-4D7 HS-TGP MUC 2015 03.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Thai_Airways_International_Boeing_747-4D7_HS-TGP_MUC_2015_03.jpg"
  },
  "aircraft/b757": {
    "file": "Delta Boeing 757-200 N699DL BWI MD1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Delta_Boeing_757-200_N699DL_BWI_MD1.jpg"
  },
  "aircraft/b767-200": {
    "file": "United Boeing 767-200 N74007 MD1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:United_Boeing_767-200_N74007_MD1.jpg"
  },
  "aircraft/b767-300": {
    "file": "Atlas Air Boeing 767-300ER N662GT BWI MD1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Atlas_Air_Boeing_767-300ER_N662GT_BWI_MD1.jpg"
  },
  "aircraft/b777-200": {
    "file": "British Airways Boeing 777-200ER G-VIIH IAD VA1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:British_Airways_Boeing_777-200ER_G-VIIH_IAD_VA1.jpg"
  },
  "aircraft/b777-300": {
    "file": "United Boeing 777-300ER N2136U IAD VA2.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:United_Boeing_777-300ER_N2136U_IAD_VA2.jpg"
  },
  "aircraft/b787-8": {
    "file": "Qatar Airways Boeing 787-8 Dreamliner A7-BCO MUC 2015 02.jpg",
    "author": "Julian Herzog",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Qatar_Airways_Boeing_787-8_Dreamliner_A7-BCO_MUC_2015_02.jpg"
  },
  "aircraft/b787-9": {
    "file": "N1015X Air Tahiti Nui Boeing 787-9 Dreamliner 46.jpg",
    "author": "New York-air",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:N1015X_Air_Tahiti_Nui_Boeing_787-9_Dreamliner_46.jpg"
  },
  "aircraft/caravelle": {
    "file": "Thai Airways International Sud Aviation Caravelle (OY-KRE) at Stockholm-Arlanda Airport.jpg",
    "author": "Lars Söderström",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/",
    "source": "https://commons.wikimedia.org/wiki/File:Thai_Airways_International_Sud_Aviation_Caravelle_(OY-KRE)_at_Stockholm-Arlanda_Airport.jpg"
  },
  "aircraft/concorde": {
    "file": "238cq - British Airways Concorde, G-BOAD@LHR,24.05.2003 - Flickr - Aero Icarus.jpg",
    "author": "Aero Icarus from Zürich, Switzerland",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:238cq_-_British_Airways_Concorde,_G-BOAD@LHR,24.05.2003_-_Flickr_-_Aero_Icarus.jpg"
  },
  "aircraft/crj200": {
    "file": "Braunschweig Airport Copenhagen AirTaxi Global Reach Aviation Bombardier CRJ-200LR OY-CRJ (DSC03384).jpg",
    "author": "MarcelX42",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Braunschweig_Airport_Copenhagen_AirTaxi_Global_Reach_Aviation_Bombardier_CRJ-200LR_OY-CRJ_(DSC03384).jpg"
  },
  "aircraft/dc10": {
    "file": "N313FE Fedex 1988 McDonnell Douglas DC-10-30(F) CN- 48311-440 \"Bilal\" (13929394625).jpg",
    "author": "Tomás Del Coro from Las Vegas, Nevada, USA",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:N313FE_Fedex_1988_McDonnell_Douglas_DC-10-30(F)_CN-_48311-440_%22Bilal%22_(13929394625).jpg"
  },
  "aircraft/dc8-50": {
    "file": "F-RAFE Douglas DC-8-53 Armee de l'Air, Le Bourget museee.jpg",
    "author": "kitmasterbloke",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:F-RAFE_Douglas_DC-8-53_Armee_de_l%27Air,_Le_Bourget_museee.jpg"
  },
  "aircraft/dc8-63": {
    "file": "McDonnell Douglas DC-8-63, CP Air AN0344516.jpg",
    "author": "Pedro Aragão",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_DC-8-63,_CP_Air_AN0344516.jpg"
  },
  "aircraft/dc9": {
    "file": "YV2220 Aserca Airlines McDonnell Douglas DC-9-30.jpg",
    "author": "Wilfredor",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:YV2220_Aserca_Airlines_McDonnell_Douglas_DC-9-30.jpg"
  },
  "aircraft/e190": {
    "file": "JetBlue Embraer E190 N337JB with paint damage departing Boston March 2025.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:JetBlue_Embraer_E190_N337JB_with_paint_damage_departing_Boston_March_2025.jpg"
  },
  "aircraft/f100": {
    "file": "QantasLink Fokker 100 VH-NHZ Perth 2024 (03).jpg",
    "author": "Bahnfrend",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:QantasLink_Fokker_100_VH-NHZ_Perth_2024_(03).jpg"
  },
  "aircraft/f27": {
    "file": "Fokker F27 Friendship (6013754795).jpg",
    "author": "thinboyfatter",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Fokker_F27_Friendship_(6013754795).jpg"
  },
  "aircraft/l1011": {
    "file": "Lockheed L-1011-300 Tristar N172DA Delta ATL GA1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lockheed_L-1011-300_Tristar_N172DA_Delta_ATL_GA1.jpg"
  },
  "aircraft/md11": {
    "file": "PH-KCA KLM Royal Dutch Airlines McDonnell Douglas MD-11, landing at Schiphol (AMS - EHAM), Netherlands, pic2.JPG",
    "author": "Alf van Beem",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:PH-KCA_KLM_Royal_Dutch_Airlines_McDonnell_Douglas_MD-11,_landing_at_Schiphol_(AMS_-_EHAM),_Netherlands,_pic2.JPG"
  },
  "aircraft/md82": {
    "file": "Hannover Airport European Air Charter McDonnell Douglas MD-82 LZ-LDT (DSC09492).jpg",
    "author": "MarcelX42",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Hannover_Airport_European_Air_Charter_McDonnell_Douglas_MD-82_LZ-LDT_(DSC09492).jpg"
  },
  "aircraft/q400": {
    "file": "Bombardier Dash 8 Q400 VH-LQL Domestic Terminal Brisbane Airport P1350067.jpg",
    "author": "John Robert McPherson",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Bombardier_Dash_8_Q400_VH-LQL_Domestic_Terminal_Brisbane_Airport_P1350067.jpg"
  },
  "airlines/aerolineas": {
    "file": "02142019 Aerolineas Argentinas A332 LV-GKO KMIA NASEDIT (47110425222).jpg",
    "author": "Nathan Coats from Seattle, WA, United States of America",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:02142019_Aerolineas_Argentinas_A332_LV-GKO_KMIA_NASEDIT_(47110425222).jpg"
  },
  "airlines/aeromexico": {
    "file": "(KOR-Incheon) Aeromexico Boeing 787-9 N815AM @ RKSI 2026-06-04.jpg",
    "author": "S5A-0043",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:(KOR-Incheon)_Aeromexico_Boeing_787-9_N815AM_@_RKSI_2026-06-04.jpg"
  },
  "airlines/aircanada": {
    "file": "Air Canada 787-9 C-FVLZ @YYZ.jpg",
    "author": "AVA Navigate",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Air_Canada_787-9_C-FVLZ_@YYZ.jpg"
  },
  "airlines/airchina": {
    "file": "Air China Boeing 747-8 B-2485 MD1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Air_China_Boeing_747-8_B-2485_MD1.jpg"
  },
  "airlines/airfrance": {
    "file": "Air France Airbus A350-900 F-HUVE departing Boston June 2025.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Air_France_Airbus_A350-900_F-HUVE_departing_Boston_June_2025.jpg"
  },
  "airlines/airindia": {
    "file": "Air India, Boeing 777-237(LR), VT-ALG.jpg",
    "author": "Bill Larkins",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Air_India,_Boeing_777-237(LR),_VT-ALG.jpg"
  },
  "airlines/airlanka": {
    "file": "Air Lanka L-1011-385-3 Tristar 500 (4R-ULB 293F-1236) (3975768431).jpg",
    "author": "contri from Yonezawa-Shi, Yamagata, Japan",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Air_Lanka_L-1011-385-3_Tristar_500_(4R-ULB_293F-1236)_(3975768431).jpg"
  },
  "airlines/airnewzealand": {
    "file": "Air New Zealand Boeing 777-300ER ZK-OKV taxiing at Taoyuan February 2026 2.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Air_New_Zealand_Boeing_777-300ER_ZK-OKV_taxiing_at_Taoyuan_February_2026_2.jpg"
  },
  "airlines/alitalia": {
    "file": "Alitalia Boeing 777-3Q8(ER) EI-WLA departing JFK Airport (cropped).jpg",
    "author": "Adam Moreira (AEMoreira042281)",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Alitalia_Boeing_777-3Q8(ER)_EI-WLA_departing_JFK_Airport_(cropped).jpg"
  },
  "airlines/american": {
    "file": "140ak - American Airlines Boeing 777-223ER; N799AN@ZRH;25.07.2001 (8592693854).jpg",
    "author": "Aero Icarus from Zürich, Switzerland",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:140ak_-_American_Airlines_Boeing_777-223ER;_N799AN@ZRH;25.07.2001_(8592693854).jpg"
  },
  "airlines/ana": {
    "file": "ANA JA934A 787-9 HND 17-09-2024 (2).jpg",
    "author": "BWard 1997",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:ANA_JA934A_787-9_HND_17-09-2024_(2).jpg"
  },
  "airlines/asiana": {
    "file": "Asiana Airlines, Airbus A350-941, HL8078.jpg",
    "author": "ltdccba",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Asiana_Airlines,_Airbus_A350-941,_HL8078.jpg"
  },
  "airlines/boac": {
    "file": "BOAC Boeing 707-336C G-AXGX.jpg",
    "author": "Lars Söderström",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/",
    "source": "https://commons.wikimedia.org/wiki/File:BOAC_Boeing_707-336C_G-AXGX.jpg"
  },
  "airlines/britishairways": {
    "file": "British Airways 747 landing at LAS, June 2011.jpg",
    "author": "Tomás del Coro",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:British_Airways_747_landing_at_LAS,_June_2011.jpg"
  },
  "airlines/cathay": {
    "file": "Cathay Pacific (B-LRA) Airbus A350-941 departing Sydney Airport (3).jpg",
    "author": "Bidgee",
    "license": "CC BY-SA 3.0 au",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/au/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Cathay_Pacific_(B-LRA)_Airbus_A350-941_departing_Sydney_Airport_(3).jpg"
  },
  "airlines/chinaairlines": {
    "file": "China Airlines Airbus A350-900 B-18901 departing Taoyuan February 2026.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:China_Airlines_Airbus_A350-900_B-18901_departing_Taoyuan_February_2026.jpg"
  },
  "airlines/chinaeastern": {
    "file": "China Eastern Airlines Airbus A330-300 B-6096 landing at Taipei Songshan April 2026.jpg",
    "author": "4300streetcar",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:China_Eastern_Airlines_Airbus_A330-300_B-6096_landing_at_Taipei_Songshan_April_2026.jpg"
  },
  "airlines/delta": {
    "file": "N571DZ - Airbus A350-941 - Delta Air Lines (52837747345).jpg",
    "author": "Colin Brown from St Ann, MO, USA",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:N571DZ_-_Airbus_A350-941_-_Delta_Air_Lines_(52837747345).jpg"
  },
  "airlines/egyptair": {
    "file": "EgyptAir Boeing 777-300ER SU-GDM London Heathrow Airport.jpg",
    "author": "Phillip Capper",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:EgyptAir_Boeing_777-300ER_SU-GDM_London_Heathrow_Airport.jpg"
  },
  "airlines/emirates": {
    "file": "Emirates Airlines, Boeing 777-300ER.jpg",
    "author": "Md Shaifuzzaman Ayon",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Emirates_Airlines,_Boeing_777-300ER.jpg"
  },
  "airlines/ethiopian": {
    "file": "ET-AOP Boeing 787-8 Dreamliner Ethiopian Airlines MSN-34744 VGHS.jpg",
    "author": "Md Shaifuzzaman Ayon",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:ET-AOP_Boeing_787-8_Dreamliner_Ethiopian_Airlines_MSN-34744_VGHS.jpg"
  },
  "airlines/garuda": {
    "file": "Garuda Indonesia A330-343 (PK-GPZ) landing at Ngurah Rai Airport.jpg",
    "author": "Vismay Bhadra",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Garuda_Indonesia_A330-343_(PK-GPZ)_landing_at_Ngurah_Rai_Airport.jpg"
  },
  "airlines/gulfair": {
    "file": "A9C-FG - Gulf Air - Boeing 787-9 Dreamliner - 39986 - VGHS.jpg",
    "author": "Md Shaifuzzaman Ayon",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:A9C-FG_-_Gulf_Air_-_Boeing_787-9_Dreamliner_-_39986_-_VGHS.jpg"
  },
  "airlines/hawaiian": {
    "file": "N385HA Hawaiian Airlines Airbus A330-200 in 2021.jpg",
    "author": "Larry D. Moore",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:N385HA_Hawaiian_Airlines_Airbus_A330-200_in_2021.jpg"
  },
  "airlines/iberia": {
    "file": "(GBR-London) Iberia Airbus A350-941 EC-OAX @ EGLL 2025-06-17.jpg",
    "author": "S5A-0043",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:(GBR-London)_Iberia_Airbus_A350-941_EC-OAX_@_EGLL_2025-06-17.jpg"
  },
  "airlines/ita": {
    "file": "ITA Airways EI-IFF Airbus A350-941, FCO, 23022023.jpg",
    "author": "Anna Zvereva",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:ITA_Airways_EI-IFF_Airbus_A350-941,_FCO,_23022023.jpg"
  },
  "airlines/jal": {
    "file": "Japan Airlines Boeing 787 JA876J Singapore 2024 (03).jpg",
    "author": "Bahnfrend",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Japan_Airlines_Boeing_787_JA876J_Singapore_2024_(03).jpg"
  },
  "airlines/kenya": {
    "file": "Kenya Airways Boeing 787-8 5Y-KZD at Schiphol 15-03-2020 (1).jpg",
    "author": "Robbie Klinkenberg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Kenya_Airways_Boeing_787-8_5Y-KZD_at_Schiphol_15-03-2020_(1).jpg"
  },
  "airlines/klm": {
    "file": "KLM Boeing 777-300ER PH-BVK at Schiphol 27-08-2021.jpg",
    "author": "Robbie Klinkenberg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:KLM_Boeing_777-300ER_PH-BVK_at_Schiphol_27-08-2021.jpg"
  },
  "airlines/korean": {
    "file": "Korean Air Boeing 747-400 HL7491.jpg",
    "author": "BriYYZ",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Korean_Air_Boeing_747-400_HL7491.jpg"
  },
  "airlines/lan": {
    "file": "LAN Airlines Boeing 767-316-ER CC-CZT (21162514474).jpg",
    "author": "Kambui",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:LAN_Airlines_Boeing_767-316-ER_CC-CZT_(21162514474).jpg"
  },
  "airlines/latam": {
    "file": "LATAM Chile Boeing 787-9 at Santiago Airport (2017).jpg",
    "author": "Sky KoreSCL",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:LATAM_Chile_Boeing_787-9_at_Santiago_Airport_(2017).jpg"
  },
  "airlines/lufthansa": {
    "file": "Lufthansa Boeing 747-8 D-ABYI IAD VA1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lufthansa_Boeing_747-8_D-ABYI_IAD_VA1.jpg"
  },
  "airlines/malaysia": {
    "file": "9M-MTB - Malaysia Airlines - Airbus A330-323 - 1219 - VGHS.jpg",
    "author": "Md Shaifuzzaman Ayon",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:9M-MTB_-_Malaysia_Airlines_-_Airbus_A330-323_-_1219_-_VGHS.jpg"
  },
  "airlines/northwest": {
    "file": "Northwest Airlines Boeing 747-451 (N661US 23719 696) (6853201992).jpg",
    "author": "contri from Yonezawa-Shi, Yamagata, Japan",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Northwest_Airlines_Boeing_747-451_(N661US_23719_696)_(6853201992).jpg"
  },
  "airlines/panam": {
    "file": "Boeing 747-100 (Pan Am) (8664189574).jpg",
    "author": "MercerMJ",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Boeing_747-100_(Pan_Am)_(8664189574).jpg"
  },
  "airlines/philippine": {
    "file": "Philippine Airlines Airbus A350-900 (RP-C3501) landing at Davao International Airport.jpg",
    "author": "James.cgs",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Philippine_Airlines_Airbus_A350-900_(RP-C3501)_landing_at_Davao_International_Airport.jpg"
  },
  "airlines/qantas": {
    "file": "Qantas, Boeing 747-438, VH-OJS.jpg",
    "author": "Bill Larkins",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Qantas,_Boeing_747-438,_VH-OJS.jpg"
  },
  "airlines/qatar": {
    "file": "Qatar Airways Boeing 777-300ER A7-BEW MD1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Qatar_Airways_Boeing_777-300ER_A7-BEW_MD1.jpg"
  },
  "airlines/royalairmaroc": {
    "file": "Royal Air Maroc Boeing 787-8 CN-RGC MD3.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Royal_Air_Maroc_Boeing_787-8_CN-RGC_MD3.jpg"
  },
  "airlines/saa": {
    "file": "South African Airways Airbus A340-642 ZS-SNA (21570177024).jpg",
    "author": "Kambui",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:South_African_Airways_Airbus_A340-642_ZS-SNA_(21570177024).jpg"
  },
  "airlines/singapore": {
    "file": "Singapore Airlines A350-941 (9V-SMI) landing at Singapore Changi Airport.jpg",
    "author": "Bruce Cowan",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Singapore_Airlines_A350-941_(9V-SMI)_landing_at_Singapore_Changi_Airport.jpg"
  },
  "airlines/srilankan": {
    "file": "Left Sri Lankan A330 4R-ALT Chennai Jul25 R16 07938.jpg",
    "author": "Timothy A. Gonsalves",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Left_Sri_Lankan_A330_4R-ALT_Chennai_Jul25_R16_07938.jpg"
  },
  "airlines/swiss": {
    "file": "Swiss International Air Lines Airbus A340-313 HB-JMM (21627801264).jpg",
    "author": "Kambui",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Swiss_International_Air_Lines_Airbus_A340-313_HB-JMM_(21627801264).jpg"
  },
  "airlines/swissair": {
    "file": "HB-IWT McDonnell Douglas MD-11 (cn 48486 509) Swissair. (6784582753).jpg",
    "author": "Andrew Thomas from Shrewsbury, UK",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:HB-IWT_McDonnell_Douglas_MD-11_(cn_48486_509)_Swissair._(6784582753).jpg"
  },
  "airlines/thai": {
    "file": "Thai Airways International Boeing 777-300ER (HS-TKK) at Frankfurt Airport.jpg",
    "author": "tjdarmstadt",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Thai_Airways_International_Boeing_777-300ER_(HS-TKK)_at_Frankfurt_Airport.jpg"
  },
  "airlines/turkish": {
    "file": "Turkish Airlines Boeing 777-300ER TC-JJJ MD1.jpg",
    "author": "Acroterion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Turkish_Airlines_Boeing_777-300ER_TC-JJJ_MD1.jpg"
  },
  "airlines/twa": {
    "file": "Trans World Airlines - TWA Boeing 747-131 N53116 (28513996150).jpg",
    "author": "Kambui",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Trans_World_Airlines_-_TWA_Boeing_747-131_N53116_(28513996150).jpg"
  },
  "airlines/united": {
    "file": "United Airlines - N772UA - Boeing 777-200 - San Francisco International Airport-0406.jpg",
    "author": "Raimond Spekking",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:United_Airlines_-_N772UA_-_Boeing_777-200_-_San_Francisco_International_Airport-0406.jpg"
  },
  "airlines/varig": {
    "file": "VARIG McDonnell Douglas MD-11 PP-VPN (25250841704).jpg",
    "author": "MercerMJ",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:VARIG_McDonnell_Douglas_MD-11_PP-VPN_(25250841704).jpg"
  },
  "airlines/vietnam": {
    "file": "Vietnam Airlines Boeing 787-9 (VN-A862) at Frankfurt Airport.jpg",
    "author": "tjdarmstadt",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Vietnam_Airlines_Boeing_787-9_(VN-A862)_at_Frankfurt_Airport.jpg"
  },
  "cities/amsterdam": {
    "file": "Water reflection of canal houses at blue hour in Damrak Amsterdam the Netherlands.jpg",
    "author": "Basile Morin",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Water_reflection_of_canal_houses_at_blue_hour_in_Damrak_Amsterdam_the_Netherlands.jpg"
  },
  "cities/athens": {
    "file": "Attica 06-13 Athens 50 View from Philopappos - Acropolis Hill.jpg",
    "author": "A.Savin",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Attica_06-13_Athens_50_View_from_Philopappos_-_Acropolis_Hill.jpg"
  },
  "cities/auckland": {
    "file": "Auckland CBD skyline from Waitemata Harbour entrance.jpg",
    "author": "Pseudopanax at English Wikipedia",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Auckland_CBD_skyline_from_Waitemata_Harbour_entrance.jpg"
  },
  "cities/bali": {
    "file": "Brantan Bali Pura-Ulun-Danu-Bratan-01.jpg",
    "author": "CEphoto, Uwe Aranas",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Brantan_Bali_Pura-Ulun-Danu-Bratan-01.jpg"
  },
  "cities/bangkok": {
    "file": "Wat Arun from Chao Phraya River.jpg",
    "author": "Diliff",
    "license": "CC BY 2.5",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.5",
    "source": "https://commons.wikimedia.org/wiki/File:Wat_Arun_from_Chao_Phraya_River.jpg"
  },
  "cities/barcelona": {
    "file": "SF maig 2 cropped.jpg",
    "author": "Canaan",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:SF_maig_2_cropped.jpg"
  },
  "cities/beijing": {
    "file": "天安门夜景.jpg",
    "author": "Charlie fong冯成",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:%E5%A4%A9%E5%AE%89%E9%97%A8%E5%A4%9C%E6%99%AF.jpg"
  },
  "cities/buenosaires": {
    "file": "Obelisco de Buenos Aires visto desde Avenida 9 de Julio y Lavalle.jpg",
    "author": "Horacio Cambeiro",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Obelisco_de_Buenos_Aires_visto_desde_Avenida_9_de_Julio_y_Lavalle.jpg"
  },
  "cities/busan": {
    "file": "Korea-Busan-Haeundae-Beach-08.jpg",
    "author": "frakorea",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Korea-Busan-Haeundae-Beach-08.jpg"
  },
  "cities/cairo": {
    "file": "All Gizah Pyramids.jpg",
    "author": "Ricardo Liberato",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:All_Gizah_Pyramids.jpg"
  },
  "cities/capetown": {
    "file": "Table Mountain, Cape Town. Official 7 new Wonder of Nature. 9 (cropped).JPG",
    "author": "A3alb",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Table_Mountain,_Cape_Town._Official_7_new_Wonder_of_Nature._9_(cropped).JPG"
  },
  "cities/casablanca": {
    "file": "Hassan II Mosque and Its Minaret in Casablanca, Morocco 2.jpg",
    "author": "Dahbi fatima zahrae",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Hassan_II_Mosque_and_Its_Minaret_in_Casablanca,_Morocco_2.jpg"
  },
  "cities/chicago": {
    "file": "Skyline de Chicago desde el centro, Illinois, Estados Unidos, 2012-10-20, DD 06.jpg",
    "author": "Diego Delso",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Skyline_de_Chicago_desde_el_centro,_Illinois,_Estados_Unidos,_2012-10-20,_DD_06.jpg"
  },
  "cities/colombo": {
    "file": "Colombo Skyline Jan 2022.jpg",
    "author": "XKillSwitchXxx",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Colombo_Skyline_Jan_2022.jpg"
  },
  "cities/delhi": {
    "file": "India Gate, New Delhi from West.jpg",
    "author": "Nikhilb239",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:India_Gate,_New_Delhi_from_West.jpg"
  },
  "cities/doha": {
    "file": "Doha - West Bay Skyline 04.jpg",
    "author": "P. Hughes",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Doha_-_West_Bay_Skyline_04.jpg"
  },
  "cities/dubai": {
    "file": "Dubai Skyline mit Burj Khalifa (18241030269).jpg",
    "author": "Tim Reckmann from Hamm, Deutschland",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Dubai_Skyline_mit_Burj_Khalifa_(18241030269).jpg"
  },
  "cities/frankfurt": {
    "file": "Skyline Frankfurt am Main 2015.jpg",
    "author": "Christian Wolf (www.c-w-design.de)",
    "license": "CC BY-SA 3.0 de",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Skyline_Frankfurt_am_Main_2015.jpg"
  },
  "cities/guam": {
    "file": "Hotel and beach at Guam.JPG",
    "author": "小野 優太",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Hotel_and_beach_at_Guam.JPG"
  },
  "cities/hochiminh": {
    "file": "Ho Chi Minh City - Saigon1324.jpg",
    "author": "lumoplank",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Ho_Chi_Minh_City_-_Saigon1324.jpg"
  },
  "cities/hongkong": {
    "file": "Tsim Tsa Chui Star Ferry Pier, Central Skyline and Victoria Peak, Hong Kong.jpg",
    "author": "Daniel Case",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Tsim_Tsa_Chui_Star_Ferry_Pier,_Central_Skyline_and_Victoria_Peak,_Hong_Kong.jpg"
  },
  "cities/honolulu": {
    "file": "Diamond Head from Waikiki Beach.jpg",
    "author": "Jackie Gleason Columbus, OH / Partyk1d24 at en.wikipedia",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Diamond_Head_from_Waikiki_Beach.jpg"
  },
  "cities/istanbul": {
    "file": "Exterior of Sultan Ahmed I Mosque in Istanbul, Turkey 002.jpg",
    "author": "Moonik",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Exterior_of_Sultan_Ahmed_I_Mosque_in_Istanbul,_Turkey_002.jpg"
  },
  "cities/jakarta": {
    "file": "Monumen Nasional, Jakarta, Indonesia.jpg",
    "author": "Ramayoni",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Monumen_Nasional,_Jakarta,_Indonesia.jpg"
  },
  "cities/jeju": {
    "file": "Hydrangea macrophylla in front of Seongsan Ilchulbong volcano at blue hour in Jeju Island South Korea.jpg",
    "author": "Basile Morin",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Hydrangea_macrophylla_in_front_of_Seongsan_Ilchulbong_volcano_at_blue_hour_in_Jeju_Island_South_Korea.jpg"
  },
  "cities/johannesburg": {
    "file": "View of Hillbrow skyline with Hillbrow Tower, Johannesburg, South Africa.jpg",
    "author": "Bertrand van der Berg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:View_of_Hillbrow_skyline_with_Hillbrow_Tower,_Johannesburg,_South_Africa.jpg"
  },
  "cities/kathmandu": {
    "file": "Boudha Stupa 2018 04.jpg",
    "author": "Nabin K. Sapkota",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Boudha_Stupa_2018_04.jpg"
  },
  "cities/kualalumpur": {
    "file": "The Twins SE Asia 2019 (49171985716).jpg",
    "author": "James Kerwin from Tbilisi",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:The_Twins_SE_Asia_2019_(49171985716).jpg"
  },
  "cities/lagos": {
    "file": "Lagos skyline.jpg",
    "author": "Clara Sanchiz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lagos_skyline.jpg"
  },
  "cities/london": {
    "file": "Palace of Westminster, London - Feb 2007.jpg",
    "author": "Diliff",
    "license": "CC BY-SA 2.5",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5",
    "source": "https://commons.wikimedia.org/wiki/File:Palace_of_Westminster,_London_-_Feb_2007.jpg"
  },
  "cities/losangeles": {
    "file": "Skyline of Los Angeles, Downtown Los Angeles, California 13.jpg",
    "author": "Levi Clancy",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Skyline_of_Los_Angeles,_Downtown_Los_Angeles,_California_13.jpg"
  },
  "cities/madrid": {
    "file": "Palacio Real de Madrid - 13.jpg",
    "author": "Carlos Delgado",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Palacio_Real_de_Madrid_-_13.jpg"
  },
  "cities/male": {
    "file": "Male-total.jpg",
    "author": "Shahee Ilyas",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/",
    "source": "https://commons.wikimedia.org/wiki/File:Male-total.jpg"
  },
  "cities/manila": {
    "file": "Manila Cathedral, Intramuros Manila.jpg",
    "author": "Markadan",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Manila_Cathedral,_Intramuros_Manila.jpg"
  },
  "cities/mexicocity": {
    "file": "Mexico City Palacio de bellas artes.jpg",
    "author": "Jeses",
    "license": "CC BY-SA 2.5",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5",
    "source": "https://commons.wikimedia.org/wiki/File:Mexico_City_Palacio_de_bellas_artes.jpg"
  },
  "cities/miami": {
    "file": "Miami - Skyline from Harbor.jpg",
    "author": "P. Hughes",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Miami_-_Skyline_from_Harbor.jpg"
  },
  "cities/milan": {
    "file": "View west along Duomo roof, Milan.jpg",
    "author": "Daniel Case",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:View_west_along_Duomo_roof,_Milan.jpg"
  },
  "cities/montreal": {
    "file": "Biosphère de Montréal en juillet 2011.jpg",
    "author": "Idej Elixe",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Biosph%C3%A8re_de_Montr%C3%A9al_en_juillet_2011.jpg"
  },
  "cities/mumbai": {
    "file": "Panoramic view of Taj Palace Hotel and Taj Tower with the iconic Gateway of India in the background.jpg",
    "author": "iMahesh",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Panoramic_view_of_Taj_Palace_Hotel_and_Taj_Tower_with_the_iconic_Gateway_of_India_in_the_background.jpg"
  },
  "cities/nairobi": {
    "file": "Buffalo Nairobi Skyline Savannah Kenya May19 R1600769.jpg",
    "author": "Timothy A. Gonsalves",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Buffalo_Nairobi_Skyline_Savannah_Kenya_May19_R1600769.jpg"
  },
  "cities/newyork": {
    "file": "Lower Manhattan from Jersey City November 2016 002.jpg",
    "author": "King of Hearts",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lower_Manhattan_from_Jersey_City_November_2016_002.jpg"
  },
  "cities/osaka": {
    "file": "Osaka Castle Outer Moat and Osaka Business Park, November 2016.jpg",
    "author": "Martin Falbisoner",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Osaka_Castle_Outer_Moat_and_Osaka_Business_Park,_November_2016.jpg"
  },
  "cities/paris": {
    "file": "Eiffel tower from trocadero.jpg",
    "author": "NonOmnisMoriar",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Eiffel_tower_from_trocadero.jpg"
  },
  "cities/rio": {
    "file": "Botafogo Beach and the Sugarloaf Mountain.jpg",
    "author": "Donatas Dabravolskas",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Botafogo_Beach_and_the_Sugarloaf_Mountain.jpg"
  },
  "cities/rome": {
    "file": "Colosseum in Rome-April 2007-1- copie 2B.jpg",
    "author": "Diliff",
    "license": "CC BY-SA 2.5",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.5",
    "source": "https://commons.wikimedia.org/wiki/File:Colosseum_in_Rome-April_2007-1-_copie_2B.jpg"
  },
  "cities/sanfrancisco": {
    "file": "Golden Gate Bridge in 2012 as seen from Battery Spencer.jpg",
    "author": "Choinowski",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_in_2012_as_seen_from_Battery_Spencer.jpg"
  },
  "cities/saopaulo": {
    "file": "Copanhilton.jpg",
    "author": "Paul Keller",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Copanhilton.jpg"
  },
  "cities/seoul": {
    "file": "Front view of the Eastern side of the Imperial Throne Hall Geunjeongjeon at Gyeongbokgung Palace in Seoul.jpg",
    "author": "Basile Morin",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Front_view_of_the_Eastern_side_of_the_Imperial_Throne_Hall_Geunjeongjeon_at_Gyeongbokgung_Palace_in_Seoul.jpg"
  },
  "cities/shanghai": {
    "file": "Lujiazui from The Bund.jpg",
    "author": "kallerna",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lujiazui_from_The_Bund.jpg"
  },
  "cities/singapore": {
    "file": "ArtScience Museum, Marina Bay Sands, Singapore.jpg",
    "author": "Basile Morin",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:ArtScience_Museum,_Marina_Bay_Sands,_Singapore.jpg"
  },
  "cities/sydney": {
    "file": "Sydney Opera House - Dec 2008.jpg",
    "author": "Diliff",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_-_Dec_2008.jpg"
  },
  "cities/taipei": {
    "file": "Taipei Taiwan Taipei-101-Tower-01.jpg",
    "author": "CEphoto, Uwe Aranas",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Taipei_Taiwan_Taipei-101-Tower-01.jpg"
  },
  "cities/tokyo": {
    "file": "Minato City, Tokyo, Japan.jpg",
    "author": "David Kernan",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Minato_City,_Tokyo,_Japan.jpg"
  },
  "cities/toronto": {
    "file": "Toronto - ON - Skyline bei Nacht.jpg",
    "author": "Wladyslaw",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/",
    "source": "https://commons.wikimedia.org/wiki/File:Toronto_-_ON_-_Skyline_bei_Nacht.jpg"
  },
  "cities/vancouver": {
    "file": "Vancouver Skyline 04.jpg",
    "author": "Xicotencatl",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Vancouver_Skyline_04.jpg"
  },
  "cities/zurich": {
    "file": "Zürich view Quaibrücke 20200702.jpg",
    "author": "Daniel Kraft",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Z%C3%BCrich_view_Quaibr%C3%BCcke_20200702.jpg"
  }
};
