// Run the scene for a physical 256x64 LED board: renders at the board's own size (no website sky) and sends
// each frame as DDP to a panel driver (the Pi's ledpanel program, or the ESP32 clock). Runs under Node 18+.
//
//   node tools/board.mjs [--square] [--host 127.0.0.1] [--fps 20] [--dir ~/gorge-board]
//   node tools/board.mjs --snap out.png [--at HH:MM] [--date YYYY-MM-DD] [--egg NAME] [--weather rain] [--seconds 3]
//
// --square is the 128x128 board (four 64x64 panels as 2x2), recomposed from assets/scene_square.json
// (tools/square_layout.mjs); without it, the 256x64 board.
//
// --dir holds the board's private files and its trigger files:
//   birthdays.json   [{"name": "Sam", "date": "06-22"}, ...]  (never part of the website)
//   egg.trigger      an egg name (or names, one per line) to play now; "show" plays every egg once, then
//                    returns to live; "live" stops a show and returns to the real time and weather
//   weather.trigger  a weather preset, or "live"
//   mode.trigger     "photos" plays the photo album instead of the scene, "live" goes back to the scene
//                    (remembered in the file "mode", so it survives a restart)
//   photos/*.rgb     the album: clips of raw WxH RGB frames at the board's frame rate, played in name order
//                    (made by the private led-matrix repo's tools/photo_album.py; never part of the website)
// Each trigger file is read and deleted within a second.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createSocket } from "node:dgram";
import { deflateSync } from "node:zlib";
import { homedir } from "node:os";
import { join } from "node:path";

globalThis.GORGE_TOP = 0; // the board's own frame: must be set before the scene modules load
const SQUARE = process.argv.includes("--square");
if (SQUARE) globalThis.GORGE_GEOM = { square: true };
const { W, H } = await import("../src/pix.js");
const { Scene } = await import("../src/scene.js");
const { LiveWind, PRESETS } = await import("../src/weather.js");
const { hoodRiverTime, localParts } = await import("../src/sky.js");
const { ALL_EGGS } = await import("../src/eggs_all.js");
const { Birthday } = await import("../src/eggs3.js");
const { labels } = await import("../src/holidays.js");
const { loadSky } = await import("../src/skyfeeds.js");
const { Controller } = await import("../src/main.js");

const args = { host: "127.0.0.1", port: 4048, fps: 20, dir: join(homedir(), "gorge-board"), seconds: 3, egg: [] };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i].replace(/^--/, ""), v = process.argv[i + 1];
  if (k === "egg") { args.egg.push(v); i++; } else if (k === "egg-show") args.eggShow = true;
  else if (k === "square") continue;
  else { args[k] = v; i++; }
}
const stamp = () => new Date().toTimeString().slice(0, 8);
const log = m => console.log(`${stamp()} ${m}`);

// ---- birthdays: names and the line under the clock, from the private file only
const PINK = [255, 140, 190];
let bdCache = { key: null, people: [] };
function birthdaysOn(month, day) {
  const key = `${month}-${day}-${Math.floor(Date.now() / 60e3)}`; // re-read once a minute, not every frame
  if (bdCache.key !== key) {
    let people = [];
    try { people = JSON.parse(readFileSync(join(args.dir, "birthdays.json"), "utf8")); } catch { /* none */ }
    const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    bdCache = { key, people: people.filter(p => p.date === mmdd).map(p => p.name) };
  }
  return bdCache.people;
}
Birthday.people = c => birthdaysOn(c.now.month, c.now.day);
const boardLabels = ms => {
  const n = localParts(ms);
  return [...birthdaysOn(n.month, n.day).map(name => [`${name.toUpperCase()}'S BIRTHDAY`, PINK]), ...labels(ms)];
};

// ---- the scene
const data = JSON.parse(readFileSync(new URL(SQUARE ? "../assets/scene_square.json" : "../assets/scene.json", import.meta.url)));
loadSky(args.sky || "https://darthnut.github.io/hood-river-live/assets/sky.json");
const scene = new Scene(data, { eggClasses: ALL_EGGS, labels: boardLabels, log, eggRate: args["egg-rate"] != null ? Number(args["egg-rate"]) : 1 });
scene.eggs.shared = false; // the board rolls its own dice, as it always has
const ctl = new Controller(scene, new LiveWind(), log);
if (args.at || args.date) {
  const t = localParts(Date.now());
  const [y, m, d] = (args.date || `${t.year}-${t.month}-${t.day}`).split("-").map(Number);
  const [hh, mm] = (args.at || `${t.hour}:${t.minute}`).split(":").map(Number);
  ctl.setTime(hoodRiverTime(y, m, d, hh, mm));
}
if (args.speed) ctl.setSpeed(Number(args.speed));
if (args.weather) ctl.setWeather(args.weather);
if (args.wind) ctl.setWind(args.wind);
for (const e of args.egg) ctl.trigger(e);
if (args.eggShow) ctl.startShow();

const T0 = Date.UTC(2026, 0, 1) / 1000;
const out = new Uint8Array(W * H * 3);
function render(wall, dt) {
  const img = scene.render(wall / 1000 - T0, dt, ctl.wind, ctl.now(wall));
  for (let i = 0; i < out.length; i++) { const v = img[i] * 255; out[i] = v <= 0 ? 0 : v >= 255 ? 255 : v + 0.5; }
  return out;
}

// ---- snapshot mode: a few seconds of frames, the last one written as a 4x PNG
if (args.snap) {
  const dt = 1 / Number(args.fps), n = Math.round(Number(args.seconds) * Number(args.fps));
  const wall0 = Date.now();
  for (let i = 0; i < n; i++) render(wall0 + i * dt * 1000, dt);
  writeFileSync(args.snap, png(out, W, H, 4));
  log(`wrote ${args.snap}`);
  process.exit(0);
}

// ---- trigger files
mkdirSync(args.dir, { recursive: true });
let showOnce = false, lastShowI = -1;
function readTrigger(name) {
  const p = join(args.dir, name);
  if (!existsSync(p)) return null;
  let s = "";
  try { s = readFileSync(p, "utf8"); unlinkSync(p); } catch { return null; }
  return s.split(/\s+/).map(x => x.trim().toLowerCase()).filter(Boolean);
}
// ---- photo mode: the album's clips in turn, each loaded ahead while the one before plays
let mode = "live";
try { mode = readFileSync(join(args.dir, "mode"), "utf8").trim() === "photos" ? "photos" : "live"; } catch { /* live */ }
const BLACK = new Uint8Array(W * H * 3);
const album = { i: -1, clip: null, f: 0, loading: false, ready: null, gen: 0 };
function albumLoad() { // read the next clip in the background; album.ready gets it (null if there is none)
  let files = [];
  try { files = readdirSync(join(args.dir, "photos")).filter(f => f.endsWith(".rgb")).sort(); } catch { /* none */ }
  if (!files.length) { album.ready = { b: null }; return; }
  album.i = (album.i + 1) % files.length;
  album.loading = true;
  const gen = album.gen;
  readFile(join(args.dir, "photos", files[album.i])).then(b => b, () => null).then(b => {
    if (gen !== album.gen) return; // the mode changed meanwhile
    album.loading = false; album.ready = { b: b && b.length >= out.length ? b : null };
  });
}
function photoFrame() { // a frame from the album, or null to show the scene
  if (!album.clip || album.f + out.length > album.clip.length) {
    if (!album.ready) {
      if (!album.loading) albumLoad();
      if (album.clip) return album.clip.subarray(album.clip.length - out.length); // hold the last frame
      return album.loading ? BLACK : null;
    }
    album.clip = album.ready.b; album.ready = null; album.f = 0;
    if (!album.clip) return null;
    albumLoad(); // the next clip loads while this one plays
  }
  const fr = album.clip.subarray(album.f, album.f + out.length);
  album.f += out.length;
  return fr;
}

setInterval(() => {
  const eggs = readTrigger("egg.trigger");
  for (const e of eggs || []) {
    if (e === "show") { ctl.startShow(); showOnce = true; lastShowI = -1; log("egg show: starting"); }
    else if (e === "live") { ctl.goLive(); showOnce = false; log("back to live"); }
    else ctl.trigger(e);
  }
  const wx = readTrigger("weather.trigger");
  if (wx && wx[0]) {
    if (wx[0] === "live") ctl.setWeather(null);
    else if (PRESETS[wx[0]]) ctl.setWeather(wx[0]);
    else log(`weather: unknown preset ${wx[0]}`);
    log(`weather: ${ctl.weather || "live"}`);
  }
  const md = readTrigger("mode.trigger");
  if (md && (md[0] === "photos" || md[0] === "live")) {
    mode = md[0]; Object.assign(album, { clip: null, loading: false, ready: null, gen: (album.gen || 0) + 1 });
    try { writeFileSync(join(args.dir, "mode"), mode); } catch { /* still switches */ }
    log(`mode: ${mode}`);
  }
  if (ctl.show && showOnce) { // a triggered show plays every egg once, then the board goes back to live
    if (ctl.show.i < lastShowI) { ctl.goLive(); showOnce = false; log("egg show: done, back to live"); }
    else lastShowI = ctl.show.i;
  }
}, 1000);

// ---- stream: whole frames as DDP, paced to the frame rate
const CHUNK = 1440, sock = createSocket("udp4");
let seq = 1;
function send(frame) {
  for (let off = 0; off < frame.length; off += CHUNK) {
    const len = Math.min(CHUNK, frame.length - off), last = off + len >= frame.length;
    const pkt = Buffer.alloc(10 + len);
    pkt[0] = last ? 0x41 : 0x40; pkt[1] = seq & 0x0f; pkt[2] = 0x0b; pkt[3] = 0x01;
    pkt.writeUInt32BE(off, 4); pkt.writeUInt16BE(len, 8);
    pkt.set(frame.subarray(off, off + len), 10);
    sock.send(pkt, Number(args.port), args.host);
  }
  seq = seq % 15 + 1;
}

const period = 1000 / Number(args.fps);
let next = performance.now(), stats = { n: 0, ms: 0, worst: 0, late: 0 }, statT = Date.now();
log(`streaming ${W}x${H} at ${args.fps} fps to ${args.host}:${args.port}; triggers in ${args.dir}`);
function tick() {
  const a = performance.now();
  const photo = mode === "photos" ? photoFrame() : null;
  send(photo || render(Date.now(), period / 1000));
  const ms = performance.now() - a;
  stats.n++; stats.ms += ms; stats.worst = Math.max(stats.worst, ms);
  next += period;
  let wait = next - performance.now();
  if (wait < -period * 5) { next = performance.now(); wait = 0; stats.late++; } // fell far behind: resync
  if (Date.now() - statT > 600e3) { // one line every 10 minutes keeps the SD card quiet
    log(`render avg ${(stats.ms / stats.n).toFixed(1)} ms, worst ${stats.worst.toFixed(0)} ms, resyncs ${stats.late}; wind ${ctl.wind.live ? "live" : "not yet"}`);
    stats = { n: 0, ms: 0, worst: 0, late: 0 }; statT = Date.now();
  }
  setTimeout(tick, Math.max(0, wait));
}
tick();

// ---- a tiny PNG writer for --snap
function png(rgb, w, h, s) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const W2 = w * s, H2 = h * s, raw = Buffer.alloc((W2 * 3 + 1) * H2);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const si = (Math.floor(y / s) * w + Math.floor(x / s)) * 3, di = y * (W2 * 3 + 1) + 1 + x * 3;
    raw[di] = rgb[si]; raw[di + 1] = rgb[si + 1]; raw[di + 2] = rgb[si + 2];
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W2, 0); ihdr.writeUInt32BE(H2, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
