// THE WORLD TODAY — Tuesday 24 November 2026.
// A program that draws one 1024x1024 newspaper front page summing up
// the day's world news, using only the Node.js standard library.
// It hand-rolls a 5x7 bitmap font and a PNG encoder, and writes
// deterministic bytes to /output/entry.png (or $MAKEFUN_OUTPUT_DIR).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// Palette: cream paper, navy ink, red for the lead, gold rules.
const PAPER = [247, 242, 231];
const INK = [20, 33, 61];
const RED = [185, 28, 28];
const GOLD = [201, 162, 39];
const NAVY2 = [38, 58, 94];
const SEA = [46, 92, 138];
const SEA2 = [32, 66, 102];
const GREEN = [46, 92, 58];
const GREY = [120, 124, 128];
const WHITE = [255, 255, 255];

// 5x7 bitmap font. Each glyph is 7 rows of 5 bits; the leftmost
// pixel is the most significant bit of each row value.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
};

// Punctuation and symbols.
FONT[" "] = [0, 0, 0, 0, 0, 0, 0];
FONT["."] = [0, 0, 0, 0, 0, 0x0c, 0x0c];
FONT[","] = [0, 0, 0, 0, 0x0c, 0x04, 0x08];
FONT[":"] = [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0];
FONT[";"] = [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08];
FONT["!"] = [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04];
FONT["?"] = [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04];
FONT["-"] = [0, 0, 0, 0x0e, 0, 0, 0];
FONT["'"] = [0x04, 0x04, 0x08, 0, 0, 0, 0];
FONT['"'] = [0x0a, 0x0a, 0, 0, 0, 0, 0];
FONT["("] = [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02];
FONT[")"] = [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08];
FONT["/"] = [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10];
FONT["&"] = [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d];
FONT["%"] = [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13];
FONT["+"] = [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0];
FONT["="] = [0, 0, 0x1f, 0, 0x1f, 0, 0];
FONT["$"] = [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04];
FONT["#"] = [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a];
FONT["*"] = [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0];

// ---------------------------------------------------------------------------
// Canvas: a plain RGB pixel buffer with small drawing primitives.
// ---------------------------------------------------------------------------
class Canvas {
  data: Buffer;
  w: number;
  h: number;
  constructor(w: number, h: number, bg: number[]) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: number[]): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  rect(x: number, y: number, w: number, h: number, c: number[], t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  fillCircle(cx: number, cy: number, r: number, c: number[]): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c);
  }
  circle(cx: number, cy: number, r: number, c: number[]): void {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      this.set(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  // Scanline fill of a polygon given as [x, y] points.
  fillPoly(pts: number[][], c: number[]): void {
    let minY = pts[0][1];
    let maxY = pts[0][1];
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          const t = (y - a[1]) / (b[1] - a[1]);
          xs.push(Math.round(a[0] + t * (b[0] - a[0])));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = xs[k]; x <= xs[k + 1]; x++) this.set(x, y, c);
    }
  }
  // ---- text ---------------------------------------------------------------
  textWidth(s: string, scale: number): number {
    return s.length * 6 * scale;
  }
  drawText(x: number, y: number, s: string, scale: number, c: number[], bold = false): void {
    const up = s.toUpperCase();
    for (let ci = 0; ci < up.length; ci++) {
      const g = FONT[up[ci]] || FONT["?"];
      const ox = x + ci * 6 * scale;
      for (let row = 0; row < 7; row++) {
        const bits = g[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            this.fillRect(ox + col * scale, y + row * scale, scale, scale, c);
            if (bold) this.fillRect(ox + col * scale + 1, y + row * scale, scale, scale, c);
          }
        }
      }
    }
  }
  drawTextCentered(cx: number, y: number, s: string, scale: number, c: number[], bold = false): void {
    this.drawText(cx - Math.floor(this.textWidth(s, scale) / 2), y, s, scale, c, bold);
  }
  // Word-wrap a string to lines no wider than maxW pixels at the given scale.
  wrap(s: string, scale: number, maxW: number): string[] {
    const words = s.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const word of words) {
      const trial = cur ? cur + " " + word : word;
      if (this.textWidth(trial, scale) <= maxW || !cur) {
        cur = trial;
      } else {
        lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
}

// ---------------------------------------------------------------------------
// PNG encoder: 8-bit RGB, filter 0, zlib level 9. Deterministic output.
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const raw = Buffer.alloc(cv.h * (1 + cv.w * 3));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 3)] = 0;
    cv.data.copy(raw, y * (1 + cv.w * 3) + 1, y * cv.w * 3, (y + 1) * cv.w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// The front page.
// ---------------------------------------------------------------------------
function mix(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function drawPage(cv: Canvas): void {
  const M = 36;
  const RW = W - 2 * M; // 952

  // Masthead.
  cv.fillRect(M, 22, RW, 4, GOLD);
  cv.drawTextCentered(W / 2, 38, "THE WORLD TODAY", 6, INK, true);
  cv.fillRect(M, 92, RW, 2, INK);
  cv.drawTextCentered(W / 2, 104, "TUESDAY 24 NOVEMBER 2026 - WORLD NEWS IN ONE IMAGE", 3, NAVY2, true);
  cv.fillRect(M, 132, RW, 6, INK);

  // ---- Lead story: South Korea air-raid scare ---------------------------
  const LX = M;
  const LW = 560; // lead text column width
  const IX = 624; // illustration panel x
  const IW = W - M - IX; // 364
  const IY = 150;
  const IH = 352;

  cv.drawText(LX, 152, "LEAD STORY", 2, RED, true);
  cv.drawText(LX + cv.textWidth("LEAD STORY ", 2), 152, "- SOUTH KOREA", 2, INK, true);
  const head = ["AIR-RAID SCARE AS", "RUSSIAN JETS NEAR", "KOREAN ISLAND"];
  head.forEach((line, i) => cv.drawText(LX, 182 + i * 38, line, 5, INK, true));
  const leadBody =
    "Russian warplanes entered South Korea's air defence zone near Ulleung Island on Tuesday morning. Sirens sounded and residents were told to take shelter as fighter jets scrambled. The alert was lifted after five minutes. Seoul said no airspace was violated - but official alerts wrongly blamed North Korea.";
  const leadLines = cv.wrap(leadBody, 2, LW);
  leadLines.forEach((line, i) => cv.drawText(LX, 312 + i * 21, line, 2, INK));

  // Illustration panel: dawn sky, sea, island, jet, alert triangle.
  for (let y = 0; y < IH; y++) {
    const t = y / IH;
    cv.fillRect(IX, IY + y, IW, 1, mix(NAVY2, [214, 178, 94], t * 0.55));
  }
  // Sun glow low on the horizon.
  cv.fillCircle(IX + 90, IY + IH - 96, 46, [232, 196, 110]);
  cv.fillCircle(IX + 90, IY + IH - 96, 34, [240, 210, 140]);
  // Sea bands.
  cv.fillRect(IX, IY + IH - 92, IW, 30, SEA);
  cv.fillRect(IX, IY + IH - 62, IW, 30, SEA2);
  cv.fillRect(IX, IY + IH - 32, IW, 32, [24, 50, 80]);
  // Island mound with two pines.
  cv.fillPoly(
    [
      [IX + 150, IY + IH - 92],
      [IX + 210, IY + IH - 148],
      [IX + 300, IY + IH - 92],
    ],
    GREEN
  );
  cv.fillPoly([[IX + 196, IY + IH - 138], [IX + 208, IY + IH - 170], [IX + 220, IY + IH - 138]], GREEN);
  cv.fillPoly([[IX + 246, IY + IH - 116], [IX + 258, IY + IH - 148], [IX + 270, IY + IH - 116]], GREEN);
  // Fighter jet crossing the sky.
  const jx = IX + 150;
  const jy = IY + 78;
  cv.fillPoly(
    [
      [jx, jy],
      [jx + 118, jy + 12],
      [jx + 96, jy + 18],
      [jx + 128, jy + 34],
      [jx + 40, jy + 26],
      [jx + 18, jy + 40],
      [jx + 2, jy + 30],
    ],
    [230, 230, 228]
  );
  cv.fillPoly([[jx + 96, jy + 18], [jx + 128, jy + 34], [jx + 108, jy + 38]], GREY);
  // Alert triangle with exclamation mark.
  const tx = IX + IW - 96;
  const ty = IY + 22;
  cv.fillPoly([[tx, ty + 64], [tx + 34, ty], [tx + 68, ty + 64]], RED);
  cv.rect(tx, ty + 64, 68, 3, RED);
  cv.drawText(tx + 27, ty + 20, "!", 4, WHITE, true);
  // Radar arcs around the triangle.
  cv.circle(tx + 34, ty + 34, 52, GOLD);
  cv.circle(tx + 34, ty + 34, 62, GOLD);
  // Panel caption.
  cv.fillRect(IX, IY + IH - 32, IW, 32, INK);
  cv.drawText(IX + 12, IY + IH - 23, "ULLEUNG ISLAND - 7:52 AM", 2, WHITE, true);

  // ---- Divider and supporting stories ------------------------------------
  cv.fillRect(M, 522, RW, 3, INK);
  cv.drawText(M, 540, "ALSO TODAY", 2, RED, true);

  interface Story {
    label: string;
    body: string;
    icon: (x: number, y: number, s: number) => void;
  }
  const burst = (x: number, y: number, s: number) => {
    // Explosion burst: eight-point star.
    const cx = x + s / 2;
    const cy = y + s / 2;
    const pts: number[][] = [];
    for (let a = 0; a < 16; a++) {
      const r = a % 2 === 0 ? s * 0.48 : s * 0.2;
      const rad = (a * Math.PI) / 8 - Math.PI / 2;
      pts.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
    }
    cv.fillPoly(pts, RED);
    cv.fillCircle(cx, cy, 7, GOLD);
  };
  const plane = (x: number, y: number, s: number) => {
    cv.fillPoly(
      [
        [x + 8, y + s * 0.5],
        [x + s - 8, y + s * 0.42],
        [x + s - 14, y + s * 0.52],
        [x + s - 30, y + s * 0.6],
        [x + s * 0.42, y + s * 0.62],
        [x + s * 0.34, y + s * 0.72],
        [x + s * 0.26, y + s * 0.6],
      ],
      NAVY2
    );
    cv.fillPoly([[x + s * 0.45, y + s * 0.5], [x + s * 0.6, y + s * 0.78], [x + s * 0.5, y + s * 0.78]], NAVY2);
  };
  const bars = (x: number, y: number, s: number) => {
    const bw = 14;
    const base = y + s - 12;
    cv.fillRect(x + 10, base - 22, bw, 22, NAVY2);
    cv.fillRect(x + 32, base - 36, bw, 36, SEA);
    cv.fillRect(x + 54, base - 52, bw, 52, GOLD);
    cv.line(x + 6, base - 56, x + 76, base - 64, RED);
    cv.line(x + 6, base - 56, x + 12, base - 50, RED);
    cv.line(x + 6, base - 56, x + 12, base - 62, RED);
  };
  const coin = (x: number, y: number, s: number) => {
    cv.fillCircle(x + s / 2, y + s / 2, 30, GOLD);
    cv.circle(x + s / 2, y + s / 2, 24, INK);
    cv.drawTextCentered(x + s / 2, y + s / 2 - 14, "$", 4, INK, true);
  };

  const stories: Story[] = [
    {
      label: "STRIKE ON ZAPORIZHZHIA KILLS 2",
      body: "A Russian attack on the city overnight killed two people and wounded 22, including two children, officials say.",
      icon: burst,
    },
    {
      label: "HASINA TO RETURN HOME DEC 16",
      body: "The ousted prime minister plans to fly back from exile in India on Liberation Day, her office tells Reuters.",
      icon: plane,
    },
    {
      label: "JAPAN FACTORIES GROW FASTER",
      body: "Manufacturing PMI rises to 53.7 in November on chip demand, while services cool to 50.5, a survey shows.",
      icon: bars,
    },
    {
      label: "GOLD STEADIES AFTER SELL-OFF",
      body: "Spot gold edges up to $3,645 an ounce as traders await US inflation data and the Fed's next move.",
      icon: coin,
    },
  ];

  const cols = [M, M + RW / 2 + 12];
  const rows = [566, 762];
  const cellW = RW / 2 - 12;
  stories.forEach((st, i) => {
    const cx = cols[i % 2];
    const cy = rows[Math.floor(i / 2)];
    cv.rect(cx, cy, 88, 120, GOLD, 2);
    st.icon(cx + 4, cy + 20, 80);
    const tx0 = cx + 102;
    const tw = cellW - 102;
    const labelLines = cv.wrap(st.label, 2, tw);
    labelLines.forEach((line, j) => cv.drawText(tx0, cy + 6 + j * 17, line, 2, INK, true));
    const bodyLines = cv.wrap(st.body, 2, tw);
    bodyLines.forEach((line, j) =>
      cv.drawText(tx0, cy + 6 + labelLines.length * 17 + 4 + j * 18, line, 2, NAVY2)
    );
  });

  // ---- Footer --------------------------------------------------------------
  cv.fillRect(M, 922, RW, 2, INK);
  cv.drawTextCentered(W / 2, 938, "COMPILED FROM REUTERS, YONHAP AND AP REPORTS", 2, NAVY2, true);
  cv.drawTextCentered(W / 2, 962, "THE WORLD TODAY - TUESDAY 24 NOVEMBER 2026", 2, INK, true);
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------
function main(): void {
  const cv = new Canvas(W, H, PAPER);
  drawPage(cv);
  const png = encodePNG(cv);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
