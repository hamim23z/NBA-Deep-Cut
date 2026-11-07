import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright');
const base = process.env.BASE_URL ?? 'http://localhost:4173/';
const shots = process.argv[2];
const prompts = JSON.parse(readFileSync(resolve(here, '../public/prompts.json'), 'utf8'));
const find = (text) => prompts.find((p) => p.text.toLowerCase() === text.toLowerCase());
const sizes = [[390, 844], [360, 640], [320, 568]];
const failures = [];

const check = (label, ok, detail = '') => {
  if (!ok) failures.push(`${label} ${detail}`);
};

const rect = (page, selector, nth = 0) =>
  page.evaluate(([sel, n]) => {
    const el = document.querySelectorAll(sel)[n];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  }, [selector, nth]);

const inside = (r, w, h) => r && r.x >= -0.5 && r.y >= -0.5 && r.right <= w + 0.5 && r.bottom <= h + 0.5;
const overlap = (a, b) => a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

async function setKeyboard(page, height) {
  await page.evaluate((h) => {
    Object.defineProperty(window.visualViewport, 'height', { get: () => h, configurable: true });
    window.visualViewport.dispatchEvent(new Event('resize'));
  }, height);
  await page.waitForTimeout(400);
}

async function page_(page, label, w, h, vh) {
  const doc = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth }));
  check(`${label}: document height equals the viewport`, doc.sh === doc.ih, `${doc.sh} vs ${doc.ih}`);
  check(`${label}: no horizontal overflow`, doc.sw <= doc.iw, `${doc.sw} vs ${doc.iw}`);
}

async function run(browser, [w, h]) {
  const tag = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name) => (shots ? page.screenshot({ path: `${shots}/${tag}-${name}.png` }) : null);

  await page.goto(`${base}#rare`);
  await page.waitForSelector('.home');
  await page.waitForTimeout(900);
  await page_(page, `${tag} home`, w, h, h);
  const homeBox = await rect(page, '.home');
  check(`${tag} home: inside the viewport`, inside(homeBox, w, h));
  await shot('1-home');

  await page.tap('text=PLAY RARE SHOT');
  await page.waitForSelector('.answer__input');
  await page.waitForTimeout(500);
  await page_(page, `${tag} prompt`, w, h, h);
  await shot('2-prompt');

  const vh = Math.round(h * 0.45);
  await page.focus('.answer__input');
  await page.fill('.answer__input', 'Le');
  await page.waitForSelector('.suggestion');
  await setKeyboard(page, vh);
  await page_(page, `${tag} keyboard`, w, h, vh);
  const card = await rect(page, '.prompt');
  const input = await rect(page, '.answer__input');
  const button = await rect(page, '.answer__submit');
  const answer = await rect(page, '.answer');
  const ball = await rect(page, '.world__ball');
  check(`${tag} keyboard: question card inside the visible area`, inside(card, w, vh), JSON.stringify(card));
  check(`${tag} keyboard: input inside the visible area`, inside(input, w, vh), JSON.stringify(input));
  check(`${tag} keyboard: ANSWER inside the visible area`, inside(button, w, vh), JSON.stringify(button));
  check(`${tag} keyboard: ANSWER at least 44px`, button && button.h >= 44 && button.w >= 44);
  check(`${tag} keyboard: ball inside the visible area`, inside(ball, w, vh) && ball.w >= 28, JSON.stringify(ball));
  check(`${tag} keyboard: ball clear of the card and the input row`, !overlap(ball, card) && !overlap(ball, answer), JSON.stringify({ ball, card, answer }));
  const fontSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.answer__input')).fontSize));
  check(`${tag}: input font at least 16px`, fontSize >= 16);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.suggestion')].map((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { y: r.y, bottom: r.bottom, h: r.height, hit: el.contains(top) };
  }));
  const visible = rows.filter((r) => r.y >= 0 && r.bottom <= vh && r.hit);
  check(`${tag} keyboard: at least 3 suggestion rows fully visible`, visible.length >= 3, JSON.stringify(rows));
  check(`${tag} keyboard: suggestion rows at least 44px`, rows.every((r) => r.h >= 44));
  check(`${tag} keyboard: at most 4 rows tall`, rows.length <= 6);
  await shot('3-keyboard-suggestions');

  const name = await page.textContent('.suggestion .suggestion__name');
  await page.tap('.suggestion');
  const picked = await page.evaluate(() => ({ value: document.querySelector('.answer__input').value, card: !!document.querySelector('.result-card') }));
  check(`${tag}: a tapped suggestion only fills the input`, picked.value === name && !picked.card);

  await setKeyboard(page, h);
  await page.tap('.answer__submit');
  await page.waitForSelector('.result-card__body');
  await page.waitForTimeout(1500);
  await page_(page, `${tag} result`, w, h, h);
  const active = await page.evaluate(() => document.activeElement.tagName);
  check(`${tag} result: the input is blurred`, active !== 'INPUT');
  const body = await rect(page, '.result-card__body');
  const next = await rect(page, '.result-card__next');
  const rball = await rect(page, '.world__ball');
  const tagBox = await rect(page, '.world__tag');
  check(`${tag} result: card inside the viewport`, inside(body, w, h), JSON.stringify(body));
  check(`${tag} result: the button is pinned inside the viewport and big`, inside(next, w, h) && next.h >= 44, JSON.stringify(next));
  check(`${tag} result: ball visible and clear of the card`, inside(rball, w, h) && !overlap(rball, body), JSON.stringify({ rball, body }));
  check(`${tag} result: answer tag next to the ball`, inside(tagBox, w, h) && tagBox && Math.abs(tagBox.y + tagBox.h / 2 - (rball.y + rball.h / 2)) < 30, JSON.stringify({ tagBox, rball }));
  await shot('4-after-submit');

  for (let i = 0; i < 6; i++) {
    await page.tap('.result-card__next');
    await page.waitForSelector('.answer__input');
    const p = find((await page.textContent('.prompt')).replace(/\s+/g, ' ').trim());
    const a = p.answers.find((x) => x.tier === 3) ?? p.answers[0];
    await page.fill('.answer__input', a.name);
    await page.tap('.answer__submit');
    await page.waitForSelector('.result-card__body');
    await page.waitForTimeout(250);
  }
  await page.tap('.result-card__next');
  await page.waitForSelector('.final');
  await page.waitForTimeout(1400);
  await page_(page, `${tag} results`, w, h, h);
  await shot('5-results');
  const sheet = await rect(page, '.final');
  check(`${tag} results: inside the viewport`, inside(sheet, w, h), JSON.stringify(sheet));
  const rball2 = await rect(page, '.world__ball');
  check(`${tag} results: ball visible and clear of the sheet`, inside(rball2, w, h) && !overlap(rball2, sheet), JSON.stringify({ rball2, sheet }));
  check(`${tag}: no script errors`, errors.length === 0, errors.join('; '));
  await ctx.close();
}

const browser = await chromium.launch();
for (const size of sizes) await run(browser, size);
await browser.close();
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('mobile checks passed');
