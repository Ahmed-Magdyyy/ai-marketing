export interface Occasion {
  name: string;
  arabicName: string;
  date: Date;
  type: string;
}

/**
 * Returns the Gregorian date for the Monday after Eastern Orthodox Easter.
 * Valid for the 20th and 21st centuries.
 */
function getShammElNassim(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;

  const orthodoxEasterJulian = new Date(Date.UTC(year, month - 1, day));
  // 13 days difference between Julian and Gregorian calendars from 1900 to 2099
  const orthodoxEasterGregorian = new Date(
    orthodoxEasterJulian.getTime() + 13 * 86400000,
  );

  // Shamm el Nassim is the day (Monday) directly following Orthodox Easter Sunday
  return new Date(orthodoxEasterGregorian.getTime() + 1 * 86400000);
}

/**
 * Converts a Tabular Islamic calendar date to a Gregorian Date object.
 */
function hijriToGregorian(year: number, month: number, day: number): Date {
  const jd =
    Math.floor((11 * year + 3) / 30) +
    354 * year +
    30 * month -
    Math.floor((month - 1) / 2) +
    day +
    1948440 -
    385;

  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const d = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;

  return new Date(Date.UTC(y, m - 1, d));
}

function getHijriYear(gregorianYear: number): number {
  return Math.round((gregorianYear - 622) * (33 / 32));
}

/**
 * Retrieves important marketing and cultural occasions for a specific month/year/country.
 */
export function getOccasions(
  month: number,
  year: number,
  country: string = "egypt",
): Occasion[] {
  const occasions: Occasion[] = [];
  const hYear = getHijriYear(year);

  // 1. Core Islamic/Arab Occasions
  // Check the neighboring Hijri years because the Hijri year shifts across Gregorian years
  for (const y of [hYear - 1, hYear, hYear + 1]) {
    const ramadan = hijriToGregorian(y, 9, 1);
    if (ramadan.getUTCFullYear() === year) {
      occasions.push({
        name: "Ramadan",
        arabicName: "رمضان",
        date: ramadan,
        type: "religious",
      });
    }

    const eidFitr = hijriToGregorian(y, 10, 1);
    if (eidFitr.getUTCFullYear() === year) {
      occasions.push({
        name: "Eid el Fitr",
        arabicName: "عيد الفطر",
        date: eidFitr,
        type: "religious",
      });
    }

    const eidAdha = hijriToGregorian(y, 12, 10);
    if (eidAdha.getUTCFullYear() === year) {
      occasions.push({
        name: "Eid el Adha",
        arabicName: "عيد الأضحى",
        date: eidAdha,
        type: "religious",
      });
    }

    const islamicNewYear = hijriToGregorian(y, 1, 1);
    if (islamicNewYear.getUTCFullYear() === year) {
      occasions.push({
        name: "Islamic New Year",
        arabicName: "رأس السنة الهجرية",
        date: islamicNewYear,
        type: "religious",
      });
    }

    const prophetsBirthday = hijriToGregorian(y, 3, 12);
    if (prophetsBirthday.getUTCFullYear() === year) {
      occasions.push({
        name: "Prophet's Birthday",
        arabicName: "المولد النبوي",
        date: prophetsBirthday,
        type: "religious",
      });
    }
  }

  const c = country.toLowerCase().trim();

  // 2. Egypt Specific
  if (c === "egypt") {
    occasions.push({
      name: "Coptic Christmas",
      arabicName: "عيد الميلاد المجيد",
      date: new Date(Date.UTC(year, 0, 7)),
      type: "national",
    });
    occasions.push({
      name: "Revolution Day",
      arabicName: "عيد الثورة",
      date: new Date(Date.UTC(year, 0, 25)),
      type: "national",
    });
    occasions.push({
      name: "Mother's Day",
      arabicName: "عيد الأم",
      date: new Date(Date.UTC(year, 2, 21)),
      type: "national",
    });
    occasions.push({
      name: "Shamm el Nassim",
      arabicName: "شم النسيم",
      date: getShammElNassim(year),
      type: "national",
    });
    occasions.push({
      name: "30 June",
      arabicName: "ثورة 30 يونيو",
      date: new Date(Date.UTC(year, 5, 30)),
      type: "national",
    });
    occasions.push({
      name: "Summer Season",
      arabicName: "موسم الصيف",
      date: new Date(Date.UTC(year, 5, 1)),
      type: "season",
    });
    occasions.push({
      name: "Back to School",
      arabicName: "العودة للمدارس",
      date: new Date(Date.UTC(year, 8, 15)),
      type: "season",
    });

    // Black Friday Calculation (Last Friday of November)
    const lastDayNov = new Date(Date.UTC(year, 10, 30));
    const offset = (lastDayNov.getUTCDay() + 2) % 7;
    const blackFriday = new Date(Date.UTC(year, 10, 30 - offset));
    occasions.push({
      name: "Black Friday",
      arabicName: "البلاك فرايداي",
      date: blackFriday,
      type: "commercial",
    });
  }

  // 3. Saudi Arabia Specific
  if (["saudi arabia", "ksa", "saudi", "السعودية"].includes(c)) {
    occasions.push({
      name: "Founding Day",
      arabicName: "يوم التأسيس",
      date: new Date(Date.UTC(year, 1, 22)),
      type: "national",
    });
    occasions.push({
      name: "Saudi National Day",
      arabicName: "اليوم الوطني السعودي",
      date: new Date(Date.UTC(year, 8, 23)),
      type: "national",
    });
    occasions.push({
      name: "Riyadh Season",
      arabicName: "موسم الرياض",
      date: new Date(Date.UTC(year, 9, 20)),
      type: "season",
    });
  }

  // 4. UAE Specific
  if (["uae", "united arab emirates", "الإمارات"].includes(c)) {
    occasions.push({
      name: "Dubai Shopping Festival",
      arabicName: "مهرجان دبي للتسوق",
      date: new Date(Date.UTC(year, 0, 1)),
      type: "season",
    });
    occasions.push({
      name: "UAE National Day",
      arabicName: "اليوم الوطني الإماراتي",
      date: new Date(Date.UTC(year, 11, 2)),
      type: "national",
    });
  }

  // Filter and return only occasions for the requested month
  return occasions.filter((occ) => occ.date.getUTCMonth() + 1 === month);
}
