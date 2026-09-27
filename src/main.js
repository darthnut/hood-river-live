// Boot the scene and run it at 20 fps in the page.
// URL parameters, for testing: ?at=HH:MM  ?date=YYYY-MM-DD  ?speed=60  ?weather=rain  ?wind=25  ?egg=NAME
import { W, H } from "./pix.js";
import { Scene } from "./scene.js";
import { LiveWind, PRESETS } from "./weather.js";
import { hoodRiverTime, localParts } from "./sky.js";
import { ALL_EGGS } from "./eggs_all.js";
import { labels } from "./holidays.js";

const FPS = 20;
const T0 = Date.UTC(2026, 0, 1) / 1000; // scene time counts from here, so every visitor's barge is in the same place

export async function start(canvas, { onStatus = () => {} } = {}) {
  const data = await (await fetch(new URL("../assets/scene.json", import.meta.url))).json();
  const q = new URLSearchParams(location.search);
  const scene = new Scene(data, { eggClasses: ALL_EGGS, labels, log: m => console.log(m) });
  const fixedWind = q.get("wind");
  const wind = fixedWind ? { // a steady test wind from the west, in place of the live reading
    speed: Number(fixedWind), gust: Number(fixedWind) * 1.3, dir: 270, cloud: 0, rain: 0, code: 0, snowfall: 0,
    snow_depth: 0, visibility: 24000, temp: 60, pm25: 0, live: true, compass: () => "W",
  } : new LiveWind();

  // Test overrides: a fixed start time, a clock speed, a weather preset, a demo wind.
  let clock0 = null;
  if (q.get("at") || q.get("date")) {
    const today = localParts(Date.now());
    const [y, m, d] = (q.get("date") || `${today.year}-${today.month}-${today.day}`).split("-").map(Number);
    const [hh, mm] = (q.get("at") || `${today.hour}:${today.minute}`).split(":").map(Number);
    clock0 = hoodRiverTime(y, m, d, hh, mm);
  }
  const speed = Number(q.get("speed") || 1);
  const weather = q.get("weather");
  if (weather && PRESETS[weather]) scene.fx.override = weather;
  for (const name of (q.get("egg") || "").split(",").filter(Boolean)) scene.eggs.trigger(name);

  const ctx = canvas.getContext("2d");
  const out = ctx.createImageData(W, H);
  const started = Date.now();
  let last = performance.now(), worst = 0, frames = 0;

  function frame() {
    const wall = Date.now();
    const t = wall / 1000 - T0;
    const nowMs = clock0 === null ? wall + (wall - started) * (speed - 1) : clock0 + (wall - started) * speed;
    const t0 = performance.now();
    const img = scene.render(t, 1 / FPS, wind, nowMs);
    const px = out.data;
    for (let i = 0, j = 0; i < img.length; i += 3, j += 4) {
      px[j] = img[i] * 255; px[j + 1] = img[i + 1] * 255; px[j + 2] = img[i + 2] * 255; px[j + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    worst = Math.max(worst, performance.now() - t0);
    if (++frames % (FPS * 5) === 0) {
      onStatus({ fps: frames / ((performance.now() - last) / 1000), worstMs: worst, live: wind.live });
      frames = 0; worst = 0; last = performance.now();
    }
  }
  frame();
  setInterval(frame, 1000 / FPS);
  return { scene, wind };
}
