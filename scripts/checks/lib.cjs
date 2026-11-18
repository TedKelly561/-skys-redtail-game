// Shared helpers for the game checks (see README.md in this folder).
//
// Every check gets a fresh browser page with its own empty storage, so checks never depend on
// each other. The game exposes its engine as window.__whiskers in development builds only,
// which is why the checks run against the Vite dev server.

class CheckFailure extends Error {}

/** Stop the check with a readable reason unless `ok` is true. */
function assert(ok, message) {
  if (!ok) throw new CheckFailure(message);
}

/** Saved settings every check starts from: no name prompt, no music, no voice, no buddy prompt. */
const BASE_STORAGE = {
  whiskers_player_name: 'Skylar',
  whiskers_player_name_asked: 'true',
  whiskers_music: 'false',
  whiskers_read_aloud: 'false',
  whiskers_season: 'summer',
  whiskers_buddy_v1: JSON.stringify({ name: 'Finn', color: '#4fb7ff' }),
};

/**
 * Opens the game in a new page and waits for the engine.
 * - storage: extra localStorage values (merged over BASE_STORAGE); null values are removed.
 * - viewport / mobile: page size and touch emulation.
 * Returns { page, errors } where errors collects uncaught page errors.
 */
async function openGame(browser, baseUrl, { storage = {}, viewport = { width: 800, height: 450 }, mobile = false } = {}) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const seed = { ...BASE_STORAGE, ...storage };
  // Seed storage once per context (not on every reload, so checks can test what persists).
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(values)) {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  }, seed);
  await page.goto(baseUrl);
  await waitForEngine(page);
  page.close = (orig => async () => { await orig(); await context.close(); })(page.close.bind(page));
  return { page, errors };
}

async function waitForEngine(page) {
  await page.waitForFunction(() => !!window.__whiskers, null, { timeout: 90000 });
}

/** Fails the check if the page threw any uncaught errors. */
function assertNoPageErrors(errors) {
  assert(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' | ')}`);
}

module.exports = { assert, assertNoPageErrors, openGame, waitForEngine, CheckFailure, BASE_STORAGE };
