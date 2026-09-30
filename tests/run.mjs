#!/usr/bin/env node
// Builds the app, serves the production build, and runs the end-to-end suites.
//
//   npm run test:e2e                         all local suites, Chromium + Firefox
//   npm run test:e2e -- --browser firefox    one browser
//   npm run test:e2e -- --suite library      one suite
//   npm run test:e2e -- --network            also run sharing/listen-together (uses public trackers)
//   npm run test:e2e -- --no-build           reuse the existing dist/
//
// First run: npx playwright install chromium firefox
import { spawn, spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const E2E = join(ROOT, 'tests', 'e2e');
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/`;
const NETWORK_SUITES = new Set(['sharing']);

const args = process.argv.slice(2);
const opt = name => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const browsers = (opt('browser') ?? 'all') === 'all' ? ['chromium', 'firefox'] : [opt('browser')];
const onlySuite = opt('suite');
const includeNetwork = args.includes('--network') || NETWORK_SUITES.has(onlySuite);

const suites = readdirSync(E2E)
  .filter(f => f.endsWith('.mjs') && f !== 'harness.mjs')
  .map(f => f.replace(/\.mjs$/, ''))
  .filter(s => (onlySuite ? s === onlySuite : includeNetwork || !NETWORK_SUITES.has(s)));

if (!args.includes('--no-build')) {
  console.log('Building...');
  const build = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
const stopServer = () => server.kill();
process.on('exit', stopServer);

for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(BASE_URL)).ok) break;
  } catch {
    await new Promise(r => setTimeout(r, 200));
  }
}

const runs = [];
for (const suite of suites) {
  if (NETWORK_SUITES.has(suite)) {
    // Two-person features: every sender/receiver browser pairing
    for (const a of browsers) for (const b of browsers) runs.push({ suite, env: { BROWSER: a, BROWSER_A: a, BROWSER_B: b }, label: `${suite} [${a} -> ${b}]` });
  } else {
    for (const browser of browsers) runs.push({ suite, env: { BROWSER: browser }, label: `${suite} [${browser}]` });
  }
}

const results = [];
for (const run of runs) {
  console.log(`\n=== ${run.label}`);
  const { status } = spawnSync('node', [join(E2E, `${run.suite}.mjs`)], {
    env: { ...process.env, ...run.env, BASE_URL },
    stdio: 'inherit',
    timeout: 10 * 60 * 1000,
  });
  results.push({ label: run.label, ok: status === 0 });
}

console.log('\n=== Summary');
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.label}`);
stopServer();
process.exit(results.every(r => r.ok) ? 0 : 1);
