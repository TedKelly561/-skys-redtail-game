const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// The glowing cave under the Grand Lake: dive in, find all 12 crystals, ride Grandpa Turtle,
// open the chest (Crystal Crown), and swim back out through the ring.
module.exports = {
  name: 'cave',
  about: 'Lake cave: enter (stops hide-and-seek), Sniff points to crystals, 12 crystals, turtle ride, Crystal Crown, exit.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl, { storage: { whiskers_lake_unlocked: 'true' } });
    track(page);
    await page.evaluate(() => window.__whiskers.startLakeSwim());
    await page.waitForTimeout(1000);
    const entered = await page.evaluate(() => {
      const e = window.__whiskers;
      // Playing hide-and-seek with Pip when diving in: the cave stops it.
      e.startHideAndSeek();
      const pipStarted = e.hideSeek.active;
      const c = e.cave.entrancePos;
      e.caveCooldown = 0;
      e.player.group.position.set(c.x, c.y + 1.0, c.z);
      e.forwardSpeed = 0;
      e.updateLakeSwim(0.016, 0, -1, false);
      // Sniff in the cave: a sparkle trail toward a crystal.
      let sparkles = 0;
      const trail = e.cave.showDirection(e.player.group.position, () => sparkles++);
      return { inCave: e.inCave, pipStarted, pipStopped: !e.hideSeek.active, trail: trail && sparkles === 6 };
    });
    assert(entered.inCave, 'diving onto the glowing ring did not enter the cave');
    assert(entered.pipStarted && entered.pipStopped, `Pip's hide-and-seek: started ${entered.pipStarted}, stopped in the cave ${entered.pipStopped}`);
    assert(entered.trail, 'Sniff in the cave did not point to a crystal');
    await page.waitForFunction(() => /💎 0\/12/.test(document.body.innerText) && document.body.innerText.includes('Back to the lake'), null, { timeout: 15000 });
    const crystals = await page.evaluate(() => {
      const e = window.__whiskers;
      const cv = e.cave;
      let all = false;
      for (const c of cv.crystals) {
        const p = c.group.getWorldPosition(new c.group.position.constructor());
        p.y += 0.8;
        for (const ev of cv.update(0.016, p, true)) if (ev.type === 'allCrystals') all = true;
      }
      return { found: cv.found, total: cv.total, all };
    });
    assert(crystals.found === 12 && crystals.total === 12 && crystals.all, `crystals ${crystals.found}/${crystals.total}, all-found event ${crystals.all}`);
    // Ride: skip the short arrival pause and swim onto his shell.
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.cave.rideCooldown = 0;
      const s = new e.player.group.position.constructor();
      e.cave.seat(s);
      e.player.group.position.copy(s);
    });
    await page.waitForFunction(() => window.__whiskers.cave.riding, null, { timeout: 15000 });
    const metTurtle = await page.evaluate(() => window.__whiskers.metFriends.has('seaturtle'));
    assert(metTurtle, 'riding did not meet Grandpa Turtle');
    // Treasure chest.
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.cave.riding = false;
      e.cave.rideCooldown = 30;
      const cp = e.cave.chestPos.clone();
      e.cave.toWorld(cp);
      cp.y += 1;
      e.player.group.position.copy(cp);
    });
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('whiskers_closet_v1') || '{}').owned || []).includes('crystal-crown'), null, { timeout: 15000 });
    // Out through the ring.
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.cave.insideTime = 10;
      const x = e.cave.exitPos.clone();
      e.cave.toWorld(x);
      e.player.group.position.copy(x);
    });
    await page.waitForFunction(() => !window.__whiskers.inCave, null, { timeout: 15000 });
    await page.waitForFunction(() => !/💎 \d+\/\d+/.test(document.body.innerText), null, { timeout: 10000 });
    const moments = await page.evaluate(() => window.__whiskers.getTrip().moments);
    assert(moments.cave && moments.turtleRide && moments.chest, `storybook moments missing: ${JSON.stringify(moments)}`);
    note('entered, 12/12 crystals, rode Grandpa Turtle, found the Crystal Crown, back in the lake');
    assertNoPageErrors(errors);
    await page.close();
  },
};
