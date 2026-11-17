const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// A bush cat's whole routine: pops out, crouches, leaps, falls in, shakes off, sulks, hides.
module.exports = {
  name: 'cats',
  about: 'Bush cats run their full pounce routine (a regular cat, and a Tricky-only cat).',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl);
    track(page);
    for (const level of ['normal', 'tricky']) {
      const states = await page.evaluate((level) => {
        const e = window.__whiskers;
        e.setDifficulty(level);
        e.pauseGame();
        const cats = e.cats;
        cats.reset();
        const idx = level === 'tricky' ? cats.cats.findIndex((c) => c.extra) : 1;
        const c = cats.cats[idx];
        const V = c.popPos.constructor;
        const near = new V(c.popPos.x - c.facing.x * 2.5, -0.5, c.popPos.z - c.facing.z * 2.5);
        const far = new V(c.popPos.x - c.facing.x * 14, -0.5, c.popPos.z - c.facing.z * 14);
        const seen = [];
        for (let i = 0; i < 60 * 25; i++) {
          const p = c.state === 'hide' || c.state === 'pop' ? near : far;
          cats.update(1 / 60, i < 60 * 3 ? p : far);
          if (seen[seen.length - 1] !== c.state) seen.push(c.state);
          if (i > 60 && c.state === 'hide') break;
        }
        return seen.join('>');
      }, level);
      assert(states === 'hide>pop>crouch>leap>swim>shake>sulk>hide' || states === 'pop>crouch>leap>swim>shake>sulk>hide', `${level} cat went ${states}`);
      note(`${level}: ${states}`);
    }
    assertNoPageErrors(errors);
    await page.close();
  },
};
