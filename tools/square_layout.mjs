// The static layout for the square LED board (128x128: four 64x64 panels as 2x2), written to
// assets/scene_square.json. The same view as the 256x64 board's town (led-matrix tools/town.py, exported to
// assets/scene.json), recomposed for a square: every landmark sits at half its old x, the sky is more than
// twice as tall and Mt. Hood is drawn much bigger in it. The website never loads this file.
//
//   node tools/square_layout.mjs
import { writeFileSync } from "node:fs";

globalThis.GORGE_GEOM = { square: true };
const { W, H, HORIZON, rx, ry } = await import("../src/pix.js");
const { Rng } = await import("../src/rng.js");

const [FAR_EAST, FAR_WEST, ORCHARD, ORCHARD_ROW, BLUFF, ROCKS, FREEWAY, LAWN, SAND, RAIL,
  BRICK, CREAM, WHITE, SLATE, ROOF, TREE, STEEPLE, INN] = Array.from({ length: 18 }, (_, i) => i + 1);
const ROW_TOWN_BASE = HORIZON - 5, ROW_RAIL = HORIZON - 4, ROW_FREEWAY = HORIZON - 2, ROW_SHORE = HORIZON - 1;
const SHORE_R = Math.round(rx(232));

// Smooth periodic 1-D noise in [-1, 1], length n (tools/pix.py value_noise).
function valueNoise(n, cells, rng) {
  const pts = Array.from({ length: cells }, () => rng.uniform(-1, 1));
  return Array.from({ length: n }, (_, k) => {
    const x = k * cells / n, i = Math.floor(x);
    let f = x - i; f = f * f * (3 - 2 * f);
    return pts[i % cells] * (1 - f) + pts[(i + 1) % cells] * f;
  });
}
const interp = (x, xs, ys) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[ys.length - 1];
};

// ---------------------------------------------------------------- Mt. Hood
// town.py's north-face profile, scaled up: MH across and MV down per pixel of the old drawing.
const PEAK_X = 75, SUMMIT_Y = 27, MH = 1.2, MV = 1.4;
function slope(d, segments) {
  let y = 0;
  for (const [run, s] of segments) {
    const step = Math.min(d, run);
    y += step * s; d -= step;
    if (d <= 0) break;
  }
  return y + Math.max(0, d) * segments[segments.length - 1][1];
}
function mountainTop(dx, ridge) { // in the old drawing's pixels, summit at row 3
  let drop;
  if (dx < 0) drop = slope(-dx, [[2, 0.12], [3, 0.5], [8, 0.85], [40, 0.42]]);
  else {
    drop = slope(dx, [[2, 0.12], [2, 0.55], [3, 1.0], [10, 0.5], [10, 0.12], [16, 0.38], [40, 0.18]]);
    drop -= 0.8 * Math.max(0, Math.sin(dx * 0.45)) * (dx > 36 ? 1 : 0);
  }
  return 3 + drop + ridge * 0.35;
}
const snowline = (dx, snow, gully) => 13 + (dx > 0 ? 0.12 * dx : 0.18 * -dx) + snow * 1.8 + 5 * Math.max(0, gully);
function isSnow(x, dx, y, top, line) {
  const theta = Math.atan2(dx, y - 1.5);
  const rib = Math.sin(theta * 7 + 0.7 + 0.9 * Math.sin(y * 0.55)) > 0.93 && top + 2 < y && y < line - 1;
  if (y < line) return !rib;
  const h = ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663)) & 0xffff;
  return dx > 12 && y < line + 4 && h < 0.22 * 0xffff;
}
const eastFacing = (dx, y, ridge) => dx < (y - 3) * 0.55 + 1.2 * Math.sin(y * 0.8) + ridge * 0.5;

const rng = new Rng(11);
const mtnMat = new Uint8Array(W * HORIZON), mtnEast = new Uint8Array(W * HORIZON);
{
  const mr = new Rng(7);
  const ridge = valueNoise(W, 30, mr).map((v, i) => 1.6 * v + 0.8 * valueNoise(W, 75, mr)[i]);
  const snow = valueNoise(W, 9, mr), gullies = valueNoise(W, 45, mr);
  for (let x = 0; x < W; x++) {
    const dx = (x - PEAK_X) / MH;                 // in the old drawing's columns
    const top = mountainTop(dx, ridge[x]), line = snowline(dx, snow[x], gullies[x]);
    for (let y = Math.max(0, Math.round(SUMMIT_Y + (top - 3) * MV)); y < HORIZON; y++) {
      const yo = 3 + (y - SUMMIT_Y) / MV;          // the old drawing's row
      mtnMat[y * W + x] = isSnow(PEAK_X + dx, dx, yo, top, line) ? 2 : 1;
      mtnEast[y * W + x] = eastFacing(dx, yo, ridge[x]) ? 1 : 0;
    }
  }
}
let summitY = 0;
while (summitY < HORIZON && !mtnMat[summitY * W + PEAK_X]) summitY++;

// ---------------------------------------------------------------- the land, as material codes
const land = new Uint8Array(W * HORIZON);
const set = (x, y, code) => { if (x >= 0 && x < W && y >= 0 && y < HORIZON) land[y * W + x] = code; };
const fill = (x, top, code, bottom = HORIZON) => { for (let y = Math.max(0, Math.round(top)); y < bottom; y++) set(x, y, code); };
const xs = Array.from({ length: W }, (_, x) => x), old = x => x / rx(1); // a column in the old board's x

// far ridges: Mosier to the east, the valley opening under Hood, Mt. Defiance to the west
const n1 = valueNoise(W, 20, rng), n2 = valueNoise(W, 60, rng);
const ridge = xs.map(x => ry(interp(old(x), [0, 40, 85, 110, 150, 190, 215, 235, 256], [24, 23, 24, 25, 26, 25, 20, 17, 16])) + 2.0 * n1[x] + 0.8 * n2[x]);
for (const x of xs) fill(x, ridge[x], old(x) < 150 ? FAR_EAST : FAR_WEST);

// orchard slopes of the Hood River Valley behind town, in rows
const n3 = valueNoise(W, 15, rng);
const orch = xs.map(x => ry(interp(old(x), [60, 92, 150, 205, 240], [31, 26, 23.5, 24.5, 30])) + 1.4 * n3[x]);
for (let x = Math.round(rx(60)); x < Math.round(rx(240)); x++) {
  for (let y = Math.round(orch[x]); y < HORIZON; y++) set(x, y, y % 2 === 0 && (x + y) % 3 === 0 ? ORCHARD_ROW : ORCHARD);
}

// town: buildings stepping up the hill, densest downtown near the water
const windows = [], buildings = [];
const TOWN_X = rx(150), clip = (v, a, b) => Math.max(a, Math.min(b, v));
for (let i = 0; i < 200; i++) {
  const x = Math.trunc(clip(rng.normal(TOWN_X, 17), rx(90), rx(226)));
  const up = (Math.abs(rng.normal(0, 3.6)) + Math.abs(x - TOWN_X) / 18) * 1.05; // how far up the hill
  const bottom = Math.trunc(clip(ROW_TOWN_BASE - up, orch[x] + 1, ROW_TOWN_BASE));
  const downtown = Math.abs(x - TOWN_X) < 14 && bottom >= ROW_TOWN_BASE - 2;
  const bw = rng.integers(2, downtown ? 5 : 4), bh = rng.integers(2, downtown ? 6 : 4);
  const code = downtown ? [BRICK, CREAM, WHITE, SLATE][rng.integers(4)] : [CREAM, WHITE, SLATE, WHITE][rng.integers(4)];
  buildings.push([bottom, x, bw, bh, code, !downtown]);
}
buildings.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // higher up (further) first
for (const [bottom, x, bw, bh, code, roofed] of buildings) {
  for (let yy = bottom - bh + 1; yy <= bottom; yy++) for (let xx = x; xx < Math.min(W, x + bw); xx++) set(xx, yy, code);
  if (roofed) for (let xx = x; xx < Math.min(W, x + bw); xx++) set(xx, bottom - bh, ROOF);
  for (let k = 0; k < Math.trunc(bw * bh / 6) + (rng.random() < 0.6 ? 1 : 0); k++) windows.push([x + rng.integers(bw), bottom - rng.integers(bh), rng.random()]);
}
for (let i = 0; i < 70; i++) { // street trees and yards
  const x = Math.trunc(clip(rng.normal(TOWN_X, 20), rx(88), rx(228)));
  set(x, Math.trunc(rng.uniform(orch[x] + 1, ROW_TOWN_BASE + 1)), TREE);
}
const STEEPLE_X = Math.round(rx(140));
for (let y = ROW_TOWN_BASE - 10; y < ROW_TOWN_BASE - 3; y++) set(STEEPLE_X, y, STEEPLE); // church steeple
for (let y = ROW_TOWN_BASE - 3; y <= ROW_TOWN_BASE; y++) for (let x = STEEPLE_X - 1; x <= STEEPLE_X + 1; x++) set(x, y, WHITE);

// rail bed, freeway and the rocky shore run the full width, east under the bridge too
for (let x = 0; x < SHORE_R; x++) {
  set(x, ROW_RAIL, RAIL); set(x, ROW_RAIL + 1, RAIL); set(x, ROW_FREEWAY, FREEWAY); set(x, ROW_SHORE, ROCKS);
}
const span = (a, b, row, code) => { for (let x = Math.round(rx(a)); x < Math.round(rx(b)); x++) set(x, row, code); };
span(116, 134, ROW_SHORE, LAWN);        // Event Site
span(137, 178, ROW_SHORE, SAND);        // sandbar at the river mouth
span(180, 200, ROW_SHORE, LAWN);        // Waterfront Park
span(134, 137, ROW_SHORE, 0);           // the Hood River itself (shows as water)
for (let y = ROW_SHORE - 3; y <= ROW_SHORE; y++) span(84, 96, y, INN); // Hood River Inn at the bridgehead
span(84, 96, ROW_SHORE - 4, ROOF);
for (let x = Math.round(rx(200)); x < Math.round(rx(230)); x += 4) { // port buildings
  for (const y of [ROW_SHORE - 1, ROW_SHORE]) for (let k = 0; k < 3; k++) set(x + k, y, SLATE);
}
for (const x of [184, 190, 196]) set(Math.round(rx(x)), ROW_SHORE - 1, TREE); // park trees

// the bluff closing the west edge, down to the water
const n4 = valueNoise(W, 25, rng);
for (let x = Math.round(rx(228)); x < W; x++) fill(x, ry(interp(old(x), [228, 256], [34, 17])) + 1.2 * n4[x], BLUFF);

const cars = Array.from({ length: 12 }, () => [rng.uniform(0, 1), rng.choice([-1, 1]), rng.uniform(0.8, 1.2)]);
const bridgeCars = Array.from({ length: 4 }, () => rng.uniform(0, 1));
const masts = [101, 104, 107, 110, 113].map(x => Math.round(rx(x)));

// ---------------------------------------------------------------- sky and water fields
const sr = new Rng(13);
const stars = Array.from({ length: 120 }, () => [sr.integers(W), sr.integers(0, Math.round(ry(16))), sr.uniform(0, 6.28), sr.uniform(0.8, 2.5)]);
const field = (rows, r) => { const a = new Uint16Array(rows * 512); for (let i = 0; i < a.length; i++) a[i] = Math.round(r.random() * 65535); return a; };
const wr = new Rng(17);
const caps = field(H - HORIZON, wr), glints = field(H - HORIZON, wr);
const fr = new Rng(5);
let fog = Float32Array.from({ length: H * 512 }, () => fr.random());
for (let pass = 0; pass < 3; pass++) { // soften into wisps
  const f2 = new Float32Array(fog.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < 512; x++) {
    const g = k => fog[y * 512 + ((x + k + 512) % 512)];
    f2[y * 512 + x] = (g(0) + g(1) + g(-1) + g(3) + g(-3)) / 5;
  }
  fog = f2;
}
let lo = Infinity, hi = -Infinity;
for (const v of fog) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
const fogTex = Uint8Array.from(fog, v => Math.round((v - lo) / (hi - lo + 1e-6) * 255));

const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const data = {
  horizon: HORIZON, w: W, h: H,
  land: b64(land), mtn_mat: b64(mtnMat), mtn_east: b64(mtnEast),
  summit: [PEAK_X, summitY], windows, stars,
  caps: b64(caps), glints: b64(glints), fog_tex: b64(fogTex),
  cars, bridge_cars: bridgeCars, masts,
};
const out = new URL("../assets/scene_square.json", import.meta.url);
writeFileSync(out, JSON.stringify(data));
console.log(`wrote assets/scene_square.json: summit ${data.summit}, ${windows.length} windows`);
