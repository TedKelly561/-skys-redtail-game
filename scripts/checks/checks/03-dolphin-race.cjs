const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

module.exports = {
  name: 'dolphin-race',
  about: 'Dolphin race near the end of the river: winning gives 10 stars, losing gives 2.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl);
    track(page);
    // Win: cross the start gate, then reach the flags first.
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.startGame(3);
      e.playerDistance = 2188;
      e.playerLateral = 0;
      e.tummy = 95;
    });
    await page.waitForFunction(() => window.__whiskers.race.state === 'racing', null, { timeout: 60000 });
    const s0 = await page.evaluate(() => window.__whiskers.counts.stars);
    await page.evaluate(() => (window.__whiskers.playerDistance = 2336));
    await page.waitForFunction(() => window.__whiskers.race.state === 'done', null, { timeout: 60000 });
    const s1 = await page.evaluate(() => window.__whiskers.counts.stars);
    assert(s1 - s0 === 10, `winning gave ${s1 - s0} stars, expected 10`);
    // Lose: the dolphin reaches the flags first.
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.startGame(3);
      e.playerDistance = 2190;
      e.playerLateral = 0;
    });
    await page.waitForFunction(() => window.__whiskers.race.state === 'racing', null, { timeout: 60000 });
    const s2 = await page.evaluate(() => window.__whiskers.counts.stars);
    await page.evaluate(() => (window.__whiskers.race.dolphinDist = 2339));
    await page.waitForFunction(() => window.__whiskers.race.state === 'done', null, { timeout: 60000 });
    const s3 = await page.evaluate(() => window.__whiskers.counts.stars);
    assert(s3 - s2 === 2, `losing gave ${s3 - s2} stars, expected 2`);
    note('win +10 stars, lose +2 stars');
    assertNoPageErrors(errors);
    await page.close();
  },
};
