# Deploying NYLON on Vercel

NYLON is a static site: `web/` builds to `web/dist` and needs no server, database or environment variables. The three data files it reads (`prompts.json`, `universe.json`, `outside_range.json`) are committed in `web/public/`, so the build needs only the contents of `web/`.

## Before the first deploy

1. Check **`SITE_URL`** in `web/src/config.ts`: it is `https://nba-deep-cut.vercel.app` (change it, with no trailing slash, if the site is given another address or a custom domain). It is used in the share line ("Deep Cut #12: 385", the squares, then this address) and in the social-card tags.
2. `LAUNCH_DATE` in the same file is `2026-10-29`: that day (New York time) is dive #1 and the site is playable from then on. Before it visitors see a "Coming soon" screen.
3. Commit and push.

## First deploy

1. Go to vercel.com, **Add New... > Project**, and import the GitHub repository.
2. Set **Root Directory** to `web`.
3. **Framework Preset**: Vite (it is detected, and `web/vercel.json` also says `vite`).
4. Leave **Build Command** (`npm run build`), **Output Directory** (`dist`) and **Install Command** (`npm ci`) at their defaults; `vercel.json` sets the same values.
5. Add **no environment variables**. Nothing in the build reads one.
6. Click **Deploy**. The build runs `tsc -b && vite build`; it does not run the data sync (that script exits early on Vercel and when `../data` is missing).

`web/vercel.json` also sets caching: the three data files revalidate every minute, hashed files under `/assets/` are cached for a year, and the page itself is always revalidated so a new deploy shows up at once. Page addresses fall back to `index.html`; files (the JSON, images) are never rewritten.

## A custom domain

1. In the project, **Settings > Domains > Add**, and type the domain.
2. Follow the DNS instruction Vercel shows (an A record for an apex domain, or a CNAME for a subdomain such as `www`).
3. When it shows as valid, set **`SITE_URL`** in `web/src/config.ts` to the new address, commit and push, so the share line and the social card use it.

## Changing the data and redeploying

The data is committed, so a data change is a normal commit:

```
python3 pipeline/run.py          # only when the source data has changed
python3 pipeline/export.py       # regenerates data/export/*.json
cd web && npm run sync-data      # copies them into web/public/
git add data/export web/public && git commit -m "New prompts" && git push
```

Vercel deploys on every push to the production branch. Visitors pick up the new data within about a minute (the data files revalidate every 60 seconds). To redeploy without a change, use **Deployments > the latest > Redeploy**.

Note that dive N always plays prompts 7(N-1) to 7(N-1)+6, so replacing or reordering prompts changes what the day's dive is for everyone, including days already played (players' saved results keep their old score and squares). Append new dives at the end rather than reordering.

## Checklist for the live site

Run this on the real URL, on a phone and on a desktop:

- [ ] The home screen loads, with the right dive number for today in New York time (before launch: "Coming soon" with the launch date).
- [ ] `/?preview=1` before launch shows a Play-test, and a test play is not saved.
- [ ] Play a full dive: answers score, the shot animations play, Enter skips a shot, the results screen shows the total and the share button.
- [ ] Copy result: the pasted text is `NYLON RARE #N: score` (or COMMON), seven squares and the live address (`https://nba-deep-cut.vercel.app`, not another address).
- [ ] Reload in the middle of a dive: it resumes at the next prompt with the same score.
- [ ] Reload after finishing: it opens on the results screen. The archive lists past dives, and playing one does not change the streak.
- [ ] Share the link in a chat app or a social post: the card shows the title, description and the social image.
- [ ] `/prompts.json`, `/universe.json` and `/outside_range.json` load (open them in the browser) and `/favicon.png` shows an icon.
- [ ] Turn on a system "reduce motion" setting: shots become a plain fade.
- [ ] The browser console shows no errors.
- [ ] Block site data (a private window with cookies blocked): the game still plays and says it is not saving anything.

## Privacy: no tracking

The site has **no analytics, no cookies, no third-party scripts and no external requests**. Fonts are self-hosted. The only thing stored is in the visitor's own browser (localStorage): finished dives, the dive in progress, the sound setting, and the streak that is computed from them. Nothing is sent anywhere. Do not add analytics or embeds without updating this section and the how-to-play screen.
