#!/usr/bin/env node

/**
 * Lightweight browser-based prompt server.
 *
 * Starts a local HTTP server, serves the web entry module, opens the browser,
 * waits for the form to submit/cancel, and writes the result JSON to stdout.
 *
 * Interface:
 *   stdin  → payload JSON
 *   stdout → result JSON  { status: "submitted"|"cancelled"|"timeout"|"closed", data?: {...} }
 *
 * Usage:
 *   node prompt.mjs --entry <web/app.mjs> [--timeout <duration>]
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';
import { exec } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const HEARTBEAT_TIMEOUT_MS = 15_000;
const ENTRY_PATH = '/__entry.mjs';
const PAYLOAD_PATH = '/__payload';

function parseArgs(argv) {
  const args = { entry: '', timeout: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--entry':
        args.entry = argv[++i] || '';
        break;
      case '--timeout':
        args.timeout = parseDuration(argv[++i] || '');
        break;
    }
  }
  return args;
}

function parseDuration(str) {
  if (!str || str === '0s' || str === '0') return 0;
  const match = str.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return 0;
  const num = Number(match[1]);
  switch (match[2]) {
    case 'ms': return num;
    case 's': return num * 1_000;
    case 'm': return num * 60_000;
    case 'h': return num * 3_600_000;
    default: return 0;
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' :
    'xdg-open';
  exec(`${cmd} "${url}"`);
}

export function buildHostHTML() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prompt</title>
</head>
<body>
  <div id="app-root"></div>
  <script type="module">
    const root = document.getElementById('app-root');
    const { mount } = await import('${ENTRY_PATH}');

    async function postResult(body) {
      await fetch('/__result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    async function loadData() {
      const response = await fetch('${PAYLOAD_PATH}');
      if (!response.ok) {
        throw new Error(\`Failed to load prompt payload: \${response.status}\`);
      }
      return response.json();
    }

    const data = await loadData();

    mount({
      root,
      data,
      submit: (values) => {
        postResult({ status: 'submitted', data: values });
        window.close();
      },
      cancel: () => postResult({ status: 'cancelled' }),
      assetsBaseURL: '/',
    });
  </script>
</body>
</html>`;
}

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function resolveStaticFilePath(webDir, requestURL) {
  const rawPath = (requestURL || '/').split('?')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  const relativePath = decodedPath.replace(/^\/+/u, '');
  const filePath = resolve(webDir, relativePath);
  const relativePathFromRoot = relative(webDir, filePath);
  if (
    relativePathFromRoot === '' ||
    relativePathFromRoot === '..' ||
    relativePathFromRoot.startsWith('../') ||
    relativePathFromRoot.startsWith('..\\')
  ) {
    return null;
  }
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.entry) {
    process.stderr.write('prompt: --entry is required\n');
    process.exit(1);
  }

  const payloadJSON = await readStdin();
  JSON.parse(payloadJSON); // validate

  const entryPath = resolve(args.entry);
  const webDir = dirname(entryPath);
  const hostHTML = buildHostHTML();

  let done = false;
  let resultResolve;
  const resultPromise = new Promise((r) => { resultResolve = r; });
  const finish = (json) => {
    if (done) return;
    done = true;
    resultResolve(json);
  };

  // Heartbeat: if no ping within HEARTBEAT_TIMEOUT_MS, treat as closed.
  let heartbeatTimer = null;
  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => finish(JSON.stringify({ status: 'closed' })), HEARTBEAT_TIMEOUT_MS);
  };

  const server = createServer(async (req, res) => {
    // Result callback
    if (req.method === 'POST' && req.url === '/__result') {
      const body = await collectBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      finish(body);
      return;
    }

    if (req.method === 'GET' && req.url === PAYLOAD_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(payloadJSON);
      return;
    }

    if (req.method === 'GET' && req.url === ENTRY_PATH) {
      try {
        const content = readFileSync(entryPath);
        res.writeHead(200, { 'Content-Type': MIME['.mjs'] });
        res.end(content);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
      return;
    }

    // Heartbeat
    if (req.url === '/heartbeat') {
      resetHeartbeat();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    // Host page
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(hostHTML);
      return;
    }

    // Static files from web directory
    const filePath = resolveStaticFilePath(webDir, req.url);
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    try {
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}`;
    process.stderr.write(`prompt: listening on ${url}\n`);
    openBrowser(url);
    resetHeartbeat();
  });

  // Timeout
  let timeoutTimer;
  if (args.timeout > 0) {
    timeoutTimer = setTimeout(() => finish(JSON.stringify({ status: 'timeout' })), args.timeout);
  }

  const result = await resultPromise;
  if (timeoutTimer) clearTimeout(timeoutTimer);
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  server.close();
  process.stdout.write(`${result}\n`);
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMain()) {
  main().catch((err) => {
    process.stderr.write(`prompt: ${err.message}\n`);
    process.exit(1);
  });
}
