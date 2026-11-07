# Design notes: NYLON and the moon world

NYLON is one place: a full-screen pixel-art world that stays mounted while the player moves between home, a prompt, the result, the results, the archive and how to play. A card floats over it (a bottom sheet on a phone). The world is `aria-hidden`; the HUD and the card carry every word and number, and a polite live line says each result.

The look is black and orange, hard-edged: near-black boxes (`#0A0A0A`, about 90% opaque) with a 4px orange border, hard offset shadows, no glow, no blur, no gradients on the UI, no rounded corners and no image files. A test checks the stylesheets.

## The world (`web/src/world/`)

- `scene.ts` fills RGBA buffers on a 360 x 215 grid (the static scene, the clouds, three star layers, two crowd-shimmer layers); `World.tsx` puts each on a canvas once with `image-rendering: pixelated`. Ambient motion is CSS on whole layers.
- Top to bottom: a dithered night sky with stars; the moon at (132, 22), radius 16, with craters and a hoop under it; clouds; an arena roof at rows 128 to 135 with an opening above the ball column; rafters; retired-number banners (3 x 5 pixel font); a dithered crowd; a hardwood floor from row 203; and the arena hoop at the ball column.
- `sceneMetrics` places the grid: on a wide screen it fills the screen (4 pixels per cell at 1440 x 860) and keeps the moon's line clear of the HUD; on a phone it is sized to the space between the HUD and the bottom sheet, with the ball column kept in view.

## The journey

The ball's position is a function of the running total (0 to 700): `ballY(mode, total)` runs from the rim (row 190) up to the moon (row 24) in COMMON and from the moon down to the rim in RARE. The ball, the ruler's YOU arrow and ghost balls, the gauge, the altitude and the score all derive from the total, so restoring a dive puts everything back in place.

| Zone from | COMMON | RARE |
| --- | --- | --- |
| 0 | RIM | MOON |
| 100 | RAFTERS | ORBIT |
| 200 | ROOF | CLOUDS |
| 300 | CLOUDS | ROOF |
| 450 | ORBIT | RAFTERS |
| 600 | MOON | RIM |

Altitude is 10 ft a point (COMMON: total x 10; RARE: 7,000 minus total x 10). Points per tier are 10, 20, 35, 55, 75, 100 for tier index 0 to 5 in RARE and reversed in COMMON.

## Screens

- **Home:** the ball at the mode's start; the NYLON title, the tagline, two mode cards, a full-width play button, Archive, How to play and the streaks.
- **A prompt:** HUD (NYLON chip, ALTITUDE, seven prompt pips, SCORE, sound), the depth gauge on the left, dashed lines at the zone thresholds, the mode chip, a dotted ruler on the right with the YOU arrow and ghost balls, and the question card with the timer, the era, the question (first letter capitalised for display only), the answer box and a mode hint.
- **After an answer:** the card becomes a result card with a border in the answer's tier colour: the tier class, PICK, the answer, "+N PTS" and the feet gained, a flavour line and the CLIMB or SINK button. The ball moves at once for `500 + 700 x points / 100` ms (at most 1,200). A wrong answer shakes the ball and shows AIRBALL.
- **Results:** the ball at its final position, the total, the final altitude and zone, the best score in the mode, the streak, a tier breakdown, the share text, "Play the other mode" and the archive.
- **A phone:** the gauge is hidden, the HUD shrinks to chips, and the question is a bottom sheet of fixed height.

## Type, colour and access

Press Start 2P for headings and numbers, VT323 for body text. Palette: `#0A0A0A`, `#FF6A13`, `#FFB347`, `#FF3B1F`, `#F4EAD6` and greys; tier colours `#6E6E6E`, `#A8A8A8`, `#EDEDED`, `#FFB020`, `#FF6A13`, `#FF3B1F`, always with the tier number. Text is at least 4.5 : 1. Keyboard play: the input, Answer, then the kept answer input on the result (Enter goes on) and the next button. Reduced motion makes the move instant and turns off streaks, the celebration and all ambient motion.
