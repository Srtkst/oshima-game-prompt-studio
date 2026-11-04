import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { isGameSlug, registeredGameUrl, suggestGameSlug } from '../public/js/game-file.js';
import { gameCatalog } from '../tools/build-game-catalog.js';

test('HTMLの名前から読みやすいIDを提案し、既存のランダムIDも許可する', () => {
  assert.equal(suggestGameSlug('Tool Tidying (2).HTML'), 'tool-tidying-2');
  assert.equal(suggestGameSlug('東大島　クイズ.html'), '東大島-クイズ');
  assert.ok(isGameSlug('24c5d0ee5340aeaf053cdca9'));
  for (const value of ['../game', 'a/b', 'index', 'con', 'foo--bar', '']) assert.equal(isGameSlug(value), false);
  const url = new URL(registeredGameUrl('東大島-クイズ', 'https://example.test/studio/gallery.html'));
  assert.equal(url.pathname, '/studio/play.html');
  assert.equal(url.searchParams.get('game'), '東大島-クイズ');
});

test('登録ファイルから一覧用の情報だけを生成し、不正なJSONはファイル名付きで報告する', async (t) => {
  const path = await mkdtemp(`${tmpdir()}${sep}oshima-catalog-`);
  t.after(() => rm(path, { recursive: true, force: true }));
  const directory = pathToFileURL(path + sep);
  const html = '<!doctype html><html><title>実際の作品名</title></html>';
  const legacy = '24c5d0ee5340aeaf053cdca9';
  const save = (name, data) => writeFile(new URL(name, directory), JSON.stringify(data));
  await save(`${legacy}.json`, { title: 'upload-artifact', html });
  await save('tool-tidying.json', { title: '片づけ', description: '短い紹介', html });
  await save('index.json', []);
  const games = await gameCatalog(directory);
  assert.deepEqual(games.find(({ id }) => id === legacy), { id: legacy, title: '実際の作品名', description: '' });
  assert.deepEqual(games.find(({ id }) => id === 'tool-tidying'), { id: 'tool-tidying', title: '片づけ', description: '短い紹介' });
  assert.equal(games.length, 2);
  await save('invalid-game.json', { title: '無効', html: 'not a game' });
  await assert.rejects(gameCatalog(directory), /invalid-game\.json/);
});
