// Mock-up only: the current 256x64 frame with the sky extended upward, to compare taller aspect ratios.
//   node tools/mock_tall.mjs out.png
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { Scene } from "../src/scene.js";
import { hoodRiverTime } from "../src/sky.js";
import { W, H } from "../src/pix.js";
import { Rng } from "../src/rng.js";

const out = process.argv[2];
const data = JSON.parse(readFileSync(new URL("../assets/scene.json", import.meta.url)));
const wind = { speed: 18, gust: 24, dir: 270, cloud: 0, rain: 0, code: 0, snowfall: 0, snow_depth: 0, visibility: 24000, temp: 60, pm25: 0, live: true, compass: () => "W" };
const S = 3, GAP = 8;
const variants = [];
for (const at of [[13, 0], [22, 0]]) {
  const sc = new Scene(data, { eggRate: 0, log: () => {} });
  sc.fx.override = at[0] === 13 ? "partly" : "clear";
  let img;
  for (let k = 0; k < 30; k++) img = sc.render(60 + k * 0.05, 0.05, wind, hoodRiverTime(2026, 9, 26, ...at));
  for (const extra of [32, 64]) variants.push({ img, extra, night: at[0] === 22 });
}
const widths = variants.map(() => W * S), heights = variants.map(v => (H + v.extra) * S);
const sheetW = 2 * W * S + GAP, rowsH = [Math.max(heights[0], heights[1]), Math.max(heights[2], heights[3])];
const sheetH = rowsH[0] + rowsH[1] + GAP;
const sheet = new Uint8Array(sheetW * sheetH * 3).fill(24);
variants.forEach((v, n) => {
  const th = H + v.extra, tall = new Float32Array(W * th * 3), r = new Rng(3);
  const top = [v.img[0], v.img[1], v.img[2]]; // the current top-of-sky colour at x=0
  const zenith = v.night ? [0.01, 0.012, 0.04] : [0.08, 0.26, 0.6];
  for (let y = 0; y < th; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    if (y >= v.extra) { const j = ((y - v.extra) * W + x) * 3; tall[i] = v.img[j]; tall[i + 1] = v.img[j + 1]; tall[i + 2] = v.img[j + 2]; continue; }
    const f = y / v.extra;
    for (let k = 0; k < 3; k++) tall[i + k] = zenith[k] + (top[k] - zenith[k]) * f ** 0.8;
  }
  if (v.night) for (let s = 0; s < v.extra * 3; s++) { const x = r.integers(W), y = r.integers(v.extra), i = (y * W + x) * 3, b = r.uniform(0.3, 0.9); tall[i] = tall[i + 1] = b; tall[i + 2] = b * 0.95; }
  const ox = (n % 2) * (W * S + GAP), oy = n < 2 ? 0 : rowsH[0] + GAP;
  for (let yy = 0; yy < th * S; yy++) for (let xx = 0; xx < W * S; xx++) {
    const si = (Math.floor(yy / S) * W + Math.floor(xx / S)) * 3, di = ((oy + yy) * sheetW + ox + xx) * 3;
    for (let k = 0; k < 3; k++) sheet[di + k] = Math.max(0, Math.min(255, Math.round(tall[si + k] * 255)));
  }
});
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
const raw = Buffer.alloc((sheetW * 3 + 1) * sheetH);
for (let y = 0; y < sheetH; y++) Buffer.from(sheet.buffer, y * sheetW * 3, sheetW * 3).copy(raw, y * (sheetW * 3 + 1) + 1);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(sheetW, 0); ihdr.writeUInt32BE(sheetH, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(`wrote ${out}`);
