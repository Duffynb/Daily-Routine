import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appDataMiddleware,
  foodEstimateMiddleware,
  activityBurnEstimateMiddleware,
} from './persist-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const builtFaviconSvg = fs.existsSync(distAssetsDir)
  ? fs
      .readdirSync(distAssetsDir)
      .find((name) => /^favicon-.*\.svg$/i.test(name))
  : null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

const apiStack = [
  appDataMiddleware,
  foodEstimateMiddleware,
  activityBurnEstimateMiddleware,
];

function runApi(req, res, i = 0) {
  if (i >= apiStack.length) {
    serveStatic(req, res);
    return;
  }
  apiStack[i](req, res, () => runApi(req, res, i + 1));
}

function safeJoin(base, requestPath) {
  const rel = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(base, rel);
  if (!full.startsWith(base)) return null;
  return full;
}

function serveStatic(req, res) {
  const rawUrl = req.url.split('?')[0];
  let urlPath = decodeURIComponent(rawUrl);

  // Some browsers ask /favicon.ico first; serve built SVG favicon as fallback.
  if ((urlPath === '/favicon.ico' || urlPath === '/favicon.svg') && builtFaviconSvg) {
    const icoFallbackPath = path.join(distAssetsDir, builtFaviconSvg);
    fs.readFile(icoFallbackPath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(data);
    });
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';

  const filePath = safeJoin(distDir, urlPath);
  if (!filePath) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (!err) {
      res.setHeader('Content-Type', mimeFor(filePath));
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(data);
      return;
    }
    // Missing static asset (has extension) should be a real 404, not SPA fallback.
    if (path.extname(urlPath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
      return;
    }
    const indexPath = path.join(distDir, 'index.html');
    fs.readFile(indexPath, (e2, html) => {
      if (e2) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not found — run npm run build first.');
        return;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    });
  });
}

if (!fs.existsSync(distDir)) {
  console.error('Missing dist/ — run: npm run build');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  runApi(req, res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use (EADDRINUSE).\n` +
        `  • Stop the other process, e.g. Windows:\n` +
        `      netstat -ano | findstr :${port}\n` +
        `      taskkill /PID <PID_FROM_LIST> /F\n` +
        `  • Or use another port:\n` +
        `      PowerShell:  $env:PORT=8788; npm start\n` +
        `      cmd.exe:       set PORT=8788&& npm start`
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(
    `Daily routine: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/ (bound ${host}:${port})`
  );
});
