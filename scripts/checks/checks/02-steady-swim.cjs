const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// The "bouncing screen" bug: while cruising with no keys pressed, Whiskers and the camera must
// hold a steady height.
module.exports = {
  name: 'steady-swim',
  about: 'Cruising with no keys pressed: Whiskers and the camera hold a steady height.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl);
    track(page);
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.startGame(0);
      window.__heights = [];
      const rec = () => {
        window.__heights.push([e.player.group.position.y, e.camera.position.y]);
        requestAnimationFrame(rec);
      };
      rec();
    });
    await page.waitForTimeout(15000);
    const h = await page.evaluate(() => window.__heights);
    assert(h.length > 20, `only ${h.length} frames recorded`);
    // Skip the first quarter (the camera settles in after the start).
    const steady = h.slice(Math.floor(h.length / 4));
    const range = (i) => Math.max(...steady.map((r) => r[i])) - Math.min(...steady.map((r) => r[i]));
    assert(range(0) < 0.05, `Whiskers' height moved ${range(0).toFixed(3)} m`);
    assert(range(1) < 0.05, `camera height moved ${range(1).toFixed(3)} m`);
    note(`${steady.length} frames: Whiskers moved ${range(0).toFixed(3)} m, camera ${range(1).toFixed(3)} m`);
    assertNoPageErrors(errors);
    await page.close();
  },
};
