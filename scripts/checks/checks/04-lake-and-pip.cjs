const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// Reaching the Grand Lake: the storybook opens, closing it shows the victory panel,
// "Swim with family" starts free swim, and finding Pip in hide-and-seek gives 5 stars.
module.exports = {
  name: 'lake-and-pip',
  about: 'Reach the Grand Lake, close the storybook, swim with family, find Pip (+5 stars).',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl, { viewport: { width: 390, height: 844 }, mobile: true });
    track(page);
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.startGame(4);
      e.playerDistance = 2414;
    });
    await page.waitForFunction(() => window.__whiskers.gameState === 'victory', null, { timeout: 90000 });
    await page.getByLabel('Close the storybook').click({ timeout: 60000 });
    await page.getByText('Swim with family').click({ timeout: 30000 });
    await page.waitForFunction(() => window.__whiskers.isFreeSwim && window.__whiskers.gameState === 'playing', null, { timeout: 30000 });
    await page.getByLabel('Play hide and seek').click({ timeout: 30000 });
    await page.waitForFunction(() => window.__whiskers.hideSeek.active, null, { timeout: 30000 });
    const s0 = await page.evaluate(() => window.__whiskers.counts.stars);
    await page.evaluate(() => {
      const e = window.__whiskers;
      const s = e.hideSeek.spot;
      e.player.group.position.set(s.x + 6, -1.8, s.z);
      e.freeHeading = -Math.PI / 2;
    });
    await page.waitForFunction(() => !window.__whiskers.hideSeek.active, null, { timeout: 60000 });
    const s1 = await page.evaluate(() => window.__whiskers.counts.stars);
    assert(s1 - s0 === 5, `finding Pip gave ${s1 - s0} stars, expected 5`);
    note('storybook -> victory panel -> free swim -> found Pip (+5)');
    assertNoPageErrors(errors);
    await page.close();
  },
};
