const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// The storybook opens at the Grand Lake with pages for what happened on the swim, closing it
// shows the victory panel, and after a reload the title screen's Storybook button opens it.
module.exports = {
  name: 'storybook',
  about: 'Storybook pages match the swim; it opens at the lake and from the title screen.',
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
      e.trip.distance = 2370;
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
    note(`${pages.length} pages; victory panel after closing; title screen button works`);
    assertNoPageErrors(errors);
    await page.close();
  },
};
