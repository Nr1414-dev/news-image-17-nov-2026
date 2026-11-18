// news-image-20261117 — "The World in One Day"
// A deterministic, dependency-free Node program that draws one 1024x1024 PNG
// summing up Tuesday 17 November 2026's world news as a newspaper front page.
//
// News verified 18 Nov 2026 from several sources before drawing:
//  * Al Jazeera live blog, 17 Nov 2026 (US-Israel war on Iran): IRGC drones
//    targeted a US radar at Sheikh Isa Air Base, Bahrain; US jets then struck
//    a missile site on Qeshm Island; tankers hit naval mines in the Strait of
//    Hormuz (Oman evacuated 24 crew from the tanker Tara Gas).
//  * ISW, Russian Offensive Campaign Assessment, 17 Nov 2026: Ukrainian forces
//    struck the Kerch Strait Bridge a second consecutive night, collapsing the
//    automobile span into the strait; 2 killed; road traffic closed.
//  * UK Foreign Office / Reuters, 17 Nov 2026: Britain sanctioned eight
//    Israeli construction firms building West Bank settlements plus the Tsav 9
//    group accused of blocking Gaza aid; UK, Australia, Canada and Italy urged
//    Israel to open Gaza crossings; UN agencies warned of a winter emergency.
//  * One Turn / Al Jazeera, 17 Nov 2026: Houthi forces advanced on Aden after
//    Yemeni government forces pulled back from the Bab al-Mandab coast; Saudi
//    Arabia named a new coalition commander.
//  * COP31, Antalya: ministers took charge on Tue 17 Nov as the first draft
//    deal (published Mon 16 Nov) was debated — fossil-fuel phase-out and
//    adaptation finance of at least $120bn a year by 2035.
//  * Also on 17 Nov: Japan scrambled jets after suspected Russian aircraft
//    entered its airspace; the first Trump-Xi-Putin trilateral summit was set
//    for Thu 19 Nov in Shenzhen; Gerard Depardieu pleaded guilty to a sexual
//    assault charge in a Paris court.
//
// Design (newspaper front-page rules: one dominant lead story, a modular
// grid, a kicker + headline + deck per story, 3-4 type sizes only, captions
// on every picture, high contrast so it still reads at ~300 px wide):
// masthead with the date, one big lead panel (the Gulf), a 2x2 grid of the
// next four stories, and a bottom strip of three short items.
//
// The program uses only the Node standard library, a fixed seed, and no
// network or clock, so every run writes byte-identical output.
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

export const W = 1024;
export const H = 1024;
export const SEED = 20261117;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 229];
const INK = [22, 19, 14];
const NAVY = [22, 35, 63];
const NAVY2 = [30, 52, 92];
const RED = [179, 38, 30];
const GOLD = [201, 162, 39];
const TEAL = [15, 118, 110];
const SEA = [11, 59, 74];
const SKY = [168, 205, 226];
const SAND = [226, 205, 160];
const ORANGE = [234, 88, 12];
const YELLOW = [245, 197, 66];
const WHITE = [255, 255, 255];
const GREY = [120, 124, 128];
const GREEN = [46, 125, 50];

type RGB = [number, number, number];

// ------------------------------------------------------- seeded randomness
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------- canvas
const buf = new Uint8Array(W * H * 3);

function px(x: number, y: number, c: RGB): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const o = (iy * W + ix) * 3;
  buf[o] = c[0];
  buf[o + 1] = c[1];
  buf[o + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      o += 3;
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x0 + dx * t);
    const cy = Math.round(y0 + dy * t);
    for (let a = -th + 1; a < th; a++)
      for (let b = -th + 1; b < th; b++) px(cx + a, cy + b, c);
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) px(x, y, c);
    }
}

function ring(cx: number, cy: number, r: number, th: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let d = 0; d < th; d++)
      px(cx + Math.cos(rad) * (r + d), cy + Math.sin(rad) * (r + d), c);
  }
}

// Filled polygon by scanline: pts is a flat [x0,y0,x1,y1,...] list.
function poly(pts: number[], c: RGB): void {
  const n = pts.length / 2;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pts[i * 2 + 1]);
    maxY = Math.max(maxY, pts[i * 2 + 1]);
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[j * 2];
      const y1 = pts[j * 2 + 1];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  poly([x0, y0, x1, y1, x2, y2], c);
}

// Horizontal sky bands: colours from top to horizon.
function skyBands(x: number, y: number, w: number, h: number, cols: RGB[]): void {
  const n = cols.length;
  for (let i = 0; i < n; i++) rect(x, y + (h * i) / n, w, h / n + 1, cols[i]);
}

// Deterministic stipple dots inside a rectangle, for paper/sea texture.
function stipple(x: number, y: number, w: number, h: number, n: number, c: RGB, rng: () => number): void {
  for (let i = 0; i < n; i++) px(x + rng() * w, y + rng() * h, c);
}

// ---------------------------------------------------------------- PNG writer
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePNG(): Buffer {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = deflateSync(raw, { level: 9 });
  const iend = chunk("IEND", new Uint8Array(0));
  return Buffer.concat([Buffer.from(sig), chunk("IHDR", ihdr), chunk("IDAT", idat), iend]);
}

// ------------------------------------------------------------- bitmap font
// A 5x7 pixel font, drawn by hand: each glyph is 7 rows of 5 bits ("1" = ink).
// Only capitals, digits and the punctuation the headlines need are defined,
// which is why every label on the page is set in capitals.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "1") rect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawChar(ch, cx, y, scale, c);
    cx += 6 * scale;
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Word-wrap a string to lines that fit maxW pixels at the given scale.
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawWrapped(s: string, x: number, y: number, maxW: number, scale: number, c: RGB, lh: number): void {
  const lines = wrapText(s, maxW, scale);
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, scale, c));
}

// A story panel: thin ink frame, kicker tag, picture area, headline + deck.
function panelFrame(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, PAPER);
  rect(x, y, w, 3, INK);
  rect(x, y, 3, h, INK);
  rect(x + w - 3, y, 3, h, INK);
  rect(x, y + h - 3, w, 3, INK);
}

function kickerTag(x: number, y: number, label: string, c: RGB): void {
  const w = textWidth(label, 2) + 16;
  rect(x, y, w, 22, c);
  drawText(label, x + 8, y + 4, 2, WHITE);
}

// ------------------------------------------------------------------- scenes
// Every scene is drawn from flat, high-contrast shapes so it stays readable
// when the page is shrunk to ~300 px: no fine lines, no small detail.

// LEAD — the Gulf: dusk sky, a tanker burning in the Strait of Hormuz,
// a drone overhead, mines in the water, a radar station on the shore.
function sceneGulf(x: number, y: number, w: number, h: number, rng: () => number): void {
  skyBands(x, y, w, Math.floor(h * 0.62), [[27, 42, 74], [120, 84, 96], [232, 130, 58]]);
  circle(x + 120, y + 52, 30, [245, 197, 66]);
  // distant shore with the radar station, right side
  rect(x + w - 250, y + Math.floor(h * 0.42), 250, Math.floor(h * 0.2), SAND);
  rect(x + w - 210, y + Math.floor(h * 0.30), 10, Math.floor(h * 0.14), INK);
  circle(x + w - 205, y + Math.floor(h * 0.28), 26, WHITE);
  ring(x + w - 205, y + Math.floor(h * 0.28), 26, 3, INK);
  rect(x + w - 150, y + Math.floor(h * 0.34), 60, Math.floor(h * 0.08), WHITE);
  rect(x + w - 150, y + Math.floor(h * 0.34), 60, 6, RED);
  // sea
  rect(x, y + Math.floor(h * 0.62), w, Math.ceil(h * 0.38), SEA);
  for (let i = 0; i < 6; i++) {
    const wy = y + Math.floor(h * 0.66) + i * 12;
    line(x + 20 + (i % 2) * 60, wy, x + w - 40 - (i % 3) * 80, wy, [90, 160, 175], 2);
  }
  // tanker, centre-left, on fire
  const tx = x + 90;
  const ty = y + Math.floor(h * 0.62);
  rect(tx, ty - 34, 420, 34, INK);
  rect(tx + 300, ty - 78, 70, 44, INK);
  rect(tx + 312, ty - 96, 10, 18, INK);
  rect(tx + 336, ty - 96, 10, 18, INK);
  // flames
  tri(tx + 150, ty - 34, tx + 185, ty - 110, tx + 220, ty - 34, ORANGE);
  tri(tx + 175, ty - 34, tx + 205, ty - 88, tx + 235, ty - 34, YELLOW);
  circle(tx + 195, ty - 100, 16, ORANGE);
  // smoke
  circle(tx + 200, ty - 80, 16, [90, 90, 90]);
  circle(tx + 226, ty - 96, 18, [110, 110, 110]);
  circle(tx + 256, ty - 108, 14, [130, 130, 130]);
  // naval mines in the water
  for (const [mx, my] of [[640, 176], [760, 196], [560, 200]] as const) {
    const cx = x + mx;
    const cy = y + my;
    for (let a = 0; a < 8; a++) {
      const rad = (a * Math.PI) / 4;
      line(cx, cy, cx + Math.cos(rad) * 20, cy + Math.sin(rad) * 20, INK, 3);
    }
    circle(cx, cy, 12, INK);
  }
  // drone with dashed trail, top right
  const dx = x + w - 330;
  const dy = y + 42;
  line(dx - 120, dy + 26, dx - 8, dy + 4, WHITE, 2);
  poly([dx, dy, dx + 44, dy + 6, dx + 52, dy + 16, dx + 8, dy + 18], INK);
  line(dx + 6, dy - 8, dx + 46, dy - 8, INK, 3);
  circle(dx + 22, dy + 22, 5, RED);
  stipple(x, y, w, h, 60, [255, 255, 255], rng);
}

// UKRAINE — the Kerch Bridge: the road span has collapsed into the strait,
// the arch is broken, smoke rises from the gap.
function sceneBridge(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, Math.floor(h * 0.6), [SKY, [214, 232, 240]]);
  rect(x, y + Math.floor(h * 0.6), w, Math.ceil(h * 0.4), [38, 110, 160]);
  // banks
  poly([x, y + h * 0.6, x + 70, y + h * 0.52, x + 110, y + h * 0.6], GREEN);
  poly([x + w - 110, y + h * 0.6, x + w - 70, y + h * 0.52, x + w, y + h * 0.6], GREEN);
  // Ukrainian flag on the left bank
  rect(x + 26, y + h * 0.18, 4, h * 0.36, INK);
  rect(x + 30, y + h * 0.18, 44, 13, [29, 78, 216]);
  rect(x + 30, y + h * 0.18 + 13, 44, 13, [245, 197, 66]);
  // deck: left and right spans, middle span dropped into the water
  const deckY = y + Math.floor(h * 0.42);
  rect(x, deckY, 150, 14, GREY);
  rect(x + w - 150, deckY, 150, 14, GREY);
  // two thin beams slanting down from the broken ends to the fallen span
  line(x + 150, deckY + 7, x + 215, deckY + 48, [90, 92, 96], 5);
  line(x + w - 150, deckY + 7, x + w - 215, deckY + 48, [90, 92, 96], 5);
  // the fallen road span, lying tilted in the water
  poly([x + 205, deckY + 46, x + w - 205, deckY + 52, x + w - 215, deckY + 64, x + 215, deckY + 58], [70, 72, 76]);
  // broken arch halves
  line(x + 30, deckY, x + 120, deckY - 44, INK, 4);
  line(x + w - 30, deckY, x + w - 120, deckY - 44, INK, 4);
  // explosion at the gap
  circle(x + w / 2, deckY - 6, 26, ORANGE);
  circle(x + w / 2, deckY - 6, 14, YELLOW);
  circle(x + w / 2 - 40, deckY - 34, 14, [90, 90, 90]);
  circle(x + w / 2 + 42, deckY - 40, 18, [110, 110, 110]);
  // splash where the span fell
  tri(x + w / 2 - 60, y + h * 0.78, x + w / 2, y + h * 0.62, x + w / 2 + 60, y + h * 0.78, WHITE);
}

// GAZA / WEST BANK — white tents, an aid truck, a red sanctions stamp.
function sceneGaza(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, Math.floor(h * 0.62), [[250, 214, 165], [244, 196, 140]]);
  circle(x + w - 60, y + 26, 20, [245, 197, 66]);
  rect(x, y + Math.floor(h * 0.62), w, Math.ceil(h * 0.38), SAND);
  // tents
  for (let i = 0; i < 3; i++) {
    const tx = x + 24 + i * 92;
    const ty = y + Math.floor(h * 0.62);
    tri(tx, ty, tx + 42, ty - 52, tx + 84, ty, WHITE);
    tri(tx + 30, ty, tx + 42, ty - 26, tx + 54, ty, INK);
    line(tx, ty, tx + 84, ty, INK, 2);
  }
  // aid truck
  const bx = x + 310;
  const by = y + Math.floor(h * 0.62);
  rect(bx, by - 56, 120, 56, WHITE);
  rect(bx, by - 56, 120, 5, RED);
  rect(bx + 120, by - 40, 44, 40, WHITE);
  rect(bx + 128, by - 34, 28, 16, SKY);
  circle(bx + 26, by, 13, INK);
  circle(bx + 96, by, 13, INK);
  circle(bx + 140, by, 13, INK);
  drawText("AID", bx + 34, by - 42, 2, RED);
}

// YEMEN — a coastline map: sea on the left, land on the right, red arrows
// pushing toward Aden, marked with a red dot.
function sceneYemen(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SAND);
  // sea on the left, with a wavy coastline
  poly([x, y, x + 150, y, x + 120, y + h * 0.35, x + 165, y + h * 0.6, x + 130, y + h, x, y + h], SEA);
  // mountains, kept left of Aden so the label stays clear
  tri(x + 270, y + h * 0.7, x + 305, y + h * 0.34, x + 340, y + h * 0.7, [150, 130, 100]);
  tri(x + 325, y + h * 0.7, x + 360, y + h * 0.44, x + 395, y + h * 0.7, [150, 130, 100]);
  // three parallel advance arrows pointing east toward Aden
  for (const ay of [16, 44, 72] as const) {
    line(x + 215, y + ay, x + 275, y + ay, RED, 5);
    tri(x + 275, y + ay, x + 255, y + ay - 9, x + 255, y + ay + 9, RED);
  }
  // Aden, bottom right, label above the dot clear of the mountains
  circle(x + 430, y + h - 26, 10, RED);
  ring(x + 430, y + h - 26, 16, 3, RED);
  drawText("ADEN", x + 406, y + h - 54, 2, INK);
}

// COP31 — a globe with a green leaf and a rising sun over Antalya.
function sceneCop31(x: number, y: number, w: number, h: number): void {
  skyBands(x, y, w, h, [[214, 232, 240], [190, 220, 205]]);
  // sun rays
  const sx = x + w - 70;
  const sy = y + 34;
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    line(sx, sy, sx + Math.cos(rad) * 40, sy + Math.sin(rad) * 40, GOLD, 3);
  }
  circle(sx, sy, 18, YELLOW);
  // globe
  const gx = x + 92;
  const gy = y + h / 2 + 4;
  circle(gx, gy, 52, TEAL);
  poly([gx - 30, gy - 18, gx - 6, gy - 30, gx + 8, gy - 12, gx - 12, gy + 2, gx - 34, gy + 4], GREEN);
  poly([gx + 6, gy + 12, gx + 30, gy + 6, gx + 34, gy + 26, gx + 12, gy + 34, gx - 2, gy + 22], GREEN);
  ring(gx, gy, 52, 3, INK);
  // leaf
  poly([gx + 66, gy + 26, gx + 96, gy - 4, gx + 122, gy + 2, gx + 130, gy + 28, gx + 100, gy + 34], GREEN);
  line(gx + 66, gy + 26, gx + 128, gy + 28, INK, 2);
  // factory / emissions bars crossed out, right side
  rect(x + w - 150, y + h - 52, 26, 52, GREY);
  rect(x + w - 118, y + h - 40, 26, 40, GREY);
  rect(x + w - 86, y + h - 62, 26, 62, GREY);
  line(x + w - 158, y + h - 14, x + w - 52, y + h - 66, RED, 5);
  drawText("$120BN", x + w - 168, y + 14, 2, RED);
}

// Bottom-strip icons, drawn in a 64x64 box at (x, y).
function iconJet(x: number, y: number): void {
  poly([x + 6, y + 44, x + 52, y + 14, x + 58, y + 22, x + 30, y + 48, x + 22, y + 58], GREY);
  poly([x + 52, y + 14, x + 62, y + 20, x + 56, y + 30], INK);
  line(x + 2, y + 50, x + 20, y + 56, WHITE, 2);
  line(x + 2, y + 58, x + 16, y + 62, WHITE, 2);
}

function iconFlags(x: number, y: number): void {
  const flags: RGB[][] = [
    [[179, 38, 30], [255, 255, 255]],
    [[29, 78, 216], [255, 255, 255]],
    [[255, 255, 255], [179, 38, 30]],
  ];
  for (let i = 0; i < 3; i++) {
    const fx = x + 4 + i * 20;
    rect(fx, y + 6, 3, 52, INK);
    rect(fx + 3, y + 6, 17, 10, flags[i][0]);
    rect(fx + 3, y + 16, 17, 10, flags[i][1]);
  }
}

function iconGavel(x: number, y: number): void {
  line(x + 12, y + 54, x + 42, y + 22, [120, 72, 20], 6);
  poly([x + 34, y + 8, x + 58, y + 16, x + 52, y + 30, x + 28, y + 22], [120, 72, 20]);
  rect(x + 30, y + 6, 6, 20, GOLD);
  rect(x + 8, y + 56, 34, 8, INK);
}

// ------------------------------------------------------------------ layout
function drawMasthead(rng: () => number): void {
  rect(20, 14, 984, 104, NAVY);
  rect(20, 114, 984, 4, GOLD);
  drawTextCentered("THE WORLD IN ONE DAY", 512, 28, 5, WHITE);
  drawTextCentered("TUESDAY 17 NOVEMBER 2026", 512, 78, 3, GOLD);
  stipple(20, 14, 984, 104, 40, [255, 255, 255], rng);
}

function drawHero(rng: () => number): void {
  const x = 20;
  const y = 132;
  const w = 984;
  const h = 320;
  panelFrame(x, y, w, h);
  sceneGulf(x + 3, y + 3, w - 6, 214, rng);
  rect(x, y + 217, w, 100, NAVY);
  drawText("LEAD STORY - THE GULF", x + 22, y + 226, 2, GOLD);
  drawTextCentered("GULF WAR WIDENS", 512, y + 250, 4, WHITE);
  const deck =
    "IRAN DRONES TARGET US RADAR IN BAHRAIN - US STRIKES QESHM ISLAND - TANKERS HIT MINES IN HORMUZ";
  for (const [i, ln] of wrapText(deck, 940, 2).entries())
    drawTextCentered(ln, 512, y + 286 + i * 20, 2, WHITE);
}

function drawGridPanel(
  x: number,
  y: number,
  scene: (x: number, y: number, w: number, h: number) => void,
  kicker: string,
  headline: string,
  deck: string,
): void {
  const w = 480;
  const h = 184;
  panelFrame(x, y, w, h);
  scene(x + 3, y + 3, w - 6, 96);
  kickerTag(x + 12, y + 12, kicker, RED);
  drawText(headline, x + 14, y + 108, 3, INK);
  drawWrapped(deck, x + 14, y + 134, w - 28, 2, INK, 17);
}

function drawStrip(): void {
  const items = [
    { icon: iconJet, head: "JAPAN SCRAMBLES JETS", sub: "RUSSIAN PLANES IN ITS AIRSPACE" },
    { icon: iconFlags, head: "SUMMIT SET FOR SHENZHEN", sub: "TRUMP - XI - PUTIN MEET THU 19 NOV" },
    { icon: iconGavel, head: "DEPARDIEU PLEADS GUILTY", sub: "FRENCH ACTOR ADMITS ASSAULT CHARGE" },
  ];
  for (let i = 0; i < 3; i++) {
    const x = 20 + i * 334;
    const y = 860;
    const w = 316;
    const h = 112;
    panelFrame(x, y, w, h);
    items[i].icon(x + 12, y + 24);
    const headLines = wrapText(items[i].head, w - 96, 2);
    headLines.forEach((ln, j) => drawText(ln, x + 88, y + 16 + j * 18, 2, INK));
    const subLines = wrapText(items[i].sub, w - 96, 2);
    subLines.forEach((ln, j) =>
      drawText(ln, x + 88, y + 16 + headLines.length * 18 + 6 + j * 18, 2, [90, 80, 70]),
    );
  }
}

// --------------------------------------------------------------------- main
function main(): void {
  const rng = mulberry32(SEED);
  rect(0, 0, W, H, PAPER);
  stipple(0, 0, W, H, 900, [210, 198, 170], rng);
  drawMasthead(rng);
  drawHero(rng);
  drawGridPanel(20, 466, sceneBridge, "UKRAINE", "KERCH BRIDGE FALLS",
    "ROAD SPAN DROPS INTO THE STRAIT AFTER A 2ND NIGHT OF STRIKES. 2 KILLED.");
  drawGridPanel(524, 466, sceneGaza, "GAZA - WEST BANK", "UK SANCTIONS 8 FIRMS",
    "SETTLEMENT BUILDERS AND AN AID-BLOCKING GROUP NAMED. WEST URGES GAZA OPEN.");
  drawGridPanel(20, 662, sceneYemen, "YEMEN", "HOUTHIS NEAR ADEN",
    "GOVT FORCES PULL BACK FROM THE RED SEA COAST. SAUDI NAMES NEW COMMANDER.");
  drawGridPanel(524, 662, sceneCop31, "CLIMATE - COP31 ANTALYA", "CLIMATE DRAFT DEBATED",
    "FOSSIL FUEL PHASE-OUT AND $120BN A YEAR BY 2035 ON THE TABLE.");
  drawStrip();
  drawTextCentered("ALL STORIES FROM TUESDAY 17 NOVEMBER 2026", 512, 988, 2, INK);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  writeFileSync(join(outDir, "entry.png"), png);
  console.log(`wrote ${join(outDir, "entry.png")} ${W}x${H} ${png.length} bytes`);
}

main();
