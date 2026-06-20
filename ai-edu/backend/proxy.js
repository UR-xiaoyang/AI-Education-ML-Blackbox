const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 80;
const API_URL = process.env.API_URL || 'http://localhost:3001';
const distDir = path.join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function proxyApi(req, res) {
  const url = `${API_URL}${req.url}`;
  const proxyReq = http.request(url, {
    method: req.method,
    headers: {
      ...req.headers,
      host: new URL(API_URL).host
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Backend unavailable' }));
  });

  req.pipe(proxyReq);
}

function serveFile(res, filePath, isIndex = false) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': isIndex ? 'no-store, no-cache, must-revalidate' : 'public, max-age=31536000, immutable'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) {
    proxyApi(req, res);
    return;
  }

  const requestPath = decodeURIComponent(req.url.split('?')[0]);
  const safePath = path.normalize(requestPath).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(res, filePath, path.basename(filePath) === 'index.html');
      return;
    }

    serveFile(res, path.join(distDir, 'index.html'), true);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Proxying /api/* to ${API_URL}`);
});
