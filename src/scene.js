// Hood River from the Washington shore: the live scene, drawn every frame.
// A port of the board's renderer (led-matrix tools/gorge.py + town.py); the static layout comes from
// assets/scene.json, exported from the Python so both show exactly the same town.
import { W, H, HORIZON, TOP, FULL_H, rgb, blend, line, text, gradient, clamp, decodeB64, setTarget } from "./pix.js";
import { Rng } from "./rng.js";
import { skyState, phaseWeights, mixp, PHASES, SKY, MOUNTAIN, DEEP_WATER, SUN_GLOW, SUN_DISC, localParts, MONTHS } from "./sky.js";
import { WeatherFX } from "./weather.js";
import { Eggs, splash } from "./eggs.js";

// ---------------------------------------------------------------- land materials
const [FAR_EAST, FAR_WEST, ORCHARD, ORCHARD_ROW, BLUFF, ROCKS, FREEWAY, LAWN, SAND, RAIL,
  BRICK, CREAM, WHITE, SLATE, ROOF, TREE, STEEPLE, INN] = Array.from({ length: 18 }, (_, i) => i + 1);
const DAY = {
  [FAR_EAST]: [158, 146, 102], [FAR_WEST]: [62, 92, 70], [ORCHARD]: [98, 140, 70], [ORCHARD_ROW]: [58, 96, 48],
  [BLUFF]: [40, 64, 44], [ROCKS]: [110, 104, 96], [FREEWAY]: [78, 80, 86], [LAWN]: [96, 160, 72], [SAND]: [222, 200, 150],
  [RAIL]: [84, 70, 62], [BRICK]: [168, 84, 64], [CREAM]: [224, 208, 168], [WHITE]: [232, 232, 226], [SLATE]: [122, 134, 156],
  [ROOF]: [70, 62, 66], [TREE]: [46, 90, 50], [STEEPLE]: [245, 245, 240], [INN]: [214, 196, 160],
};
const SNOW_TAKE = { [FAR_EAST]: 0.7, [FAR_WEST]: 0.45, [ORCHARD]: 0.85, [ORCHARD_ROW]: 0.5, [BLUFF]: 0.35, [ROCKS]: 0.6,
  [FREEWAY]: 0.1, [LAWN]: 0.95, [SAND]: 0.9, [RAIL]: 0.3, [ROOF]: 0.95, [TREE]: 0.3, [BRICK]: 0.05, [CREAM]: 0.05,
  [WHITE]: 0, [SLATE]: 0.05, [STEEPLE]: 0, [INN]: 0.05 };
const HAZY = { [FAR_EAST]: 0.28, [FAR_WEST]: 0.25, [ORCHARD]: 0.12, [ORCHARD_ROW]: 0.12 };
export const MAT = { FAR_EAST, FAR_WEST, ORCHARD, ORCHARD_ROW, BLUFF, TREE, ROOF, SAND };

const SHORE_L = 84, SHORE_R = 232;
const ROW_TOWN_BASE = HORIZON - 5, ROW_RAIL = HORIZON - 4, ROW_FREEWAY = HORIZON - 2, ROW_SHORE = HORIZON - 1;

// A day colour relit for the time of day: warm at golden hour, violet at blue hour, near-black at night.
export function shade(day, w) {
  const c = day.map(v => v / 255);
  return [0, 1, 2].map(k => w.day * c[k] + w.gold * c[k] * [1.05, 0.8, 0.72][k]
    + w.twi * (c[k] * 0.42 + [0.06, 0.04, 0.12][k]) + w.night * (c[k] * 0.12 + [0.01, 0.015, 0.04][k]));
}
const sc3 = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// The website's taller sky: each time-of-day gradient continues up past the board's top row to a deeper zenith.
const ZENITH = { night: [1, 2, 7], twi: [6, 6, 26], gold: [8, 5, 28], day: [22, 70, 168] };
const SKY_TALL = Object.fromEntries(PHASES.map(p => [p, [[0, ZENITH[p]], ...SKY[p].map(([y, c]) => [y + TOP, c])]]));

// ---------------------------------------------------------------- riders

const SAIL_COLORS = [rgb(255, 60, 140), rgb(255, 220, 40), rgb(40, 220, 255), rgb(255, 130, 30), rgb(150, 255, 60),
  rgb(200, 90, 255), rgb(255, 255, 255)];

class Sailor {
  constructor(rng, kite = false) { this.rng = rng; this.kite = kite; this.reset(true); }
  reset(first = false) {
    const r = this.rng;
    this.y = r.uniform(40, 61);
    this.dir = r.choice([-1, 1]);
    this.speed = r.uniform(16, 30);
    this.x = first ? r.uniform(0, W) : (this.dir > 0 ? -10 : W + 10);
    this.color = r.choice(SAIL_COLORS);
    this.color2 = r.choice(SAIL_COLORS);
    this.jumpT = -1;
    this.phase = r.uniform(0, 6.28);
    this.trail = [];
  }
  get scale() { return 0.55 + (this.y - 40) / 21 * 0.9; }
}

// ---------------------------------------------------------------- the scene

export class Scene {
  // the bridge's perspective: a point at depth z (1 = near edge of the screen) and height `up` above the deck
  static VP = [100.0, 33.3];
  static NEAR_DECK = [-14.0, 27.0];
  static Z_NEAR = 0.8; static Z_FAR = 8.0;
  static LIFT = [1.25, 2.0];
  static TOWER_H = 20.0; static TOWER_W = 6.0;
  static DECK_TRUSS = 6.0; static WATER = 44.0; static PIER_STEP = 0.75;
  static PEAK_X = 150;
  static RAIL_ROW = HORIZON - 4; static RAIL_SPAN = [0, 232];
  static PERCH = [160, HORIZON];

  constructor(data, { eggClasses = [], eggRate = 1, log = console.log, labels = null } = {}) {
    const n = W * HORIZON;
    this.land = decodeB64(data.land, Uint8Array).slice(0, n);
    this.mtnMat = decodeB64(data.mtn_mat, Uint8Array).slice(0, n);
    this.mtnEast = decodeB64(data.mtn_east, Uint8Array).slice(0, n);
    this.summit = data.summit;
    this.windows = data.windows;
    this.stars = data.stars;
    const toF = a => Float32Array.from(a, v => v / 65535);
    this.caps = toF(decodeB64(data.caps, Uint16Array));      // (H-HORIZON) x 512
    this.glints = toF(decodeB64(data.glints, Uint16Array));
    this.fx = new WeatherFX(Float32Array.from(decodeB64(data.fog_tex, Uint8Array), v => v / 255));
    this.cars = data.cars; this.bridgeCars = data.bridge_cars; this.masts = data.masts;
    this.labels = labels; // (ms) -> [[text, [r,g,b]], ...] for the line under the clock

    const rng = this.rng = new Rng(7);
    this.skies = Object.fromEntries(PHASES.map(p => [p, gradient(SKY_TALL[p], HORIZON + TOP)]));
    const sr = new Rng(13); // more stars for the website's extra sky
    for (let k = 0; k < 90; k++) this.stars.push([sr.integers(W), sr.integers(-TOP, 0), sr.uniform(0, 6.28), sr.uniform(0.8, 2.5)]);
    this.sailors = Array.from({ length: 10 }, () => new Sailor(rng));
    this.kiters = Array.from({ length: 3 }, () => new Sailor(rng, true));
    this.streaks = Array.from({ length: 40 }, () => [rng.uniform(0, W), rng.uniform(4 - TOP, 63), rng.uniform(5, 14), rng.uniform(0.7, 1.4)]);
    this.birds = Array.from({ length: 3 }, () => [rng.uniform(-60, W), rng.uniform(8, 20), rng.uniform(5, 9)]);
    this.eggs = new Eggs(eggClasses, new Rng((Date.now() & 0xffffffff) >>> 0), eggRate, log);
    this.solid = new Uint8Array(W * H);
    for (let i = 0; i < n; i++) this.solid[i] = this.land[i] > 0 ? 1 : 0;
    this.liftRaise = 0;
    this.groundSnow = 0;
  }

  // Screen position for a sun or moon: east (morning) left, west right. Near the horizon it matches the
  // board exactly; higher up it climbs into the website's extra sky.
  static arc(haDeg, elev) {
    const y = elev <= 10 ? 26 - elev * 0.5 : 21 - (elev - 10) * 0.8;
    return [128 + haDeg / 115 * 130, Math.max(5 - TOP, y)];
  }
  arc(haDeg, elev) { return Scene.arc(haDeg, elev); }

  static bargeX(t) { return W + 40 - ((t * 3.5) % (W + 160)); }
  bargeX(t) { return Scene.bargeX(t); }

  render(t, dt, wind, nowMs) {
    const rng = this.rng;
    const { elev, ha, melev, mha, phase: mphase } = skyState(nowMs);
    const now = localParts(nowMs);
    const w = phaseWeights(elev);
    const night = w.night + 0.5 * w.twi;
    const light = w.gold + w.day;
    const wx = this.wx = this.fx.state(wind, t, w.day, elev);
    const { cc, rain, snow, ground } = wx;
    this.groundSnow = ground;
    const mph = Math.max(wind.speed, wx.wind);
    const wf = clamp(mph / 25, 0.2, 1.6);
    const veil = Math.max(cc, wx.smoke, wx.fog);
    const activity = Math.min(1, light + 0.5 * w.twi) * (1 - 0.6 * rain) * (1 - 0.9 * snow) * (1 - 0.7 * ground)
      * (1 - 0.8 * Math.max(0, wx.fog - 0.5) * 2) * (1 - 0.6 * wx.smoke) * (1 - wx.storm) * (1 - wx.ice);
    let nSail = Math.round(clamp(Math.round(mph / 4.5), 3, 7) * activity);
    const nKite = Math.round(clamp(Math.floor(mph / 15), 1, 2) * activity);
    if (mph > 30) nSail = Math.min(nSail, 3);
    const riders = [...this.sailors.slice(0, nSail), ...this.kiters.slice(0, nKite)];
    // The website's frame is TOP rows taller than the board's. Everything below draws in the board's
    // coordinates on `img`, a view of the bottom 64 rows; negative rows reach the extra sky (see pix.js).
    const full = new Float32Array(W * FULL_H * 3), img = full.subarray(TOP * W * 3);
    setTarget(full, img);

    // --- sky, from the top of the extra sky down to the horizon
    const base = Array.from({ length: HORIZON + TOP }, (_, y) =>
      [0, 1, 2].map(k => PHASES.reduce((s, p) => s + w[p] * this.skies[p][y][k], 0)));
    const skyAll = this.fx.sky(base, w, wx), sky = skyAll.slice(TOP);
    for (let y = 0; y < HORIZON + TOP; y++) for (let x = 0; x < W; x++) full.set(skyAll[y], (y * W + x) * 3);
    if (night > 0.02) {
      for (const [x, y, ph, sp] of this.stars) {
        blend(img, x, y, rgb(255, 245, 230), night * (1 - veil) * (1 - (y + TOP) / (17 + TOP)) * (0.5 + 0.35 * Math.sin(t * sp + ph)));
      }
    }

    // --- sun: glow even just below the horizon, disc once it clears the ridge
    const [sx, sy] = this.arc(ha, elev);
    const glow = mixp(w, SUN_GLOW);
    const glowR = (16 + 10 * w.day) * (1 + 0.3 * wx.heat);
    const sunf = WeatherFX.sunFactor(wx);
    const strength = (0.55 * w.gold + 0.3 * w.twi + 0.25 * w.day) * sunf;
    const [show, discCol] = WeatherFX.disc(wx, mixp(w, SUN_DISC));
    for (let y = -TOP; y < HORIZON; y++) for (let x = 0; x < W; x++) {
      const d2 = (x - sx) ** 2 + ((y - sy) * 1.3) ** 2;
      const i = ((y + TOP) * W + x) * 3, g = strength * Math.exp(-d2 / (2 * glowR * glowR));
      full[i] += glow[0] * g; full[i + 1] += glow[1] * g; full[i + 2] += glow[2] * g;
      if (elev > -1 && d2 < 5.5 * 5.5) {
        full[i] = full[i] * (1 - show) + discCol[0] * show;
        full[i + 1] = full[i + 1] * (1 - show) + discCol[1] * show;
        full[i + 2] = full[i + 2] * (1 - show) + discCol[2] * show;
      }
    }

    // --- moon with its real phase
    const [mx, my] = this.arc(mha, melev);
    const egg = { t, dt, w, night, light, elev, sx, sy, riders, rng, summit: this.summit, now, nowMs, scene: this,
      mx, my, melev, mphase, veil, rail_row: Scene.RAIL_ROW, rail_span: Scene.RAIL_SPAN, perch: Scene.PERCH,
      wind, wx, ground };
    this.eggs.update(egg);
    const moonUp = melev > -1 && w.day < 0.9;
    if (moonUp) {
      const fade = (1 - 0.7 * w.day) * clamp(1 - 1.1 * veil ** 1.5, 0, 1);
      const k0 = 0.25 * night * (1 - veil), mcol = rgb(150, 160, 200);
      if (k0 > 0) {
        for (let y = -TOP; y < HORIZON; y++) for (let x = 0; x < W; x++) {
          const g = k0 * Math.exp(-((x - mx) ** 2 + (y - my) ** 2) / 98), i = ((y + TOP) * W + x) * 3;
          full[i] += mcol[0] * g; full[i + 1] += mcol[1] * g; full[i + 2] += mcol[2] * g;
        }
      }
      const c = Math.cos(2 * Math.PI * mphase), waxing = mphase < 0.5;
      for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) {
        const nx = xx / 3.8, ny = yy / 3.8;
        if (nx * nx + ny * ny > 1) continue;
        const wdt = Math.sqrt(1 - ny * ny);
        const on = waxing ? nx > c * wdt : nx < -c * wdt;
        blend(img, mx + xx, my + yy, on ? rgb(238, 235, 215) : rgb(30, 34, 56), fade);
      }
    }
    this.eggs.draw("sky", img, egg);

    // --- birds (daytime)
    for (const b of this.birds) {
      b[0] += b[2] * dt;
      if (b[0] > W + 20) { b[0] = -rng.uniform(20, 120); b[1] = rng.uniform(8, 20); }
      if (light > 0.1) {
        const flap = Math.trunc(t * 4 + b[1]) % 2;
        const c = w.day < 0.5 ? rgb(30, 15, 40) : rgb(40, 45, 60);
        for (const dx of [-1, 1]) blend(img, b[0] + dx, b[1] - flap, c, 0.9 * light);
        blend(img, b[0], b[1], c, 0.9 * light);
      }
    }

    // --- Mt. Hood, lit on the side facing the sun
    const pal = mixp(w, MOUNTAIN);
    const sunEast = ha < 0;
    const hide = WeatherFX.mountainHidden(wx) * 0.92;
    for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, mat = this.mtnMat[p];
      if (!mat) continue;
      const lit = (this.mtnEast[p] === 1) === sunEast ? 1 : 0;
      let col = pal[(mat === 2 ? 2 : 0) + lit].map((v, k) => v * 0.8 + sky[y][k] * 0.2);
      if (ground > 0 && mat === 1) col = col.map((v, k) => v * (1 - 0.7 * ground) + pal[2 + lit][k] * 0.7 * ground);
      if (hide > 0) col = col.map((v, k) => v * (1 - hide) + sky[y][k] * hide);
      img.set(col, p * 3);
    }
    this.fx.drawClouds(full, w, dt, wx, wf);
    this.eggs.draw("mountain", img, egg);

    const dim = 0.35 + 0.65 * (1 - night);
    this.drawLand(img, t, w, sky, night, dim);
    this.eggs.draw("shore", img, egg);

    // --- river: sky reflection, chop, sun or moon glitter
    const deep = mixp(w, DEEP_WATER), sunDisc = mixp(w, SUN_DISC);
    const tick = Math.trunc(t * 8);
    const nR = H - HORIZON;
    const crestRow = new Uint8Array(W), crest = new Uint8Array(W);
    for (let r = 0; r < nR; r++) {
      const d = r / (nR - 1), y = HORIZON + r;
      const mirror = clamp(Math.trunc(HORIZON - 1 - r * 1.25), 0, HORIZON - 1);
      const baseC = [0, 1, 2].map(k => sky[mirror][k] * (0.55 - 0.25 * d) + deep[k] * (0.25 + 0.5 * d));
      const kk = 1.1 - 0.75 * d;
      const shift = Math.trunc(t * (6 + 14 * wf) * (0.3 + d));
      const thr = (0.994 - 0.012 * wf) - 0.006 * d;
      for (let x = 0; x < W; x++) crestRow[x] = this.caps[r * 512 + ((((x - shift) % 512) + 512) % 512)] > thr ? 1 : 0;
      for (let x = 0; x < W; x++) {
        crest[x] = crestRow[x] | crestRow[(x + W - 1) % W] | (crestRow[(x + W - 2) % W] & (d > 0.5 ? 1 : 0));
      }
      const capA = (0.25 + 0.55 * d) * (0.35 + 0.65 * (1 - night));
      const half = 3 + d * 16;
      for (let x = 0; x < W; x++) {
        const swell = 1 + (0.05 + 0.08 * wf) * Math.sin(x * kk + t * 1.5 + r * 1.9);
        let c0 = baseC[0] * swell, c1 = baseC[1] * swell, c2 = baseC[2] * swell;
        if (crest[x]) {
          c0 = c0 * (1 - capA) + 0.922 * capA; c1 = c1 * (1 - capA) + 0.91 * capA; c2 = c2 * (1 - capA) + 0.98 * capA;
        }
        const sparkle = this.glints[r * 512 + ((((x - tick * 37) % 512) + 512) % 512)] > 0.8;
        const g2 = this.glints[r * 512 + ((((x - tick * 11) % 512) + 512) % 512)];
        if (elev > -2) {
          const g = Math.exp(-(((x - sx) / half) ** 2)) * Math.min(1, (elev + 2) / 6) * sunf;
          c0 += glow[0] * 0.35 * g; c1 += glow[1] * 0.35 * g; c2 += glow[2] * 0.35 * g;
          if (sparkle && g2 > 0.5 * w.day && g > 0.3 + 0.25 * w.day) { [c0, c1, c2] = sunDisc; }
        } else if (moonUp) {
          const g = Math.exp(-(((x - mx) / (half * 0.55)) ** 2)) * (1 - veil);
          c0 += 0.588 * 0.08 * g; c1 += 0.627 * 0.08 * g; c2 += 0.784 * 0.08 * g;
          if (sparkle && g2 > 0.75 && g > 0.5 + 0.5 * cc) {
            c0 = c0 * 0.45 + 0.725 * 0.55; c1 = c1 * 0.45 + 0.745 * 0.55; c2 = c2 * 0.45 + 0.843 * 0.55;
          }
        }
        const i = (y * W + x) * 3;
        img[i] = c0; img[i + 1] = c1; img[i + 2] = c2;
      }
    }

    // --- tug pushing barges upriver (leftward), lit after dark
    const bx = this.bargeX(t), by = 39;
    const bargeC = sc3(rgb(55, 45, 40), dim), tugC = sc3(rgb(200, 60, 45), dim);
    for (let i = 0; i < 3; i++) {
      const x0 = Math.trunc(bx + i * 14);
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + 12); x++) for (const y of [by, by + 1]) img.set(bargeC, (y * W + x) * 3);
    }
    const tx = Math.trunc(bx + 42);
    for (let x = Math.max(0, tx); x < Math.min(W, tx + 5); x++) for (const y of [by - 1, by, by + 1]) img.set(tugC, (y * W + x) * 3);
    blend(img, tx + 2, by - 2, sc3(rgb(240, 240, 240), dim), 1);
    if (night > 0.2) {
      blend(img, tx + 2, by - 3, rgb(255, 255, 230), night);
      blend(img, tx + 1, by, rgb(255, 60, 60), night); // heading upriver we see its port (red) side
    }

    this.drawStructures(img, t, w, night, dim);

    // --- wind streaks (the Gorge's west wind blows upriver: left to right here)
    const streakA = 0.18 * (0.35 + 0.65 * (1 - night));
    for (const s of this.streaks.slice(0, Math.trunc(10 + 20 * wf))) {
      s[0] += (40 + 60 * wf) * s[3] * dt;
      if (s[0] > W + 15) { s[0] = -rng.uniform(0, 40); s[1] = rng.uniform(4, 63); }
      for (let i = 0; i < Math.trunc(s[2]); i++) blend(img, s[0] - i, s[1], [1, 1, 1], streakA * (1 - i / s[2]));
    }

    this.eggs.draw("water", img, egg);
    if (rain > 0 || wx.storm) {
      const k = 1 - 0.2 * rain - 0.15 * wx.storm;
      for (let i = 0; i < full.length; i++) full[i] *= k;
    }
    this.fx.atmosphere(full, w, t, night, wx);
    const flash = this.fx.drawLightning(img, t, dt, wx);
    if (wx.rainbowNow) this.eggs.trigger("rainbow");

    // --- riders, water eggs and the bridge's pieces, sorted by depth and drawn far to near
    const lum = 0.45 + 0.55 * light;
    const items = this.foregroundItems(t, w, night, dim);
    for (const s of riders) items.push([this.depthAtRow(s.y), im => this.drawRider(im, s, t, dt, wf, lum)]);
    for (const [row, fn] of this.eggs.depthItems(egg)) items.push([this.depthAtRow(row), fn]);
    const before = wx.ice ? img.slice() : null;
    items.sort((a, b) => b[0] - a[0]);
    for (const [, fn] of items) fn(img);
    let solid = null;
    if (wx.ice) { // what's solid for the ice glaze: the land, plus the bridge
      solid = this.solid.slice();
      for (let p = 0; p < W * H; p++) {
        const i = p * 3;
        if (Math.abs(img[i] - before[i]) + Math.abs(img[i + 1] - before[i + 1]) + Math.abs(img[i + 2] - before[i + 2]) > 0.05) solid[p] = 1;
      }
    }
    this.fx.atmosphereNear(full, w, t, night, wx);
    this.fx.drawRain(full, dt, rain, wf, night, t);
    this.fx.drawSnow(full, dt, snow, wf, night, t);
    this.fx.drawHail(full, dt, wx, night);
    if (wx.ice) this.fx.drawGlaze(img, t, wx, night, solid);
    this.fx.drawSpray(img, dt, mph, night);
    this.eggs.draw("top", img, egg);
    WeatherFX.flash(full, flash);

    // --- captions: clock and date top-left, wind top-right
    const h12 = now.hour % 12 || 12;
    const clock = `${h12}:${String(now.minute).padStart(2, "0")} ${now.hour < 12 ? "AM" : "PM"}`;
    const date = `${now.weekdayName} ${MONTHS[now.month - 1]} ${now.day}`;
    let x = text(full, 3, 2, clock, [1, 1, 1], 0.95);
    x = text(full, x + 5, 2, date, rgb(215, 215, 235), 0.8);
    if (wind.live && !wind.demo) { // live temperature ("*" is the degree sign)
      const f = clamp((wind.temp - 30) / 60, 0, 1);
      const tint = [0, 1, 2].map(k => rgb(170, 205, 255)[k] * (1 - f) + rgb(255, 205, 150)[k] * f);
      text(full, x + 5, 2, `${Math.round(wind.temp)}*F`, tint, 0.95);
    }
    const days = this.labels ? this.labels(nowMs) : [];
    if (days.length) {
      const [label, col] = days[Math.trunc(t / 6) % days.length];
      text(full, 3, 10, label, rgb(...col), 0.9);
    }
    const word = wx.label || WeatherFX.caption(wx);
    let cap;
    if (wind.demo || word) cap = `WIND ${Math.round(mph)} MPH` + (wind.demo ? "" : ` ${wind.compass()}`);
    else cap = `WIND ${Math.round(mph)} MPH ${wind.compass()}  GUST ${Math.round(wind.gust)}`;
    if (word) cap = `${word}  ${cap}`;
    if (wx.label || wind.demo) cap = "DEMO " + cap;
    text(full, W - 3 - cap.length * 4 + 1, 2, cap, [1, 1, 1], wind.live ? 0.9 : 0.45);
    this.eggs.draw("over", full, egg); // eggs that play with the caption use the frame's own coordinates
    return full;
  }

  // ---------------------------------------------------------------- land

  drawLand(img, t, w, sky, night, dim) {
    const pal = [];
    for (let code = 0; code <= 18; code++) pal.push(shade(DAY[code] || [0, 0, 0], w));
    const snowCol = shade([236, 240, 248], w);
    const ground = this.groundSnow;
    for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, code = this.land[p];
      if (!code) continue;
      const hz = HAZY[code] || 0;
      let c = pal[code].map((v, k) => v * (1 - hz) + sky[y][k] * hz);
      if (ground > 0) {
        const s = (SNOW_TAKE[code] || 0) * ground;
        c = c.map((v, k) => v * (1 - s) + snowCol[k] * s);
      }
      img.set(c, p * 3);
    }
    // the Hood River's mouth reads as a notch of water in the shoreline
    const mouth = sky[HORIZON - 3].map((v, k) => v * 0.5 + [0.02, 0.06, 0.12][k]);
    for (let x = 134; x < 137; x++) img.set(mouth, (ROW_SHORE * W + x) * 3);

    for (const x of this.masts) { // marina masts, with anchor lights at night
      for (const y of [ROW_SHORE - 3, ROW_SHORE - 2, ROW_SHORE - 1]) blend(img, x, y, shade([235, 235, 235], w), 1);
      if (night > 0.3) blend(img, x, ROW_SHORE - 4, [1, 0.95, 0.8], night * 0.9);
    }
    if (night > 0.08) { // windows light up through the evening, a few at a time
      for (const [x, y, k] of this.windows) {
        if (k < night * 0.75 && x >= 0 && x < W && y >= 0 && y < HORIZON) {
          const i = (y * W + x) * 3;
          img[i] = img[i] * 0.15 + 0.85; img[i + 1] = img[i + 1] * 0.15 + 0.8 * 0.85; img[i + 2] = img[i + 2] * 0.15 + 0.45 * 0.85;
        }
      }
      for (let x = SHORE_L + 4; x < SHORE_R; x += 9) blend(img, x, ROW_SHORE, [1, 0.92, 0.7], night * 0.7);
    }
    this.drawTrain(img, t, night, dim, ROW_RAIL, 0, SHORE_R);

    for (const [phase, direction, speed] of this.cars) { // I-84: headlights one way, taillights the other
      const x = (((phase * SHORE_R + direction * t * 24 * speed) % SHORE_R) + SHORE_R) % SHORE_R;
      if (night > 0.3) {
        blend(img, x, ROW_FREEWAY, direction < 0 ? [1, 0.95, 0.75] : [1, 0.2, 0.15], Math.min(1, night * 1.2));
      } else {
        blend(img, x, ROW_FREEWAY, shade([230, 230, 235], w), 1);
        blend(img, x + direction, ROW_FREEWAY, shade([200, 200, 210], w), 0.8);
      }
    }
  }

  // Freight train on the far shore, two pixels tall starting at `row`, visible between xMin and xMax.
  drawTrain(img, t, night, dim, row, xMin = 0, xMax = W) {
    const period = W + 180 + 500;
    const head = W + 20 - (t * 13) % period;
    const cars = [rgb(150, 70, 45), rgb(110, 105, 115), rgb(60, 110, 80), rgb(150, 120, 50)];
    for (let car = 0; car < 24; car++) {
      const cx = head + car * 7;
      const x0 = Math.trunc(Math.max(xMin, cx)), x1 = Math.trunc(Math.min(xMax, cx + 6));
      const col = sc3(car === 0 ? rgb(230, 170, 40) : sc3(cars[car % 4], 0.8), dim);
      for (let x = x0; x < x1; x++) { img.set(col, (row * W + x) * 3); img.set(col, ((row + 1) * W + x) * 3); }
    }
    if (xMin < head && head < xMax) {
      blend(img, head - 1, row, rgb(255, 240, 170), 1);
      const n = 8 + Math.trunc(10 * night);
      for (let k = 1; k < n; k++) {
        if (head - 1 - k > xMin) blend(img, head - 1 - k, row, rgb(255, 220, 150), (0.5 + 0.3 * night) * (1 - k / (8 + 10 * night)));
      }
    }
  }

  // ---------------------------------------------------------------- sandbar and the bridge

  drawStructures(img, t, w, night, dim) {
    let sand = shade(DAY[SAND], w);
    const ground = this.groundSnow;
    if (ground > 0) sand = sand.map((v, k) => v * (1 - 0.9 * ground) + shade([236, 240, 248], w)[k] * 0.9 * ground);
    for (let x = 138; x < 178; x++) { // sandbar spit reaching into the Columbia from the river mouth
      const depth = 2.6 * Math.sin(Math.PI * (x - 138) / 40) ** 0.7;
      for (let y = HORIZON; y <= HORIZON + Math.round(depth); y++) blend(img, x, y, sc3(sand, 1 - 0.12 * (y - HORIZON)), 1);
    }
    for (let i = 0; i < 10; i++) blend(img, 96 + i, HORIZON + Math.sin(i / 9 * Math.PI) * 1.6, shade(DAY[ROCKS], w), 1); // the Hook
  }

  project(z, up = 0, dx = 0) {
    const [vx, vy] = Scene.VP, k = 1 / z;
    return [vx + (Scene.NEAR_DECK[0] + dx - vx) * k, vy + (Scene.NEAR_DECK[1] - up - vy) * k, k];
  }

  member(img, z0, up0, z1, up1, col, dx0 = 0, dx1 = 0) {
    const [x0, y0, k0] = this.project(z0, up0, dx0), [x1, y1, k1] = this.project(z1, up1, dx1);
    line(img, x0, y0, x1, y1, col, 1);
    if ((k0 + k1) / 2 > 0.45) line(img, x0 + 1, y0, x1 + 1, y1, sc3(col, 0.78), 1); // up close, thicker steel
  }

  pier(img, z, width, concrete, twin, stepped = false) {
    const [x, yTop, k] = this.project(z, -Scene.DECK_TRUSS);
    let [, yBot] = this.project(z, -Scene.WATER);
    const half = Math.max(0.6, width * k / 2);
    yBot = Math.min(yBot, 70);
    for (let xx = Math.round(x - half); xx <= Math.round(x + half); xx++) {
      const f = (xx - (x - half)) / Math.max(1, 2 * half);
      let col = sc3(concrete, 1 - 0.3 * f); // lit from the left, shaded right
      if (twin && half >= 1.5 && Math.abs(xx - x) < 0.6) col = sc3(concrete, 0.45);
      line(img, xx, yTop, xx, yBot, col, 1);
    }
    if (stepped) for (let xx = Math.round(x - half - 1); xx <= Math.round(x + half + 1); xx++) blend(img, xx, yTop, sc3(concrete, 0.9), 1);
  }

  deckTrussItems(z0, z1, steel, panel = 0.28) {
    const dt = Scene.DECK_TRUSS, items = [];
    let z = z0, i = 0;
    while (z < z1 - 1e-6) {
      const zn = Math.min(z1, z + panel * z), za = z, ii = i;
      items.push([(za + zn) / 2, img => {
        this.member(img, za, 0, zn, 0, steel);
        this.member(img, za, -dt, zn, -dt, sc3(steel, 0.85));
        if (ii % 2) this.member(img, za, 0, zn, -dt, sc3(steel, 0.9));
        else this.member(img, za, -dt, zn, 0, sc3(steel, 0.9));
        this.member(img, za, 0, za, -dt, sc3(steel, 0.8));
      }]);
      z = zn; i++;
    }
    return items;
  }

  tower(img, z, steel, house, night, t) {
    const th = Scene.TOWER_H, tw = Scene.TOWER_W;
    for (const side of [-tw / 2, tw / 2]) this.member(img, z, -Scene.DECK_TRUSS, z, th, steel, side, side);
    let up = 0;
    while (up < th - 3) { // X-bracing up the tower
      const u1 = Math.min(th - 3, up + tw * 1.1);
      this.member(img, z, up, z, u1, sc3(steel, 0.85), -tw / 2, tw / 2);
      this.member(img, z, u1, z, up, sc3(steel, 0.85), -tw / 2, tw / 2);
      this.member(img, z, u1, z, u1, steel, -tw / 2, tw / 2);
      up = u1;
    }
    const [x0, y0] = this.project(z, th + 3, -tw / 2 - 1), [x1, y1] = this.project(z, th - 1, tw / 2 + 1);
    for (let yy = Math.round(y0); yy <= Math.round(y1); yy++) for (let xx = Math.round(x0); xx <= Math.round(x1); xx++) blend(img, xx, yy, house, 1);
    if (night > 0.2 && Math.trunc(t * 1.5 + z * 3) % 2) {
      const [x, y] = this.project(z, th + 5);
      blend(img, x, y, [1, 0.15, 0.1], night);
    }
  }

  depthAtRow(y) {
    return (Scene.NEAR_DECK[1] + Scene.WATER - Scene.VP[1]) / Math.max(0.5, y - Scene.VP[1]);
  }

  // The bridge as [depth, draw] pieces, so riders can be sorted in among its piers and spans.
  foregroundItems(t, w, night, dim) {
    const steel = shade([104, 128, 92], w), house = shade([150, 162, 132], w);
    const concrete = shade([200, 180, 140], w), cable = shade([200, 205, 200], w);
    const [zA, zB] = Scene.LIFT;
    const items = [];
    const add = (z, fn) => items.push([z, fn]);

    for (let z = Scene.Z_FAR; z > zB + 0.3; z -= Scene.PIER_STEP) { // approach piers
      const zz = z;
      add(zz + 0.01, img => this.pier(img, zz, 5.0, concrete, true));
    }
    items.push(...this.deckTrussItems(zB, Scene.Z_FAR, steel), ...this.deckTrussItems(Scene.Z_NEAR, zA, steel));
    for (const zt of [zB, zA]) { // tower piers sit just behind their towers
      add(zt + 0.01, img => this.pier(img, zt, 9.0, concrete, false, true));
      add(zt, img => this.tower(img, zt, steel, house, night, t));
    }

    // lift span: a through-truss with a curved top chord between the towers; raised for tall ships
    const n = 7;
    const raise = this.liftRaise * (Scene.TOWER_H - 13);
    this.liftRaise = Math.max(0, this.liftRaise - 0.02); // sinks back unless a ship holds it
    const tops = Array.from({ length: n + 1 }, (_, i) => [zA + (zB - zA) * i / n, raise + 5 + 7 * Math.sin(Math.PI * i / n)]);
    for (let i = 0; i < n; i++) {
      const [za, ua] = tops[i], [zb, ub] = tops[i + 1];
      add((za + zb) / 2, img => {
        this.member(img, za, raise, zb, raise, steel);
        this.member(img, za, ua, zb, ub, steel);
        this.member(img, za, raise, za, ua, sc3(steel, 0.85));
        if (i < n / 2) this.member(img, za, raise, zb, ub, sc3(steel, 0.8));
        else this.member(img, za, ua, zb, raise, sc3(steel, 0.8));
      });
    }
    add((zA + zB) / 2 - 0.01, img => { // cables draped between the tower tops
      for (const [sag, alpha] of [[5.0, 0.55], [8.5, 0.4]]) {
        const pts = Array.from({ length: 12 }, (_, j) => {
          const u = j / 11;
          return this.project(zA + (zB - zA) * u, Scene.TOWER_H + 1 - sag * Math.sin(Math.PI * u));
        });
        for (let j = 0; j < 11; j++) line(img, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], cable, alpha);
      }
    });

    if (this.wx && this.wx.ice) { // ice storm: icicles under the deck trusses
      for (let z = Scene.Z_NEAR; z < Scene.Z_FAR; z *= 1.12) {
        const zz = z;
        add(zz - 0.005, img => {
          const [x, y, k] = this.project(zz, -Scene.DECK_TRUSS);
          const length = Math.max(1, Math.round(3.5 * k));
          for (let i = 0; i < length; i++) blend(img, x, y + 1 + i, [0.8, 0.92, 1.0], 0.9 * (1 - i / (length + 1)));
        });
      }
    }
    for (let z = Scene.Z_NEAR + 0.2; z < Scene.Z_FAR; z *= 1.35) { // lamp posts along the deck, lit after dark
      const zz = z;
      add(zz - 0.005, img => {
        const [x, y] = this.project(zz, 0), [, yl] = this.project(zz, 4);
        line(img, x, y, x, yl, sc3(steel, 0.9), 1);
        if (night > 0.25) blend(img, x, yl, [1, 0.9, 0.65], night * 0.9);
      });
    }
    this.bridgeCars.forEach((ph, k) => { // traffic: bigger up close, lights after dark
      const z = 1.0 + ((((ph + t * 0.04 * (k % 2 ? 1 : -1)) % 1) + 1) % 1) * (Scene.Z_FAR - 1.0);
      if (raise > 0.3 && z > zA - 0.1 && z < zB + 0.1) return; // traffic waits while the span is up
      add(z - 0.005, img => {
        const [x, y, s] = this.project(z, 1.2);
        const size = Math.max(1, Math.round(3 * s));
        if (night > 0.3) {
          const col = k % 2 ? [1, 0.95, 0.75] : [1, 0.2, 0.15];
          for (let d = 0; d < size; d++) blend(img, x + d, y, col, night);
        } else {
          const body = shade([[200, 60, 50], [230, 230, 235], [60, 90, 160]][k % 3], w);
          for (let dy = 0; dy < Math.max(1, size - 1); dy++) for (let d = 0; d <= size; d++) blend(img, x + d, y - dy, body, 1);
        }
      });
    });
    return items;
  }

  // ---------------------------------------------------------------- riders

  drawRider(img, s, t, dt, wf, lum) {
    if (s.eaten) return; // the shark egg has them
    let cat = s.catapultT == null ? null : t - s.catapultT;
    if (cat !== null && cat > 3.6) { s.catapultT = null; cat = null; }
    let crash = s.crashT == null ? null : t - s.crashT;
    if (crash !== null && crash > 5.4) { s.crashT = null; crash = null; }
    const stalled = (cat !== null && cat > 0.4 && cat < 3.2) || (crash !== null && crash > 1.6 && crash < 4.6);
    if (!stalled) s.x += s.dir * s.speed * (0.6 + 0.6 * wf) * dt;
    if (s.x < -30 || s.x > W + 30) s.reset();
    const sc = s.scale;
    if (cat !== null && this.drawCatapult(img, s, cat, lum)) return;
    let mega = s.megaT == null ? null : s.megaT;
    if (mega !== null && t - mega > 3.5) { s.megaT = null; mega = null; }
    if (mega === null && s.jumpT < 0 && this.rng.random() < dt * 0.08 * wf) s.jumpT = 0; // occasional jump
    let lift = 0;
    if (s.jumpT >= 0) {
      s.jumpT += dt;
      const p = s.jumpT / 0.9;
      lift = p < 1 ? Math.sin(Math.PI * p) * 4 * sc : 0;
      if (p >= 1) s.jumpT = -1;
    }
    if (mega !== null) lift = Math.sin(Math.PI * (t - mega) / 3.5) * (s.y + 6); // huge air, off the top of the screen
    const x = s.x, y = s.y - lift;
    if (lift < 0.5) s.trail.push([s.x, s.y]); // wake
    s.trail = s.trail.slice(-Math.trunc(14 * sc + 4));
    for (let i = 0; i < s.trail.length - 1; i++) {
      const f = i / Math.max(1, s.trail.length);
      blend(img, s.trail[i][0], s.trail[i][1] + 0.5, rgb(235, 240, 255), 0.55 * f * lum);
    }
    const bl = Math.round(3 * sc) + 1; // board + rider
    for (let i = 0; i < bl; i++) blend(img, x - s.dir * i + s.dir * bl / 2, y, sc3(rgb(240, 240, 240), lum), 1);
    if (s.kite) {
      blend(img, x, y - 1, rgb(40, 25, 30), 1);
      blend(img, x, y - 2, rgb(40, 25, 30), 1);
      const sway = Math.sin(t * 0.9 + s.phase);
      let kx = x + s.dir * (6 + 3 * sway) * sc;
      let ky = Math.max(4.0, y - (18 + 4 * Math.cos(t * 0.7 + s.phase)) * sc - 4);
      if (crash !== null) { // loop, nose-dive into the water, sit, relaunch
        const water = [kx, y - 1];
        if (crash < 1.2) {
          const a = 2 * Math.PI * crash / 1.2;
          kx += s.dir * Math.sin(a) * 5 * sc; ky += (1 - Math.cos(a)) * 4 * sc;
        } else if (crash < 4.0) {
          const p = Math.min(1, (crash - 1.2) / 0.5);
          kx += (water[0] - kx) * p; ky += (water[1] - ky) * p * p;
          if (crash > 1.7 && crash < 2.1) splash(img, kx, y, (crash - 1.7) / 0.4, sc);
        } else {
          const p = (crash - 4.0) / 1.4;
          ky = water[1] + (ky - water[1]) * (1 - (1 - p) ** 2);
        }
      }
      s.kitePos = [kx, ky];
      if (s.kiteLost != null && t - s.kiteLost > 25) s.kiteLost = null; // the loose-kite egg draws it
      if (s.kiteLost != null) return;
      const tips = [];
      for (let j = -4; j <= 4; j++) {
        const px = kx + j * Math.max(1, sc), py = ky + j * j * 0.2 * sc;
        const c = sc3(Math.abs(j) < 3 ? s.color : s.color2, lum);
        blend(img, px, py, c, 1);
        blend(img, px, py + 1, sc3(c, 0.7), 1); // two pixels thick so it reads as a canopy
        if (Math.abs(j) === 4) tips.push([px, py + 1]);
      }
      for (const [tx, ty] of tips) line(img, x, y - 2, tx, ty, rgb(230, 230, 240), 0.35 * lum);
    } else {
      const hs = Math.round(6 * sc) + 3, mast = x + s.dir;
      for (let i = 0; i < hs; i++) {
        const wdt = Math.max(1, Math.round((1 - i / hs) * (3.2 * sc + 1.5)));
        for (let j = 0; j < wdt; j++) {
          const c = j < wdt - 1 || wdt === 1 ? s.color : s.color2;
          blend(img, mast - s.dir * j, y - 1 - i, sc3(c, lum), 1);
        }
      }
      blend(img, mast + s.dir, y - 1, rgb(40, 25, 30), 1);
      blend(img, mast + s.dir, y - 2, rgb(40, 25, 30), 1);
    }
  }

  // Windsurfer catapult; returns false once the rider is back up so the normal drawing takes over.
  drawCatapult(img, s, a, lum) {
    if (a >= 3.2) return false;
    const sc = s.scale, x = s.x, y = s.y, d = s.dir, rider = rgb(40, 25, 30);
    const hs = Math.round(6 * sc) + 3;
    if (a < 0.55) { // the sail pitches forward, the rider sails over the top
      const p = a / 0.55, lean = p * Math.PI / 2;
      for (let i = 0; i < hs; i++) blend(img, x + d * (1 + Math.sin(lean) * i), y - 1 - Math.cos(lean) * i, sc3(s.color, lum), 1);
      blend(img, x + d * (2 + 9 * p * sc), y - 3 - Math.sin(Math.PI * p) * 7 * sc, rider, 1);
      blend(img, x + d * (2 + 9 * p * sc), y - 2 - Math.sin(Math.PI * p) * 7 * sc, rider, 1);
    } else { // sail flat on the water, rider bobbing next to it, then hauling it back up
      const up = Math.max(0, (a - 2.4) / 0.8), ang = Math.PI / 2 * (1 - up);
      for (let i = 0; i < hs; i++) {
        blend(img, x + d * (1 + Math.sin(ang) * i), y - Math.cos(ang) * i, sc3(s.color, lum), 1);
        if (up < 0.3 && i < hs - 2) blend(img, x + d * (1 + i), y + 1, sc3(s.color2, lum * 0.6), 1);
      }
      blend(img, x + d * (2 + 9 * sc) * (1 - up), y + Math.sin(a * 5) * 0.5, rider, 1);
      for (let i = 0; i < Math.round(3 * sc) + 1; i++) blend(img, x - d * (i + 2), y + 0.5, sc3(rgb(240, 240, 240), lum), 1);
      if (a < 0.95) splash(img, x + d * (2 + 9 * sc), y, (a - 0.55) / 0.4, sc);
    }
    return true;
  }
}
