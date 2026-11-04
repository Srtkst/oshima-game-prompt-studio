import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gameBytesLimit, gameIdPattern, validateGame } from '../public/js/game-file.js';

const bodyLimit = 2 * gameBytesLimit + 2048;
const hash = (value) => createHash('sha256').update(value).digest();

async function bodyJson(request) {
  if (Number(request.headers['content-length']) > bodyLimit) throw new Error('HTMLは512 KB以内にしてください。');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > bodyLimit) throw new Error('HTMLは512 KB以内にしてください。');
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}

export function gameApi({ key = '', publicUrl = '', directory, now = Date.now, ttl = 24 * 60 * 60_000 }) {
  if (key && !/^[\x21-\x7e]{16,150}$/u.test(key)) throw new Error('EVENT_PUBLISH_KEYには16〜150文字の半角英数字・記号を設定してください。');
  if (publicUrl) {
    const url = new URL(publicUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.href.length > 600) {
      throw new Error('EVENT_PUBLIC_URLにはサーバーのルートURLを設定してください。');
    }
    publicUrl = url.href;
  }
  const expected = key && hash(`Bearer ${key}`);
  let writes = Promise.resolve();
  const file = (id) => join(directory, `${id}.json`);

  function json(response, status, value) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(value));
  }

  async function readGame(id) {
    try { return JSON.parse(await readFile(file(id), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }

  async function saveGame(game) {
    await mkdir(directory, { recursive: true });
    const files = await readdir(directory);
    let active = 0;
    for (const name of files) {
      const id = name.slice(0, -5);
      if (!name.endsWith('.json') || !gameIdPattern.test(id)) continue;
      const existing = await readGame(id);
      if (!existing) continue;
      if (existing.expiresAt <= now()) await unlink(file(id)).catch(ignoreMissing);
      else active += 1;
    }
    if (active >= 100) return null;
    const id = randomBytes(16).toString('hex');
    const expiresAt = now() + ttl;
    const temp = `${file(id)}.tmp`;
    try {
      await writeFile(temp, JSON.stringify({ ...game, expiresAt }), { flag: 'wx' });
      await rename(temp, file(id));
    } finally { await unlink(temp).catch(ignoreMissing); }
    return { id, expiresAt };
  }

  return async function handle(request, response, pathname) {
    if (pathname === '/api/event.json' && request.method === 'GET') {
      json(response, 200, { publishing: Boolean(expected), publicUrl });
      return;
    }
    const id = pathname.startsWith('/api/games/') ? pathname.slice('/api/games/'.length) : '';
    if (gameIdPattern.test(id) && request.method === 'GET') {
      const game = await readGame(id);
      if (game && game.expiresAt > now()) json(response, 200, game);
      else json(response, 404, { error: '作品が見つからないか、公開期間が終了しました。' });
      return;
    }
    if ((pathname === '/api/games' && request.method === 'POST') || (gameIdPattern.test(id) && request.method === 'DELETE')) {
      if (!expected) return json(response, 403, { error: 'イベント配信は無効です。' });
      if (!timingSafeEqual(expected, hash(request.headers.authorization ?? ''))) {
        request.resume();
        return json(response, 401, { error: '公開キーを確認してください。' });
      }
      if (request.method === 'DELETE') {
        await unlink(file(id)).catch(ignoreMissing);
        return json(response, 200, { removed: true });
      }
      let game;
      try {
        const value = await bodyJson(request);
        const title = typeof value?.title === 'string' ? value.title.trim() : '';
        if (!title || title.length > 80 || /[\p{Cc}\p{Cf}]/u.test(title)) throw new Error('表示名を1〜80文字で入力してください。');
        validateGame(value.html);
        game = { title, html: value.html };
      } catch (error) {
        request.resume();
        return json(response, 400, { error: error instanceof SyntaxError ? '作品データを読み取れませんでした。' : error.message });
      }
      const pending = writes.then(() => saveGame(game));
      writes = pending.catch(() => {});
      const result = await pending;
      if (!result) return json(response, 409, { error: '公開中の作品が上限に達しました。' });
      return json(response, 201, result);
    }
    json(response, 404, { error: '公開先が見つかりません。' });
  };
}

function ignoreMissing(error) {
  if (error.code !== 'ENOENT') throw error;
}
