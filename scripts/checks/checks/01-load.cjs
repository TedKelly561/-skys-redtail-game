const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

module.exports = {
  name: 'load',
  about: 'The game loads, a swim starts, Whiskers moves forward, no page errors.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl);
    track(page);
    await page.evaluate(() => window.__whiskers.startGame(0));
    const d0 = await page.evaluate(() => window.__whiskers.playerDistance);
    await page.waitForTimeout(4000);
    const d1 = await page.evaluate(() => window.__whiskers.playerDistance);
    assert(d1 > d0 + 0.5, `Whiskers did not swim forward (${d0.toFixed(1)} -> ${d1.toFixed(1)} m)`);
    const state = await page.evaluate(() => window.__whiskers.gameState);
    assert(state === 'playing', `game state is ${state}, expected playing`);
    note(`swam ${(d1 - d0).toFixed(1)} m in 4 s`);
    assertNoPageErrors(errors);
    await page.close();
  },
};
