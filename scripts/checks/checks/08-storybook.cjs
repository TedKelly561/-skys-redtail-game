const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// The storybook opens at the Grand Lake with pages for what happened on the swim, closing it
// shows the victory panel, and after a reload the title screen's Storybook button opens it.
module.exports = {
  name: 'storybook',
  about: 'Storybook pages match the swim; opens at the lake and from the title; keys, cloud stars, lake shortcut, Pick a place.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl, { viewport: { width: 420, height: 800 } });
    track(page);
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.startGame(0);
      e.meetFriend('turtle', false);
      e.meetFriend('frog', false);
      e.addMoment('croc');
      e.addMoment('croc');
      e.addMoment('cat');
      e.trip.ghostRival = 'Maya';
      e.addMoment('ghostWin');
      e.counts.stars += 23;
      e.counts.treasuresTotal += 4;
      e.trip.distance = 2385; // the swim began at 15, so 2370 meters were swum
      e.triggerGrandLakeCelebration();
    });
    await page.waitForSelector('text=River Adventure', { timeout: 20000 });
    const pages = [];
    for (let i = 0; i < 12; i++) {
      pages.push(await page.evaluate(() => {
        const h = document.querySelector('h2');
        const p = h && h.nextElementSibling;
        return `${h ? h.innerText : ''} :: ${p ? p.innerText : ''}`;
      }));
      const next = await page.$('button[aria-label="Next page"]:not([disabled])');
      if (!next) break;
      await next.click();
      await page.waitForTimeout(250);
    }
    const text = pages.join('\n');
    assert(/Skylar and Whiskers' River Adventure/.test(text), 'cover title missing');
    assert(/2370 meters/.test(text), 'swim distance missing');
    assert(/Turtle, Frog/.test(text), 'new friends missing');
    assert(/23 stars and 4 treasures/.test(text), 'treasures missing');
    assert(/got away from 2 grumpy crocs/.test(text), 'brave moments missing');
    assert(/beat Maya's ghost/.test(text), 'ghost race win missing');
    assert(/The End/.test(text), 'ending page missing');
    await page.click('button:has-text("Close the book")');
    await page.waitForFunction(() => document.body.innerText.includes('You made it home!'), null, { timeout: 10000 });
    await page.reload();
    await page.waitForFunction(() => !!window.__whiskers, null, { timeout: 90000 });
    await page.click('button:has-text("Storybook")', { timeout: 30000 });
    await page.waitForSelector('text=River Adventure', { timeout: 10000 });
    // Keys don't start the game behind the open book; Escape closes it.
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const stateWithBook = await page.evaluate(() => window.__whiskers.gameState);
    assert(stateWithBook === 'title', `Space/Enter with the book open started the game (${stateWithBook})`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.innerText.includes('River Adventure'), null, { timeout: 5000 });
    const later = await page.evaluate(() => {
      const e = window.__whiskers;
      const before = e.getTrip();
      // Stars synced from another device weren't found on this trip.
      const c = e.counts;
      e.applyCloudProgress({
        totalPoints: c.totalPoints,
        starsCollected: c.stars + 100,
        treasuresCollected: c.treasuresTotal,
        foodEaten: c.foodEaten,
        furthestDistance: 0,
        highestChapter: 0,
        smoothStones: c.smoothStones,
        lostTrinkets: c.lostTrinkets,
        shimmeringScales: c.shimmeringScales,
        riverPearls: c.riverPearls,
      });
      const synced = e.getTrip();
      // The title's Grand Lake shortcut adds to this story instead of starting an empty one.
      e.startLakeSwim();
      const lake = e.getTrip();
      // "Pick a place": only the meters actually swum count.
      e.startGame(4);
      const startAt = e.playerDistance;
      e.trip.distance = startAt + 55;
      const picked = e.getTrip();
      return {
        foundBefore: before.stars - before.startStars,
        foundAfter: synced.stars - synced.startStars,
        lakeKept: lake.startedAt === before.startedAt && lake.distance === 2385,
        pickedMeters: Math.round(picked.distance - picked.startDistance),
      };
    });
    assert(later.foundAfter === later.foundBefore, `cloud stars counted as found on the trip (${later.foundBefore} -> ${later.foundAfter})`);
    assert(later.lakeKept, 'the Grand Lake shortcut replaced the last story');
    assert(later.pickedMeters === 55, `a Pick-a-place swim of 55 meters counted ${later.pickedMeters}`);
    note(`${pages.length} pages; victory panel after closing; title button works; keys blocked; cloud stars, lake shortcut and Pick a place counted right`);
    assertNoPageErrors(errors);
    await page.close();
  },
};
