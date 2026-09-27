// Boot the scene and run it at 20 fps in the page.
// URL parameters, for testing: ?at=HH:MM  ?date=YYYY-MM-DD  ?speed=60  ?weather=rain  ?wind=25  ?egg=NAME
import { W, FULL_H } from "./pix.js";
import { Scene } from "./scene.js";
import { LiveWind, PRESETS } from "./weather.js";
import { hoodRiverTime, localParts } from "./sky.js";
import { ALL_EGGS } from "./eggs_all.js";
import { labels } from "./holidays.js";
import { loadSky } from "./skyfeeds.js";
import { EggShow, Planner } from "./show.js";

const FPS = 20;
const T0 = Date.UTC(2026, 0, 1) / 1000; // scene time counts from here, so every visitor's barge is in the same place

// What this visitor has changed: the clock, the weather, the wind, the egg show. Only their own view changes;
// the eggs that start by chance still start on the same second for everyone.
export class Controller {
  constructor(scene, liveWind, log) {
    this.scene = scene; this.log = log;
    this.live = true; this.base = 0; this.anchor = Date.now(); this.speed = 1;
    this.windMph = null; this.show = null; this.showStart = 0; this.rate = scene.eggs.rate;
    const ctl = this;
    this.wind = new Proxy(liveWind, { // the live reading, with this visitor's overrides on top
      get(o, k, receiver) {
        const src = ctl.show ? ctl.show.wind : o;
        if (ctl.windMph !== null && !ctl.show) {
          if (k === "speed") return ctl.windMph;
          if (k === "gust") return Math.round(ctl.windMph * 1.3);
          if (k === "dir") return 270;
        }
        const v = src[k];
        return typeof v === "function" ? v.bind(receiver) : v;
      },
    });
  }

  get weather() { return this.scene.fx.override; }
  get custom() { return !this.live || this.speed !== 1 || this.weather !== null || this.windMph !== null || !!this.show; }

  now(wall = Date.now()) {
    if (this.show) return this.show.now((wall - this.showStart) / 1000);
    return this.live ? wall : this.base + (wall - this.anchor) * this.speed;
  }

  setTime(ms) {
    if (Math.abs(ms - this.now()) > 20 * 60e3) this.clear(); // a moonrise doesn't belong at noon
    this.stopShow(); this.live = false; this.base = ms; this.anchor = Date.now();
  }
  clear() { this.scene.eggs.active = []; this.scene.eggs.pending = []; this.scene.liftRaise = 0; }
  setSpeed(s) { const n = this.now(); this.stopShow(); this.live = false; this.base = n; this.anchor = Date.now(); this.speed = s; }
  setWeather(name) { this.scene.fx.override = name && PRESETS[name] ? name : null; }
  setWind(mph) { this.windMph = mph === null ? null : Number(mph); }

  goLive() {
    if (!this.live || this.show) { this.clear(); this.scene.eggs.lastSecond = null; } // catch up on everyone's eggs
    this.stopShow(); this.live = true; this.speed = 1; this.windMph = null; this.setWeather(null);
  }

  // Start an egg now, or first move the clock (and the wind) to a time it plays well at.
  trigger(name, jump = false) {
    if (jump) {
      const w = new Planner(this.scene, Date.now()).when(name);
      if (w) {
        this.setTime(w[0]); this.speed = 1;
        if (this.weather === null) this.setWeather("clear");
        if (w[1] && this.wind.speed < 25) this.windMph = 30;
      }
    }
    this.scene.eggs.trigger(name);
  }

  startShow() {
    this.stopShow(); this.clear();
    this.show = new EggShow(this.scene, this.log, Date.now());
    this.showStart = Date.now();
    this.setWeather(null);
    this.scene.eggs.rate = 0; // nothing starts by chance mid-show
  }

  skipShow() { // clear the current egg away and move on
    const s = this.show;
    if (!s) return;
    this.scene.eggs.active = this.scene.eggs.active.filter(([e]) => e.name !== s.base);
    this.scene.liftRaise = 0;
    s.phase = "gap"; s.tPhase = -1e9;
  }

  stopShow() {
    if (!this.show) return;
    const at = this.show.at;
    this.show = null;
    this.scene.eggs.rate = this.rate;
    this.live = false; this.base = at; this.anchor = Date.now(); this.speed = 1;
  }
}

export async function start(canvas, { onStatus = () => {}, onLog = () => {} } = {}) {
  const data = await (await fetch(new URL("../assets/scene.json", import.meta.url))).json();
  loadSky(new URL("../assets/sky.json", import.meta.url));
  const q = new URLSearchParams(location.search);
  const log = m => { console.log(m); onLog(m); };
  const scene = new Scene(data, { eggClasses: ALL_EGGS, labels, log });
  const ctl = new Controller(scene, new LiveWind(), log);

  // Test overrides: a fixed start time, a clock speed, a weather preset, a steady wind from the west.
  if (q.get("at") || q.get("date")) {
    const today = localParts(Date.now());
    const [y, m, d] = (q.get("date") || `${today.year}-${today.month}-${today.day}`).split("-").map(Number);
    const [hh, mm] = (q.get("at") || `${today.hour}:${today.minute}`).split(":").map(Number);
    ctl.setTime(hoodRiverTime(y, m, d, hh, mm));
  }
  if (q.get("speed")) ctl.setSpeed(Number(q.get("speed")));
  ctl.setWeather(q.get("weather"));
  if (q.get("wind")) ctl.setWind(q.get("wind"));
  for (const name of (q.get("egg") || "").split(",").filter(Boolean)) ctl.trigger(name);

  const ctx = canvas.getContext("2d");
  const out = ctx.createImageData(W, FULL_H);
  let last = performance.now(), worst = 0, frames = 0;

  function frame() {
    const wall = Date.now();
    const t = wall / 1000 - T0;
    const nowMs = ctl.now(wall);
    ctl.shown = nowMs;
    const t0 = performance.now();
    const img = scene.render(t, 1 / FPS, ctl.wind, nowMs);
    const px = out.data;
    for (let i = 0, j = 0; i < img.length; i += 3, j += 4) {
      px[j] = img[i] * 255; px[j + 1] = img[i + 1] * 255; px[j + 2] = img[i + 2] * 255; px[j + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    worst = Math.max(worst, performance.now() - t0);
    if (++frames % (FPS * 5) === 0) {
      onStatus({ fps: frames / ((performance.now() - last) / 1000), worstMs: worst, live: ctl.wind.live });
      frames = 0; worst = 0; last = performance.now();
    }
  }
  frame();
  setInterval(frame, 1000 / FPS);
  window.gorge = { scene, ctl }; // for poking at it from the browser console
  return { scene, ctl };
}
