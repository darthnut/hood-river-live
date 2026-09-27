// The real sky, computed locally: lunar eclipses (Meeus, Astronomical Algorithms ch. 54).
// A port of the board's sky_events.py / sky_more.py.

const rad = d => d * Math.PI / 180;

// The umbral lunar eclipse at the full moon nearest `ms` (UTC ms), or null:
// { max (UTC ms), kind "partial"|"total", magnitude, partialMin, totalMin, gamma }.
export function lunarEclipseNear(ms) {
  const when = new Date(ms);
  const y0 = when.getUTCFullYear(), jan1 = Date.UTC(y0, 0, 1);
  const year = y0 + ((ms - jan1) / 86400e3 + 1 - 0.5) / 365.25;
  const k = Math.round((year - 2000) * 12.3685 - 0.5) + 0.5;
  const T = k / 1236.85;
  const M = rad(((2.5534 + 29.10535670 * k - 0.0000014 * T * T) % 360 + 360) % 360);
  const Mp = rad(((201.5643 + 385.81693528 * k + 0.0107582 * T * T) % 360 + 360) % 360);
  const F = rad(((160.7108 + 390.67050284 * k - 0.0016118 * T * T) % 360 + 360) % 360);
  const Om = rad(((124.7746 - 1.56375588 * k + 0.0020672 * T * T) % 360 + 360) % 360);
  if (Math.abs(Math.sin(F)) > 0.36) return null;
  const E = 1 - 0.002516 * T;
  const F1 = F - rad(0.02665) * Math.sin(Om);
  const A1 = rad(((299.77 + 0.107408 * k) % 360 + 360) % 360);
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T;
  jde += -0.4065 * Math.sin(Mp) + 0.1727 * E * Math.sin(M) + 0.0161 * Math.sin(2 * Mp) - 0.0097 * Math.sin(2 * F1)
    + 0.0073 * E * Math.sin(Mp - M) - 0.0050 * E * Math.sin(Mp + M) - 0.0023 * Math.sin(Mp - 2 * F1)
    + 0.0021 * E * Math.sin(2 * M) + 0.0012 * Math.sin(Mp + 2 * F1) + 0.0006 * E * Math.sin(2 * Mp + M)
    - 0.0004 * Math.sin(3 * Mp) - 0.0003 * E * Math.sin(M + 2 * F1) + 0.0003 * Math.sin(A1)
    - 0.0002 * E * Math.sin(M - 2 * F1) - 0.0002 * E * Math.sin(2 * Mp - M) - 0.0002 * Math.sin(Om);
  const P = 0.2070 * E * Math.sin(M) + 0.0024 * E * Math.sin(2 * M) - 0.0392 * Math.sin(Mp) + 0.0116 * Math.sin(2 * Mp)
    - 0.0073 * E * Math.sin(Mp + M) + 0.0067 * E * Math.sin(Mp - M) + 0.0118 * Math.sin(2 * F1);
  const Q = 5.2207 - 0.0048 * E * Math.cos(M) + 0.0020 * E * Math.cos(2 * M) - 0.3299 * Math.cos(Mp)
    - 0.0060 * E * Math.cos(Mp + M) + 0.0041 * E * Math.cos(Mp - M);
  const Wf = Math.abs(Math.cos(F1));
  const gamma = (P * Math.cos(F1) + Q * Math.sin(F1)) * (1 - 0.0048 * Wf);
  const u = 0.0059 + 0.0046 * E * Math.cos(M) - 0.0182 * Math.cos(Mp) + 0.0004 * Math.cos(2 * Mp) - 0.0005 * Math.cos(M + Mp);
  const mag = (1.0128 - u - Math.abs(gamma)) / 0.5450;
  if (mag <= 0) return null;
  const n = 0.5458 + 0.0400 * Math.cos(Mp);
  const p = 1.0128 - u, tt = 0.4678 - u;
  const partial = 60 / n * Math.sqrt(Math.max(0, p * p - gamma * gamma));
  const total = tt * tt > gamma * gamma ? 60 / n * Math.sqrt(tt * tt - gamma * gamma) : 0;
  const max = Date.UTC(2000, 0, 1, 12) + (jde - 2451545.0) * 86400e3 - 69e3;
  return { max, kind: total > 0 ? "total" : "partial", magnitude: mag, partialMin: partial, totalMin: total, gamma };
}
