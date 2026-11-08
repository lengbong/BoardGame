// scripts/fetch-city-images.py 가 만든 파일입니다. 직접 고치지 마세요.
export interface ImageCredit {
  id: string;
  file: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

export const IMAGE_CREDITS: ImageCredit[] = [
  {
    "id": "cairo",
    "file": "Pyramids of the Giza Necropolis.jpg",
    "author": "KennyOMG",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pyramids_of_the_Giza_Necropolis.jpg"
  },
  {
    "id": "istanbul",
    "file": "Hagia Sophia (228968325).jpeg",
    "author": "Adli Wahid",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Hagia_Sophia_(228968325).jpeg"
  },
  {
    "id": "hanoi",
    "file": "Thap Rua.jpg",
    "author": "Cyril Doussin from London, United Kingdom",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Thap_Rua.jpg"
  },
  {
    "id": "bangkok",
    "file": "เจดีย์ประธานทรงปรางค์วัดอรุณ2.jpg",
    "author": "Mastertongapollo",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:%E0%B9%80%E0%B8%88%E0%B8%94%E0%B8%B5%E0%B8%A2%E0%B9%8C%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%98%E0%B8%B2%E0%B8%99%E0%B8%97%E0%B8%A3%E0%B8%87%E0%B8%9B%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B8%84%E0%B9%8C%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%AD%E0%B8%A3%E0%B8%B8%E0%B8%932.jpg"
  },
  {
    "id": "newdelhi",
    "file": "India Gate, New Delhi from West.jpg",
    "author": "Nikhilb239",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:India_Gate,_New_Delhi_from_West.jpg"
  },
  {
    "id": "taipei",
    "file": "Taipei Taiwan Taipei-101-Tower-01.jpg",
    "author": "CEphoto, Uwe Aranas",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Taipei_Taiwan_Taipei-101-Tower-01.jpg"
  },
  {
    "id": "singapore",
    "file": "Marina Bay Sands (I).jpg",
    "author": "Supanut Arunoprayote",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Marina_Bay_Sands_(I).jpg"
  },
  {
    "id": "beijing",
    "file": "Temple of Heaven 20160323 01.jpg",
    "author": "Shujianyang",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Temple_of_Heaven_20160323_01.jpg"
  },
  {
    "id": "rio",
    "file": "Pão de Açucar - Sugarloaf Mountain - Zuckerhut - 2022.jpg",
    "author": "Arne Müseler",
    "license": "CC BY-SA 3.0 de",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:P%C3%A3o_de_A%C3%A7ucar_-_Sugarloaf_Mountain_-_Zuckerhut_-_2022.jpg"
  },
  {
    "id": "sydney",
    "file": "Sydney Opera House 2026.jpg",
    "author": "BAVhah",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Sydney_Opera_House_2026.jpg"
  },
  {
    "id": "seoul",
    "file": "광화문 월대.jpg",
    "author": "서울관광 아카이브",
    "license": "KOGL Type 1",
    "licenseUrl": "http://www.kogl.or.kr/info/licenseType1.do",
    "source": "https://commons.wikimedia.org/wiki/File:%EA%B4%91%ED%99%94%EB%AC%B8_%EC%9B%94%EB%8C%80.jpg"
  },
  {
    "id": "moscow",
    "file": "Saint Basil's Cathedral in Moscow.jpg",
    "author": "Tsy1980",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Saint_Basil%27s_Cathedral_in_Moscow.jpg"
  },
  {
    "id": "athens",
    "file": "The Parthenon in Athens.jpg",
    "author": "Steve Swayne",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:The_Parthenon_in_Athens.jpg"
  },
  {
    "id": "rome",
    "file": "Colosseo 2020.jpg",
    "author": "FeaturedPics",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Colosseo_2020.jpg"
  },
  {
    "id": "barcelona",
    "file": "SF maig 2 cropped.jpg",
    "author": "Canaan",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:SF_maig_2_cropped.jpg"
  },
  {
    "id": "berlin",
    "file": "Brandenburger Tor abends.jpg",
    "author": "Thomas Wolf, www.foto-tw.de",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Brandenburger_Tor_abends.jpg"
  },
  {
    "id": "amsterdam",
    "file": "Colorful canal houses at golden hour in Damrak avenue Amsterdam the Netherlands.jpg",
    "author": "Basile Morin",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Colorful_canal_houses_at_golden_hour_in_Damrak_avenue_Amsterdam_the_Netherlands.jpg"
  },
  {
    "id": "london",
    "file": "Elizabeth Tower and the north front of the Palace of Westminster, London.jpg",
    "author": "Christian David",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Elizabeth_Tower_and_the_north_front_of_the_Palace_of_Westminster,_London.jpg"
  },
  {
    "id": "paris",
    "file": "Tour Eiffel Wikimedia Commons (cropped).jpg",
    "author": "Benh LIEU SONG",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons_(cropped).jpg"
  },
  {
    "id": "dubai",
    "file": "The Dubai Fountain & Burj Khalifa Pixabay.jpg",
    "author": "Christian Raggini",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:The_Dubai_Fountain_%26_Burj_Khalifa_Pixabay.jpg"
  },
  {
    "id": "tokyo",
    "file": "Tokyo Tower 2023.jpg",
    "author": "Akonnchiroll",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Tokyo_Tower_2023.jpg"
  },
  {
    "id": "newyork",
    "file": "Front view of Statue of Liberty (cropped).jpg",
    "author": "AskALotl",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Front_view_of_Statue_of_Liberty_(cropped).jpg"
  }
];
