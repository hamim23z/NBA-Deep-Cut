# NYLON: Spec & Build Plan

## Overview

NYLON (called Deep Cut until session 7f) is a daily basketball trivia game with two modes: in RARE, obscure correct answers score more than obvious ones and the ball sinks from the moon; in COMMON, famous answers score more and the ball climbs from the rim to the moon. It is inspired by the daily rare-answer trivia format (Krillion) but built entirely on NBA data.

- **Daily Dive:** 7 prompts, 25 seconds each, the same set for every player each day.
- **Your move:** type one answer per prompt, such as a player or a team. Autocomplete suggests names from the full player and team list, so it never reveals the valid answers.
- **Scoring:** a valid answer earns points by its fame tier and the mode (see Modes). An invalid, empty or late answer earns 0 in both modes.
- **Reveal:** after each prompt the ball moves to the answer's level, and a card shows the level, the points and the most famous and the rarest valid answers.
- **Share:** your mode, dive number and total points plus 7 colored squares, one per prompt, colored by tier.

**What done means for the credit window:** a public URL live by November 3 with at least 63 prompts (9 days of dives), player and team prompt types, rarity scoring, daily rotation, share, streaks and an archive. No accounts and no backend: it is a static site.

## Era and answer types

All data comes from NBA games since the 2001-02 season (the range confirmed in session 1's spike of the sportsdataverse releases). Every prompt states its era in the text, for example "Since 2002, name a player who scored 40 or more points in a game." This keeps the valid-answer list complete by construction. If someone types a real player from before 2002, the game says "outside the data range" and does not count it as a wrong guess against their streak.

Answer types in version 1:

| Answer type | Example prompt |
| --- | --- |
| Player | Since 2002, name a player who scored 40+ points in a playoff game |
| Player | Since 2002, name a player who recorded a triple-double in the Finals |
| Team | Since 2002, name a team that won 60+ regular-season games in a season |
| Team | Since 2002, name a team that scored 150+ points in a regulation game |

Games and scores appear inside the criteria of prompts rather than as answers. Referees are a stretch goal that depends on session 1's finding about referee data.

## Scoring and rarity

Every valid answer gets a tier from a fame score computed once in the pipeline. This is a stand-in for real crowd answer frequencies, which a static site cannot collect on day one. It is an approximation and is labeled as such on the how-to-play screen.

- **Players:** fame score is career points in the dataset. Rank every player in the data, then assign tiers by global percentile (not by percentile within the prompt), so a superstar is low value in every prompt.
- **Teams:** teams are mostly familiar, so they get the lowest tier by default, and defunct or renamed franchise names (for example Seattle, New Jersey) get a higher tier.

| Tier | Fame percentile (1 = most famous) | Points |
| --- | --- | --- |
| 1 | top 3% | 10 |
| 2 | 3 to 10% | 20 |
| 3 | 10 to 25% | 35 |
| 4 | 25 to 50% | 55 |
| 5 | 50 to 75% | 75 |
| 6 | bottom 25% | 100 |

A dive is worth at most 700 points. Wrong, invalid or timed-out answers score 0. The share line reads like `NYLON RARE #12: 385` followed by seven colored squares and the address.

## Modes

Both modes use the same daily seven prompts and the same tiers; only the points differ. With the tier index 0 (most famous) to 5 (rarest) the pipeline already computes, `pointsFor(mode, tierIdx)` is `TIER_POINTS[tierIdx]` in **RARE** and `TIER_POINTS[5 - tierIdx]` in **COMMON** (the values are 10, 20, 35, 55, 75 and 100). A wrong, empty or timed-out answer is 0 in both.

- The mode is chosen on the home screen (two cards), remembered as the last used, reflected in the URL hash (`#rare`, `#common`; the hash wins over the saved choice) and shown in the HUD. The results screen has "Play the other mode".
- A day counts for the streak if either mode was completed. Finished dives (so best scores, the archive and the results) are stored per mode.
- The old localStorage keys (`deepcut.*`) are read once and copied to `nylon:*` (the old history becomes the RARE history, which is how it was scored); they are never deleted.

## The moon world (the interface)

One full-screen pixel-art scene, procedurally drawn on a 360 x 215 grid (no image files), with a floating question card (a bottom sheet on a phone). Levels, top to bottom, with the ball's row on the grid, the altitude and the pick: MOON 24 (3,200 ft, FRANCHISE), ORBIT 60 (2,400, ALL-STAR), CLOUDS 94 (1,800, STARTER), ROOF 128 (1,100, ROTATION), RAFTERS 162 (500, BENCH), RIM 190 (60, DEEP CUT). The most famous answers are always on the moon. RARE starts the ball on the moon and sinks (MOON pays 10 ... RIM pays 100); COMMON starts at the rim and climbs (RIM pays 10 ... MOON pays 100). Reaching the end level (RIM in RARE, MOON in COMMON) plays a short celebration and the top-tier sound. A wrong answer leaves the ball where it is (it shakes) and the card says AIRBALL. The scene is decoration (`aria-hidden`); a polite live line says each result ("ORBIT, 75 points, 185 total"). docs/design.md has the details.

## Answer matching

- Normalize before comparing: lowercase, strip accents and punctuation, drop suffixes like Jr. and III.
- Accept full names, known aliases (for example nicknames and spelling variants from the aliases list), and a last name only when it is unique across all players in the universe.
- Allow small typos: edit distance 1 for names of 6 to 10 characters, 2 for longer names.
- Autocomplete lists the whole universe, not just valid answers.

## Data and content pipeline

An offline Python pipeline turns box score data into a fixed `prompts.json` plus a `universe.json`. The website never touches raw data.

1. **Fetch** player box scores, team box scores, game schedule and (if it exists) referee data from sources confirmed in the data spike. Store raw files in `data/raw/` (gitignored).
2. **Normalize** into tables: players (with name variants), teams (with historical names), games, and player-game and team-game stats.
3. **Fame and tiers:** compute fame scores and tiers as described above.
4. **Generate prompts** from templates with parameters (stat thresholds, playoffs versus regular season). Keep a prompt only if it has at least 15 valid answers for players or at least 5 for teams, and no more than a set maximum, so it is neither trivial nor impossible. Record each prompt's difficulty from its number of valid answers and its tier mix.
5. **Curate and export:** select at least 63 prompts, balanced across templates and difficulty, no repeats, and export `web/public/prompts.json` and `web/public/universe.json`, validated against the schemas.

**Prompt schema (the contract between pipeline and website):**

```json
{
  "id": "p-0042",
  "answerType": "player",
  "text": "Since 2002, name a player who scored 40 or more points in a playoff game.",
  "answers": [
    { "id": "pl-123", "name": "Example Player", "tier": 3, "points": 35 }
  ],
  "difficulty": "medium"
}
```

**Universe schema:**

```json
{ "players": [ { "id": "pl-123", "name": "Example Player", "aliases": ["E. Player"] } ],
  "teams":   [ { "id": "tm-5", "name": "Example Team", "aliases": ["Example"] } ] }
```

The values in these samples are placeholders to show the shape, not real data.

## Architecture and stack

Two pieces joined by JSON files: a Python pipeline that runs offline, and a static website that only reads `prompts.json` and `universe.json`.

| Piece | Choice | Why |
| --- | --- | --- |
| Pipeline | Python 3, pandas, pyarrow, pytest | Parquet input, easy to test |
| Website | Vite, React, TypeScript | One static build |
| State | Browser localStorage | Streaks and history without a backend |
| Hosting | GitHub Pages (or Vercel) | Free, deploys from the repo |
| Contracts | `schema/prompts.schema.json`, `schema/universe.schema.json` | Lets pipeline and website be built in parallel |

```
repo/
  SPEC.md            this document
  CLAUDE.md          rules and commands for every session
  pipeline/          fetch, normalize, fame, generate, export, tests
  web/               the React app and public/*.json
  data/raw/          gitignored raw data
  schema/            JSON schemas
  docs/              notes written by sessions
```

Answers ship inside the JSON, so a determined player could read them. That is acceptable for a casual daily game. The daily dive is chosen from the launch date, so everyone sees the same 7 prompts on a given day.

## Build plan

Nine small sessions, each with one goal and a checkable finish line. Merge each pull request before starting dependent sessions.

| # | Goal | Done when | Depends on |
| --- | --- | --- | --- |
| 0 | You: replace SPEC.md, CLAUDE.md and README.md on main, close the old Clutch Time pull requests | New files on main | none |
| 1 | Data spike 2: find reachable box score, schedule, universe and referee data and test counts | docs/data-source-boxscores.md names working sources and shows real counts for sample prompts | 0 |
| 2 | Pipeline core: fetch and normalize into players, teams, games and stat tables | Tests pass and one command produces the processed tables | 1 |
| 3 | Website with mock data: timer, input with autocomplete, matching, reveal, scoring, share, mobile layout; creates both schemas | App plays a full dive from a hand-written 10-prompt file that follows the schemas | 0 (parallel with 2) |
| 4 | Fame score, tiers and prompt generator | Generator outputs candidate prompts with valid answers, tiers and difficulty, and tests pass | 2 |
| 5 | Curate and export at least 63 prompts and the universe | Files pass schema validation and a printed 20-prompt sample looks right | 4 |
| 6 | Integration: real data, daily rotation, streaks, archive, how-to-play screen | A full dive plays end to end from the real files | 3, 5 |
| 7 | Polish and deploy: accessibility, tests, README, GitHub Pages | Public URL works on a phone and a laptop | 6 |
| 8 | Review: a fresh session audits the code and 20 random prompts by checking valid answers against the data, then fixes issues | Written list of issues, all fixed or logged | 7 |

Sessions 2 and 3 run at the same time because they only share the schemas.

**Prompt template for every session:**

```
Read SPEC.md and CLAUDE.md first. Your task is session N: <goal>.
Stay inside that goal. Do not start other sessions' work.
Done means: <done-when line>. Run the tests before finishing.
If you are blocked for more than a few attempts, stop and report what you tried.
Open a pull request with a short summary of what changed and how to check it.
```

## Credit budget and timeline

About $6 has been spent. The plan spends roughly $73 on the core build and keeps about $20 in reserve, finishing the day before the November 4 expiry. Dollar figures are estimates, so treat the first two days as calibration.

| Day | Sessions | Budget (USD) |
| --- | --- | --- |
| Tue Oct 27 | 0 and 1: new files, data spike 2 | 3 |
| Wed Oct 28 | 2 and 3 in parallel | 22 |
| Thu Oct 29 | 4: fame score and prompt generator | 12 |
| Fri Oct 30 | 5: curate and export | 8 |
| Sat Oct 31 | 6: integration | 12 |
| Sun Nov 1 | 7: polish and deploy | 10 |
| Mon Nov 2 | 8: review and fixes | 6 |
| Tue Nov 3 | Reserve: stretch work or reruns | 20 |

**Spending the reserve, in order of value:** a referee prompt type (only if the data exists), a second answer type for scores or seasons, real answer-frequency rarity through a small backend, a hard mode with a 15-second timer, a generated share image.

## Risks and cuts

| Risk | What happens | Fallback |
| --- | --- | --- |
| Referee data missing | No referee prompts | Cut referees from version 1 |
| Fame score feels wrong | A famous player scores high or the reverse | Adjust the tier cutoffs, or blend career points with games played |
| Valid answers incomplete | A correct answer is rejected because the data lacks it | State the era in every prompt, and show the full valid list on reveal |
| Name matching too strict or loose | Frustrating misses or false accepts | Add an aliases list and test with 50 hand-written inputs |
| Credit runs short | Later sessions cannot finish | Cut in the order below |

**Cut order if credit runs short:** stretch work first, then the archive, then streaks, then team prompts. The share button stays, because it is what makes the game spread.
