// Render eggs at chosen moments to a PNG contact sheet, from the command line (Node 18+).
//   node tools/moments.mjs out.png "osprey@14:00@5" "ufo@2026-10-31 22:00@8" ...
// Mirrors the board's egg_moments.py: a steady 28 mph west wind, the clock held at the chosen time.
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { Scene } from "../src/scene.js";
import { ALL_EGGS } from "../src/eggs_all.js";
import { hoodRiverTime } from "../src/sky.js";
import { W, H, text } from "../src/pix.js";
import { setSky } from "../src/skyfeeds.js";

const [out, ...specs] = process.argv.slice(2);
const data = JSON.parse(readFileSync(new URL("../assets/scene.json", import.meta.url)));
try { setSky(JSON.parse(readFileSync(new URL("../assets/sky.json", import.meta.url)))); } catch (e) { /* no live sky data */ }
const wind = { speed: 28, gust: 36, dir: 270, cloud: 0, rain: 0, code: 0, snowfall: 0, snow_depth: 0,
  visibility: 24000, temp: 60, pm25: 0, live: true, compass: () => "W" };

const S = 3, LABEL = 8, TW = W * S, TH = H * S + LABEL * S, GAP = 6, COLS = 2;
const rows = Math.ceil(specs.length / COLS);
const sheetW = COLS * TW + (COLS - 1) * GAP, sheetH = rows * TH + (rows - 1) * GAP;
const sheet = new Uint8Array(sheetW * sheetH * 3).fill(24);
const logs = [];

specs.forEach((spec, n) => {
  const [name, at, age] = spec.split("@");
  const [datePart, timePart] = at.includes(" ") ? at.split(" ") : ["2026-09-26", at];
  const [y, m, d] = datePart.split("-").map(Number), [hh, mm] = timePart.split(":").map(Number);
  const now = hoodRiverTime(y, m, d, hh, mm);
  const sc = new Scene(data, { eggClasses: ALL_EGGS, eggRate: 0, log: s => logs.push(s) });
  sc.eggs.shared = false;
  let t = 60, img;
  for (let k = 0; k < 20; k++, t += 0.05) sc.render(t, 0.05, wind, now);
  sc.eggs.trigger(name);
  const start = t;
  do { img = sc.render(t, 0.05, wind, now); t += 0.05; } while (t - start < Number(age));
  // label strip, drawn with the scene's own font
  const lab = new Float32Array(W * LABEL * 3).fill(0.09);
  text(lab, 1, 1, `${name} ${at} +${age}S`.slice(0, 60), [0.9, 0.9, 0.9], 1);
  const ox = (n % COLS) * (TW + GAP), oy = Math.floor(n / COLS) * (TH + GAP);
  const put = (src, h, y0) => {
    for (let yy = 0; yy < h * S; yy++) for (let xx = 0; xx < TW; xx++) {
      const si = (Math.floor(yy / S) * W + Math.floor(xx / S)) * 3, di = ((oy + y0 + yy) * sheetW + ox + xx) * 3;
      for (let k = 0; k < 3; k++) sheet[di + k] = Math.max(0, Math.min(255, Math.round(src[si + k] * 255)));
    }
  };
  put(lab, LABEL, 0);
  put(img, H, LABEL * S);
});

// minimal PNG writer
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc((sheetW * 3 + 1) * sheetH);
for (let y = 0; y < sheetH; y++) {
  raw[y * (sheetW * 3 + 1)] = 0;
  Buffer.from(sheet.buffer, y * sheetW * 3, sheetW * 3).copy(raw, y * (sheetW * 3 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(sheetW, 0); ihdr.writeUInt32BE(sheetH, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
for (const l of logs) if (!l.includes("triggered")) console.log(l);
console.log(`wrote ${out}`);
