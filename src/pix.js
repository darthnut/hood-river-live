// Shared pixel helpers. An image is a Float32Array of W*rows*3 floats in [0, 1], row-major RGB.
//
// The board is 256x64. The website adds TOP rows of sky above that frame (256x96 in all). The scene and
// the eggs keep drawing in the board's coordinates on a "view" of the bottom 64 rows, so everything
// calibrated on the board stays put, and the helpers here let negative rows reach up into the extra sky.

export const W = 256, H = 64, HORIZON = 36;
export const TOP = 32;           // extra sky rows on the website
export const FULL_H = H + TOP;   // the website's frame height

export const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
export const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const newImage = () => new Float32Array(W * H * 3);

// The current frame: the full website image and the board-coordinate view of its bottom 64 rows.
let FULL = null, VIEW = null;
export function setTarget(full, view) { FULL = full; VIEW = view; }
export const getFull = () => FULL;
export const getView = () => VIEW;

// [array, index] of pixel (x, y), or null when it's off the image. On the board view, y runs from -TOP
// (the top of the website's extra sky) to H - 1; on any other image, from 0 to its last row.
export function at(img, x, y) {
  if (x < 0 || x >= W || y >= img.length / (W * 3)) return null;
  if (y >= 0) return [img, (y * W + x) * 3];
  if (img === VIEW && y >= -TOP) return [FULL, ((y + TOP) * W + x) * 3]; // above the board frame
  return null;
}

export function blend(img, x, y, c, a = 1) { // hot: kept allocation-free
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W) return;
  let m = img, i;
  if (y >= 0) {
    i = (y * W + x) * 3;
    if (i >= img.length) return;
  } else if (img === VIEW && y >= -TOP) {
    m = FULL; i = ((y + TOP) * W + x) * 3; // above the board frame, in the extra sky
  } else return;
  m[i] = m[i] * (1 - a) + c[0] * a;
  m[i + 1] = m[i + 1] * (1 - a) + c[1] * a;
  m[i + 2] = m[i + 2] * (1 - a) + c[2] * a;
}

// Set a pixel exactly (integer coordinates, no rounding).
export function put(img, x, y, c) {
  const p = at(img, x, y);
  if (p) { const [m, i] = p; m[i] = c[0]; m[i + 1] = c[1]; m[i + 2] = c[2]; }
}

// Read a pixel (black when it's off the image).
export function get(img, x, y) {
  const p = at(img, x, y);
  return p ? [p[0][p[1]], p[0][p[1] + 1], p[0][p[1] + 2]] : [0, 0, 0];
}

// Add light to a pixel.
export function lighten(img, x, y, c, k) {
  const p = at(img, x, y);
  if (p) { const [m, i] = p; m[i] += c[0] * k; m[i + 1] += c[1] * k; m[i + 2] += c[2] * k; }
}

export function line(img, x0, y0, x1, y1, c, a) {
  const n = Math.floor(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    blend(img, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, c, a);
  }
}

// 3x5 font; bit 2 = left column.
export const FONT = {
  "0": [7, 5, 5, 5, 7], "1": [2, 6, 2, 2, 7], "2": [7, 1, 7, 4, 7], "3": [7, 1, 3, 1, 7], "4": [5, 5, 7, 1, 1],
  "5": [7, 4, 7, 1, 7], "6": [7, 4, 7, 5, 7], "7": [7, 1, 1, 2, 2], "8": [7, 5, 7, 5, 7], "9": [7, 5, 7, 1, 7],
  "A": [2, 5, 7, 5, 5], "B": [6, 5, 6, 5, 6], "C": [3, 4, 4, 4, 3], "D": [6, 5, 5, 5, 6], "E": [7, 4, 6, 4, 7],
  "F": [7, 4, 6, 4, 4], "G": [3, 4, 5, 5, 3], "H": [5, 5, 7, 5, 5], "I": [7, 2, 2, 2, 7], "J": [1, 1, 1, 5, 2],
  "K": [5, 5, 6, 5, 5], "L": [4, 4, 4, 4, 7], "M": [5, 7, 7, 5, 5], "N": [6, 5, 5, 5, 5], "O": [2, 5, 5, 5, 2],
  "P": [6, 5, 6, 4, 4], "Q": [2, 5, 5, 6, 3], "R": [6, 5, 6, 5, 5], "S": [3, 4, 2, 1, 6], "T": [7, 2, 2, 2, 2],
  "U": [5, 5, 5, 5, 7], "V": [5, 5, 5, 5, 2], "W": [5, 5, 7, 7, 5], "X": [5, 5, 2, 5, 5], "Y": [5, 5, 2, 2, 2],
  "Z": [7, 1, 2, 4, 7], "*": [7, 5, 7, 0, 0], ":": [0, 2, 0, 2, 0], " ": [0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 2],
  "!": [2, 2, 2, 0, 2], "'": [2, 2, 0, 0, 0], "-": [0, 0, 7, 0, 0], "+": [0, 2, 7, 2, 0], "&": [2, 5, 2, 5, 3],
  "?": [6, 1, 2, 0, 2], "/": [1, 1, 2, 4, 4], ",": [0, 0, 0, 2, 4],
};
const BLACK = [0, 0, 0];

// Draw text with a 1px drop shadow; returns the x after the last character.
export function text(img, x, y, s, color, alpha = 1) {
  for (const ch of s.toUpperCase()) {
    const rows = FONT[ch] || FONT[" "];
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 3; k++) {
        if (rows[r] & (4 >> k)) {
          for (const [dx, dy, c, a] of [[1, 1, BLACK, 0.7 * alpha], [0, 0, color, alpha]]) {
            blend(img, x + k + dx, y + r + dy, c, a);
          }
        }
      }
    }
    x += 4;
  }
  return x;
}

// Colour gradient over n rows from [[row, [r,g,b]], ...] stops (0..255 colours).
export function gradient(stops, n) {
  const out = [];
  for (let y = 0; y < n; y++) {
    let i = 0;
    while (i < stops.length - 2 && y > stops[i + 1][0]) i++;
    const [y0, c0] = stops[i], [y1, c1] = stops[i + 1];
    const f = clamp((y - y0) / (y1 - y0), 0, 1);
    out.push([0, 1, 2].map(k => (c0[k] + (c1[k] - c0[k]) * f) / 255));
  }
  return out;
}

export function decodeB64(s, Type) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Type(bytes.buffer);
}
