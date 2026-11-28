# Working on Whiskers' River Journey

A 3D browser game for kids aged 4–7 (Skylar and her cousin), played mostly on an iPad and a
Windows laptop. Read README.md for what the game has and where the code lives.

## Before you change anything

- **Never change these without the lead's explicit OK.** `npm run guard` catches them:
  - `firestore.rules`: Ted republishes it by hand in the Firebase console.
  - `firebase-applet-config.json`
  - `public/sw.js`: the offline cache. If you change it, bump `CACHE`.
  - `.github/workflows/deploy-pages.yml`
- **Saved-game keys:** the `whiskers_*` localStorage key strings and `PLAYER_KEYS` in
  `src/game/profiles.ts`. Renaming or removing one wipes the kids' progress. New per-player keys
  go in `PLAYER_KEYS`.
- **Never push to `main`.** Work on a branch and open a pull request. Pages publishes from `main`.

## Style

- TypeScript strict, 2-space indent, single quotes, camelCase.
- One game system per file in `src/game/`. React screens go in `src/components/`, styled with
  Tailwind.
- Comments say why, in plain words.
- **Kid-facing text** (tips, read-aloud lines, popups, the storybook):
  - one or two short sentences, warm, no scary or mean words;
  - `npm run kidtext` enforces 14 words or fewer and the banned list in
    `scripts/checks/kid-text-banned.txt`;
  - a person reads every new line before it ships.
- **Performance** (the iPad and an older laptop are the targets):
  - small objects stay low-poly (spheres about 16×12 segments or fewer);
  - don't create objects or vectors every frame (reuse temporaries);
  - register far-away scenery with the `DistanceStreamer`;
  - `npm run check -- memory-budget` keeps river shapes under 230 MB.
- Data lists (`FRIENDS`, `CLOSET_ITEMS`, `HOUSE_ITEMS`, `PLAYER_KEYS`) need unique ids:
  `npm run ids`.

## Check your work

```bash
npm run lint                     # type-check
npm run check -- <names>         # the game checks your change touches (list: npm run check -- --list)
npm run check                    # all of them, before the pull request
npm run ids && npm run kidtext && npm run guard
```

- The checks drive the game through `window.__whiskers`, which exists in dev builds only.
- A new feature gets a new check in `scripts/checks/checks/`; see the README in that folder.
- Pull requests run the build and all checks on GitHub (`.github/workflows/checks.yml`).

## Local workers (the Legion's models)

Jobs for the local worker are posted in Switchyard Hub, in the project "🧰 Local worker jobs
(Legion's models)". Each job is tagged `local-worker` and follows that project's doc "How local
jobs work". The worker branches `local/<task id>` from `origin/main` and pushes only that branch.
Install with plain `npm install` and never commit `package-lock.json` (this repo uses `bun.lock`).
