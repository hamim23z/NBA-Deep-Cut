/** Settings that change when the game launches or moves. Everything else reads them from here. */

/** The first day of the game: dive #1 is played on this calendar date in TIME_ZONE (YYYY-MM-DD). */
export const LAUNCH_DATE = '2026-10-29';

/** Everyone in this time zone gets the same dive on the same calendar day. */
export const TIME_ZONE = 'America/New_York';

export const historyKey = (mode: 'rare' | 'common', preview = false): string => `nylon:${preview ? 'preview:' : ''}history:${mode}`;
export const progressKey = (preview = false): string => `nylon:${preview ? 'preview:' : ''}progress`;
export const modeKey = (preview = false): string => `nylon:${preview ? 'preview:' : ''}mode`;
export const SOUND_KEY = 'nylon:sound';
export const LEGACY_KEYS = { history: 'deepcut.v1', progress: 'deepcut.v1.progress', sound: 'deepcut.sound', previewHistory: 'deepcut.preview.v1', previewProgress: 'deepcut.preview.v1.progress' } as const;

/**
 * The address of the live site, added to the share line and to the page's social tags (Open Graph and Twitter).
 * Change it here (and only here) if the site moves to another address or a custom domain.
 */
export const SITE_URL = 'https://nba-deep-cut.vercel.app';
