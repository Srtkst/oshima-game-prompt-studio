import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGameSlug, registeredTitle, validateGame } from '../public/js/game-file.js';

const directory = new URL('../public/games/', import.meta.url);

export async function gameCatalog(root = directory) {
  const entries = await readdir(root, { withFileTypes: true });
  const games = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'index.json') continue;
    const id = entry.name.slice(0, -5);
    try {
      if (!isGameSlug(id)) throw new Error('ファイル名は小文字の英数字・日本語・ハイフンで指定してください。');
      const text = await readFile(new URL(encodeURIComponent(entry.name), root), 'utf8');
      const game = JSON.parse(text.replace(/^\uFEFF/u, ''));
      if (typeof game?.title !== 'string' || !game.title.trim() || game.title.length > 80) throw new Error('作品名は1〜80文字で指定してください。');
      if (game.description !== undefined && (typeof game.description !== 'string' || game.description.length > 140)) throw new Error('紹介文は140文字以内です。');
      validateGame(game.html);
      games.push({ id, title: registeredTitle(id, game).trim(), description: game.description?.trim() ?? '' });
    } catch (error) { throw new Error(`${entry.name} の登録を確認してください。${error.message}`, { cause: error }); }
  }
  games.sort((a, b) => a.title.localeCompare(b.title, 'ja') || a.id.localeCompare(b.id));
  return games;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const games = await gameCatalog();
  await writeFile(new URL('index.json', directory), JSON.stringify(games, null, 2) + '\n');
}
