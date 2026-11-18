const { assert, assertNoPageErrors, openGame } = require('../lib.cjs');

// How much 3D shape data the river loads as Whiskers swims (it stays on the graphics card).
// It was 434 MB with 9 MB in one step; keep it light for iPads. Also: the Grand Lake's lily
// pads load before Whiskers gets there.
const MAX_TOTAL_MB = 230;
const MAX_STEP_MB = 4;

module.exports = {
  name: 'memory-budget',
  about: `River shapes stay under ${MAX_TOTAL_MB} MB (max ${MAX_STEP_MB} MB per step); lake pads load early.`,
  async run({ browser, baseUrl, note, track }) {
    const { page, errors } = await openGame(browser, baseUrl, { viewport: { width: 400, height: 300 } });
    track(page);
    const r = await page.evaluate(async () => {
      const wg = await import('/src/game/worldGen.ts');
      const e = window.__whiskers;
      e.pauseGame();
      const st = e.streamer;
      const bytesOf = (o) => {
        let b = 0;
        o.traverse((m) => {
          if (!m.geometry) return;
          for (const a of Object.values(m.geometry.attributes)) b += a.array.byteLength;
          if (m.geometry.index) b += m.geometry.index.array.byteLength;
        });
        return b;
      };
      let total = 0;
      for (const x of st.entries) total += bytesOf(x.obj);
      const seen = new Set(st.entries.filter((x) => x.attached).map((x) => x.obj));
      let maxStep = 0;
      const padsAt = {};
      for (let d = 0; d < 2950; d += 1.5) {
        const p = wg.getRiverPath(d).position;
        st.update(0.3, p, true);
        let b = 0;
        for (const x of st.entries) if (x.attached && !seen.has(x.obj)) { seen.add(x.obj); b += bytesOf(x.obj); }
        maxStep = Math.max(maxStep, b);
        if (Math.abs(d - 2301) < 0.75) {
          let pads = 0;
          for (const m of e.forest.group.children) {
            const pos = m.geometry.attributes.position;
            for (let i = 0; i < pos.count; i += 3) if (Math.abs(pos.getY(i) - 0.04) < 0.002 && pos.getZ(i) + m.position.z < -2350) pads++;
          }
          padsAt.d2300 = Math.round(pads / 14);
        }
      }
      return { totalMB: total / 1e6, maxStepMB: maxStep / 1e6, pads: padsAt.d2300 || 0 };
    });
    assert(r.totalMB <= MAX_TOTAL_MB, `river shapes are ${r.totalMB.toFixed(0)} MB (budget ${MAX_TOTAL_MB} MB)`);
    assert(r.maxStepMB <= MAX_STEP_MB, `one step loaded ${r.maxStepMB.toFixed(1)} MB (budget ${MAX_STEP_MB} MB)`);
    assert(r.pads >= 15, `only ${r.pads} lake lily pads loaded 70 m before the lake`);
    note(`${r.totalMB.toFixed(0)} MB total, biggest step ${r.maxStepMB.toFixed(1)} MB, ${r.pads} lily pads loaded before the lake`);
    assertNoPageErrors(errors);
    await page.close();
  },
};
