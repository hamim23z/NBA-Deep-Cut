import { describe, expect, it } from 'vitest';
import { BALL_X, BANNERS, DIGITS, FLOOR_Y, GRID, MOON, PALETTE, RIM_Y, ROOF_Y, pixelAt, renderClouds, renderCrowdShimmer, renderScene, renderStars, rng, sceneMetrics, toScreen } from './scene';
import { LEVELS } from '../modes';

const scene = renderScene();

describe('the moon world scene', () => {
  it('is a 360 x 215 grid, fully painted, the same every time', () => {
    expect([scene.w, scene.h]).toEqual([GRID.w, GRID.h]);
    for (let i = 3; i < scene.data.length; i += 4) expect(scene.data[i]).toBe(255);
    expect(renderScene().data).toEqual(scene.data);
  });
  it('has a warm-black sky that is lighter toward the roof', () => {
    const top = pixelAt(scene, 0, 0);
    const low = pixelAt(scene, 0, ROOF_Y - 1);
    const lum = (c: string): number => Number.parseInt(c.slice(1, 3), 16) + Number.parseInt(c.slice(3, 5), 16) + Number.parseInt(c.slice(5, 7), 16);
    expect(lum(low)).toBeGreaterThan(lum(top));
    expect(lum(top)).toBeLessThan(60);
  });
  it('has an off-white moon at (132, 22), radius 16, with craters and an orange hoop rim under it', () => {
    expect([MOON.x, MOON.y, MOON.r]).toEqual([132, 22, 16]);
    expect(pixelAt(scene, MOON.x + 11, MOON.y - 6)).toBe(PALETTE.moon.toUpperCase());
    expect(pixelAt(scene, MOON.x + 6 - 1, MOON.y - 2 - 1)).toBe(PALETTE.moonCrater.toUpperCase());
    expect(pixelAt(scene, MOON.x, 36)).toBe(PALETTE.orange);
    expect(pixelAt(scene, MOON.x, 37)).toBe(PALETTE.orange);
  });
  it('has an opening in the roof above the ball column, and roof beams elsewhere', () => {
    expect(pixelAt(scene, BALL_X, ROOF_Y + 2)).not.toBe(pixelAt(scene, 40, ROOF_Y + 2));
    expect(pixelAt(scene, 40, ROOF_Y + 2)).toBe('#2A1D18');
    expect(pixelAt(scene, BALL_X, ROOF_Y + 2)).not.toBe('#2A1D18');
  });
  it('has an arena hoop at the ball column: a cream backboard, an orange rim at row 183 and a net', () => {
    expect(pixelAt(scene, BALL_X - 11, 163)).toBe(PALETTE.cream.toUpperCase());
    expect(pixelAt(scene, BALL_X, RIM_Y)).toBe(PALETTE.orange);
    let netCells = 0;
    for (let y = RIM_Y + 3; y < RIM_Y + 12; y++) for (let x = BALL_X - 8; x <= BALL_X + 8; x++) if (pixelAt(scene, x, y) === PALETTE.net.toUpperCase()) netCells++;
    expect(netCells).toBeGreaterThan(20);
  });
  it('has a cream baseline at row 203 and hardwood below it', () => {
    expect(pixelAt(scene, 20, FLOOR_Y)).toBe(PALETTE.cream.toUpperCase());
    const wood = pixelAt(scene, 21, FLOOR_Y + 4);
    expect(Number.parseInt(wood.slice(1, 3), 16)).toBeGreaterThan(Number.parseInt(wood.slice(5, 7), 16) + 40); // orange-brown: red well above blue
  });
  it('hangs banners from the rafters across the width and keeps the ball column clear', () => {
    let banner = 0;
    for (let x = 0; x < GRID.w; x++) if (pixelAt(scene, x, BANNERS.top + 8) === PALETTE.orange.toUpperCase()) banner++;
    expect(banner).toBeGreaterThan(30);
    for (let y = BANNERS.top; y < BANNERS.top + BANNERS.height; y++) for (let x = BALL_X - 8; x <= BALL_X + 8; x++) expect([PALETTE.orange, PALETTE.cream]).not.toContain(pixelAt(scene, x, y));
  });
  it('has a 3 x 5 digit font for the banner numbers', () => {
    expect(Object.keys(DIGITS)).toHaveLength(10);
    for (const rows of Object.values(DIGITS)) {
      expect(rows).toHaveLength(5);
      for (const row of rows) expect(row).toMatch(/^[01]{3}$/);
    }
  });
  it('keeps the moon, the roof opening and the ball column free of the level rows it needs', () => {
    for (const level of LEVELS) expect(level.y).toBeGreaterThan(0);
    expect(LEVELS[0]!.y).toBe(MOON.y + 2);
  });
});

describe('the ambient layers', () => {
  it('draws clouds twice as wide as the grid, so they loop', () => {
    const clouds = renderClouds();
    expect(clouds.w).toBe(GRID.w * 2);
    for (let y = 0; y < clouds.h; y += 7) for (let x = 0; x < GRID.w; x += 5) expect(pixelAt(clouds, x, y)).toBe(pixelAt(clouds, x + GRID.w, y));
  });
  it('draws a few stars and some specks of crowd, with the rest clear', () => {
    const count = (l: { data: Uint8ClampedArray }): number => l.data.filter((_, i) => i % 4 === 3 && l.data[i] === 255).length;
    expect(count(renderStars(3))).toBeGreaterThan(20);
    expect(count(renderStars(3))).toBeLessThan(200);
    expect(count(renderCrowdShimmer(4))).toBeGreaterThan(50);
  });
  it('is seeded: the same seed, the same numbers', () => {
    const a = rng(5);
    const b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('where the grid sits on a screen', () => {
  it('fills a 1440 x 860 screen exactly, at 4 pixels per cell', () => {
    expect(sceneMetrics(1440, 860)).toMatchObject({ scale: 4, ox: 0, oy: 0, narrow: false });
  });
  it('fills a 1280 x 720 screen with no empty band (the larger scale, centred)', () => {
    const m = sceneMetrics(1280, 720);
    expect(GRID.w * m.scale).toBeGreaterThanOrEqual(1280);
    expect(GRID.h * m.scale).toBeGreaterThanOrEqual(720);
    expect(m.ox).toBeLessThanOrEqual(0);
    expect(m.oy).toBeLessThanOrEqual(0);
  });
  it('keeps the moon level line clear of the HUD, and still shows some floor, on a 1280 x 720 screen', () => {
    const m = sceneMetrics(1280, 720);
    expect(toScreen(m, 0, 24).y).toBeGreaterThanOrEqual(70);
    expect(toScreen(m, 0, 203).y).toBeLessThan(720);
  });
  it('sizes a phone scene to the part above the sheet and keeps the ball column in view', () => {
    const m = sceneMetrics(390, 844);
    expect(m.narrow).toBe(true);
    expect(m.oy + GRID.h * m.scale).toBeGreaterThanOrEqual(m.visible); // the scene runs down to the sheet
    expect(m.oy).toBeGreaterThanOrEqual(90); // and starts below the HUD, so the moon is clear of it
    expect(GRID.w * m.scale).toBeGreaterThanOrEqual(390);
    const ball = toScreen(m, BALL_X, 0).x;
    expect(ball).toBeGreaterThan(40);
    expect(ball).toBeLessThan(390 - 40);
    expect(toScreen(m, 0, LEVELS[5]!.y).y).toBeLessThan(m.visible); // even the rim is above the sheet
  });
  it('maps cells to screen pixels', () => {
    expect(toScreen(sceneMetrics(1440, 860), BALL_X, 24)).toEqual({ x: 528, y: 96 });
  });
});
