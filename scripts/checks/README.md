# Game checks

Automatic checks that play parts of the game in a hidden browser and confirm they still work.
Run them before every pull request.

## Run them

```bash
npm run check                    # all checks, about 3–10 minutes
npm run check -- cave tricky     # only some checks
npm run check -- --list          # what each check does
```

The first time on a new computer, after `npm install` (or `bun install`):

```bash
npx playwright install chromium
```

`npm run check` starts the game's dev server by itself on port 3123 (set `CHECK_PORT` to change
it). To use a dev server that is already running, add `--url=http://127.0.0.1:3000/`.

## Guard: protected files and saved-game keys

```bash
npm run guard                     # compares your changes with origin/main
npm run guard -- --base=<ref>     # compare with another branch or commit
```

It fails (exit 1) if a change touches `firestore.rules`, `firebase-applet-config.json`,
`public/sw.js` or `.github/workflows/deploy-pages.yml`, or removes or renames a saved-game key
(`whiskers_...` strings in `src/`, compared file by file) or a `PLAYER_KEYS` entry. Renaming a key
would wipe the kids' saved progress. Moving a key string to another file is flagged too: check it
by hand. Settings are in `guard.config.json`. Exit 2 means git itself failed (for example, an
unknown base). Run `git fetch origin` first so `origin/main` is current.

## Quick data checks (seconds, no browser)

```bash
npm run ids                       # FRIENDS, CLOSET_ITEMS, HOUSE_ITEMS and PLAYER_KEYS have no duplicate ids,
                                  # and FRIENDS matches the FriendKind type
npm run kidtext                   # tips, read-aloud lines and popups: 14 words or fewer, no banned words
npm run kidtext -- --report       # list findings but always exit 0
```

The banned words are in `kid-text-banned.txt` (approved by Ted). They match whole words only, so
"war" doesn't match "reward". `kidtext` reads calls whose first argument is a plain string. Text
built in a variable or a ternary isn't scanned, so read those lines yourself.

## On GitHub

Every pull request runs `ids`, `kidtext` and the full `npm run check` (`.github/workflows/checks.yml`).
When a check fails, the run keeps the screenshots as a downloadable "check-results" file.

## Reading the result

- Each check prints `PASS` or `FAIL` with a short reason, and a line about what it saw.
- The exit code is `0` when everything passes and `1` when anything fails. Local workers use
  that as the pass/fail.
- `scripts/checks/out/results.json` holds the same results as data, and
  `scripts/checks/out/<check>.png` is a screenshot of each failed check. The `out` folder is not
  committed.

## The checks

| Check | What it proves |
| --- | --- |
| `load` | The game loads, a swim starts, Whiskers moves, no page errors. |
| `steady-swim` | No "bouncing screen": Whiskers and the camera hold their height while cruising. |
| `dolphin-race` | Winning the dolphin race gives 10 stars, losing gives 2. |
| `lake-and-pip` | Reaching the Grand Lake opens the storybook, then the victory panel, free swim, and hide-and-seek with Pip (+5). |
| `tricky` | Bad-guy counts per level (6/4/6 vs 9/8/10), Tricky's 1.3× swim, croc lunge, the following croc (Zoom escapes). |
| `cats` | A bush cat's whole pounce routine, on Normal and for a Tricky-only cat. |
| `ghost-race` | The first run is saved, the other player races its ghost (slower loses, faster wins), and the live race bar shows. |
| `storybook` | The book's pages match the swim, and it opens at the lake and from the title screen. |
| `cave` | Enter the cave, find all 12 crystals, ride Grandpa Turtle, get the Crystal Crown, leave. |
| `player-backup` | The cousin's backup restores on a fresh device, removed players stay removed, bad data is ignored. |
| `memory-budget` | The river's 3D shapes stay under 230 MB (4 MB per step), and the lake's lily pads load early. |

## How they work

- The checks use the dev server because the game exposes its engine as `window.__whiskers` only
  in development builds. They read and set game state through it, and click real buttons where
  the screen flow matters.
- Every check opens a fresh page with empty storage plus the basics (player name, no music, no
  read-aloud, a buddy, summer), so the checks don't depend on each other. `lib.cjs` has the
  helpers.
- Rendering is software (SwiftShader), so results match on every machine.

## Add a check

Copy a file in `checks/`, number it, and export `{ name, about, run }`:

```js
module.exports = {
  name: 'my-check',
  about: 'One line on what it proves.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl);
    track(page); // so a failure gets a screenshot
    // ... drive the game, then:
    assert(condition, 'what went wrong, in plain words');
    note('what it saw');
    assertNoPageErrors(errors);
    await page.close();
  },
};
```
