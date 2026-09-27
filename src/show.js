// The egg show (every egg in turn through one sped-up day and night) and the planner behind "jump to a
// suitable time" in the controls. A port of the board's eggshow.py; times are UTC ms, dates Hood River's.
import { W, HORIZON } from "./pix.js";
import { skyState, localParts, hoodRiverTime } from "./sky.js";
import { easter, thanksgiving } from "./calendar.js";
import { harvestDate } from "./eggs2.js";
import { landTop } from "./eggs.js";
import { Scene } from "./scene.js";

const MOVE_S = 4, GAP_S = 1.5, CAP_S = 22, MAX_S = 90, RETRY_S = 120;
export const WINDY = new Set(["catapult", "kitecrash", "megajump", "paddleboard", "bigcat", "loosekite"]);

function friday13(y) { // the first Friday the 13th of the year
  for (let m = 1; m <= 12; m++) if (new Date(Date.UTC(y, m - 1, 13)).getUTCDay() === 5) return [y, m, 13];
  return [y, 1, 13];
}
const on = (m, d) => y => [y, m, d];

// [egg, local time or "sunset+N" (minutes after the sun meets the western ridge), date rule or null for today]
export const PROGRAM = [
  ["balloons", "06:40"], ["heron", "06:50"], ["pelicans", "07:05", on(7, 15)], ["geese", "07:20"], ["elk", "07:50"],
  ["osprey-right", "08:20"], ["solareclipse", "08:36", () => [2029, 1, 14]], ["sealion", "08:50"], ["lenticular", "09:05"],
  ["spiderclock", "09:10"], ["ducks", "09:15"], ["beaver", "09:25"], ["supdog", "09:28"], ["lograft", "09:32"], ["bottle", "09:40"],
  ["salmon", "10:00"], ["icefloes", "10:05", on(1, 15)], ["damrainbow", "10:10", on(5, 15)], ["sundogs", "10:12", on(1, 10)],
  ["floatplane", "10:14"], ["ducklings", "10:16", on(5, 20)], ["sturgeon", "10:20"], ["salmonrun", "10:45", on(9, 15)],
  ["pears", "10:52", on(9, 20)], ["snowday", "10:56", on(1, 20)], ["snowman", "10:57", on(1, 20)], ["driftboat", "10:59"],
  ["blossom", "11:00", on(4, 15)], ["wish", "11:11"], ["paperplane", "11:20"], ["valentine", "11:30", on(2, 14)],
  ["stpatrick", "11:45", on(3, 17)], ["easter", "12:00", easter], ["groundhog", "12:05", on(2, 2)], ["thanksgiving", "12:10", thanksgiving],
  ["aprilfools", "12:15", on(4, 1)], ["paragliders", "12:20"], ["catapult", "12:35"], ["kitecrash", "12:45"], ["loosekite", "12:50"],
  ["megajump", "12:55"], ["paddleboard", "13:00"], ["hydroplanes", "13:05"], ["bigfoot", "13:10"], ["steam", "13:15"],
  ["steamtrain", "13:30"], ["sternwheeler", "13:45"], ["pirates", "13:52"], ["tallship-lift", "14:00"], ["osprey-eagle", "14:30"],
  ["osprey-left", "14:45"], ["shark", "15:00"], ["bigcat", "15:10"], ["piday", "15:14", on(3, 14)], ["humpback", "15:20"],
  ["claude", "15:40"], ["kraken", "16:00"], ["rainbow", "16:30"], ["godrays", "16:35"], ["race", "16:40"], ["canoes", "16:45", on(10, 10)],
  ["fallcolor", "17:00", on(10, 15)], ["blackcat", "17:05", friday13], ["whale", "17:20"], ["dragon", "17:30"], ["spider", "17:40"],
  ["burp", "17:50"], ["bigspider", "18:00"], ["timemachine", "18:05"], ["greenflash", "sunset+0"], ["alpenglow", "sunset+5"],
  ["contrails", "sunset+10"], ["sasquatch", "sunset+20"], ["bats", "sunset+35"], ["harvestmoon", "sunset+75", harvestDate],
  ["nlc", "21:45", on(6, 30)], ["fair", "21:55", on(7, 27)], ["moonbow", "21:58"], ["starlink", "22:00"], ["iss", "22:05"],
  ["planets", "22:10"], ["moonpair", "22:12"], ["comet", "22:15"], ["birthday", "22:20"], ["fireworks", "22:25", on(7, 4)],
  ["halloween", "22:35", on(10, 31)], ["christmas", "22:40", on(12, 24)], ["holidaylights", "22:50", on(12, 22)],
  ["trainlights", "22:52", on(12, 10)], ["satellites", "23:00"], ["moonlanding", "23:05", on(7, 20)], ["meteor", "23:20"],
  ["shower", "23:30", on(8, 12)], ["eclipse", "23:40"], ["countdown", "23:59", on(12, 31)], ["ufo", "00:30"], ["aurora", "01:30"],
  ["climbers", "02:30", on(6, 1)],
];

const smooth = p => { p = Math.min(1, Math.max(0, p)); return p * p * (3 - 2 * p); };

// When an egg would play: the UTC ms of its time slot, with today (Hood River) as the reference day.
export class Planner {
  constructor(scene, todayMs) { this.scene = scene; const n = localParts(todayMs); this.today = [n.year, n.month, n.day]; }

  sunset([y, m, d]) { // the sun's disc meets the western ridge in this view (as the green flash wants it)
    let t = hoodRiverTime(y, m, d, 15, 0);
    for (let i = 0; i < 7 * 60; i++, t += 60e3) {
      const { elev, ha } = skyState(t), [sx, sy] = Scene.arc(ha, elev);
      if (sx >= 0 && sx < W) { if (sy - 5.5 > (landTop(this.scene, sx) ?? HORIZON) - 1.5) return t; }
      else if (elev < 0.5) return t;
    }
    return t;
  }

  target([, when, rule]) {
    const day = rule ? rule(this.today[0]) : this.today;
    if (when.startsWith("sunset")) return this.sunset(day) + Number(when.split("+")[1]) * 60e3;
    const [hh, mm] = when.split(":").map(Number);
    const t = hoodRiverTime(day[0], day[1], day[2], hh, mm);
    return hh < 5 ? t + 86400e3 : t; // after midnight belongs to the next calendar day
  }

  // [time, needs wind] for an egg name ("osprey" matches its first variant), or null.
  when(name) {
    const item = PROGRAM.find(p => p[0] === name || (p[0].split("-")[0] === name && !name.includes("-")));
    return item ? [this.target(item), WINDY.has(item[0].split("-")[0])] : null;
  }
}

export class EggShow {
  constructor(scene, log = console.log, todayMs = Date.now()) {
    this.scene = scene; this.log = log;
    this.planner = new Planner(scene, todayMs);
    this.program = PROGRAM.filter(p => scene.eggs.eggs[p[0].split("-")[0]]);
    this.wind = { speed: 18, gust: 23, dir: 270, cloud: 0, rain: 0, code: 0, snowfall: 0, snow_depth: 0,
      visibility: 24000, temp: 60, pm25: 0, live: true, demo: true, compass: () => "W" };
    this.i = -1;
    this.at = this.planner.target(this.program[this.program.length - 1]); // so the first move is a dawn
    this.nextItem(0);
  }

  nextItem(elapsed) {
    this.i = (this.i + 1) % this.program.length;
    this.name = this.program[this.i][0];
    this.base = this.name.split("-")[0];
    this.src = this.at;
    this.dst = this.planner.target(this.program[this.i]);
    this.phase = "move"; this.tPhase = elapsed; this.tTry = null;
  }

  active() { return this.scene.eggs.active.some(([e]) => e.name === this.base); }

  // Advance the show; returns the scene time (UTC ms) for this frame. `elapsed` is seconds.
  now(elapsed) {
    const age = elapsed - this.tPhase;
    if (this.phase === "move") { // a time-lapse from the last time of day to the next, landing on its date
      const s = localParts(this.src), d = localParts(this.dst);
      const m0 = s.hour * 60 + s.minute + s.second / 60;
      let m1 = d.hour * 60 + d.minute;
      if (m1 < m0) m1 += 24 * 60;
      const p = Math.abs(m1 - m0) > 1 ? smooth(age / MOVE_S) : 1;
      const day0 = hoodRiverTime(d.year, d.month, d.day, 0, 0), m = m0 + (m1 - m0) * p;
      this.at = day0 + (m - (m1 >= 24 * 60 ? 24 * 60 : 0)) * 60e3;
      this.wind.speed = WINDY.has(this.base) ? 30 : 18;
      this.wind.gust = this.wind.speed * 1.3;
      if (age >= MOVE_S || p >= 1) { this.arrived = elapsed; this.phase = "start"; this.tPhase = elapsed; }
      return this.at;
    }
    this.at = this.dst + (elapsed - this.arrived) * 1000; // the clock ticks normally meanwhile
    if (this.phase === "start") {
      if (this.tTry === null) { this.scene.eggs.trigger(this.name); this.tTry = elapsed; }
      else if (this.active()) { this.phase = "run"; this.tPhase = this.tTry; }
      else if (elapsed - this.tTry >= 1) { // it had nothing to act on yet; try again shortly
        if (age > RETRY_S) { this.log(`egg show: ${this.name} had nothing to act on; skipping`); this.phase = "gap"; this.tPhase = elapsed; }
        else { this.scene.eggs.trigger(this.name); this.tTry = elapsed; }
      }
    } else if (this.phase === "run") {
      const egg = this.scene.eggs.eggs[this.base], cap = egg.duration >= 300 ? CAP_S : MAX_S;
      if (!this.active()) { this.phase = "gap"; this.tPhase = elapsed; }
      else if (age > cap) { // a long decoration: long enough, clear it away
        this.scene.eggs.active = this.scene.eggs.active.filter(([e]) => e.name !== this.base);
        this.scene.liftRaise = 0;
        this.phase = "gap"; this.tPhase = elapsed;
      }
    } else if (this.phase === "gap" && age >= GAP_S) this.nextItem(elapsed);
    return this.at;
  }
}
