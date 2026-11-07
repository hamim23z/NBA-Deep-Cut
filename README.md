# NYLON

A daily basketball trivia game. Seven prompts, 25 seconds each, and your answers move a ball up or down a pixel-art world.

## How it works

Each day has a new dive of 7 prompts, like "Name a player who played for the Philadelphia 76ers in a playoff game in the 2020-21 season." Type a name and submit. Every answer is worth points based on how famous that player is, and there are two modes:

- **Rare mode:** The rarer your answer, the more points. You start on the moon and sink toward the arena rim.
- **Common mode:** The more famous your answer, the more points. You start at the rim and climb toward the moon.

Wrong or timed-out answers are worth 0. Your streak, best scores and past dives are saved in your browser.

## Run it on your computer

You only need Node.js installed (the current LTS version is fine).

1. Download or clone this repo.
2. Open a terminal in the `web` folder.
3. Run `npm install` once.
4. Run `npm run dev`.
5. Open the address it prints, usually http://localhost:5173.

All of the game data is already included, so you don't need to run anything else to play.

## Tech stack

- **Website:** Vite, React and TypeScript
- **Data pipeline:** Python (pandas, pyarrow, pytest) that turns public NBA play-by-play and box score data into the daily prompts and a fame ranking of players
- **Data source:** The open sportsdataverse ESPN NBA data
- **Saving progress:** Your browser's localStorage, with no accounts and no server
- **Hosting:** Vercel

## Why this exists

I only made this because I had Claude Code cloud credits to use up. Claude wrote all of it: the code, the data pipeline, the design, the tests and this README. All I did was write prompts.

## Disclaimer

Unofficial fan game. Not affiliated with or endorsed by the NBA.
