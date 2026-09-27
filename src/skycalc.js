// The real sky over Hood River, computed locally: planets (JPL approximate elements), the moon and sun
// (the largest terms of Meeus ch. 47 and ch. 25) for local solar eclipses and moon-planet pairings, and
// meteor-shower radiants. A port of the board's sky_more.py.
import { LAT, LON, localParts } from "./sky.js";

const DEG = 180 / Math.PI, RAD = Math.PI / 180, AU_KM = 149597870.7, EPS_J2000 = 23.4392911, ALT_KM = 0.03;
const mod = (x, m) => ((x % m) + m) % m;
export const julian = ms => ms / 86400e3 + 2440587.5;
export const gmstDeg = jd => mod(280.46061837 + 360.98564736629 * (jd - 2451545.0), 360);

// Azimuth/elevation (degrees) of a distant object at RA/Dec (degrees) from Hood River.
export function radecToAzel(jd, ra, dec) {
  const ha = (gmstDeg(jd) + LON - ra) * RAD, lat = LAT * RAD, d = dec * RAD;
  const el = Math.asin(Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(ha));
  const az = Math.atan2(-Math.cos(d) * Math.sin(ha), Math.sin(d) * Math.cos(lat) - Math.cos(d) * Math.sin(lat) * Math.cos(ha));
  return [mod(az * DEG, 360), el * DEG];
}
const eclToEqu = (x, y, z, eps = EPS_J2000) => {
  const e = eps * RAD;
  return [x, y * Math.cos(e) - z * Math.sin(e), y * Math.sin(e) + z * Math.cos(e)];
};
const vecRadec = (x, y, z) => [mod(Math.atan2(y, x) * DEG, 360), Math.atan2(z, Math.hypot(x, y)) * DEG];

// ---------------------------------------------------------------- planets

const ELEMENTS = { // a, e, I, L, long. perihelion, long. node, and their rates per Julian century
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};
export const PLANET_LOOK = { venus: [[255, 250, 230], 1.0], jupiter: [[255, 240, 205], 0.8], mars: [[255, 150, 110], 0.6], saturn: [[245, 225, 170], 0.55] };

function keplerE(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}
function orbitXyz(r, nu, w, node, inc) {
  const u = w + nu;
  return [r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc)),
    r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc)), r * Math.sin(u) * Math.sin(inc)];
}
function planetHelio(name, jd) {
  const T = (jd - 2451545.0) / 36525, [base, rates] = ELEMENTS[name];
  const [a, e, I, L, wp, node] = base.map((v, i) => v + rates[i] * T);
  const M = (mod(L - wp + 180, 360) - 180) * RAD, E = keplerE(M, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return orbitXyz(Math.hypot(xp, yp), Math.atan2(yp, xp), (wp - node) * RAD, node * RAD, I * RAD);
}
function planetRadec(name, jd) {
  const [ex, ey, ez] = planetHelio("earth", jd), [px, py, pz] = planetHelio(name, jd);
  const [x, y, z] = eclToEqu(px - ex, py - ey, pz - ez);
  return [...vecRadec(x, y, z), Math.hypot(x, y, z)];
}

// [[name, az, el, distance AU, hour angle deg]] for the naked-eye planets we draw.
export function planets(ms) {
  const jd = julian(ms);
  return Object.keys(PLANET_LOOK).map(name => {
    const [ra, dec, dist] = planetRadec(name, jd), [az, el] = radecToAzel(jd, ra, dec);
    return [name, az, el, dist, mod(gmstDeg(jd) + LON - ra + 180, 360) - 180];
  });
}

// ---------------------------------------------------------------- the moon and the sun

const LR = [[0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751], [0, 2, 0, 0, -2069, 0]];
const B = [[0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107]];

export function moonEcliptic(jd) {
  const T = (jd + 69 / 86400 - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * RAD;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * RAD;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * RAD;
  const F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) * RAD;
  const A1 = (119.75 + 131.849 * T) * RAD, A2 = (53.09 + 479264.290 * T) * RAD, A3 = (313.45 + 481266.484 * T) * RAD;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, cl, cr] of LR) {
    const k = E ** Math.abs(m), arg = d * D + m * M + mp * Mp + f * F;
    sl += cl * k * Math.sin(arg);
    sr += cr * k * Math.cos(arg);
  }
  for (const [d, m, mp, f, cb] of B) sb += cb * E ** Math.abs(m) * Math.sin(d * D + m * M + mp * Mp + f * F);
  const Lr = Lp * RAD;
  sl += 3958 * Math.sin(A1) + 1962 * Math.sin(Lr - F) + 318 * Math.sin(A2);
  sb += -2235 * Math.sin(Lr) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - F) + 175 * Math.sin(A1 + F)
    + 127 * Math.sin(Lr - Mp) - 115 * Math.sin(Lr + Mp);
  return [mod(Lp + sl / 1e6, 360), sb / 1e6, 385000.56 + sr / 1000];
}

export function sunEcliptic(jd) {
  const T = (jd + 69 / 86400 - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T, M = (357.52911 + 35999.05029 * T) * RAD;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const R = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(M + C * RAD));
  return [mod(L0 + C - 0.00569, 360), R];
}

function topo(jd, lonEcl, latEcl, distKm) {
  const T = (jd - 2451545.0) / 36525, eps = 23.4392911 - 0.0130042 * T, l = lonEcl * RAD, b = latEcl * RAD;
  const [x, y, z] = eclToEqu(distKm * Math.cos(b) * Math.cos(l), distKm * Math.cos(b) * Math.sin(l), distKm * Math.sin(b), eps);
  const th = (gmstDeg(jd) + LON) * RAD, lat = LAT * RAD, a = 6378.137, e2 = 0.00669437999014;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const ox = (N + ALT_KM) * Math.cos(lat) * Math.cos(th), oy = (N + ALT_KM) * Math.cos(lat) * Math.sin(th);
  const oz = (N * (1 - e2) + ALT_KM) * Math.sin(lat);
  const dx = x - ox, dy = y - oy, dz = z - oz, d = Math.hypot(dx, dy, dz);
  return [[dx / d, dy / d, dz / d], d];
}

// What an observer in Hood River sees of the sun and moon: separation and radii in degrees, and the
// moon's offset from the sun (dx right, dy up) on the sky.
export function sunMoonLocal(ms) {
  const jd = julian(ms), [ls, R] = sunEcliptic(jd), [lm, bm, dm] = moonEcliptic(jd);
  const [us] = topo(jd, ls, 0, R * AU_KM), [um, dmt] = topo(jd, lm, bm, dm);
  const sep = Math.acos(Math.max(-1, Math.min(1, us[0] * um[0] + us[1] * um[1] + us[2] * um[2]))) * DEG;
  const [azS, elS] = radecToAzel(jd, ...vecRadec(...us)), [azM, elM] = radecToAzel(jd, ...vecRadec(...um));
  return { sep, rSun: 0.266563 / R, rMoon: Math.asin(1737.4 / dmt) * DEG, sunEl: elS, sunAz: azS,
    dx: (mod(azM - azS + 180, 360) - 180) * Math.cos(elS * RAD), dy: elM - elS };
}

// The solar eclipse seen from Hood River on a local date, or null: { start, max, end (UTC ms), magnitude }.
export function solarEclipseOn(year, month, day) {
  const jd = julian(Date.UTC(year, month - 1, day, 20));
  if (Math.abs(mod(moonEcliptic(jd)[0] - sunEcliptic(jd)[0] + 180, 360) - 180) > 20) return null; // only near new moon
  let best = null, first = null, last = null;
  for (let i = 0, t = Date.UTC(year, month - 1, day, 12); i < 16 * 30; i++, t += 120e3) {
    const s = sunMoonLocal(t);
    if (s.sunEl > -0.8 && s.sep < s.rSun + s.rMoon) {
      first = first ?? t;
      last = t;
      const mag = (s.rSun + s.rMoon - s.sep) / (2 * s.rSun);
      if (!best || mag > best[1]) best = [t, mag];
    }
  }
  return best ? { start: first, max: best[0], end: last, magnitude: best[1] } : null;
}

function moonRadec(ms) {
  const jd = julian(ms), [lon, lat] = moonEcliptic(jd), T = (jd - 2451545.0) / 36525, l = lon * RAD, b = lat * RAD;
  return vecRadec(...eclToEqu(Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b), 23.4392911 - 0.0130042 * T));
}

// [[planet, separation deg]] for planets within `within` degrees of the moon.
export function moonPlanetPairs(ms, within = 4) {
  const jd = julian(ms), [mra, mdec] = moonRadec(ms), out = [];
  for (const name of Object.keys(PLANET_LOOK)) {
    const [ra, dec] = planetRadec(name, jd);
    const cs = Math.sin(mdec * RAD) * Math.sin(dec * RAD) + Math.cos(mdec * RAD) * Math.cos(dec * RAD) * Math.cos((mra - ra) * RAD);
    const sep = Math.acos(Math.max(-1, Math.min(1, cs))) * DEG;
    if (sep < within) out.push([name, sep]);
  }
  return out;
}

// ---------------------------------------------------------------- meteor showers

// [name, peak month, day, radiant RA, Dec (degrees), zenithal hourly rate]
const SHOWERS = [["Quadrantids", 1, 4, 230, 49, 110], ["Lyrids", 4, 22, 271, 34, 18], ["Eta Aquariids", 5, 6, 338, -1, 50],
  ["Delta Aquariids", 7, 30, 340, -16, 25], ["Perseids", 8, 12, 48, 58, 100], ["Draconids", 10, 8, 262, 54, 10],
  ["Orionids", 10, 21, 95, 16, 20], ["Leonids", 11, 17, 152, 22, 15], ["Geminids", 12, 14, 112, 33, 150],
  ["Ursids", 12, 22, 217, 76, 10]];

// [name, activity 0..1, zhr, radiant az, radiant el] for a shower near its peak tonight, else null.
// The night runs noon to noon, so the peak night carries through the small hours.
export function activeShower(ms) {
  const n = localParts(ms - 12 * 3600e3), night = Date.UTC(n.year, n.month - 1, n.day);
  for (const [name, m, d, ra, dec, zhr] of SHOWERS) {
    const days = Math.abs(Math.round((night - Date.UTC(n.year, m - 1, d)) / 86400e3));
    if (days <= 2) return [name, [1, 0.5, 0.2][days], zhr, ...radecToAzel(julian(ms), ra, dec)];
  }
  return null;
}
