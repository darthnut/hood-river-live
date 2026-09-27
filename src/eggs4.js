// Easter eggs, batch 4 (the board's eggs_more3.py): Gorge weather and seasons, the real night sky, and
// some silliness.
import { W, H, HORIZON, rgb, blend, line, text, scale as mul } from "./pix.js";
import { Egg, smoothFade, sprite, splash, disk, glow, landTop, skyXY } from "./eggs.js";
import { MAT, Scene } from "./scene.js";
import { Rainbow, Sasquatch, Sternwheeler } from "./eggs1.js";
import { activeShower, planets, solarEclipseOn, sunMoonLocal, PLANET_LOOK } from "./skycalc.js";
import { starlinkVisible, cometsBright } from "./skyfeeds.js";

const ROW_FREEWAY = HORIZON - 2;
const fresh = (holder, key) => holder.lastKey !== key;
const dayKey = n => `${n.year}-${n.month}-${n.day}`;

// Recompute an expensive value at most every `every` seconds of wall time.
function cached(fn, every) {
  let t = -1e12, v;
  return (...a) => {
    const now = performance.now() / 1000;
    if (now - t > every) { t = now; v = fn(...a); }
    return v;
  };
}

// ---------------------------------------------------------------- Gorge weather and seasons

export class Lenticular extends Egg {
  static egg = "lenticular";
  layer = "mountain"; duration = 150; perHour = 3; exclusive = false;
  allowed(c) {
    const w = c.wind;
    if (!w || w.demo) return 0;
    return w.speed >= 20 && w.cloud >= 15 && w.cloud <= 75 && c.veil < 0.5 ? c.light : 0;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 12), [sx, sy] = c.summit;
    const lit = mul(rgb(250, 248, 245), 0.45 + 0.55 * c.light), under = mul(rgb(185, 190, 205), 0.45 + 0.55 * c.light);
    [[18, 3], [14, 1], [10, -1]].forEach(([w, dy], k) => { // stacked lenses capping the summit
      const cx = sx + 1 + Math.sin(age * 0.07 + k) * 0.8, cy = sy + dy;
      for (let dx = -w; dx <= w; dx++) {
        const u = dx / w, h = 1.6 * (1 - u * u) ** 0.7;
        for (let yy = Math.floor(-h); yy <= Math.ceil(h * 0.6); yy++) {
          blend(img, cx + dx, cy + yy, yy > 0 ? under : lit, fade * Math.min(1, 1.2 * (1 - Math.abs(u) ** 3)) * 0.92);
        }
      }
    });
  }
}

export class Alpenglow extends Egg {
  static egg = "alpenglow";
  layer = "mountain"; duration = 240; perHour = 5000; exclusive = false;
  allowed(c) { return c.now.hour >= 12 && c.elev > -3 && c.elev < 0.5 && c.veil < 0.4 && fresh(this, dayKey(c.now)) ? 1 : 0; }
  begin(c) {
    this.lastKey = dayKey(c.now);
    const mat = c.scene.mtnMat;
    this.pix = [];
    let ymin = 99, ymax = 0;
    for (let p = 0; p < HORIZON * W; p++) {
      if (!mat[p]) continue;
      const y = Math.floor(p / W);
      this.pix.push([p, mat[p] === 2, y]);
      ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
    }
    this.ymin = ymin; this.span = Math.max(1, ymax - ymin);
    return true;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 30), shadow = 0.25 + age / this.duration * 0.9; // the glow creeps up
    for (const [p, snow, y] of this.pix) {
      const h = (y - this.ymin) / this.span;
      const on = (1 - Math.min(1, Math.max(0, (shadow - h) * 4))) * fade;
      if (on <= 0) continue;
      const i = p * 3, pink = snow ? [1.0, 0.62, 0.72] : [0.75, 0.42, 0.45];
      const m = Math.max(img[i], img[i + 1], img[i + 2], 0.6);
      for (let k = 0; k < 3; k++) img[i + k] = img[i + k] * (1 - 0.8 * on) + pink[k] * m * 0.8 * on;
    }
  }
}

export class PearTruck extends Egg {
  static egg = "pears";
  layer = "shore"; duration = 22; perHour = 0.6;
  allowed(c) { return [8, 9, 10].includes(c.now.month) ? c.light : 0; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); return true; }
  draw(img, c, age) {
    const d = this.dir, x = d > 0 ? -10 + age * 12 : W + 10 - age * 12, y = ROW_FREEWAY, lum = 0.55 + 0.45 * c.light;
    const red = mul(rgb(170, 40, 35), lum), glass = mul(rgb(150, 190, 220), lum), tire = rgb(20, 20, 22);
    const bins = [mul(rgb(200, 215, 70), lum), mul(rgb(150, 190, 60), lum), mul(rgb(230, 200, 80), lum)];
    for (let i = 0; i < 8; i++) { // i = 0 at the tailgate .. 7 at the bumper
      const X = x + (d > 0 ? i : -i);
      blend(img, X, y, red, 1);
      if (i >= 5) blend(img, X, y - 1, i === 6 ? glass : red, 1); // cab with a window
      else { blend(img, X, y - 1, bins[i % 3], 1); if (i >= 1 && i <= 3) blend(img, X, y - 2, bins[(i + 1) % 3], 1); } // pears
    }
    blend(img, x + (d > 0 ? 1 : -1), y + 1, tire, 1); blend(img, x + (d > 0 ? 6 : -6), y + 1, tire, 1);
    if (c.night > 0.3) blend(img, x + (d > 0 ? 8 : -8), y, rgb(255, 240, 190), c.night);
  }
}

export class CountyFair extends Egg {
  static egg = "fair";
  static LIGHTS = [[255, 70, 70], [255, 210, 60], [80, 220, 255], [255, 120, 220], [120, 255, 120]];
  layer = "shore"; duration = 900; perHour = 300; exclusive = false;
  allowed(c) { return c.now.month === 7 && c.now.day >= 22 ? Math.max(c.night, c.w.twi) : 0; }
  begin(c) { this.cx = 214; this.ground = landTop(c.scene, 214, [MAT.ORCHARD, MAT.ORCHARD_ROW]) ?? HORIZON - 8; return true; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 4), r = 6, cx = this.cx, cy = this.ground - r - 1;
    const dark = mul(rgb(40, 40, 55), 0.4 + 0.6 * c.light);
    line(img, cx - 3, this.ground, cx, cy, dark, fade); line(img, cx + 3, this.ground, cx, cy, dark, fade); // A-frame legs
    for (let k = 0; k < 10; k++) {
      const a = age * 0.35 + k * 2 * Math.PI / 10, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      line(img, cx, cy, px, py, mul(dark, 1.5), 0.5 * fade);
      const col = rgb(...CountyFair.LIGHTS[(k + Math.trunc(age * 3)) % 5]);
      blend(img, px, py, col, fade * (0.6 + 0.4 * c.night));
      glow(img, px, py, 2, col, 0.12 * fade * c.night);
    }
    for (let k = 0; k < 7; k++) { // the midway below it
      blend(img, cx - 12 + k * 3, this.ground, rgb(...CountyFair.LIGHTS[(k + Math.trunc(age * 2)) % 5]), fade * (0.5 + 0.5 * Math.sin(age * 4 + k)));
    }
  }
}

export class Race extends Egg {
  static egg = "race";
  static COLORS = [[255, 60, 60], [255, 200, 40], [60, 200, 255], [255, 110, 200], [120, 240, 90], [255, 140, 30], [200, 120, 255], [250, 250, 250]];
  layer = "water"; duration = 40; perHour = 0.2;
  allowed(c) { return c.now.hour >= 12 && c.now.hour <= 17 ? c.light : 0; }
  begin(c) { this.marks = [[70, 49], [190, 55]]; this.lag = Race.COLORS.map(() => c.rng.uniform(0, 2.6)).sort((a, b) => a - b); return true; }
  depthRow() { return 52; }
  course(u) { // a loop around the two marks; u in 0..1 per lap
    const [[x0, y0], [x1, y1]] = this.marks, a = 2 * Math.PI * u;
    return [(x0 + x1) / 2 - Math.cos(a) * (x1 - x0) / 2 * 1.08, (y0 + y1) / 2 + Math.sin(a) * 4.5];
  }
  draw(img, c, age) {
    const lum = 0.55 + 0.45 * c.light;
    for (const [mx, my] of this.marks) { blend(img, mx, my, mul(rgb(255, 120, 20), lum), 1); blend(img, mx, my - 1, mul(rgb(255, 150, 40), lum), 1); }
    const bx = 128, by = 58; // committee boat
    for (let i = -3; i <= 3; i++) blend(img, bx + i, by, mul(rgb(235, 235, 235), lum), 1);
    blend(img, bx, by - 1, mul(rgb(235, 235, 235), lum), 1);
    line(img, bx + 2, by - 1, bx + 2, by - 5, mul(rgb(60, 60, 60), lum), 1);
    blend(img, bx + 3, by - 5, rgb(255, 40, 40), 1);
    if (age < 1.5 || (age > 34 && age < 35.5)) text(img, bx - 8, by - 12, "HONK", rgb(255, 255, 255), 1);
    Race.COLORS.forEach((col, k) => {
      const lag = this.lag[k], u = age < 1.5 + lag ? 0 : (age - 1.5 - lag) / 16;
      const [x, y] = this.course(u), d = this.course(u + 0.01)[0] - x >= 0 ? 1 : -1;
      const sc = 0.8 + (y - 45) / 20 * 0.6, hs = Math.round(5 * sc) + 2;
      for (let i = 0; i < hs; i++) {
        const wdt = Math.max(1, Math.round((1 - i / hs) * (2.4 * sc + 1)));
        for (let j = 0; j < wdt; j++) blend(img, x + d - d * j, y - 1 - i, mul(rgb(...col), lum), 1);
      }
      blend(img, x + 2 * d, y - 1, rgb(40, 25, 30), 1);
      for (let i = 0; i < 3; i++) blend(img, x - d * (i + 1), y, mul(rgb(240, 240, 240), lum), 1);
      for (let i = 0; i < 6; i++) blend(img, x - d * (i + 4), y + 0.4, rgb(235, 240, 255), 0.4 * (1 - i / 6));
    });
  }
}

export class IceFloes extends Egg {
  static egg = "icefloes";
  layer = "water"; duration = 60; perHour = 1;
  allowed(c) { const w = c.wind, cold = w && !w.demo && w.temp < 25; return cold && [12, 1, 2].includes(c.now.month) ? c.light + 0.3 : 0; }
  begin(c) {
    const r = c.rng;
    this.floes = Array.from({ length: 18 }, () => {
      const y = r.uniform(40, 62), sc = 0.9 + (y - 40) / 22 * 1.6, shape = [];
      for (let dx = -Math.trunc(4 * sc); dx <= Math.trunc(4 * sc); dx++) for (let dy = 0; dy < Math.trunc(1 + sc); dy++) if (r.random() < 0.85 - 0.1 * dy) shape.push([dx, dy]);
      return [r.uniform(-60, W - 40), y, r.uniform(3, 5), shape];
    });
    this.eagle = 5;
    return true;
  }
  draw(img, c, age) {
    const lum = 0.5 + 0.5 * c.light, ice = mul(rgb(235, 242, 250), lum), edge = mul(rgb(170, 190, 210), lum);
    this.floes.forEach(([x0, y, v, shape], k) => {
      const x = x0 + age * v; // downriver is to the right
      for (const [dx, dy] of shape) blend(img, x + dx, y + dy, dy ? edge : ice, 0.95);
      if (k === this.eagle) { // the eagle, perched and looking around
        const ex = x, ey = y - 1, brown = mul(rgb(70, 45, 28), lum), white = mul(rgb(250, 250, 245), lum);
        blend(img, ex, ey, brown, 1); blend(img, ex + 1, ey, brown, 1); blend(img, ex, ey - 1, brown, 1); blend(img, ex + 1, ey - 1, brown, 1);
        const look = Math.trunc(age / 2) % 2 ? 1 : 0;
        blend(img, ex + look, ey - 2, white, 1); blend(img, ex + look + (look ? 1 : -1), ey - 2, mul(rgb(250, 190, 40), lum), 1);
        blend(img, ex - 1, ey, white, 1); // tail
      }
    });
  }
}

export class DamRainbow extends Egg {
  static egg = "damrainbow";
  layer = "shore"; duration = 60; perHour = 0.3;
  allowed(c) { return [4, 5, 6].includes(c.now.month) && c.now.hour < 13 ? c.light : 0; } // sun behind you in the morning
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 8), cx = 246, cy = HORIZON + 1;
    for (let k = 0; k < 40; k++) { // billowing mist
      const a = k * 2.4 + age * 0.3;
      blend(img, cx - 6 + (k % 7) * 2.5 + Math.sin(a) * 2, cy - 2 - ((k * 1.7 + age * 1.5) % 14), rgb(235, 238, 245), 0.18 * fade);
    }
    Rainbow.BANDS.forEach((col, k) => {
      const r = 9 - k * 0.8;
      for (let i = 0; i < 24; i++) { const a = Math.PI * i / 23; blend(img, cx + Math.cos(a) * r, cy - Math.sin(a) * r, rgb(...col), 0.4 * fade); }
    });
  }
}

export class Paddleboard extends Egg {
  static egg = "paddleboard";
  layer = "water"; duration = 26; perHour = 1;
  allowed(c) { return c.wind && c.wind.speed >= 28 ? c.light : 0; }
  begin(c) { this.row = c.rng.uniform(50, 57); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const x = -8 + age * (W + 16) / this.duration, y = this.row + Math.sin(age * 3) * 0.6, lum = 0.6 + 0.4 * c.light;
    for (let i = -3; i <= 3; i++) blend(img, x + i, y, mul(rgb(250, 220, 60), lum), 1); // board
    const wobble = Math.sin(age * 5) * 0.6;
    blend(img, x + wobble, y - 1, mul(rgb(30, 60, 140), lum), 1); blend(img, x + wobble, y - 2, mul(rgb(230, 80, 60), lum), 1);
    blend(img, x + wobble, y - 3, mul(rgb(240, 200, 170), lum), 1);
    const stroke = (age * 3) % 1, side = Math.trunc(age * 3) % 2 ? -1 : 1, px = x + wobble - 1 - stroke * 2;
    line(img, px + 2, y - 3, px, y + 1, mul(rgb(60, 45, 35), lum), 1);
    blend(img, px, y + 1 + (side > 0 ? 1 : 0), rgb(235, 240, 255), 0.6);
    if (Math.trunc(age) % 6 === 3) text(img, Math.trunc(x) - 5, Math.trunc(y) - 11, "HELP", rgb(255, 255, 255), 0.9);
  }
}

export class Beaver extends Egg {
  static egg = "beaver";
  layer = "water"; duration = 26; perHour = 0.25;
  allowed(c) { return c.light + c.w.twi; }
  begin(c) { this.x0 = c.rng.uniform(40, 90); this.y0 = c.rng.uniform(52, 58); this.x1 = 150; this.y1 = HORIZON + 2.5; return true; }
  pos(age) { const p = Math.min(1, age / 20); return [this.x0 + (this.x1 - this.x0) * p, this.y0 + (this.y1 - this.y0) * p]; }
  depthRow(c, age) { return this.pos(age)[1]; }
  draw(img, c, age) {
    const [x, y] = this.pos(age), lum = 0.55 + 0.45 * c.light, fur = mul(rgb(95, 60, 35), lum), stick = mul(rgb(150, 110, 70), lum);
    const n = Math.hypot(this.x1 - this.x0, this.y1 - this.y0), ux = (this.x1 - this.x0) / n, uy = (this.y1 - this.y0) / n;
    if (age < 20) {
      for (let k = 1; k < 14; k++) for (const side of [-1, 1]) { // the V of its wake
        blend(img, x - ux * k - uy * side * k * 0.35, y - uy * k + ux * side * k * 0.2, rgb(235, 240, 255), 0.5 * (1 - k / 14));
      }
      blend(img, x, y, fur, 1); blend(img, x + ux, y + uy, fur, 1);
      line(img, x + ux * 2, y - 1, x + ux * 5, y - 1.5, stick, 1);
    } else {
      const b = age - 20;
      if (b < 0.5) { blend(img, x - ux * 2, y - 1, fur, 1); blend(img, x - ux * 2, y - 2, fur, 1); } // the tail up...
      else if (b < 1.5) splash(img, x - ux * 2, y, b - 0.5, 0.8); // ...and the slap
      line(img, x + ux * 2, y, x + ux * 5, y, stick, 1);
    }
  }
}

export class SnowDay extends Egg {
  static egg = "snowday";
  static JACKETS = [[255, 60, 60], [60, 140, 255], [255, 210, 40], [120, 230, 90], [255, 120, 220]];
  layer = "shore"; duration = 45; perHour = 1;
  allowed(c) { return c.ground > 0.3 ? c.light : 0; }
  begin(c) {
    this.path = [];
    for (let x = 186; x < 230; x++) { const y = landTop(c.scene, x); if (y !== null) this.path.push([x, y]); }
    if (this.path.length < 10) return false;
    this.kids = Array.from({ length: 5 }, () => [c.rng.uniform(0, 1), c.rng.uniform(0.8, 1.2)]);
    return true;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 2), lum = 0.55 + 0.45 * c.light, path = this.path, n = path.length;
    for (const [x, y] of path) blend(img, x, y, mul(rgb(245, 248, 255), lum), 0.9 * fade); // a packed sled run
    let top = 0;
    path.forEach(([, y], i) => { if (y < path[top][1]) top = i; });
    this.kids.forEach(([ph, sp], k) => {
      const cyc = (age * 0.12 * sp + ph) % 1;
      let i;
      if (cyc < 0.25) { const u = cyc / 0.25; i = top < Math.floor(n / 2) ? Math.trunc(top + (n - 1 - top) * u ** 1.5) : Math.trunc(top * (1 - u ** 1.5)); }
      else { const u = (cyc - 0.25) / 0.75; i = top < Math.floor(n / 2) ? Math.trunc(n - 1 + (top - (n - 1)) * u) : Math.trunc(top * u); }
      const [x, y] = path[Math.max(0, Math.min(n - 1, i))];
      blend(img, x, y - 1, mul(rgb(...SnowDay.JACKETS[k % 5]), lum), fade);
      blend(img, x, y - 2, mul(rgb(240, 200, 170), lum), fade);
      if (cyc < 0.25) blend(img, x + 1, y - 1, mul(rgb(160, 60, 40), lum), fade); // sled
    });
  }
}

// ---------------------------------------------------------------- the real night sky

const showerNow = cached(ms => activeShower(ms), 60);
const planetsNow = cached(ms => planets(ms), 20);

function streak(img, x, y, dx, dy, length, col, a = 1) {
  const n = Math.max(1, Math.trunc(length));
  for (let i = 0; i < n; i++) blend(img, x - dx * i, y - dy * i, col, a * (1 - i / n));
}

// Real meteor showers on their peak nights, streaking away from the true radiant. Triggered, a burst.
export class MeteorShower extends Egg {
  static egg = "shower";
  layer = "sky"; duration = 0.9; perHour = 60; exclusive = false;
  allowed(c) {
    if (c.night < 0.8 || c.veil > 0.5) return 0;
    const s = showerNow(c.nowMs);
    if (!s) return 0;
    const [, activity, zhr, , el] = s;
    return activity * Math.max(0, Math.sin(el * Math.PI / 180)) * Math.min(1, zhr / 60);
  }
  begin(c) {
    const s = showerNow(c.nowMs);
    this.burst = !s || c.night < 0.8;
    let az, el;
    if (this.burst) { this.label = "PERSEIDS"; az = 45; el = 40; this.duration = 20; }
    else { this.label = s[0].toUpperCase(); az = s[3]; el = s[4]; this.duration = 0.9; }
    [this.rx, this.ry] = skyXY(az, el);
    const r = c.rng, mtn = c.scene.mtnMat;
    this.meteors = Array.from({ length: this.burst ? 42 : 1 }, () => {
      let x, y;
      for (let tries = 0; tries < 20; tries++) { // start in open sky: the mountain hides meteors behind it
        x = r.uniform(4, W - 4); y = r.uniform(9, 26);
        const ground = landTop(c.scene, x);
        if (mtn[Math.trunc(y) * W + Math.trunc(x)] === 0 && !(ground !== null && ground <= y)) break;
      }
      const dx = x - this.rx, dy = y - this.ry, d = Math.hypot(dx, dy) || 1;
      return [this.burst ? r.uniform(0, this.duration - 0.8) : 0, x, y, dx / d, dy / d, r.uniform(90, 150)];
    });
    return true;
  }
  draw(img, c, age) {
    if (this.burst && age < 4) text(img, Math.trunc(this.rx) - this.label.length * 2, Math.trunc(this.ry) + 3, this.label, rgb(200, 210, 240), 0.8 * Math.min(1, 4 - age));
    for (const [t0, x, y, ux, uy, v] of this.meteors) {
      const a = age - t0;
      if (a >= 0 && a < 0.8) streak(img, x + ux * v * a, y + uy * v * a, ux * 1.2, uy * 1.2, 16, rgb(255, 250, 225), 0.9 * Math.min(1, (0.8 - a) / 0.25));
    }
  }
}

// Screen position on the same arc mapping the scene uses for the sun and moon.
function planetXY(p) {
  if (p.length > 4) { const [x, y] = Scene.arc(p[4], p[2]); return [x, Math.max(10, y)]; }
  return skyXY(p[1], p[2]);
}

export class Planets extends Egg {
  static egg = "planets";
  layer = "mountain"; duration = 600; perHour = 5000; exclusive = false;
  up(c) { return planetsNow(c.nowMs).filter(p => p[2] > 2 && (p[0] !== "mars" || p[3] < 1.1)); }
  allowed(c) { return c.elev < -4 && c.veil < 0.6 && this.up(c).length ? 1 : 0; }
  begin(c) { this.demo = c.elev > -4 || !this.up(c).length; this.duration = this.demo ? 30 : 600; return true; }
  draw(img, c, age) {
    let shown;
    if (this.demo) shown = [["venus", 250, 12, 0.7], ["jupiter", 200, 35, 5], ["saturn", 150, 25, 9.5]];
    else { shown = this.up(c); if (!shown.length || c.elev > -3) { this.done = true; return; } }
    const fade = smoothFade(age, this.duration, 3) * (1 - 0.8 * c.veil);
    for (const p of shown) {
      const [x, y] = planetXY(p), [col, bright] = PLANET_LOOK[p[0]], c3 = rgb(...col);
      glow(img, x, y, 3, c3, 0.25 * bright * fade);
      blend(img, x, y, c3, fade);
      if (p[0] === "venus") for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blend(img, x + dx, y + dy, c3, 0.35 * fade);
      if (age < 8) text(img, Math.trunc(x) + 3, Math.trunc(y) - 1, p[0], rgb(190, 200, 225), 0.6 * Math.min(1, 8 - age) * fade);
    }
  }
}

export class StarlinkTrain extends Egg {
  static egg = "starlink";
  layer = "mountain"; duration = 600; perHour = 5000; exclusive = false;
  allowed(c) { return c.veil < 0.5 && starlinkVisible(c.nowMs).length ? 1 : 0; }
  begin(c) { this.demo = !starlinkVisible(c.nowMs).length; this.duration = this.demo ? 28 : 600; return true; }
  draw(img, c, age) {
    let pts = [];
    if (this.demo) {
      const p = age / this.duration;
      for (let k = 0; k < 24; k++) { // a tight line of pearls, the leaders a little ahead
        const u = p * 1.25 - k * 0.018;
        if (u >= 0 && u <= 1) pts.push([W * 0.95 - u * W * 0.9, 12 + u * 10 + Math.sin(k) * 0.3]);
      }
    } else {
      const vis = starlinkVisible(c.nowMs);
      if (!vis.length) { this.done = true; return; }
      pts = vis.map(([az, el]) => skyXY(az, el));
    }
    for (const [x, y] of pts) blend(img, x, y, rgb(235, 240, 255), 0.85);
  }
}

export class SolarEclipse extends Egg {
  static egg = "solareclipse";
  static cache = {};
  layer = "sky"; duration = 900; perHour = 5000; exclusive = false;
  today(c) {
    const k = dayKey(c.now);
    if (!(k in SolarEclipse.cache)) SolarEclipse.cache[k] = solarEclipseOn(c.now.year, c.now.month, c.now.day);
    return SolarEclipse.cache[k];
  }
  inProgress(c) { const e = this.today(c); return e && e.start <= c.nowMs && c.nowMs <= e.end; }
  allowed(c) { return this.inProgress(c) ? 1 : 0; }
  begin(c) { this.demo = !this.inProgress(c); this.duration = this.demo ? 32 : 900; return true; }
  draw(img, c, age) {
    let mdx, mdy, rm;
    if (this.demo) { // a time-lapse partial eclipse, 90% at its deepest
      const off = (0.5 - age / this.duration) * 2 * 1.9;
      mdx = off * 0.8; mdy = -off * 0.6 + 0.2; rm = 1.03;
    } else {
      const s = sunMoonLocal(c.nowMs);
      if (s.sep > s.rSun + s.rMoon) { this.done = true; return; }
      mdx = s.dx / s.rSun; mdy = s.dy / s.rSun; rm = s.rMoon / s.rSun;
    }
    const R = 5.5, sx = c.sx, sy = c.sy, mx = sx + mdx * R, my = sy - mdy * R; // the scene's sun disc radius
    const si = (Math.max(0, Math.trunc(sy) - 10) * W + Math.trunc(Math.min(W - 1, Math.max(0, sx + 12)))) * 3;
    const sky = [img[si] * 0.8, img[si + 1] * 0.8, img[si + 2] * 0.8];
    let covered = 0;
    for (let yy = Math.trunc(my - R * rm) - 1; yy < Math.trunc(my + R * rm) + 2; yy++) {
      for (let xx = Math.trunc(mx - R * rm) - 1; xx < Math.trunc(mx + R * rm) + 2; xx++) {
        if (xx < 0 || xx >= W || yy < 0 || yy >= HORIZON || (xx - mx) ** 2 + (yy - my) ** 2 > (R * rm) ** 2) continue;
        if ((xx - sx) ** 2 + (yy - sy) ** 2 <= (R + 3) ** 2) {
          img.set(sky, (yy * W + xx) * 3);
          if ((xx - sx) ** 2 + (yy - sy) ** 2 <= R * R) covered++;
        }
      }
    }
    const frac = covered / (Math.PI * R * R);
    if (frac > 0.6) { const k = 1 - 0.5 * (frac - 0.6) / 0.4; for (let i = 0; i < img.length; i++) img[i] *= k; } // strange, dim light
  }
}

export class Comet extends Egg {
  static egg = "comet";
  layer = "mountain"; duration = 600; perHour = 5000; exclusive = false;
  allowed(c) { return c.elev < -8 && c.veil < 0.5 && cometsBright(c.nowMs).length ? 1 : 0; }
  begin(c) { this.demo = !(c.elev < -8 && cometsBright(c.nowMs).length); this.duration = this.demo ? 30 : 600; return true; }
  draw(img, c, age) {
    let shown;
    if (this.demo) shown = [["COMET", 1.0, 272, 36, -125 * Math.PI / 180]];
    else { shown = cometsBright(c.nowMs); if (!shown.length || c.elev > -6) { this.done = true; return; } }
    const fade = smoothFade(age, this.duration, 3) * (1 - 0.8 * c.veil);
    for (const [name, mag, az, el, ang] of shown) {
      const [x, y] = skyXY(az, el), length = 8 + Math.max(0, 4.5 - mag) * 4, ux = Math.cos(ang), uy = Math.sin(ang);
      for (let i = 0; i < Math.trunc(length); i++) { // dust tail: broad, curving, warm
        const spread = 1 + i * 0.12, bend = (i / length) ** 2 * 3;
        for (let q = 0; q < 5; q++) {
          const s = -spread + q * spread / 2;
          blend(img, x + ux * i - uy * (s + bend), y + uy * i + ux * (s + bend), rgb(255, 245, 215), 0.32 * (1 - i / length) * fade);
        }
      }
      for (let i = 0; i < Math.trunc(length * 1.2); i++) blend(img, x + ux * i, y + uy * i, rgb(150, 200, 255), 0.55 * (1 - i / (length * 1.2)) * fade); // ion tail
      glow(img, x, y, 2, rgb(220, 255, 230), 0.5 * fade);
      blend(img, x, y, rgb(240, 255, 240), fade);
      if (age < 8) {
        const label = name.includes("(") ? name.split("(").pop().replace(")", "") : name;
        text(img, Math.trunc(x) + 3, Math.trunc(y) + 2, label.slice(0, 14), rgb(190, 210, 230), 0.6 * fade);
      }
    }
  }
}

export class NoctilucentClouds extends Egg {
  static egg = "nlc";
  layer = "sky"; duration = 200; perHour = 20; exclusive = false;
  allowed(c) {
    const m = c.now.month, d = c.now.day;
    const summer = m === 6 || (m === 5 && d >= 25) || m === 7 || (m === 8 && d <= 10);
    return summer && c.elev > -15 && c.elev < -6 && c.veil < 0.4 ? 1 : 0;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 20), evening = c.now.hour >= 12;
    const [x0, x1] = evening ? [196, W] : [0, 60], col = [0.5, 0.85, 1.0];
    for (let y = 9; y < 21; y++) for (let x = x0; x < x1; x++) {
      const edge = evening ? (x - x0) / (x1 - x0) : (x1 - x) / (x1 - x0);
      const ripple = 0.5 + 0.5 * Math.sin(x * 0.9 + y * 2.6 + age * 0.15) * Math.sin(x * 0.21 - y * 0.7 + 1.3);
      const band = Math.exp(-(((y - 14 + 2 * Math.sin(x * 0.05)) / 3.5) ** 2));
      const a = Math.min(1, Math.max(0, edge * 1.6)) * (0.35 + 0.65 * ripple) * band * 0.85 * fade, i = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) img[i + k] = img[i + k] * (1 - a) + col[k] * a;
    }
  }
}

// ---------------------------------------------------------------- silliness

export class Bigfoot extends Egg {
  static egg = "bigfoot";
  layer = "water"; duration = 14; perHour = 0.06;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); this.row = c.rng.uniform(52, 58); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const d = this.dir, x = d > 0 ? -12 + age * (W + 24) / this.duration : W + 12 - age * (W + 24) / this.duration;
    const hop = Math.trunc(age) % 4 === 2 ? Math.max(0, Math.sin(age * 2.3)) * 2 : 0, y = this.row - hop, lum = 0.6 + 0.4 * c.light;
    for (let i = -4; i <= 4; i++) blend(img, x + i, y, mul(rgb(245, 245, 245), lum), 1); // board
    for (let i = 0; i < 12; i++) { // the sail, leaning out ahead
      const wdt = Math.max(1, Math.round((1 - i / 12) * 6));
      for (let j = 0; j < wdt; j++) blend(img, x + d * (4 + j * 0.8) + d * i * 0.1, y - 1 - i, mul(j < wdt - 1 ? rgb(255, 80, 40) : rgb(255, 210, 40), lum), 1);
    }
    const rows = age > 5.5 && age < 8.5 ? Sasquatch.WAVE : Sasquatch.WALK[1];
    sprite(img, Math.trunc(x) - 2, Math.trunc(y) - rows.length, rows, { "#": mul(rgb(140, 92, 55), lum) }, d < 0);
    for (let i = 0; i < 10; i++) blend(img, x - d * (i + 5), y + 0.4, rgb(235, 240, 255), 0.5 * (1 - i / 10));
  }
}

export class BigCat extends Egg {
  static egg = "bigcat";
  static CX = 230;
  layer = "mountain"; duration = 18; perHour = 0.05;
  allowed(c) { return c.light; }
  begin(c) { this.ridge = landTop(c.scene, BigCat.CX) ?? 20; this.swatted = false; return true; }
  draw(img, c, age) {
    const rise = age < 14 ? Math.min(1, age / 3) : Math.max(0, 1 - (age - 14) / 3);
    const cx = BigCat.CX, cy = this.ridge + 8 - 10 * rise, lum = 0.55 + 0.45 * c.light; // eyes clear the ridge
    const fur = mul(rgb(235, 150, 60), lum), stripe = mul(rgb(170, 90, 30), lum), pink = mul(rgb(255, 170, 170), lum), R = 6;
    for (let yy = -R; yy <= R; yy++) for (let xx = -R - 1; xx <= R + 1; xx++) {
      if ((xx / (R + 1)) ** 2 + (yy / R) ** 2 <= 1) blend(img, cx + xx, cy + yy, yy < -3 && ((xx % 4) + 4) % 4 === 0 ? stripe : fur, 1);
    }
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) { // ears
      blend(img, cx + side * (3 + j - Math.floor((4 - i) / 2)), cy - R - i + 1, i < 2 && j === 1 ? pink : fur, 1);
    }
    const look = age > 5 ? -2 : 0, blink = Math.trunc(age * 1.3) % 6 === 0; // eyes follow the kite on the left
    for (const side of [-1, 1]) {
      const ex = cx + side * 3 - (side > 0 ? 1 : 0) + look * 0.5, ey = cy - 2;
      if (blink) { blend(img, ex, ey, stripe, 1); blend(img, ex + 1, ey, stripe, 1); }
      else {
        for (const dx of [0, 1]) { blend(img, ex + dx, ey, rgb(120, 220, 90), 1); blend(img, ex + dx, ey - 1, rgb(120, 220, 90), 1); }
        blend(img, ex + (look ? 0 : 1), ey, rgb(10, 10, 10), 1); // slit pupils
      }
    }
    blend(img, cx, cy + 1, pink, 1); // nose
    for (const side of [-1, 1]) line(img, cx + side * 2, cy + 1, cx + side * 8, cy, mul(rgb(250, 250, 250), lum), 0.5); // whiskers
    if (age > 7 && age < 12) { // the swat: a paw arcs up and over to the left
      const p = (age - 7) / 5, a = Math.PI * (0.1 + 0.9 * p);
      const px = cx - 7 - Math.sin(a) * 22, py = Math.max(11, cy - Math.sin(a) * 9 - p * 2);
      disk(img, px, py, 2.6, fur, 1);
      for (const k of [-1, 0, 1]) blend(img, px + k * 1.3, py - 2.4, pink, 1); // toe beans
      if (p > 0.5 && !this.swatted) {
        this.swatted = true;
        const kites = c.riders.filter(r => r.kite && r.crashT == null);
        if (kites.length) kites.reduce((a2, b) => (b.x > a2.x ? b : a2)).crashT = c.t;
      }
    }
  }
}

export class Pirates extends Egg {
  static egg = "pirates";
  layer = "water"; duration = 60; perHour = 0.05;
  allowed(c) { return (c.light + 0.4 * c.w.twi) * (c.now.month === 9 && c.now.day === 19 ? 40 : 1); } // Talk Like a Pirate Day
  begin(c) {
    this.sw = new Sternwheeler();
    this.sw.begin(c);
    this.sw.dir = this.dir = -1; // both heading upriver (left)
    this.duration = (W + 50 + 55) / Sternwheeler.SPEED;
    return true;
  }
  depthRow() { return 48.5; }
  draw(img, c, age) {
    this.sw.draw(img, c, age);
    const swX = W + 10 - age * Sternwheeler.SPEED, x = swX + 50, y = 47, lum = 0.5 + 0.5 * c.light; // fifty pixels astern
    const hull = mul(rgb(35, 28, 26), lum), sail = mul(rgb(30, 30, 34), lum), white = mul(rgb(235, 235, 230), lum);
    for (let i = 0; i < 24; i++) { blend(img, x + i, y, hull, 1); blend(img, x + i, y - 1, i > 2 && i < 22 ? hull : mul(rgb(120, 30, 30), lum), 1); }
    line(img, x, y - 1, x - 5, y - 4, hull, 1); // bowsprit
    [6, 13, 19].forEach((mx, m) => {
      const top = m === 1 ? 14 : 11;
      line(img, x + mx, y - 2, x + mx, y - top, hull, 1);
      for (let yy = 3; yy < top - 2; yy++) {
        const wdt = 6 - Math.abs(yy - top / 2) * 0.3;
        for (let xx = -Math.trunc(wdt / 2); xx <= Math.trunc(wdt / 2); xx++) blend(img, x + mx + xx, y - yy, sail, 1);
      }
    });
    const fx = x + 14, fy = y - 15; // the Jolly Roger on the main mast
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 3; dy++) blend(img, fx + dx, fy + dy, rgb(15, 15, 15), 1);
    for (const [dx, dy] of [[1, 0], [2, 0], [1, 2], [2, 2]]) blend(img, fx + dx, fy + dy, white, 1);
    const shot = age % 5;
    if (shot > 1 && shot < 3.5 && x > 10 && x < W - 10) { // bow chaser fires; the ball splashes just short
      const s = shot - 1;
      if (s < 0.15) glow(img, x - 2, y - 2, 4, rgb(255, 170, 70), 0.9);
      for (let k = 0; k < 5; k++) disk(img, x - 2 - s * 3 - k * 0.6, y - 2 - s * 1.5 - (k % 2), 0.8 + s, rgb(220, 220, 222), 0.4 * (1 - s / 2.5));
      if (s > 0.6 && s < 1.4) splash(img, swX + 27 + (x - (swX + 27)) * 0.4, y + 1, (s - 0.6) / 0.8, 1.2);
    }
  }
}

export class SpiderClock extends Egg {
  static egg = "spiderclock";
  static ROWS = ["l.k.l", "lkwkl", ".gkg."];
  layer = "over"; duration = 16; perHour = 0.3;
  begin(c) {
    const h = c.now.hour % 12 || 12;
    this.n = `${h}:${String(c.now.minute).padStart(2, "0")} ${c.now.hour < 12 ? "AM" : "PM"}`.length;
    this.duration = 3 + this.n * 1.1;
    return true;
  }
  draw(img, c, age) {
    const pal = { k: rgb(20, 18, 24), l: rgb(70, 62, 60), w: rgb(245, 245, 245), g: rgb(60, 230, 160) }, baseY = 10;
    let x, y;
    if (age < 1.2) { x = -5 + age * 6; y = baseY; } // walks in from the left
    else if (age < 1.2 + this.n * 1.1) {
      const k = Math.floor((age - 1.2) / 1.1), f = (age - 1.2) - k * 1.1, cx = 3 + k * 4;
      if (f < 0.6) { // crouch, then leap up under the character
        x = cx; y = baseY - (f > 0.2 ? Math.sin(Math.PI * f / 0.6) * 4 : 0);
        if (f > 0.25 && f < 0.45) { // the bump: the character pops up a pixel
          for (let yy = 1; yy < 8; yy++) for (let xx = Math.max(0, cx); xx < cx + 4; xx++) {
            const d = (yy * W + xx) * 3, s = ((yy + 1) * W + xx) * 3;
            img[d] = img[s]; img[d + 1] = img[s + 1]; img[d + 2] = img[s + 2];
          }
        }
      } else { const g = (f - 0.6) / 0.5; x = cx + g * 4; y = baseY - Math.sin(Math.PI * g) * 1.5; } // hop along
    } else { const g = age - 1.2 - this.n * 1.1; x = 3 + this.n * 4 + g * 10; y = baseY - Math.max(0, Math.sin(g * 5)) * 2; }
    sprite(img, Math.round(x) - 1, Math.round(y), SpiderClock.ROWS, pal);
  }
}

export class Balloons extends Egg {
  static egg = "balloons";
  static PAIRS = [[[230, 50, 50], [255, 220, 60]], [[60, 120, 230], [250, 250, 250]], [[250, 140, 30], [120, 40, 160]],
    [[40, 170, 90], [255, 230, 120]], [[240, 90, 170], [90, 200, 250]], [[255, 210, 40], [220, 60, 60]]];
  layer = "mountain"; duration = 90; perHour = 1.5;
  allowed(c) { const calm = !c.wind || c.wind.speed < 12; return calm && c.elev > 0 && c.elev < 18 && c.now.hour < 12 && c.veil < 0.5 ? c.light : 0; }
  begin(c) {
    const r = c.rng;
    this.balloons = Array.from({ length: 12 }, (_, k) => [r.uniform(-20, W), r.uniform(0, 30), r.uniform(0.7, 1.6), r.uniform(0.15, 0.35), k % 6, r.uniform(0, 6.3)])
      .sort((a, b) => a[2] - b[2]); // far ones first
    return true;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 6), lum = 0.5 + 0.5 * c.light;
    for (const [x0, t0, size, climb, pair, ph] of this.balloons) {
      const x = x0 + age * 1.5 * size, y = HORIZON - 4 - Math.min(age + t0, 60) * climb * size * 0.9;
      const ra = mul(rgb(...Balloons.PAIRS[pair][0]), lum), rb = mul(rgb(...Balloons.PAIRS[pair][1]), lum), r = 2.2 * size;
      for (let yy = -Math.trunc(r) - 1; yy <= Math.trunc(r * 1.3); yy++) {
        const half = yy <= 0 ? Math.sqrt(Math.max(0, r * r - yy * yy)) : r * (1 - yy / (r * 1.4));
        for (let xx = -Math.trunc(half); xx <= Math.trunc(half); xx++) blend(img, x + xx, y + yy, Math.trunc((xx + half) / Math.max(1, half * 0.5)) % 2 ? ra : rb, fade); // gores
      }
      const by = y + Math.trunc(r * 1.3) + 1;
      blend(img, x, by + 1, mul(rgb(110, 75, 45), lum), fade); // basket
      if (Math.sin(age * 1.7 + ph) > 0.85) { blend(img, x, by, rgb(255, 170, 60), fade); glow(img, x, y + r * 0.5, r, rgb(255, 160, 60), 0.2 * fade); } // burner
    }
  }
}

export const BATCH4 = [Lenticular, Alpenglow, PearTruck, CountyFair, Race, IceFloes, DamRainbow, Paddleboard, Beaver, SnowDay,
  MeteorShower, Planets, StarlinkTrain, SolarEclipse, Comet, NoctilucentClouds, Bigfoot, BigCat, Pirates, SpiderClock, Balloons];
