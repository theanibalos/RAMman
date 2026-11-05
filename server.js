'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getSystemMemory() {
  const GiB = 1024 ** 3;
  try {
    if (process.platform === 'linux') {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const getVal = key => {
        const line = meminfo.split('\n').find(l => l.startsWith(key + ':'));
        if (!line) return 0;
        const parts = line.split(/\s+/);
        return parseInt(parts[1], 10) * 1024;
      };
      const totalBytes = getVal('MemTotal');
      const availableBytes = getVal('MemAvailable') || getVal('MemFree');
      const usedBytes = Math.max(0, totalBytes - availableBytes);
      const totalGiB = Number((totalBytes / GiB).toFixed(1));
      const usedGiB = Number((usedBytes / GiB).toFixed(1));
      const freeGiB = Number((availableBytes / GiB).toFixed(1));
      const percent = Number(((usedBytes / totalBytes) * 100).toFixed(1));
      return { total: totalGiB, used: usedGiB, free: freeGiB, percent, totalBytes, usedBytes };
    }
  } catch {}

  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const totalGiB = Number((totalBytes / GiB).toFixed(1));
  const usedGiB = Number((usedBytes / GiB).toFixed(1));
  const freeGiB = Number((freeBytes / GiB).toFixed(1));
  const percent = Number(((usedBytes / totalBytes) * 100).toFixed(1));
  return { total: totalGiB, used: usedGiB, free: freeGiB, percent, totalBytes, usedBytes };
}

const sseClients = new Set();

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Endpoint JSON
  if (pathname === '/api/ram') {
    const mem = getSystemMemory();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(mem));
    return;
  }

  // Endpoint SSE (Server-Sent Events) en tiempo real
  if (pathname === '/api/ram/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify(getSystemMemory())}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Servir archivos estáticos
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.join(ROOT, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 No Encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Transmitir cada 1 segundo a los clientes conectados
setInterval(() => {
  if (sseClients.size === 0) return;
  const data = `data: ${JSON.stringify(getSystemMemory())}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}, 1000);

server.listen(PORT, () => {
  const mem = getSystemMemory();
  console.log('='.repeat(52));
  console.log('   Sam RAMman · Medidor de RAM en Tiempo Real');
  console.log('='.repeat(52));
  console.log(` Servidor local activo en: http://localhost:${PORT}`);
  console.log(` RAM del sistema detectada: ${mem.used} GB usados / ${mem.total} GB totales (${mem.percent}%)`);
  console.log(' Abre esa dirección en tu navegador para ver al personaje.');
  console.log(' Presiona Ctrl + C para detener.');
  console.log('='.repeat(52));
});
