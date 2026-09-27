// Live weather over the scene: live Open-Meteo readings, presets, and every weather effect.
// Effects that cover the whole frame (clouds, fog, smoke, rain, snow, hail, flashes) take the website's
// full image, TOP rows taller than the board's; rows there are board rows + TOP.
import { W, H, HORIZON, TOP, clamp } from "./pix.js";
import { PHASES, LAT, LON } from "./sky.js";
import { Rng } from "./rng.js";

const BASE = { cloud: 0, rain: 0, snow_cm: 0, ground: 0, fog: 0, smoke: 0, storm: 0, hail: 0, ice: 0, wind: 0, heat: 0 };
export const PRESETS = Object.fromEntries(Object.entries({
  clear: {}, partly: { cloud: 35 }, cloudy: { cloud: 70 }, overcast: { cloud: 96 },
  drizzle: { cloud: 90, rain: 0.4 }, rain: { cloud: 96, rain: 2.5 }, downpour: { cloud: 100, rain: 7.0 },
  flurries: { cloud: 75, snow_cm: 0.3, ground: 0.5 }, snow: { cloud: 96, snow_cm: 1.2, ground: 1.0 },
  riverfog: { cloud: 20, fog: 0.45 }, fog: { cloud: 60, fog: 1.0 },
  haze: { smoke: 0.4 }, smoke: { smoke: 1.0 },
  thunderstorm: { cloud: 100, rain: 4.0, storm: 1.0 }, hail: { cloud: 100, rain: 2.0, storm: 1.0, hail: 1.0 },
  icestorm: { cloud: 100, rain: 1.5, ice: 1.0, ground: 0.3 },
  gale: { cloud: 40, wind: 42 }, heat: { heat: 1.0 },
}).map(([k, v]) => [k, { ...BASE, ...v }]));
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const ICE_CODES = new Set([56, 57, 66, 67]);
const FOG_CODES = new Set([45, 48]);

const CLOUD_LIT = { night: [34, 36, 52], twi: [150, 122, 160], gold: [255, 188, 150], day: [248, 248, 252] };
const CLOUD_SHADE = { night: [16, 17, 26], twi: [78, 68, 100], gold: [150, 100, 120], day: [170, 178, 194] };
const OVERCAST = {
  night: [[10, 11, 16], [16, 17, 24]], twi: [[58, 54, 76], [96, 86, 104]],
  gold: [[112, 100, 110], [170, 140, 130]], day: [[140, 148, 160], [190, 196, 204]],
};
const FOG = { night: [28, 30, 38], twi: [108, 102, 124], gold: [214, 184, 164], day: [206, 210, 216] };
export const SMOKE = { night: [40, 28, 24], twi: [110, 72, 56], gold: [205, 118, 62], day: [196, 146, 96] };
const RAIN_RGB = [0.72, 0.76, 0.84];

export function mixw(w, table) {
  return [0, 1, 2].map(k => PHASES.reduce((s, p) => s + w[p] * table[p][k], 0) / 255);
}
const mean3 = c => (c[0] + c[1] + c[2]) / 3;

// ---------------------------------------------------------------- live readings

export class LiveWind {
  constructor() {
    Object.assign(this, { speed: 15, gust: 20, dir: 270, cloud: 0, precip: 0, code: 0, rain: 0, snowfall: 0,
      snow_depth: 0, visibility: 24000, temp: 60, pm25: 0, live: false });
    this.poll();
    this.pollAir();
  }

  async poll() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      "&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,precipitation,weather_code," +
      "rain,showers,snowfall,snow_depth,visibility,temperature_2m&wind_speed_unit=mph&temperature_unit=fahrenheit";
    try {
      const cur = (await (await fetch(url)).json()).current;
      this.speed = cur.wind_speed_10m; this.gust = cur.wind_gusts_10m; this.dir = cur.wind_direction_10m;
      this.cloud = cur.cloud_cover; this.precip = cur.precipitation; this.code = cur.weather_code;
      this.rain = (cur.rain || 0) + (cur.showers || 0);
      this.snowfall = cur.snowfall || 0; this.snow_depth = cur.snow_depth || 0;
      this.visibility = cur.visibility || 24000;
      this.temp = cur.temperature_2m ?? 60;
      this.live = true;
    } catch (e) {
      console.warn("weather fetch failed", e);
    }
    setTimeout(() => this.poll(), 600e3);
  }

  async pollAir() {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5`;
    try {
      this.pm25 = (await (await fetch(url)).json()).current.pm2_5 || 0;
    } catch (e) {
      console.warn("air-quality fetch failed", e);
    }
    setTimeout(() => this.pollAir(), 1800e3);
  }

  compass() {
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor((this.dir + 22.5) / 45) % 8];
  }
}

// ---------------------------------------------------------------- clouds

class Cloud {
  constructor(rng, first = false) { this.rng = rng; this.reset(first); }

  reset(first = false) {
    const r = this.rng;
    const cw = r.integers(18, 56), ch = r.integers(5, 10);
    const field = new Float32Array(ch * cw);
    const puffs = r.integers(4, 8);
    for (let p = 0; p < puffs; p++) { // a few overlapping puffs, flatter at the base
      const cx = r.uniform(0.15, 0.85) * cw, cy = r.uniform(0.35, 0.8) * ch;
      const rx = r.uniform(0.18, 0.32) * cw, ry = r.uniform(0.35, 0.6) * ch;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        field[y * cw + x] += Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
      }
    }
    this.alpha = new Float32Array(ch * cw);
    this.shade = new Float32Array(ch);
    for (let y = 0; y < ch; y++) {
      const flat = clamp((ch - 0.5 - y) / 1.5, 0, 1); // flat bottom
      for (let x = 0; x < cw; x++) this.alpha[y * cw + x] = clamp((field[y * cw + x] * flat - 0.35) * 2.5, 0, 1);
      this.shade[y] = clamp(y / ch * 1.3 - 0.2, 0, 1); // lit tops, darker bellies
    }
    this.cw = cw; this.ch = ch;
    this.y = Math.floor(r.uniform(1 - TOP * 0.9, 21)); // board rows; negative is the website's extra sky
    this.speed = r.uniform(0.6, 1.4) * (1.3 - this.y / 30);
    this.x = first ? r.uniform(-cw, W) : -cw - r.uniform(0, 60);
  }
}

// ---------------------------------------------------------------- the effects

export class WeatherFX {
  static MAX_CLOUDS = 16;

  constructor(fogTex) {
    const r = this.rng = new Rng(5);
    this.clouds = Array.from({ length: WeatherFX.MAX_CLOUDS }, () => new Cloud(r, true));
    this.drops = Array.from({ length: 460 }, () => [r.uniform(0, W), r.uniform(0, H + TOP), r.uniform(3, 6), r.uniform(0.8, 1.2)]);
    this.flakes = Array.from({ length: 460 }, () => [r.uniform(0, W), r.uniform(0, H + TOP), r.uniform(0, 6.28), r.random()]);
    this.hail = Array.from({ length: 120 }, () => [r.uniform(0, W), r.uniform(0, H), r.uniform(40, 62), 0]);
    this.spray = Array.from({ length: 90 }, () => [0, 0, 0, 0, 0]); // x, y, vx, vy, life
    this.ripples = Array.from({ length: 40 }, () => [0, 0, -1]); // x, y, age (<0 = unused)
    this.fogTex = fogTex; // H x 512, 0..1
    this.override = null;
    this.nextStrike = 3.0; this.strikeT = -9.0; this.bolt = [];
    this.lastRainWall = 0; this.rainbowDoneFor = 0;
  }

  // Everything the scene needs to know about the weather right now.
  state(wind, t, day, elev) {
    let p, label, depthGround;
    if (this.override) {
      p = PRESETS[this.override];
      label = this.override.toUpperCase();
      depthGround = p.ground;
    } else {
      const code = wind.code || 0, vis = wind.visibility || 24000, pm = wind.pm25 || 0, temp = wind.temp ?? 60;
      let snowCm = wind.snowfall || 0;
      if (snowCm < 0.05 && SNOW_CODES.has(code)) snowCm = 0.3;
      const depth = wind.snow_depth || 0;
      depthGround = depth > 0.02 ? 1.0 : (depth > 0.005 || snowCm > 0.3 ? 0.5 : 0.0);
      let fog = clamp((4000 - vis) / 3600, 0, 1);
      if (FOG_CODES.has(code)) fog = Math.max(fog, 0.5);
      p = { cloud: wind.cloud || 0, rain: wind.rain || 0, snow_cm: snowCm, fog, smoke: clamp((pm - 20) / 110, 0, 1),
        storm: code >= 95 ? 1 : 0, hail: (code === 96 || code === 99) ? 1 : 0, ice: ICE_CODES.has(code) ? 1 : 0,
        wind: 0, heat: clamp((temp - 88) / 12, 0, 1) * day };
      label = "";
      if (p.rain >= 0.1) this.lastRainWall = Date.now() / 1000;
    }
    const mm = p.rain + (p.ice && p.rain < 0.1 ? 1.5 : 0);
    const wx = {
      cc: p.cloud / 100, rain: mm >= 0.1 ? clamp(mm / 4, 0, 1) : 0,
      snow: p.snow_cm >= 0.05 ? clamp(p.snow_cm / 1.5, 0.15, 1) : 0,
      ground: depthGround, fog: p.fog, smoke: p.smoke, storm: p.storm, hail: p.hail, ice: p.ice,
      wind: p.wind, heat: p.heat, label,
    };
    if (wx.storm) wx.cc = 1;
    const now = Date.now() / 1000;
    wx.rainbowNow = !this.override && wx.rain === 0 && now - this.lastRainWall > 0 && now - this.lastRainWall < 1200 &&
      elev > 5 && elev < 42 && wx.cc < 0.85 && this.rainbowDoneFor !== this.lastRainWall;
    if (wx.rainbowNow) this.rainbowDoneFor = this.lastRainWall;
    return wx;
  }

  static caption(wx) {
    for (const [flag, word] of [[wx.hail, "HAIL"], [wx.storm, "STORM"], [wx.ice, "ICE STORM"], [wx.snow, "SNOW"],
      [wx.rain, "RAIN"], [wx.fog > 0.7, "FOG"], [wx.fog > 0.3, "RIVER FOG"], [wx.smoke > 0.55, "SMOKE"],
      [wx.smoke > 0.15, "HAZE"], [wx.heat > 0.3, "HEAT"]]) {
      if (flag) return word;
    }
    return "";
  }

  // Overcast flattens the sky toward grey; smoke and heat tint it. `sky` is an array of HORIZON colours.
  sky(sky, w, wx) {
    const k = Math.min(0.97, wx.cc ** 1.6 * 0.92 + 0.1 * wx.snow);
    let out = sky.map(c => c.slice());
    if (k > 0) {
      const top = mixw(w, Object.fromEntries(PHASES.map(p => [p, OVERCAST[p][0]])));
      const bot = mixw(w, Object.fromEntries(PHASES.map(p => [p, OVERCAST[p][1]])));
      out = out.map((c, i) => {
        const f = i / (out.length - 1);
        let g = [0, 1, 2].map(j => top[j] * (1 - f) + bot[j] * f);
        if (wx.snow > 0) {
          const m = mean3(g);
          g = g.map(v => v * (1 - 0.35 * wx.snow) + m * 1.12 * 0.35 * wx.snow);
        }
        g = g.map(v => v * (1 - 0.5 * wx.storm));
        return c.map((v, j) => v * (1 - k) + g[j] * k);
      });
    }
    if (wx.smoke > 0) {
      const s = 0.75 * wx.smoke, col = mixw(w, SMOKE);
      out = out.map(c => c.map((v, j) => v * (1 - s) + col[j] * s));
    }
    if (wx.heat > 0) {
      const h = 0.3 * wx.heat, col = [0.93, 0.9, 0.82];
      out = out.map(c => c.map((v, j) => v * (1 - h) + col[j] * h));
    }
    return out;
  }

  static sunFactor(wx) {
    return clamp(1 - 0.9 * wx.cc ** 1.3, 0.08, 1) * (1 - 0.75 * wx.smoke) * (1 + 0.5 * wx.heat);
  }

  static disc(wx, base) {
    let show = clamp(1 - wx.cc ** 2, 0.12, 1);
    let col = base;
    if (wx.smoke > 0) {
      show = Math.max(show, 0.85 * wx.smoke);
      col = base.map((v, j) => v * (1 - wx.smoke) + [1.0, 0.36, 0.16][j] * wx.smoke);
    }
    return [show * (1 - 0.9 * wx.fog), col];
  }

  static mountainHidden(wx) {
    const deck = clamp((wx.cc - 0.6) / 0.4, 0, 1) * (0.55 + 0.45 * Math.min(1, Math.max(wx.rain, wx.snow) * 2));
    return Math.max(deck, 0.95 * Math.min(1, wx.smoke * 1.4), clamp((wx.fog - 0.5) * 2, 0, 1));
  }

  drawClouds(img, w, dt, wx, wf) {
    const n = Math.round(wx.cc * WeatherFX.MAX_CLOUDS);
    let lit = mixw(w, CLOUD_LIT), shade = mixw(w, CLOUD_SHADE);
    const heavy = Math.max(wx.rain, wx.snow * 0.3) * 0.5;
    if (heavy > 0) {
      const lm = mean3(lit), sm = mean3(shade);
      lit = lit.map(v => v * (1 - heavy) + lm * 0.75 * heavy);
      shade = shade.map(v => v * (1 - heavy) + sm * 0.6 * heavy);
    }
    if (wx.storm) { lit = lit.map(v => v * 0.4); shade = shade.map(v => v * 0.22); }
    if (wx.smoke) {
      const tint = mixw(w, SMOKE);
      lit = lit.map((v, j) => v * (1 - 0.6 * wx.smoke) + tint[j] * 0.6 * wx.smoke);
      shade = shade.map((v, j) => v * (1 - 0.5 * wx.smoke) + tint[j] * 0.3 * wx.smoke);
    }
    const opacity = 0.75 + 0.2 * wx.cc;
    const speed = (2 + 5 * wf) * (1 + 1.5 * wx.storm);
    this.clouds.forEach((c, i) => {
      c.x += c.speed * speed * dt;
      if (c.x > W + 2) c.reset();
      if (i >= n) return;
      const x0 = Math.trunc(c.x), y0 = c.y;
      for (let yy = Math.max(-TOP, y0); yy < Math.min(HORIZON, y0 + c.ch); yy++) {
        const s = c.shade[yy - y0];
        const col = [0, 1, 2].map(j => lit[j] * (1 - s) + shade[j] * s);
        for (let xx = Math.max(0, x0); xx < Math.min(W, x0 + c.cw); xx++) {
          const a = c.alpha[(yy - y0) * c.cw + (xx - x0)] * opacity;
          if (a <= 0) continue;
          const i3 = ((yy + TOP) * W + xx) * 3;
          img[i3] = img[i3] * (1 - a) + col[0] * a;
          img[i3 + 1] = img[i3 + 1] * (1 - a) + col[1] * a;
          img[i3 + 2] = img[i3 + 2] * (1 - a) + col[2] * a;
        }
      }
    });
  }

  // Applied after the far scene and before the sailors and the bridge.
  atmosphere(img, w, t, night, wx) {
    if (wx.heat > 0.05) { // shimmer: rows near the horizon wobble sideways
      for (let y = 24; y < 44; y++) {
        const amp = wx.heat * 1.4 * Math.exp(-(((y - 35) / 5) ** 2));
        const shift = Math.round(Math.sin(t * 7 + y * 1.7) * amp);
        if (shift) rollRow(img, y + TOP, shift);
      }
    }
    if (wx.smoke > 0) {
      const col = mixw(w, SMOKE), sep = 0.35 * wx.smoke;
      for (let y = -TOP; y < H; y++) {
        const depth = y < HORIZON ? clamp((y - 10) / 26, 0.2, 1) : clamp(1 - (y - HORIZON) / 40, 0.25, 1);
        const a = 0.8 * wx.smoke * depth;
        for (let x = 0; x < W; x++) {
          const i = ((y + TOP) * W + x) * 3;
          let r = img[i] * (1 - a) + col[0] * a, g = img[i + 1] * (1 - a) + col[1] * a, b = img[i + 2] * (1 - a) + col[2] * a;
          const lum = (r + g + b) / 3;
          img[i] = r * (1 - sep) + lum * 1.12 * sep;
          img[i + 1] = g * (1 - sep) + lum * 0.86 * sep;
          img[i + 2] = b * (1 - sep) + lum * 0.6 * sep;
        }
      }
    }
    if (wx.fog > 0) this.fog(img, w, t, night, wx, false);
    if (wx.ice > 0) {
      const m = [1 - 0.08 * wx.ice, 1 - 0.03 * wx.ice, 1 + 0.08 * wx.ice];
      for (let i = 0; i < img.length; i += 3) { img[i] *= m[0]; img[i + 1] *= m[1]; img[i + 2] *= m[2]; }
    }
  }

  atmosphereNear(img, w, t, night, wx) {
    if (wx.fog > 0.5) this.fog(img, w, t, night, wx, true);
  }

  fog(img, w, t, night, wx, near) {
    const col = mixw(w, FOG);
    let glow = null;
    const HT = H + TOP;
    if (night > 0.3 && !near) { // lights bloom into halos in the fog
      const lights = new Float32Array(img.length);
      for (let i = 0; i < img.length; i += 3) {
        if (Math.max(img[i], img[i + 1], img[i + 2]) > 0.55) {
          lights[i] = img[i]; lights[i + 1] = img[i + 1]; lights[i + 2] = img[i + 2];
        }
      }
      glow = new Float32Array(img.length);
      for (let y = 0; y < HT; y++) for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
          const j = ((((y - dy) % HT + HT) % HT) * W + (((x - dx) % W + W) % W)) * 3;
          r += lights[j]; g += lights[j + 1]; b += lights[j + 2];
        }
        const i = (y * W + x) * 3;
        glow[i] = r / 15; glow[i + 1] = g / 15; glow[i + 2] = b / 15;
      }
    }
    const shift = Math.trunc(t * 3);
    for (let y = -TOP; y < H; y++) {
      let dens;
      if (wx.fog <= 0.6) { // river fog: a bank lying on the water and the waterfront
        const prof = y < HORIZON ? Math.exp(-(((y - HORIZON) / 5.5) ** 2)) : Math.exp(-(((y - HORIZON) / 10) ** 2));
        dens = prof * Math.min(1, wx.fog * 2.1);
      } else { // dense fog: distance fades to a wall
        dens = (y <= HORIZON + 2 ? 0.97 : clamp(0.97 - (y - HORIZON - 2) / 50, 0.45, 1)) * wx.fog;
      }
      if (near) dens *= 0.55;
      for (let x = 0; x < W; x++) {
        const a = clamp(dens * (0.75 + 0.5 * this.fogTex[((y + H) % H) * 512 + (x + shift) % 512]), 0, 0.97);
        const i = ((y + TOP) * W + x) * 3;
        img[i] = img[i] * (1 - a) + col[0] * a;
        img[i + 1] = img[i + 1] * (1 - a) + col[1] * a;
        img[i + 2] = img[i + 2] * (1 - a) + col[2] * a;
      }
    }
    if (glow) {
      const k = 0.9 * Math.min(1, wx.fog * 1.5);
      for (let i = 0; i < img.length; i++) img[i] += glow[i] * k;
    }
  }

  // Forked bolts from the cloud base; returns the flash strength for this frame.
  drawLightning(img, t, dt, wx) {
    if (!wx.storm) return 0;
    if (t >= this.nextStrike || t < this.strikeT) {
      const r = this.rng;
      let x = r.uniform(20, W - 20), y = r.uniform(5, 9);
      const ground = r.uniform(26, 40);
      const pts = [[x, y]], branches = [];
      while (y < ground) {
        y += r.uniform(1.5, 3); x += r.uniform(-2.2, 2.2);
        pts.push([x, y]);
        if (r.random() < 0.18) {
          let bx = x, by = y;
          const br = [[bx, by]];
          const nb = r.integers(2, 5);
          for (let k = 0; k < nb; k++) {
            bx += r.choice([-1, 1]) * r.uniform(1, 3); by += r.uniform(1, 2.5);
            br.push([bx, by]);
          }
          branches.push(br);
        }
      }
      this.bolt = [pts, ...branches]; this.strikeT = t;
      this.nextStrike = t + r.uniform(2.5, 8.0);
    }
    const age = t - this.strikeT;
    const on = age < 0.08 || (age > 0.15 && age < 0.22) || (age > 0.3 && age < 0.36);
    if (!on || !this.bolt.length) return 0;
    this.bolt.forEach((path, k) => {
      const a = k === 0 ? 1 : 0.7;
      for (let s = 0; s + 1 < path.length; s++) {
        const [x0, y0] = path[s], [x1, y1] = path[s + 1];
        const n = Math.floor(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
        for (let i = 0; i <= n; i++) {
          const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
          if (x >= 0 && x < W && y >= 0 && y < H) {
            let j = (y * W + x) * 3;
            img[j] = img[j] * (1 - a) + 0.94 * a; img[j + 1] = img[j + 1] * (1 - a) + 0.94 * a; img[j + 2] = img[j + 2] * (1 - a) + a;
            for (const xx of [x - 1, x + 1]) {
              if (xx >= 0 && xx < W) {
                j = (y * W + xx) * 3;
                img[j] = img[j] * 0.6 + 0.7 * 0.4; img[j + 1] = img[j + 1] * 0.6 + 0.72 * 0.4; img[j + 2] = img[j + 2] * 0.6 + 0.95 * 0.4;
              }
            }
          }
        }
      }
    });
    const bx = Math.round(this.bolt[0][this.bolt[0].length - 1][0]);
    for (let y = HORIZON; y < Math.min(H, HORIZON + 16); y++) { // its reflection on the river
      const x = bx + Math.round(Math.sin(y * 1.9 + t * 20));
      if (x >= 0 && x < W) {
        const a = 0.45 * (1 - (y - HORIZON) / 16), j = (y * W + x) * 3;
        img[j] = img[j] * (1 - a) + a; img[j + 1] = img[j + 1] * (1 - a) + a; img[j + 2] = img[j + 2] * (1 - a) + a;
      }
    }
    return age < 0.08 ? 0.35 : 0.18;
  }

  static flash(img, strength) {
    if (strength <= 0) return;
    const c = [0.85, 0.86, 1.0];
    for (let i = 0; i < img.length; i += 3) {
      img[i] = img[i] * (1 - strength) + c[0] * strength;
      img[i + 1] = img[i + 1] * (1 - strength) + c[1] * strength;
      img[i + 2] = img[i + 2] * (1 - strength) + c[2] * strength;
    }
  }

  drawHail(img, dt, wx, night) {
    if (!wx.hail) return;
    const v = 0.5 + 0.5 * (1 - night), HT = H + TOP;
    for (const h of this.hail) {
      if (h[3] === 0) {
        h[1] += 120 * dt; h[0] += 15 * dt;
        if (h[1] >= h[2] + TOP) h[3] = 0.001;
      } else {
        h[3] += dt;
        if (h[3] > 0.35) { h[3] = 0; h[1] = this.rng.uniform(-10, 0); h[0] = this.rng.uniform(0, W); }
      }
      const y = Math.trunc(h[3] > 0 ? h[2] + TOP - Math.sin(Math.PI * h[3] / 0.35) * 3 : h[1]);
      const x = ((Math.trunc(h[0]) % W) + W) % W;
      if (y >= 0 && y < HT) {
        const j = (y * W + x) * 3;
        img[j] = img[j] * 0.2 + v * 0.8; img[j + 1] = img[j + 1] * 0.2 + v * 0.8; img[j + 2] = img[j + 2] * 0.2 + v * 0.8;
      }
    }
  }

  // Ice storm: glazed land and steel catch the light in flickering glints. `solid` is a Uint8Array mask.
  drawGlaze(img, t, wx, night, solid) {
    if (!wx.ice) return;
    const r = new Rng(Math.trunc(t * 6)); // glints hold for a sixth of a second
    const c = [0.85, 0.95, 1.0].map(v => v * 0.8 * (0.5 + 0.5 * (1 - night)));
    for (let p = 0; p < W * H; p++) {
      const roll = r.random();
      if (!solid[p]) continue;
      const i = p * 3, lum = (img[i] + img[i + 1] + img[i + 2]) / 3;
      if (lum > 0.1 && lum < 0.8 && roll < 0.05 * wx.ice) {
        img[i] = img[i] * 0.2 + c[0]; img[i + 1] = img[i + 1] * 0.2 + c[1]; img[i + 2] = img[i + 2] * 0.2 + c[2];
      }
    }
  }

  // Gale: spray tearing off the whitecaps, blowing upriver.
  drawSpray(img, dt, windMph, night) {
    const strength = clamp((windMph - 26) / 16, 0, 1);
    let live = 0;
    for (const s of this.spray) {
      if (s[4] > 0) { s[0] += s[2] * dt; s[1] += s[3] * dt; s[4] -= dt; live++; }
    }
    if (strength > 0) {
      let want = Math.trunc(8 + 40 * strength) - live;
      for (const s of this.spray) {
        if (want <= 0) break;
        if (s[4] <= 0) {
          s[0] = this.rng.uniform(0, W); s[1] = this.rng.uniform(HORIZON + 2, H - 2);
          s[2] = this.rng.uniform(60, 110); s[3] = this.rng.uniform(-10, -3); s[4] = this.rng.uniform(0.25, 0.6);
          want--;
        }
      }
    }
    const a = 0.55 * (0.4 + 0.6 * (1 - night));
    for (const s of this.spray) {
      if (s[4] <= 0) continue;
      for (let i = 0; i < 3; i++) {
        const xx = Math.trunc(s[0]) - i, yy = Math.trunc(s[1]);
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) {
          const k = a * (1 - i / 3), j = (yy * W + xx) * 3;
          img[j] = img[j] * (1 - k) + k; img[j + 1] = img[j + 1] * (1 - k) + k; img[j + 2] = img[j + 2] * (1 - k) + k;
        }
      }
    }
  }

  drawSnow(img, dt, snow, wf, night, t) {
    if (snow <= 0) return;
    const n = Math.min(this.flakes.length, Math.trunc((50 + 250 * snow) * 1.4)), HT = H + TOP;
    const v = 0.45 + 0.55 * (1 - night), col = [0.96 * v, 0.97 * v, v], alpha = 0.85;
    for (let k = 0; k < n; k++) {
      const f = this.flakes[k];
      const near = f[3] > 0.8; // the nearest fifth: bigger and faster
      f[1] += (near ? 16 : 9) * (0.8 + 0.4 * f[3]) * dt;
      f[0] += (3 + 10 * wf) * dt + Math.sin(t * 1.3 + f[2]) * 4 * dt;
      if (f[1] > HT + 2) { f[1] -= HT + 4; f[0] = this.rng.uniform(-20, W); }
      f[0] = ((f[0] % (W + 10)) + (W + 10)) % (W + 10);
      const x = Math.trunc(f[0]), y = Math.trunc(f[1]);
      const pts = near ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
      for (const [dx, dy] of pts) {
        const px = x + dx, py = y + dy;
        if (px >= 0 && px < W && py >= 0 && py < HT) {
          const j = (py * W + px) * 3;
          img[j] = img[j] * (1 - alpha) + col[0] * alpha;
          img[j + 1] = img[j + 1] * (1 - alpha) + col[1] * alpha;
          img[j + 2] = img[j + 2] * (1 - alpha) + col[2] * alpha;
        }
      }
    }
  }

  drawRain(img, dt, rain, wf, night, t) {
    if (rain <= 0) return;
    const n = Math.min(this.drops.length, rain > 0.05 ? Math.trunc((60 + 260 * rain) * 1.4) : 56), HT = H + TOP;
    const slant = 0.25 + 0.35 * wf, speed = 95 + 40 * rain;
    const alpha = (0.22 + 0.2 * rain) * (0.45 + 0.55 * (1 - night));
    const col = RAIN_RGB.map(v => v * (0.35 + 0.65 * (1 - night)));
    for (let k = 0; k < n; k++) {
      const d = this.drops[k];
      d[1] += speed * d[3] * dt; d[0] += speed * d[3] * slant * dt;
      if (d[1] > HT + 4) { d[1] -= HT + 8; d[0] = this.rng.uniform(-20, W); }
      d[0] = ((d[0] % (W + 20)) + (W + 20)) % (W + 20);
      for (let step = 0; step < 5 && step < d[2]; step++) { // each streak is a short slanted line
        const xs = Math.trunc(d[0] - step * slant), ys = Math.trunc(d[1] - step);
        if (xs >= 0 && xs < W && ys >= 0 && ys < HT) {
          const j = (ys * W + xs) * 3;
          img[j] = img[j] * (1 - alpha) + col[0] * alpha;
          img[j + 1] = img[j + 1] * (1 - alpha) + col[1] * alpha;
          img[j + 2] = img[j + 2] * (1 - alpha) + col[2] * alpha;
        }
      }
    }
    if (this.rng.random() < dt * (20 + 90 * rain)) { // rings where drops hit the river
      const free = this.ripples.find(r => r[2] < 0);
      if (free) { free[0] = this.rng.uniform(0, W); free[1] = this.rng.uniform(HORIZON + 2, H - 1); free[2] = 0; }
    }
    for (const r of this.ripples) {
      if (r[2] < 0) continue;
      r[2] += dt;
      if (r[2] > 0.6) { r[2] = -1; continue; }
      const [x, y, age] = r;
      const rad = 0.6 + age * 5 * (0.4 + (y - HORIZON) / (H - HORIZON));
      const a = 0.35 * (1 - age / 0.6) * (0.4 + 0.6 * (1 - night));
      for (let k = 0; k < 8; k++) {
        const ang = k / 8 * 6.2832;
        const xx = Math.round(x + Math.cos(ang) * rad), yy = Math.round(y + Math.sin(ang) * rad * 0.35);
        if (xx >= 0 && xx < W && yy >= HORIZON && yy < H) {
          const j = ((yy + TOP) * W + xx) * 3;
          img[j] = img[j] * (1 - a) + RAIN_RGB[0] * a;
          img[j + 1] = img[j + 1] * (1 - a) + RAIN_RGB[1] * a;
          img[j + 2] = img[j + 2] * (1 - a) + RAIN_RGB[2] * a;
        }
      }
    }
  }
}

function rollRow(img, y, shift) { // like np.roll on one row
  const row = img.slice(y * W * 3, (y + 1) * W * 3);
  for (let x = 0; x < W; x++) {
    const src = (((x - shift) % W) + W) % W;
    img.set(row.subarray(src * 3, src * 3 + 3), (y * W + x) * 3);
  }
}
