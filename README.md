# Whiskers' River Journey

A 3D browser game made for Skylar (ages 4–7) and her cousin. Whiskers the redtail catfish swims
down a river to the Grand Lake, meeting friends, collecting stars and treasures, dodging gentle bad
guys, and exploring a fish house and a glowing cave. Everything is read aloud, and nobody gets hurt:
a bad guy only takes a snack.

**Play:** https://tedkelly561.github.io/-skys-redtail-game/. It works on iPad and laptops, and can
be added to the home screen to open like an app.

## What's in the game

- **The river:** five places from the start to the Grand Lake. Bubble rings, treasure chests,
  snacks, friends for the sticker book, learning moments (letters and counting), seasons and
  holiday lights, a day/night switch with fireflies, and a dolphin race near the end.
- **Bad guys:** sleepy crocs, grumpy piranhas and black cats in the bushes. The grown-ups setting
  picks Gentle, Normal or Tricky. Tricky has a faster swim, lunging and following crocs, and more
  bad guys.
- **The Grand Lake:** free swimming, the fish house (decorate, trophies, friends wall, bedtime),
  bubble jumps, a treasure dive, otter tag, a waterfall slide, hide-and-seek with Pip, and the
  glowing cave under the lake (crystals, Grandpa Turtle rides, the Crystal Crown).
- **For two kids:** player profiles, a ghost race against the other player's best run, dress-up,
  a baby fish buddy, photo mode, and a read-aloud storybook of each swim.
- **Saving:** progress is saved on the device. A grown-up can sign in with Google for cloud save
  (the first player) and a cloud backup of the other players.

## Run it

```bash
bun install            # or: npm install
npm run dev            # http://localhost:3000
```

Add `?debug` to the address for a speed readout. Other flags for finding problems:
`noshadow`, `fixedres`, `nobuddy`, `nolearn`, `noseason`, `nolakefx`, `shadows`.

## Check it

```bash
npm run lint           # TypeScript type-check
npm run check          # 11 game checks in a hidden browser (about 3-10 minutes)
npm run ids            # id lists have no duplicates
npm run kidtext        # tips and read-aloud lines are short and kid-friendly
npm run guard          # protected files and saved-game keys are untouched
```

The first time on a computer, run `npx playwright install chromium` before `npm run check`.
Details are in [scripts/checks/README.md](scripts/checks/README.md). Every pull request runs the
build, the game checks and the data checks on GitHub.

## Publish it

Pushing to `main` builds the game and publishes it to GitHub Pages (`.github/workflows/deploy-pages.yml`).
Changes go through a pull request first.

## Where things are

| Path | What |
| --- | --- |
| `src/game/engine.ts` | The game loop: swimming, camera, modes (river, lake, house, cave), events |
| `src/game/worldGen.ts`, `forest.ts`, `water.ts`, `sky.ts` | The river, banks, trees, water and sky |
| `src/game/*.ts` (others) | One file per system, for example `badGuys.ts`, `cats.ts`, `cave.ts`, `ghostRace.ts`, `storybook.ts`, `profiles.ts` |
| `src/components/*.tsx` | Screens and panels (React + Tailwind) |
| `src/services/` | Sign-in and cloud save (Firebase), loaded in the background |
| `public/` | App icons, manifest and the offline service worker (`sw.js`) |
| `firestore.rules` | Cloud save rules. Published by hand in the Firebase console after a change |
| `scripts/checks/` | The automatic checks |

[CLAUDE.md](CLAUDE.md) has the working rules for Claude sessions and local workers.
