/* THROWAWAY DIAGNOSTIC - delete after use. Not a checklist item. */
const { test } = require('@playwright/test');
const app = require('./helpers/desktop');

test('throwaway_atlas_probe', async ({ page }) => {
  await app.openApp(page);

  const atlas = await page.evaluate(async () => {
    const url = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
    const started = Date.now();
    try {
      const r = await Promise.race([
        fetch(url),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMED OUT after 20s')), 20000))
      ]);
      const text = await r.text();
      return { ok: r.ok, status: r.status, bytes: text.length, ms: Date.now() - started };
    } catch (e) {
      return { error: String(e), ms: Date.now() - started };
    }
  });
  console.log('ATLAS FETCH FROM PAGE:', JSON.stringify(atlas));

  const libs = await page.evaluate(() => ({
    d3: typeof window.d3,
    sankey: typeof (window.d3 && window.d3.sankey),
    topojson: typeof window.topojson,
    feature: typeof (window.topojson && window.topojson.feature)
  }));
  console.log('LIBS:', JSON.stringify(libs));

  await app.goToTab(page, 'map');
  await page.waitForTimeout(20000);
  const state = await page.evaluate(() => ({
    loadingText: (document.getElementById('mapLoading') || {}).textContent,
    mapqLoaded: typeof MAPQ !== 'undefined' ? MAPQ.loaded : 'MAPQ undefined',
    atlasHeld: typeof MAPQ !== 'undefined' && MAPQ.atlas ? 'yes' : 'no',
    svgCount: document.querySelectorAll('#mapStage svg').length
  }));
  console.log('MAP STATE:', JSON.stringify(state));
});
