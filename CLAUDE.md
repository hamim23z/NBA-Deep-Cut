# CLAUDE.md

Rules for every Claude Code session on this repo. Read this and SPEC.md before doing anything.

## Project

NYLON (called Deep Cut until session 7f): a daily basketball trivia game with two modes, RARE (rarer answers score more, the ball sinks from the moon) and COMMON (famous answers score more, the ball climbs from the rim). An offline Python pipeline turns NBA box score data into `web/public/prompts.json` and `web/public/universe.json`. A static Vite + React + TypeScript site reads those files. No backend, no accounts. Full details are in SPEC.md.

The repo may contain leftover files from an earlier concept (Clutch Time Quiz). Ignore anything about play-by-play scenarios, possession, or golf scoring unless a session's goal says otherwise.

## Layout

- `pipeline/`: Python 3 (pandas, pyarrow, pytest). Fetch, normalize, fame score, prompt generator, export, tests.
- `web/`: Vite + React + TypeScript app. Reads `public/prompts.json` and `public/universe.json` only.
- `schema/`: JSON schemas for prompts and universe. They are the contract between pipeline and website. Do not change them unless your session's goal says so.
- `data/raw/`: raw downloads. Gitignored. Never commit large raw files.
- `docs/`: notes written by sessions (for example `docs/data-source-boxscores.md`).

## Working rules

- Do only the session goal you were given. Do not start other sessions' work.
- Each session ends with a pull request: short summary, and how to check it.
- Run the relevant tests before finishing (`pytest` in `pipeline/`, `npm test` and `npm run build` in `web/` once they exist). Fix failures before opening the PR.
- Keep changes small and commit often with clear messages.
- If you are blocked after a few honest attempts, stop and report what you tried and what you need. Do not keep retrying or invent data.
- Never fabricate data or statistics. Every valid answer must come from the real data. Sample values in docs are placeholders only.
- Every prompt must state its era (for example "Since 2002") so its valid-answer list is complete.
- Do not use NBA logos or league branding. Plain names are fine.
- When you add a command (run the pipeline, start the site, run tests), record it in the Commands section below.

## Commands

Filled in by sessions as they are built.

- Install pipeline dependencies: `pip install -r pipeline/requirements.txt`
- Pipeline (fetch + normalize, seasons 2002-2026): `python3 pipeline/run.py` from the repo root (about 90 s, run it as plain `python3`, not `python3 -I`). Downloads one season at a time, deletes the raw files it downloaded, writes the six tables `players`, `teams`, `games`, `player_games`, `team_games`, `officials` (parquet) and `summary.json` to `data/processed/`, and regenerates `docs/pipeline-notes.md`. Resumes if interrupted; `--force` redoes finished seasons, `--start 2024 --end 2024` picks seasons, `--keep-raw` keeps downloads. Hand-written aliases are in `pipeline/data/aliases.csv`.
- Fame, tiers and candidate prompts (session 4): `python3 pipeline/generate.py` from the repo root, after the pipeline has built `data/processed/`. Computes the fame score and tier of every player, generates candidate prompts from the templates in `pipeline/templates.py`, and writes `data/generated/{fame.parquet,candidates.json,candidates_meta.json}` (gitignored) plus `docs/fame-report.md` and `docs/prompt-candidates.md`. Prints tier counts, the candidate total and templates with no candidates. Hand-written review notes for the fame report: `pipeline/data/fame-review.md`.
- Curate and export (session 5): `python3 pipeline/export.py` from the repo root, after the pipeline has built `data/processed/`. Runs everything `generate.py` does, then picks 504 prompts into 72 dives of 7 (about 2 minutes), builds the universe, checks both files against the schemas and the rarity targets, rechecks at least 60 prompts (2 per template family) against the tables, and writes `data/export/prompts.json` and `data/export/universe.json` (committed) plus `docs/prompts-sample.md`, `docs/curation-report.md` and `docs/rarity-report.md`. Layout: docs/export-format.md. Hand-written inputs: `pipeline/data/{fame_overrides,aliases,team_aliases,outside_range}.csv`; `pipeline/data/rarity-baseline.json` is the session 5 export's tier counts, the "before" of the rarity report. If the code or those files change, rerun it and commit the new export (a test fails if `data/export/` is out of date).
- Data spike 2 (Deep Cut): download per docs/data-source-boxscores.md, then `python3 pipeline/spike/boxscore_feasibility.py data/raw/boxscores` (counts and checks; output saved in docs/boxscore-feasibility-output.txt). Optional referee cross-check: `python3 pipeline/spike/referee_census.py data/raw/boxscores <out.parquet> 2002 2026`.
- Website: `cd web && npm ci` once. `npm run dev` (dev server) first runs `npm run sync-data`, which copies `data/export/prompts.json` and `universe.json` into `web/public/` and turns `pipeline/data/outside_range.csv` into `web/public/outside_range.json`; it skips with a message when `../data` is missing or on Vercel, and it is never part of `npm run build`. The three copies in `web/public/` are committed (Vercel builds from `web/` alone), so commit them after an export. `npm run build` (type-check and bundle to `web/dist`) and `npm run preview` (serve the build). Launch date (`2026-10-29`), time zone and `SITE_URL` (`https://nba-deep-cut.vercel.app`) are in `web/src/config.ts`; dive N = prompts 7(N-1) to 7(N-1)+6 of the file, wrapping after the last dive. QA before the launch: `/?preview=1` shows a Play-test, `/?preview=1&today=2026-11-10` pretends it is that day (own saved progress). Deploying: docs/deploy.md.
- Site icons (session 7e, redrawn in 7f): `python3 tools/icons/gen_icons.py` from the repo root (needs Pillow, and `npm install` in `web/` for the fonts) redraws `web/public/{favicon,apple-touch-icon,social}.png` as small pixel art (a pixel basketball, the moon with a hoop, the tier squares; no logos). The PNGs are committed, so you only run it to change them. The scene itself has no image files: it is drawn in code (`web/src/world/scene.ts`).
- Pipeline tests: `cd pipeline && python3 -m pytest` (tiny synthetic samples, no downloads needed)
- Animation review page: `npm run dev` then open `/?animations=1` (in a build, `/?preview=1&animations=1`); it shows the ball moving to every level in either mode, looping or one at a time, with a reduced-motion switch. The moon world (`web/src/world/`: `scene.ts` draws the pixel scene into buffers and works out where it sits on a screen; the ball, gauge, ruler and readouts all derive from the running total through `ballY`, `zoneName` and `altitudeFt` in `modes.ts`, `World.tsx` shows it and the ball, gauge and ruler, `worldStore.tsx` is what the screens publish) is lazy loaded. Modes and points are `web/src/modes.ts` (`pointsFor(mode, tierIdx)`); the mode comes from the URL hash (`#rare`, `#common`), else the saved choice (`nylon:mode`). The old `deepcut.*` localStorage keys are migrated once to `nylon:*` (`migrateLegacy` in `web/src/storage.ts`). Tests set the launch date to 2026-11-03 in `web/src/setupTests.ts` and check the real one in `launch.test.tsx`. Fonts are self-hosted (`@fontsource/press-start-2p` for headings, numbers and buttons, `@fontsource/vt323` for body text), no network needed. The game logic is `web/src/dive2.ts`, the component `web/src/Dive.tsx`; never add two files whose names differ only by case (the owner is on Windows).
- Web tests: `cd web && npm test` (fixtures in `web/src/__fixtures__/`; `realData.test.ts` reads the committed export). `schema/match-cases.json` is shared by `web/src/matching.shared.test.ts` and `pipeline/tests/test_matchnorm_shared.py`.

## Conventions

- Python: type hints, small functions, one module per pipeline stage, tests next to the stage they cover.
- TypeScript: strict mode, no `any`, types generated or written from the schemas.
- Scoring tiers: 10, 20, 35, 55, 75, 100 points by global fame percentile (top 3%, 3 to 10%, 10 to 25%, 25 to 50%, 50 to 75%, bottom 25%). A wrong or timed-out answer scores 0.
- Prompt validity: at least 15 valid answers for player prompts and at least 5 for team prompts.
