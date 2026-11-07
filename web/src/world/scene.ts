/**
 * The moon world, drawn procedurally on a 360 x 215 grid of cells (no image files). Each function fills an RGBA buffer, so the
 * drawing is plain code that a test can read back; the canvas only shows the buffer, once, scaled with crisp edges.
 */
export const GRID = { w: 360, h: 215 };
/** The column the ball moves in, and the rows of the roof, the rim and the floor. */
export const BALL_X = 132;
export const ROOF_Y = 128;
export const RIM_Y = 183;
export const FLOOR_Y = 203;
export const MOON = { x: 132, y: 22, r: 16 };

export interface Layer {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

const BLANK = 'transparent';
export const PALETTE = {
  skyTop: '#0A060C', skyBottom: '#1E1620', cream: '#F4EAD6', amber: '#FFB347', orange: '#FF6A13', red: '#FF3B1F', moon: '#E0D8C8',
  moonShade: '#C9BFAB', moonCrater: '#B4A992', grey: '#6E6E6E', greyLight: '#A8A8A8', net: '#F4EAD6', deep: '#8A3C0A',
} as const;

export function hex(color: string): [number, number, number, number] {
  if (color === BLANK) return [0, 0, 0, 0];
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** A small seeded random generator, so the scene is the same every time. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bayer = (x: number, y: number): number => ((BAYER[y & 3] as number[])[x & 3] as number + 0.5) / 16;

export function newLayer(w: number = GRID.w, h: number = GRID.h): Layer {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

export function put(layer: Layer, x: number, y: number, color: string): void {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= layer.w || y >= layer.h) return;
  const [r, g, b, a] = hex(color);
  const i = (y * layer.w + x) * 4;
  layer.data[i] = r;
  layer.data[i + 1] = g;
  layer.data[i + 2] = b;
  layer.data[i + 3] = a;
}

export function rect(layer: Layer, x: number, y: number, w: number, h: number, color: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(layer, xx, yy, color);
}

export function pixelAt(layer: Layer, x: number, y: number): string {
  const i = (y * layer.w + x) * 4;
  if (layer.data[i + 3] === 0) return BLANK;
  return `#${[0, 1, 2].map((k) => (layer.data[i + k] as number).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

const mix = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const h = (v: number): string => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
};

/** A 3 x 5 pixel font for the digits on the banners. */
export const DIGITS: Record<string, readonly string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

function digits(layer: Layer, text: string, x: number, y: number, color: string): void {
  [...text].forEach((ch, i) => {
    (DIGITS[ch] ?? []).forEach((row, dy) => {
      [...row].forEach((bit, dx) => {
        if (bit === '1') put(layer, x + i * 4 + dx, y + dy, color);
      });
    });
  });
}

/** Retired-number banners hang from the rafters across the width, except in the ball column. */
export const BANNERS = { numbers: ['23', '8', '24', '33', '6', '32', '11', '21', '5', '12', '34', '7'], width: 15, top: 137, height: 20 };

function bannerXs(): number[] {
  const xs: number[] = [];
  for (let x = 6; x + BANNERS.width < GRID.w; x += 28) {
    if (x + BANNERS.width > BALL_X - 16 && x < BALL_X + 16) continue; // the ball column stays clear
    xs.push(x);
  }
  return xs;
}

function drawMoon(l: Layer): void {
  const { x: cx, y: cy, r } = MOON;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
      if (d > r) continue;
      put(l, x, y, d > r - 1.6 && bayer(x, y) < 0.6 ? PALETTE.moonShade : PALETTE.moon);
    }
  }
  const craters: Array<[number, number, number]> = [[-6, -5, 3.2], [6, -2, 2.6], [-2, 7, 4], [9, 8, 2], [-10, 3, 2.2], [3, -10, 1.8]];
  for (const [dx, dy, cr] of craters) {
    for (let y = -5; y <= 5; y++) {
      for (let x = -5; x <= 5; x++) {
        const d = Math.hypot(x, y);
        if (d <= cr) put(l, cx + dx + x, cy + dy + y, y + x > cr * 0.4 ? PALETTE.moon : PALETTE.moonCrater);
      }
    }
  }
}

/** The hoop on the moon: an orange rim under it and a small white net. */
function drawMoonHoop(l: Layer): void {
  const y = MOON.y + MOON.r - 2;
  rect(l, MOON.x - 9, y, 18, 2, PALETTE.orange);
  rect(l, MOON.x - 9, y + 2, 18, 1, PALETTE.deep);
  for (let i = 0; i < 6; i++) {
    const inset = Math.floor(i / 2);
    for (let x = MOON.x - 8 + inset; x <= MOON.x + 8 - inset; x++) if ((x + i) % 2 === 0) put(l, x, y + 3 + i, PALETTE.net);
  }
}

/** The static scene: sky, moon, roof, rafters, banners, crowd, floor and the arena hoop. */
export function renderScene(): Layer {
  const l = newLayer();
  const rnd = rng(7);
  // night sky: steps of warm black, dithered between the steps
  for (let y = 0; y < ROOF_Y + 8; y++) {
    const t = Math.min(1, y / ROOF_Y) * 7;
    for (let x = 0; x < GRID.w; x++) {
      const step = Math.floor(t) + (t % 1 > bayer(x, y) ? 1 : 0);
      put(l, x, y, mix(PALETTE.skyTop, PALETTE.skyBottom, step / 7));
    }
  }
  // stars
  const starColors = [PALETTE.cream, PALETTE.greyLight, PALETTE.grey, PALETTE.cream, PALETTE.amber, PALETTE.greyLight];
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(rnd() * GRID.w);
    const y = Math.floor(rnd() * (ROOF_Y - 6));
    if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.r + 6) continue;
    const c = starColors[Math.floor(rnd() * starColors.length)] as string;
    put(l, x, y, c);
    if (rnd() < 0.04) {
      put(l, x - 1, y, c);
      put(l, x + 1, y, c);
      put(l, x, y - 1, c);
      put(l, x, y + 1, c);
    }
  }
  drawMoon(l);
  drawMoonHoop(l);

  // the arena interior: dark and warm, darker at the top
  for (let y = ROOF_Y + 8; y < FLOOR_Y; y++) {
    const t = (y - ROOF_Y - 8) / (FLOOR_Y - ROOF_Y - 8);
    for (let x = 0; x < GRID.w; x++) put(l, x, y, mix('#0C0807', '#1B100B', t * 0.9 + (bayer(x, y) - 0.5) * 0.12));
  }
  // the crowd: a dithered texture of heads, denser toward the floor
  for (let y = 158; y < FLOOR_Y; y++) {
    const density = 0.14 + ((y - 158) / (FLOOR_Y - 158)) * 0.4;
    for (let x = 0; x < GRID.w; x++) {
      if (Math.abs(x - BALL_X) < 11 && y > 160) continue;
      if (rnd() < density * bayer(x * 3, y * 2) * 1.6) {
        const pick = rnd();
        put(l, x, y, pick < 0.4 ? '#2E1C12' : pick < 0.68 ? '#442A16' : pick < 0.86 ? '#26262C' : pick < 0.95 ? '#5A3618' : pick < 0.985 ? PALETTE.deep : '#B8762A');
      }
    }
  }
  // roof (with an opening above the ball column) and rafters
  for (let x = 0; x < GRID.w; x++) {
    if (Math.abs(x - BALL_X) < 13) continue;
    rect(l, x, ROOF_Y, 1, 4, '#2A1D18');
    put(l, x, ROOF_Y, '#4A362C');
    rect(l, x, ROOF_Y + 4, 1, 4, '#33241C');
    put(l, x, ROOF_Y + 7, '#120C0A');
  }
  for (let x = 8; x < GRID.w; x += 16) {
    if (Math.abs(x - BALL_X) < 14) continue;
    rect(l, x, ROOF_Y + 8, 3, 14, '#1F140F');
    put(l, x, ROOF_Y + 8, '#33241C');
  }
  // retired-number banners hanging from the rafters
  bannerXs().forEach((x, i) => {
    const orange = i % 2 === 0;
    const body = orange ? PALETTE.orange : PALETTE.cream;
    const ink = orange ? '#1A0902' : '#1A0902';
    rect(l, x + 7, BANNERS.top - 2, 1, 3, '#3A2A22'); // the cord
    for (let dy = 0; dy < BANNERS.height; dy++) {
      const notch = dy > BANNERS.height - 5 ? dy - (BANNERS.height - 5) : 0;
      const left = x + (dy > BANNERS.height - 5 ? notch : 0);
      const right = x + BANNERS.width - (dy > BANNERS.height - 5 ? notch : 0);
      rect(l, left, BANNERS.top + dy, Math.max(0, right - left), 1, body);
    }
    rect(l, x, BANNERS.top, BANNERS.width, 1, orange ? '#FF8A3D' : '#FFFFFF');
    digits(l, BANNERS.numbers[i % BANNERS.numbers.length] as string, x + 3, BANNERS.top + 4, ink);
  });
  // the hardwood floor and its baseline
  for (let y = FLOOR_Y; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const row = y - FLOOR_Y;
      const joint = (x + (Math.floor(row / 3) % 2) * 7) % 14 === 0;
      const base = row % 3 === 0 ? '#C26A20' : '#B25E1A';
      put(l, x, y, joint ? '#7A3E10' : bayer(x, y) < 0.18 ? '#D27A2C' : base);
    }
  }
  rect(l, 0, FLOOR_Y, GRID.w, 1, PALETTE.cream);
  // the arena hoop at the ball column: stanchion, backboard, rim and net
  rect(l, BALL_X - 1, 178, 3, FLOOR_Y - 178, PALETTE.grey);
  rect(l, BALL_X - 7, FLOOR_Y - 3, 15, 3, '#4A4A4A');
  rect(l, BALL_X - 11, 163, 23, 15, PALETTE.cream);
  rect(l, BALL_X - 10, 164, 21, 13, '#D8CDB6');
  rect(l, BALL_X - 5, 169, 11, 7, PALETTE.cream);
  rect(l, BALL_X - 4, 170, 9, 5, '#D8CDB6');
  rect(l, BALL_X - 8, RIM_Y, 17, 2, PALETTE.orange);
  rect(l, BALL_X - 8, RIM_Y + 2, 17, 1, PALETTE.deep);
  for (let i = 0; i < 9; i++) {
    const inset = Math.floor(i / 3);
    for (let x = BALL_X - 7 + inset; x <= BALL_X + 7 - inset; x++) if ((x + i) % 2 === 0) put(l, x, RIM_Y + 3 + i, PALETTE.net);
  }
  return l;
}

/** The clouds, drawn twice side by side so that sliding them one grid width along loops without a seam. */
export function renderClouds(): Layer {
  const l = newLayer(GRID.w * 2, GRID.h);
  const rnd = rng(21);
  const tones = ['#5A5A66', '#484852', '#36363E'];
  const clouds = Array.from({ length: 11 }, (_, i) => ({ x: Math.floor(rnd() * GRID.w), y: 44 + Math.floor((i / 11) * 78 + rnd() * 8), w: 22 + Math.floor(rnd() * 30) }));
  for (const c of clouds) {
    for (const dx of [-GRID.w, 0, GRID.w, GRID.w * 2]) {
      const h = Math.max(4, Math.floor(c.w / 5));
      for (let row = 0; row < h; row++) {
        const span = Math.round(c.w * (0.55 + 0.45 * Math.sin(((row + 0.5) / h) * Math.PI)));
        const left = c.x + dx + Math.floor((c.w - span) / 2);
        rect(l, left, c.y + row, span, 1, tones[Math.min(2, Math.floor((row / h) * 3))] as string);
      }
      rect(l, c.x + dx + 4, c.y - 2, Math.floor(c.w / 3), 2, tones[0] as string);
      rect(l, c.x + dx + Math.floor(c.w / 2), c.y - 3, Math.floor(c.w / 4), 3, tones[0] as string);
    }
  }
  return l;
}

/** A layer of stars that twinkle (the page fades the whole layer in and out). */
export function renderStars(seed: number, count = 22): Layer {
  const l = newLayer();
  const rnd = rng(seed);
  const colors = [PALETTE.cream, PALETTE.cream, PALETTE.greyLight, PALETTE.amber];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * GRID.w);
    const y = Math.floor(rnd() * (ROOF_Y - 8));
    if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.r + 4) continue;
    const c = colors[Math.floor(rnd() * colors.length)] as string;
    put(l, x, y, c);
    put(l, x - 1, y, c);
    put(l, x + 1, y, c);
    put(l, x, y - 1, c);
    put(l, x, y + 1, c);
  }
  return l;
}

/** Bright specks in the crowd; two layers fade in turn, so the stands shimmer. */
export function renderCrowdShimmer(seed: number): Layer {
  const l = newLayer();
  const rnd = rng(seed);
  for (let y = 160; y < FLOOR_Y; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (Math.abs(x - BALL_X) < 11) continue;
      if (rnd() < 0.03) put(l, x, y, rnd() < 0.7 ? '#7A4A22' : '#B8762A');
    }
  }
  return l;
}

/**
 * Where the grid sits on a screen. On a wide screen the scene fills it (a slice: the larger of the two scales), centred. On a phone
 * the sheet with the question covers the bottom, so the scene is sized to the part above it, with the ball column kept in view.
 */
export interface Metrics {
  scale: number;
  ox: number;
  oy: number;
  /** Phone layout: a bottom sheet instead of a floating card. */
  narrow: boolean;
  /** Height of the part of the screen above the sheet (the whole height on a wide screen). */
  visible: number;
}

export const NARROW_MAX = 700;
/** On a phone the sheet with the question takes the bottom of the screen, and the HUD the top. */
export const SHEET_SHARE = 0.46;
export const HUD_NARROW = 96;

export function sceneMetrics(vw: number, vh: number): Metrics {
  const narrow = vw < NARROW_MAX;
  const visible = narrow ? Math.round(vh * (1 - SHEET_SHARE)) : vh;
  const top = narrow ? HUD_NARROW : 0;
  const scale = Math.ceil(Math.max(vw / GRID.w, (visible - top) / GRID.h) * 100) / 100; // rounded up, so the grid always covers its space
  const width = GRID.w * scale;
  const centred = (vw - width) / 2;
  const ox = narrow ? Math.min(0, Math.max(vw - width, vw * 0.3 - BALL_X * scale)) : centred;
  const oy = narrow ? top : (vh - GRID.h * scale) / 2;
  return { scale, ox, oy, narrow, visible };
}

/** Screen position of a grid cell. */
export const toScreen = (m: Metrics, gx: number, gy: number): { x: number; y: number } => ({ x: m.ox + gx * m.scale, y: m.oy + gy * m.scale });
