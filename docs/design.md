# Design notes: NYLON and the moon world

NYLON is one place: a full-screen pixel-art world that stays on screen from the first moment and never reloads while the player moves between home, a prompt, the result, the results, the archive and how to play. A card floats over it (a sheet at the bottom on a phone). The world is decoration (`aria-hidden`); the HUD and the card carry every word and number, and a polite live line says each result.

The look is black and orange, hard-edged pixel art: boxes are near-black (`#0A0A0A`, about 90% opaque) with a 4px orange border, shadows are hard offsets, motion is stepped or eased on transform and opacity only. No glow, no blur, no gradients on the UI (the sky is dithered steps in the pixel scene), no rounded corners, no image files. A test checks the stylesheets.

## The world (`web/src/world/`)

- **Drawn once, in code.** `scene.ts` fills RGBA buffers on a **360 x 215** grid (the static scene, the clouds, three star layers, two crowd-shimmer layers); `World.tsx` puts each buffer on a canvas with `putImageData`, scaled with `image-rendering: pixelated`. Nothing is redrawn per frame: the ambient motion is CSS on whole layers (stars fade, clouds slide, the crowd shimmers between two layers, two satellites cross).
- **Top to bottom:** a dithered night sky (`#0A060C` to `#1E1620`) with stars; the **moon** at (132, 22), radius 16, off-white with craters, with a **hoop** under it (an orange rim at rows 36 to 38 and a small white net); pixel clouds; an arena **roof** at rows 128 to 135 with an opening above the ball column; **rafters**; retired-number **banners** (orange and cream, numbers from a 3 x 5 pixel font) across the width except the ball column; a dithered **crowd**; a hardwood **floor** from row 203 with a cream baseline; and the **arena hoop** at the ball column (backboard, orange rim at row 183, net, grey stanchion). A faint dotted guide runs down column 132.
- **Where the grid sits (`sceneMetrics`).** On a wide screen the grid fills the screen (the larger of the two scales, centred; exactly 4 pixels per cell at 1440 x 860), but never so far up that the moon's level line runs under the HUD. On a phone (under 700 px) the grid is sized to the part between the HUD (96 px) and the bottom sheet (46% of the height), and the ball column is kept at about 30% across.

## Levels and modes

| Level | Row | Altitude | Pick | Tier | RARE pays | COMMON pays |
| --- | --- | --- | --- | --- | --- | --- |
| MOON | 24 | 3,200 ft | FRANCHISE | 1 | 10 | 100 |
| ORBIT | 60 | 2,400 ft | ALL-STAR | 2 | 20 | 75 |
| CLOUDS | 94 | 1,800 ft | STARTER | 3 | 35 | 55 |
| ROOF | 128 | 1,100 ft | ROTATION | 4 | 55 | 35 |
| RAFTERS | 162 | 500 ft | BENCH | 5 | 75 | 20 |
| RIM | 190 | 60 ft | DEEP CUT | 6 | 100 | 10 |

The most famous answers (tier 1) are always on the moon; the mode decides what that is worth (`pointsFor(mode, tierIdx)` in `modes.ts`). RARE starts the ball on the moon and sinks, COMMON starts at the rim and climbs. A wrong, empty or late answer leaves the ball where it is, shakes it, and the card says AIRBALL and +0. Reaching the end level (RIM in RARE, MOON in COMMON) sets off a pixel confetti burst, a flash of that hoop, a ripple of its net, and the existing top-tier sound.

## Screens

- **Home:** the world behind with the ball at the mode's start; on the right "THE DAILY BASKETBALL SHOT", a big NYLON (Press Start 2P, a hard shadow in deep orange), the tagline, two mode cards (the chosen one has the orange border), a full-width "PLAY RARE SHOT" or "PLAY COMMON SHOT", Archive, How to play and the streaks.
- **A prompt:** the HUD (NYLON chip, boxed ALTITUDE in feet, seven prompt pips coloured by tier with their numbers, boxed SCORE, sound), the depth gauge at the left (six rows, each a tier chip, the level name and its points, on the level's own line), dashed level lines across the scene, the mode chip at the bottom left, a dotted ruler at the right edge with an orange YOU arrow at the ball's level and small ghost balls for earlier answers, and the question card: the timer (a number and a striped bar), the era in orange, the question in large VT323 with its first letter capitalised (display only), the answer box and a one-line mode hint.
- **After an answer:** the ball moves to its level (700 ms for a step, up to 1,000 ms for the whole way, eased in and out; speed streaks trail it) and the card turns into a result card with a border in the tier's colour: the level, its pick, the answer in quotes, "+75 PTS · sink to 2,400 ft", a line of flavour, and SINK or CLIMB to go on. The answer stays in a focused read-only input: Enter goes on (armed a moment after the card appears, so the Enter that submitted the answer does not count), Tab reaches the button. A tap skips the move. The famous and rare answers are in a closed section.
- **Results:** the ball on its final level, the total, the final altitude, the best score in this mode, the streak, a tier breakdown, the share text (NYLON, mode, dive number, score, seven tier squares, the address), "Play the other mode" and a link to the archive.
- **A phone (390 x 844):** the left gauge is hidden (the right ruler stays), the HUD shrinks to chips, the question card becomes a bottom sheet whose height never changes, the suggestions open upwards, and there is no horizontal scroll.

## Type and colour

Press Start 2P for headings, numbers and labels; VT323 for body text, the question and the input. Palette: ink `#0A0A0A`, orange `#FF6A13`, amber `#FFB347`, red `#FF3B1F`, cream `#F4EAD6`, greys `#A8A8A8`, `#6E6E6E`, `#3A3A3A`. Tier colours: 1 `#6E6E6E`, 2 `#A8A8A8`, 3 `#EDEDED`, 4 `#FFB020`, 5 `#FF6A13`, 6 `#FF3B1F`; the number is always shown with the colour (chips, pips, squares, the gauge), white text on tier 1 and ink on the rest, and the level name of tier 1 is drawn in `#A8A8A8` on the card. All text is at least 4.5 : 1 (`nylonText.test.tsx` computes it).

## Accessibility

The world is `aria-hidden`. A visually hidden `aria-live="polite"` line next to it says each result ("ORBIT, 75 points, 185 total", or "AIRBALL, 0 points, 0 total"). The HUD's altitude, prompt pips and score are real text and read from the same store the world reads (one source of truth, no second timer). Keyboard play: the input, Answer, then on the result the kept answer input (Enter goes on) and the next button. Reduced motion: moves are instant, nothing ambient runs, there is no celebration, and the streaks and shake are off.

## Self-critique rounds

Screenshots at 1440 x 860, 1280 x 720 and 390 x 844 of home, a RARE prompt and answer, a COMMON prompt and answer, an airball, the end-level celebration and the results (`docs/screenshots/nylon/`), judged against: the scene fills the screen, nothing overlaps the moon, the ball column or the HUD, the gauge rows sit on the level lines, the card never covers the ball, text is readable, no horizontal scroll, no glow, gradient UI or rounded cards.

**Round 1.** Found: the results card was taller than the screen and, centred in a flex column, its top was cut off and unreachable; the card covered the YOU arrow on the ruler; the answer text was selected in orange; the ball (a cross of seams) read like a crosshair on the moon; the crowd and stars were too orange and busy; the "▶" on the button was a tiny fallback glyph; on a phone the ball was 15 px and the ghost balls sat on the YOU label; at 1280 x 720 the moon's gauge row ran under the HUD, the mode chip sat on the rim row, and the home card was taller than the window. Fixed: the stage no longer centres with `justify-content` (auto margins instead), the results' answer list is a closed section and the breakdown is two columns, the card keeps 104 px from the right edge, no selection, a ball with a cross and two curved seams, a darker crowd and fewer stars, an enlarged arrow glyph, a 30 px ball and ghost balls on the ruler's line on a phone, a scene offset that keeps the moon line 70 px from the top, a smaller bottom-left chip, a compact HUD, and a tightened home card on short screens.

**Round 2.** Rechecked every state at all three sizes: no horizontal scroll, no marker or label on the moon, nothing over the ball column, the gauge rows on their lines, the card clear of the ball. Axe found nothing on home, a prompt, a result, the results, the archive and how to play (desktop and phone), a keyboard-only dive ran with no console errors, and no animation ran under reduced motion.

**Limits, honestly.** The speed streaks follow the real direction of the move (below the ball when it rises, above it when it falls), which in COMMON and RARE matches the brief on the first move but can differ later, because every answer sends the ball to its own level from wherever it is. On a window shorter than about 700 px the results card scrolls inside its frame. The share emoji use the same six tier squares as before (⬛ is a miss), and emoji have a limited palette. On a phone the scene is cropped around the ball column, so the left of the arena is not seen.
