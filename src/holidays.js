// What's special about today, for the line under the clock. A port of the board's holidays.py, minus
// birthdays (those stay private). Major holidays always show; lesser days show because the scene has
// something for them; real sky events (meteor-shower peaks, eclipses, the Harvest Moon) show too.
import { localParts, hoodRiverTime } from "./sky.js";
import { easter, thanksgiving, nthWeekday } from "./calendar.js";
import { harvestDate } from "./eggs2.js";
import { lunarEclipseNear } from "./skymath.js";
import { activeShower, solarEclipseOn } from "./skycalc.js";

const RED = [255, 110, 100], GREEN = [120, 230, 130], GOLD = [255, 210, 90], PINK = [255, 140, 190],
  ORANGE = [255, 150, 60], BLUE = [140, 180, 255], WHITE = [235, 235, 240], VIOLET = [200, 150, 255], SKY = [170, 210, 255];

const key = ([y, m, d]) => `${y}-${m}-${d}`;

function fixed(y) {
  return new Map([
    [[y, 1, 1], ["NEW YEAR'S DAY", GOLD]], [nthWeekday(y, 1, 0, 3), ["MLK DAY", WHITE]],
    [[y, 2, 2], ["GROUNDHOG DAY", GOLD]], [[y, 2, 14], ["VALENTINE'S DAY", PINK]],
    [nthWeekday(y, 2, 0, 3), ["PRESIDENTS' DAY", BLUE]], [[y, 3, 14], ["PI DAY", SKY]],
    [[y, 3, 17], ["ST. PATRICK'S DAY", GREEN]], [[y, 4, 1], ["APRIL FOOLS' DAY", ORANGE]],
    [easter(y), ["EASTER", PINK]], [nthWeekday(y, 5, 6, 2), ["MOTHER'S DAY", PINK]],
    [nthWeekday(y, 5, 0, -1), ["MEMORIAL DAY", BLUE]], [nthWeekday(y, 6, 6, 3), ["FATHER'S DAY", BLUE]],
    [[y, 6, 19], ["JUNETEENTH", RED]], [[y, 7, 4], ["INDEPENDENCE DAY", RED]],
    [[y, 7, 20], ["MOON LANDING DAY", SKY]], [nthWeekday(y, 9, 0, 1), ["LABOR DAY", BLUE]],
    [[y, 9, 19], ["TALK LIKE A PIRATE DAY", GOLD]], [[y, 10, 31], ["HALLOWEEN", ORANGE]],
    [[y, 11, 11], ["VETERANS DAY", BLUE]], [thanksgiving(y), ["THANKSGIVING", ORANGE]],
    [[y, 12, 24], ["CHRISTMAS EVE", GREEN]], [[y, 12, 25], ["CHRISTMAS", RED]],
    [[y, 12, 31], ["NEW YEAR'S EVE", GOLD]], [harvestDate(y), ["HARVEST MOON TONIGHT", ORANGE]],
  ].map(([d, v]) => [key(d), v]));
}

function skyEvents(y, m, d) {
  const out = [], evening = hoodRiverTime(y, m, d, 21, 0);
  const s = activeShower(evening);
  if (s && s[1] >= 1) out.push([`${s[0].toUpperCase()} PEAK TONIGHT`, VIOLET]);
  const e = lunarEclipseNear(evening);
  if (e) {
    const shifted = localParts(e.max - 8 * 3600e3), at = localParts(e.max);
    if (shifted.year === y && shifted.month === m && shifted.day === d) {
      const sameDay = at.year === y && at.month === m && at.day === d;
      out.push([at.hour >= 8 || !sameDay ? "LUNAR ECLIPSE TONIGHT" : "LUNAR ECLIPSE", RED]);
    }
  }
  if (solarEclipseOn(y, m, d)) out.push(["SOLAR ECLIPSE TODAY", GOLD]);
  return out;
}

const cache = new Map();

// [[text, [r,g,b]], ...] for the Hood River date at `ms`.
export function labels(ms) {
  const n = localParts(ms), k = key([n.year, n.month, n.day]);
  if (!cache.has(k)) {
    const out = [];
    const hit = fixed(n.year).get(k);
    if (hit) out.push(hit);
    if (n.weekday === 4 && n.day === 13) out.push(["FRIDAY THE 13TH", VIOLET]);
    try { out.push(...skyEvents(n.year, n.month, n.day)); } catch (e) { /* the clock line is optional */ }
    if (cache.size > 60) cache.clear();
    cache.set(k, out);
  }
  return cache.get(k);
}
