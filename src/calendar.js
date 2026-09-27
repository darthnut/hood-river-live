// Calendar dates the eggs and the holiday line need. Dates are [year, month, day] in Hood River.

// Gregorian Easter Sunday (the anonymous Gregorian algorithm).
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return [year, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1];
}

// The n-th given weekday (Mon=0 .. Sun=6) of a month; n = -1 for the last one.
export function nthWeekday(year, month, weekday, n) {
  const wd = (y, m, d) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Mon=0
  if (n > 0) return [year, month, 1 + ((weekday - wd(year, month, 1) + 7) % 7) + 7 * (n - 1)];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [year, month, last - ((wd(year, month, last) - weekday + 7) % 7)];
}

export const thanksgiving = year => nthWeekday(year, 11, 3, 4);

export const sameDay = (now, [y, m, d]) => now.year === y && now.month === m && now.day === d;
