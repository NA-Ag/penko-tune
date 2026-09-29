// Node globals expected by browser builds of webtorrent dependencies
// (e.g. `process.browser`, `process.nextTick`, `Buffer.from`). Vite does not inject these.
import process from 'process/browser.js';
import { Buffer } from 'buffer';

const g = globalThis as any;
g.process ??= process;
g.Buffer ??= Buffer;
