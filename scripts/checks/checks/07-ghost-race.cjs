const { assert, assertNoPageErrors, openGame, waitForEngine } = require('../lib.cjs');

// Ghost race: the first run sets a time; after switching players, the other player races a
// ghost of that run (slower loses, faster wins). Also checks the race starts in the real game.
module.exports = {
  name: 'ghost-race',
  about: 'Ghost race: first run saved; the other player races its ghost (lose/win); live start.',
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl, {
      storage: {
        whiskers_profiles_v1: JSON.stringify({
          active: 'p1',
          list: [
            { id: 'p1', name: 'Skylar', color: '#22c55e' },
            { id: 'pmaya1', name: 'Maya', color: '#f472b6' },
          ],
        }),
      },
    });
    track(page);
    // Swim the course at a steady speed by calling the race directly.
    const run = (speed, lateral) =>
      page.evaluate(
        ({ speed, lateral }) => {
          const e = window.__whiskers;
          e.pauseGame();
          const gr = e.ghostRace;
          gr.reset();
          const events = [];
          let prev = 40;
          let d = 40;
          let t = 0;
          let bar = null;
          while (t < 200) {
            const r = gr.update(0.05, prev, d, lateral, -1.5, e.player.group);
            if (r.event) events.push(r.event);
            if (r.progress && !bar && r.progress.whiskers > 0.5) bar = r.progress;
            if (gr.state === 'done') break;
            prev = d;
            d += speed * 0.05;
            t += 0.05;
          }
          return { finish: events.find((x) => x.type === 'finish'), start: events.find((x) => x.type === 'start'), bar };
        },
        { speed, lateral }
      );
    const first = await run(5, 2);
    assert(first.start && first.start.rival === null, 'first run should have no ghost to race');
    assert(first.finish && first.finish.record, 'first run should set a record');
    // Switch to Maya (the page reloads with her saved game).
    await page.evaluate(async () => (await import('/src/game/profiles.ts')).switchProfile('pmaya1'));
    await page.waitForTimeout(1000);
    await waitForEngine(page);
    const slower = await run(4, -2);
    assert(slower.start && slower.start.rival === 'Skylar', `Maya should race Skylar's ghost (got ${slower.start && slower.start.rival})`);
    assert(slower.bar && slower.bar.rivalIcon === '👻', 'race bar should show the ghost');
    assert(slower.finish && !slower.finish.won, 'slower run should lose to the ghost');
    const faster = await run(6.5, -2);
    assert(faster.finish && faster.finish.won && faster.finish.record, 'faster run should win and set a record');
    // In the real game loop: crossing the start buoys starts the race and shows the race bar.
    await page.evaluate(() => {
      const e = window.__whiskers;
      e.startGame(0);
      e.playerDistance = 44.6;
    });
    await page.waitForFunction(() => window.__whiskers.ghostRace.state === 'racing', null, { timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('🏁'), null, { timeout: 15000 });
    note(`Skylar ${first.finish.time} s; Maya ${slower.finish.time} s (lost), ${faster.finish.time} s (won); live race bar shown`);
    assertNoPageErrors(errors);
    await page.close();
  },
};
