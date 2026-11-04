import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { gameApi } from './game-api.js';

const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const host = process.env.EVENT_HOST ?? '127.0.0.1';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.json': 'application/json' };
const directory = resolve(process.env.EVENT_GAME_DIR ?? '.event-games');
const normalized = (path) => process.platform === 'win32' ? path.toLowerCase() : path;
if (normalized(directory) === normalized(root) || normalized(directory).startsWith(`${normalized(root)}${sep}`)) {
  throw new Error('EVENT_GAME_DIRはpublicディレクトリの外に設定してください。');
}
const api = gameApi({ key: process.env.EVENT_PUBLISH_KEY, publicUrl: process.env.EVENT_PUBLIC_URL, directory });

createServer({ requestTimeout: 30_000 }, async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      try { await api(request, response, pathname); }
      catch (error) {
        console.error(error);
        if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: '配信先でエラーが起きました。' }));
      }
      return;
    }
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const type = types[extname(path)];
    if (!path.startsWith(`${root}${sep}`) || !type) {
      response.writeHead(404).end();
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, host, () => console.log(`Local: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/`));
