import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_URL } from './config';

const web = process.cwd();
const html = readFileSync(resolve(web, 'index.html'), 'utf8');
const tag = (re: RegExp): string | undefined => re.exec(html)?.[1];

describe('page metadata', () => {
  it('has Open Graph and Twitter card tags with an image', () => {
    for (const prop of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:alt']) expect(html, prop).toContain(`property="${prop}"`);
    for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) expect(html, name).toContain(`name="${name}"`);
    expect(tag(/name="twitter:card" content="([^"]+)"/)).toBe('summary_large_image');
  });

  it('takes the address of the social image and the page from the one SITE_URL constant', () => {
    expect(tag(/property="og:image" content="([^"]+)"/)).toBe('%SITE_URL%/social.png');
    expect(tag(/property="og:url" content="([^"]+)"/)).toBe('%SITE_URL%/');
    expect(html).not.toMatch(/https?:\/\/deep-cut/); // the address is written once, in config.ts
    expect(SITE_URL).toMatch(/^https:\/\//);
  });

  it('has a favicon, a touch icon and a social image that exist, the image at 1200x630', () => {
    for (const f of ['favicon.png', 'apple-touch-icon.png', 'social.png']) expect(existsSync(resolve(web, 'public', f)), f).toBe(true);
    const png = readFileSync(resolve(web, 'public/social.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(statSync(resolve(web, 'public/social.png')).size).toBeLessThan(600_000);
  });

  it('draws no logos or marks: the favicon is the pixel basketball, made by tools/pixel/gen_pixel.py', () => {
    const png = readFileSync(resolve(web, 'public/favicon.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(64);
    expect(png.readUInt32BE(20)).toBe(64);
    expect(statSync(resolve(web, 'public/favicon.png')).size).toBeLessThan(5_000);
  });

  it('loads no third-party scripts, styles or fonts', () => {
    expect(html).not.toMatch(/<script[^>]+src="https?:/);
    expect(html).not.toMatch(/<link[^>]+href="https?:\/\/(?!deep)/);
    const src = readFileSync(resolve(web, 'src/main.tsx'), 'utf8');
    expect(src).not.toMatch(/https?:\/\//);
  });
});

describe('no tracking', () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(resolve(dir, d.name)) : [resolve(dir, d.name)]));
  const source = files(resolve(web, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));

  it('has no analytics, no cookies and no external requests in the source', () => {
    for (const f of source) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/document\.cookie|gtag|google-analytics|googletagmanager|plausible|mixpanel|segment\.com|hotjar|sentry|fbq\(|navigator\.sendBeacon/i);
      expect(text, f).not.toMatch(/fetch\(\s*['"`]https?:/);
    }
  });

  it('only stores things in localStorage under its own nylon: keys (and reads the old deepcut. ones)', () => {
    const config = readFileSync(resolve(web, 'src/config.ts'), 'utf8');
    for (const key of config.matchAll(/(?:KEY|Key) = (?:\([^)]*\): string => )?[`']([^`']+)[`']/g)) expect(key[1]).toMatch(/^nylon:/);
    expect(config).toMatch(/SOUND_KEY = 'nylon:sound'/);
    expect(config).toMatch(/LEGACY_KEYS/); // the old names are read once and migrated, never written
  });

  it('has no dependency on a tracking or analytics package', () => {
    const pkg = JSON.parse(readFileSync(resolve(web, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).filter((d) => /analytics|segment|sentry|gtag|plausible|mixpanel/i.test(d))).toEqual([]);
  });
});
