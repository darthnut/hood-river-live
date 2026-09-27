// Live sky events from assets/sky.json: visible ISS passes, Starlink trains and bright comets over Hood
// River for the next 72 hours, precomputed once a day by tools/skyjob.py. Positions between the samples
// are interpolated. Without the file (or once it has expired) those eggs only play their demo when triggered.

let data = null;

export const setSky = d => { data = d; }; // for the Node tools, which read the file themselves

export async function loadSky(url) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (r.ok) data = await r.json();
  } catch (e) {
    console.warn("sky data unavailable", e);
  }
  setTimeout(() => loadSky(url), 6 * 3600e3); // pick up the daily refresh
}

const lerp = (a, b, f) => a + (b - a) * f;
const lerpAz = (a, b, f) => ((a + (((b - a + 540) % 360) - 180) * f) % 360 + 360) % 360; // the short way round
const live = ms => data && ms >= data.generated - 3600e3 && ms <= data.until;

// Where along a sampled track `ms` falls: [i0, i1, f], or null outside it.
function bracket(start, step, n, ms) {
  const x = (ms - start) / step;
  if (x < 0 || x > n - 1) return null;
  const i0 = Math.floor(x);
  return [i0, Math.min(n - 1, i0 + 1), x - i0];
}

const between = (a, b, f) => (a && b ? [lerpAz(a[0], b[0], f), lerp(a[1], b[1], f)] : null);

// [az, el] of the ISS if it's a naked-eye sight from Hood River right now, else null.
export function issVisible(ms) {
  if (!live(ms)) return null;
  for (const p of data.iss) {
    const b = bracket(p.start, p.step, p.pts.length, ms);
    if (b) return between(p.pts[b[0]], p.pts[b[1]], b[2]);
  }
  return null;
}

// [[az, el], ...] of Starlink train satellites visible right now.
export function starlinkVisible(ms) {
  if (!live(ms)) return [];
  for (const w of data.starlink) {
    const n = w.tracks.length ? w.tracks[0].length : 0, b = bracket(w.start, w.step, n, ms);
    if (b) return w.tracks.map(tr => between(tr[b[0]], tr[b[1]], b[2])).filter(Boolean);
  }
  return [];
}

// [[name, magnitude, az, el, tail angle], ...] of naked-eye comets above the horizon right now.
export function cometsBright(ms) {
  if (!live(ms)) return [];
  const out = [];
  for (const c of data.comets) {
    const s = c.samples;
    for (let i = 0; i + 1 < s.length; i++) {
      const [t0, m0, a0, e0, k0] = s[i], [t1, m1, a1, e1, k1] = s[i + 1];
      if (ms < t0 || ms > t1 || t1 - t0 > 600e3) continue; // only within one sampling step
      const f = (ms - t0) / (t1 - t0);
      out.push([c.name, lerp(m0, m1, f), lerpAz(a0, a1, f), lerp(e0, e1, f), lerp(k0, k1, f)]);
      break;
    }
  }
  return out;
}
