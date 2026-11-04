import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { gameApi } from '../tools/game-api.js';
import { gameDocument, gameIdPattern, validateGame } from '../public/js/game-file.js';

const html = '<!doctype html><html><body><script>document.body.textContent = "Play"</script></body></html>';
const key = 'event-fixture-key-123';

async function call(api, method, path, data, secret) {
  const request = Readable.from(data ? [Buffer.from(JSON.stringify(data))] : []);
  request.method = method;
  request.headers = secret ? { authorization: `Bearer ${secret}` } : {};
  const result = {};
  const response = {
    writeHead(status, headers) { result.status = status; result.headers = headers; },
    end(value) { result.body = JSON.parse(value); },
  };
  await api(request, response, path);
  return result;
}

test('公開はキーを要求し、共有IDで別端末が取得でき、期限切れと取り下げを処理する', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'oshima-games-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 1000;
  const api = gameApi({ directory, key, ttl: 60, now: () => now, publicUrl: 'https://event.example/' });
  const data = { title: 'ゲーム', html };
  assert.equal((await call(api, 'POST', '/api/games', data)).status, 401);
  assert.equal((await call(api, 'POST', '/api/games', data, 'wrong')).status, 401);
  assert.deepEqual((await call(api, 'GET', '/api/event.json')).body, { publishing: true, publicUrl: 'https://event.example/' });
  assert.equal((await call(api, 'POST', '/api/games', { title: '不正', html: 'not HTML' }, key)).status, 400);
  const created = await call(api, 'POST', '/api/games', data, key);
  assert.equal(created.status, 201);
  assert.match(created.body.id, gameIdPattern);
  const route = `/api/games/${created.body.id}`;
  const retrieved = await call(api, 'GET', route);
  assert.match(retrieved.headers['Content-Type'], /^application\/json/);
  assert.deepEqual(retrieved.body, { ...data, expiresAt: 1060 });
  assert.equal((await call(api, 'DELETE', route)).status, 401);
  now = 1060;
  assert.equal((await call(api, 'GET', route)).status, 404);
  const second = await call(api, 'POST', '/api/games', data, key);
  const secondRoute = `/api/games/${second.body.id}`;
  assert.equal((await call(api, 'DELETE', secondRoute, undefined, key)).status, 200);
  assert.equal((await call(api, 'GET', secondRoute)).status, 404);
  assert.equal((await call(api, 'GET', '/api/games/../secret')).status, 404);
});

test('ゲーム文書はサイズ上限とCSPを先頭に持つ', () => {
  assert.throws(() => validateGame('<html>' + 'あ'.repeat(200_000)), /512 KB/);
  const document = gameDocument(html);
  assert.match(document, /Content-Security-Policy.*default-src 'none'/);
  assert.ok(document.indexOf('Content-Security-Policy') < document.indexOf('<script>'));
});
