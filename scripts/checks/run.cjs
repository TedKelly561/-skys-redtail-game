#!/usr/bin/env node
// Runs the game checks in a headless browser and prints PASS/FAIL for each.
//
//   npm run check                  all checks (about 10 minutes on a laptop)
//   npm run check -- cave tricky   only the named checks
//   npm run check -- --list        list the checks
//   npm run check -- --url=http://127.0.0.1:3000/   use a dev server that is already running
//
// Exit code 0 when every check passes, 1 otherwise. Results also go to
// scripts/checks/out/results.json, and a screenshot of each failed check to scripts/checks/out/.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { CheckFailure } = require('./lib.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
const CHECK_DIR = path.join(__dirname, 'checks');

function loadChecks() {
  return fs
    .readdirSync(CHECK_DIR)
    .filter((f) => f.endsWith('.cjs'))
    .sort()
    .map((f) => require(path.join(CHECK_DIR, f)));
}

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

async function startDevServer(port) {
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 120; i++) {
    if ((await get(url)) === 200) return { child, url };
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`the dev server did not start on port ${port}:\n${log.slice(-800)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const checks = loadChecks();
  if (args.includes('--list')) {
    for (const c of checks) console.log(`${c.name.padEnd(16)} ${c.about}`);
    return 0;
  }
  const urlArg = args.find((a) => a.startsWith('--url='));
  const names = args.filter((a) => !a.startsWith('--'));
  const unknown = names.filter((n) => !checks.some((c) => c.name === n));
  if (unknown.length) {
    console.error(`Unknown check(s): ${unknown.join(', ')}. Use --list to see them.`);
    return 1;
  }
  const selected = names.length ? checks.filter((c) => names.includes(c.name)) : checks;

  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error('Playwright is missing. Run: npm install   then: npx playwright install chromium');
    return 1;
  }

  fs.mkdirSync(OUT, { recursive: true });
  let server = null;
  let baseUrl = urlArg ? urlArg.slice('--url='.length) : null;
  if (!baseUrl) {
    server = await startDevServer(Number(process.env.CHECK_PORT) || 3123);
    baseUrl = server.url;
  }
  const browser = await playwright.chromium.launch({
    // Software rendering: the same picture and timing on every machine.
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const results = [];
  try {
    for (const check of selected) {
      const started = Date.now();
      const notes = [];
      let shotPage = null;
      try {
        await check.run({
          browser,
          baseUrl,
          note: (msg) => notes.push(msg),
          // Remember the page so a failure can be photographed.
          track: (page) => (shotPage = page),
        });
        results.push({ name: check.name, pass: true, seconds: (Date.now() - started) / 1000, notes });
        console.log(`PASS  ${check.name}  (${((Date.now() - started) / 1000).toFixed(1)} s)`);
      } catch (err) {
        const reason = err instanceof CheckFailure ? err.message : `${err && err.message ? err.message : err}`.split('\n')[0];
        let shot = null;
        if (shotPage) {
          shot = path.join(OUT, `${check.name}.png`);
          await shotPage.screenshot({ path: shot, timeout: 60000 }).catch(() => (shot = null));
        }
        results.push({ name: check.name, pass: false, seconds: (Date.now() - started) / 1000, reason, notes, screenshot: shot });
        console.log(`FAIL  ${check.name}  (${((Date.now() - started) / 1000).toFixed(1)} s): ${reason}`);
      }
      for (const n of notes) console.log(`      ${n}`);
    }
  } finally {
    await browser.close();
    if (server) server.child.kill();
  }

  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed.${failed.length ? ` Failed: ${failed.map((f) => f.name).join(', ')}` : ''}`);
  return failed.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
