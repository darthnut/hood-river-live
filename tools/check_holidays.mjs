// List a year's worth of lines under the clock, to compare with the board's holidays.py.
import { labels } from "../src/holidays.js";
import { hoodRiverTime } from "../src/sky.js";
const y = Number(process.argv[2] || 2026);
for (let d = Date.UTC(y, 0, 1); d < Date.UTC(y + 1, 0, 1); d += 86400e3) {
  const dt = new Date(d), ms = hoodRiverTime(y, dt.getUTCMonth() + 1, dt.getUTCDate(), 12);
  const l = labels(ms);
  if (l.length) console.log(`${y}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`, l.map(x => x[0]).join(", "));
}
