const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// Bad-guy levels: Tricky swims faster and adds bad guys; Tricky crocs lunge and sometimes follow.
module.exports = {
  name: 'tricky',
  about: 'Bad-guy levels: speeds and counts; Tricky crocs lunge, follow, and Zoom escapes.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl);
    track(page);
    const levels = await page.evaluate(() => {
      const e = window.__whiskers;
      const out = {};
      for (const lvl of ['gentle', 'normal', 'tricky']) {
        e.setDifficulty(lvl);
        const sp = e.currentSpeeds();
        out[lvl] = {
          swim: sp.base,
          crocs: e.badGuys.caimans.filter((c) => c.group.visible).length,
          piranhas: e.badGuys.schools.filter((s) => s.group.visible).length,
          cats: e.cats.cats.filter((c) => c.group.visible && c.bush.visible).length,
        };
      }
      return out;
    });
    const fmt = (l) => `${l.crocs}/${l.piranhas}/${l.cats}`;
    assert(fmt(levels.gentle) === '6/4/6' && fmt(levels.normal) === '6/4/6', `Gentle/Normal bad guys ${fmt(levels.gentle)}, ${fmt(levels.normal)}; expected 6/4/6`);
    assert(fmt(levels.tricky) === '9/8/10', `Tricky bad guys ${fmt(levels.tricky)}; expected 9/8/10`);
    assert(Math.abs(levels.tricky.swim / levels.normal.swim - 1.3) < 0.01, `Tricky swim speed is ${(levels.tricky.swim / levels.normal.swim).toFixed(2)}x, expected 1.3x`);

    // A sleeping croc 3.4 m from Whiskers: Tricky wakes, lunges and catches; Normal sleeps on.
    const pass = (level) =>
      page.evaluate((level) => {
        const e = window.__whiskers;
        e.pauseGame();
        e.setDifficulty(level);
        const bg = e.badGuys;
        bg.reset();
        const c = bg.caimans[0];
        const V = c.group.position.constructor;
        const head = c.group.localToWorld(new V(0, 0, 1.5));
        const away = new V(head.x - c.home.x, 0, head.z - c.home.z).normalize();
        const p = new V(head.x + away.x * 3.4, -0.4, head.z + away.z * 3.4);
        let events = [];
        let moved = 0;
        for (let i = 0; i < 30; i++) {
          events = events.concat(bg.update(1 / 60, p, false, 9).map((x) => x.type));
          moved = Math.max(moved, Math.hypot(c.group.position.x - c.home.x, c.group.position.z - c.home.z));
        }
        return { events, moved, state: c.state };
      }, level);
    const tricky = await pass('tricky');
    assert(tricky.events.includes('caught'), `Tricky croc did not catch Whiskers (${tricky.events.join(',')})`);
    assert(tricky.moved > 1.5, `Tricky croc lunged only ${tricky.moved.toFixed(2)} m`);
    const normal = await pass('normal');
    assert(normal.state === 'sleep' && normal.moved < 0.1, `Normal croc woke or moved (${normal.state}, ${normal.moved.toFixed(2)} m)`);

    // Following croc (forced on): dawdling gets caught, zooming escapes.
    const follow = (after) =>
      page.evaluate((after) => {
        const e = window.__whiskers;
        e.setDifficulty('tricky');
        const bg = e.badGuys;
        bg.tuning.stalk = 1;
        bg.reset();
        const c = bg.caimans[0];
        const V = c.group.position.constructor;
        const head = c.group.localToWorld(new V(0, 0, 1.5));
        const dir = new V(head.x - c.home.x, 0, head.z - c.home.z).normalize();
        const p = new V(head.x + dir.x * 5, -0.5, head.z + dir.z * 5);
        const out = [];
        let t = 0;
        for (let i = 0; i < 60 * 6; i++) {
          const sp = t < 0.5 ? 7 : after;
          p.x += (dir.x * sp) / 60;
          p.z += (dir.z * sp) / 60;
          for (const ev of bg.update(1 / 60, p, t < 0.5, 9.88 * 0.9)) if (ev.type !== 'warn' && ev.type !== 'bump') out.push(ev.type);
          t += 1 / 60;
        }
        e.setDifficulty('tricky');
        return out;
      }, after);
    const dawdle = await follow(3);
    assert(dawdle[0] === 'stalk' && dawdle.includes('caught'), `slow Whiskers: ${dawdle.join(',')} (expected stalk then caught)`);
    const zoom = await follow(9.9);
    assert(zoom[0] === 'stalk' && !zoom.includes('caught'), `zooming Whiskers: ${zoom.join(',')} (expected stalk, no catch)`);
    note(`bad guys gentle/normal ${fmt(levels.normal)}, tricky ${fmt(levels.tricky)}; lunge ${tricky.moved.toFixed(1)} m; follower catches dawdlers, Zoom escapes`);
    assertNoPageErrors(errors);
    await page.close();
  },
};
