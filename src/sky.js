// The real sun and moon over Hood River, and the time-of-day palettes.

export const LAT = 45.7054, LON = -121.5215;
export const TZ = "America/Los_Angeles";

const RAD = Math.PI / 180;
const remainder = (x, m) => x - m * Math.round(x / m);

// Sun elevation/hour angle and an approximate moon (phase-trailing, equatorial), from a UTC timestamp in ms.
export function skyState(ms) {
  const utc = ms / 1000;
  const n = utc / 86400 + 2440587.5 - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * RAD;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const gmst = ((18.697374558 + 24.06570982441908 * n) % 24 + 24) % 24;
  const ha = remainder((gmst * 15 + LON) * RAD - ra, 2 * Math.PI);
  const lat = LAT * RAD;
  const elev = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / RAD;
  const phase = (((utc - 947182440) / 86400 % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853;
  const mha = remainder(ha - phase * 2 * Math.PI, 2 * Math.PI);
  const melev = Math.asin(Math.cos(lat) * Math.cos(mha)) / RAD;
  return { elev, ha: ha / RAD, melev, mha: mha / RAD, phase };
}

export const PHASES = ["night", "twi", "gold", "day"];
const ANCHORS = [-12.0, -5.0, 1.0, 12.0]; // sun elevation where each phase is "pure"

export function phaseWeights(elev) {
  const e = Math.min(Math.max(elev, ANCHORS[0]), ANCHORS[3]);
  const w = { night: 0, twi: 0, gold: 0, day: 0 };
  for (let i = 0; i < 3; i++) {
    if (ANCHORS[i] <= e && e <= ANCHORS[i + 1]) {
      const f = (e - ANCHORS[i]) / (ANCHORS[i + 1] - ANCHORS[i]);
      w[PHASES[i]] = 1 - f; w[PHASES[i + 1]] = f;
      break;
    }
  }
  return w;
}

// Blend a per-phase table of 0..255 colours (or lists of colours) by the weights; returns 0..1 values.
export function mixp(w, table) {
  const first = table.night;
  if (Array.isArray(first[0])) {
    return first.map((_, i) => [0, 1, 2].map(k => PHASES.reduce((s, p) => s + w[p] * table[p][i][k], 0) / 255));
  }
  return [0, 1, 2].map(k => PHASES.reduce((s, p) => s + w[p] * table[p][k], 0) / 255);
}

export const SKY = {
  night: [[0, [3, 4, 14]], [10, [6, 8, 24]], [22, [11, 14, 34]], [31, [16, 20, 44]], [35, [20, 24, 50]]],
  twi: [[0, [14, 14, 50]], [10, [40, 36, 96]], [22, [110, 70, 130]], [31, [200, 110, 120]], [35, [230, 150, 130]]],
  gold: [[0, [14, 8, 40]], [10, [60, 26, 96]], [22, [190, 70, 100]], [31, [255, 140, 70]], [35, [255, 196, 120]]],
  day: [[0, [36, 96, 196]], [10, [60, 130, 220]], [22, [110, 170, 235]], [31, [160, 205, 242]], [35, [185, 220, 245]]],
};
// rock shadow, rock lit, snow shadow, snow lit
export const MOUNTAIN = {
  night: [[16, 18, 36], [20, 22, 42], [55, 60, 92], [75, 82, 118]],
  twi: [[45, 42, 86], [60, 55, 105], [115, 115, 165], [160, 145, 195]],
  gold: [[72, 58, 118], [125, 85, 150], [165, 150, 205], [255, 205, 225]],
  day: [[70, 82, 112], [112, 118, 142], [190, 205, 232], [250, 252, 255]],
};
export const DEEP_WATER = { night: [3, 6, 16], twi: [12, 18, 45], gold: [10, 24, 58], day: [20, 62, 110] };
export const SUN_GLOW = { night: [0, 0, 0], twi: [230, 110, 90], gold: [255, 150, 80], day: [255, 245, 220] };
export const SUN_DISC = { night: [255, 200, 140], twi: [255, 180, 120], gold: [255, 225, 150], day: [255, 255, 235] };

// Hood River local time, whatever the visitor's own timezone: {year, month, day, hour, minute, second, weekday}.
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  second: "numeric", weekday: "short", hourCycle: "h23",
});
const WEEKDAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
export function localParts(ms) {
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = value;
  return {
    year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second,
    weekday: WEEKDAYS[p.weekday], weekdayName: p.weekday,
  };
}

// The UTC ms timestamp of a Hood River wall-clock time (handles daylight saving).
export function hoodRiverTime(year, month, day, hour = 0, minute = 0, second = 0) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second) + 8 * 3600e3;
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess);
    const got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += Date.UTC(year, month - 1, day, hour, minute, second) - got;
  }
  return guess;
}

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
