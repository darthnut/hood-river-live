// Soak test: run the scene with shared eggs at a high rate across times of day, weather and special
// dates; report exceptions, which eggs ran, and frame times.   node tools/soak.mjs
import { readFileSync } from "node:fs";
import { Scene } from "../src/scene.js";
import { ALL_EGGS } from "../src/eggs_all.js";
import { hoodRiverTime } from "../src/sky.js";
import { setSky } from "../src/skyfeeds.js";

const data = JSON.parse(readFileSync(new URL("../assets/scene.json", import.meta.url)));
try { setSky(JSON.parse(readFileSync(new URL("../assets/sky.json", import.meta.url)))); } catch (e) { /* no live sky data */ }
const dates = [[2026, 9, 26], [2026, 7, 4], [2026, 10, 31], [2026, 12, 24], [2026, 12, 31], [2026, 2, 14], [2026, 3, 14],
  [2026, 4, 1], [2026, 4, 5], [2026, 11, 13], [2026, 8, 12], [2026, 1, 20], [2026, 6, 30]];
const weathers = [null, "rain", "snow", "fog", "thunderstorm", "partly"];
const seen = new Set(), errors = new Map();
let worst = 0, total = 0, frames = 0;

for (const [y, m, d] of dates) {
  for (let hour = 0; hour < 24; hour += 2) {
    const wx = weathers[(hour / 2 + d) % weathers.length];
    const wind = { speed: 8 + (hour * 3) % 30, gust: 30, dir: 270, cloud: 40, rain: 0, code: 0, snowfall: 0, snow_depth: 0,
      visibility: 24000, temp: m === 1 ? 20 : 60, pm25: 0, live: true, compass: () => "W" };
    const sc = new Scene(data, { eggClasses: ALL_EGGS, eggRate: 100, log: s => { const n = s.match(/egg: (\w+)/); if (n) seen.add(n[1]); } });
    sc.fx.override = wx;
    const t0 = (hoodRiverTime(y, m, d, hour, 0) / 1000) - Date.UTC(2026, 0, 1) / 1000;
    for (let k = 0; k < 600; k++) { // 30 s of scene time
      const t = t0 + k * 0.05, now = hoodRiverTime(y, m, d, hour, 0) + k * 50;
      const a = performance.now();
      try { sc.render(t, 0.05, wind, now); }
      catch (e) {
        const key = `${e.message} @ ${(e.stack || "").split("\n")[1]?.trim()}`;
        errors.set(key, (errors.get(key) || 0) + 1);
      }
      const ms = performance.now() - a;
      worst = Math.max(worst, ms); total += ms; frames++;
    }
  }
}
console.log(`${frames} frames, avg ${(total / frames).toFixed(2)} ms, worst ${worst.toFixed(1)} ms`);
console.log(`${seen.size} of ${ALL_EGGS.length} eggs started on their own`);
console.log("never started:", ALL_EGGS.map(E => E.egg).filter(n => !seen.has(n)).join(", "));
for (const [k, v] of errors) console.log(`ERROR x${v}: ${k}`);
if (!errors.size) console.log("no errors");
