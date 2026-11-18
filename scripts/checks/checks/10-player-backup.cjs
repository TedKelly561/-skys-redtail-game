const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// Backup of the other players (the cousin): collect, restore on a fresh device, keep removed
// players removed, ignore bad data. Pure logic: no cloud is touched.
module.exports = {
  name: 'player-backup',
  about: "Other players' backup: restore on a fresh device; removed players stay removed.",
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl);
    track(page);
    const r = await page.evaluate(async () => {
      const pr = await import('/src/game/profiles.ts');
      const out = {};
      localStorage.clear();
      localStorage.setItem('whiskers_player_name', 'Skylar');
      localStorage.setItem('whiskers_profiles_v1', JSON.stringify({ active: 'p1', list: [{ id: 'p1', name: 'Skylar', color: '#22c55e' }, { id: 'pabc123', name: 'Maya', color: '#f472b6' }] }));
      localStorage.setItem('whiskers_p_pabc123__whiskers_player_name', 'Maya');
      localStorage.setItem('whiskers_p_pabc123__whiskers_treasure_counts', JSON.stringify({ stars: 42 }));
      localStorage.setItem('whiskers_p_pabc123__whiskers_photos_v1', 'X'.repeat(5000));
      const packed = pr.collectOtherPlayers().map((p) => pr.packPlayer(p, 100000));
      out.packed = packed.length;
      out.photosLeftOut = !packed[0].includes('photos');
      // A fresh device with only Skylar.
      localStorage.clear();
      localStorage.setItem('whiskers_profiles_v1', JSON.stringify({ active: 'p1', list: [{ id: 'p1', name: 'Skylar', color: '#22c55e' }] }));
      const restored = pr.restoreMissingPlayers(packed);
      out.restored = restored ? restored.list.map((p) => p.name).join(',') : '';
      out.stars = localStorage.getItem('whiskers_p_pabc123__whiskers_treasure_counts');
      out.again = !!pr.restoreMissingPlayers(packed);
      pr.removeProfile('pabc123');
      out.afterRemove = !!pr.restoreMissingPlayers(packed);
      out.badData = !!pr.restoreMissingPlayers(['not json', JSON.stringify({ id: '../evil', data: {} })]);
      localStorage.clear();
      return out;
    });
    assert(r.packed === 1 && r.photosLeftOut, `packed ${r.packed} player(s), photos left out: ${r.photosLeftOut}`);
    assert(r.restored === 'Skylar,Maya', `restored list: ${r.restored}`);
    assert(r.stars === '{"stars":42}', `cousin's stars after restore: ${r.stars}`);
    assert(!r.again, 'restoring twice changed something');
    assert(!r.afterRemove, 'a removed player came back');
    assert(!r.badData, 'bad backup data was accepted');
    note('restore, no double restore, removed stays removed, bad data ignored');
    assertNoPageErrors(errors);
    await page.close();
  },
};
