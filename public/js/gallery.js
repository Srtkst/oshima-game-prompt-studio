import { isGameSlug, registeredGameUrl } from './game-file.js';

const grid = document.querySelector('#gallery-grid');
const status = document.querySelector('#gallery-status');
const search = document.querySelector('#game-search');
const marks = ['◇', '✦', '◎', '✚'];
const normalized = (text) => text.normalize('NFKC').toLocaleLowerCase('ja');

function textNode(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function card(game, index) {
  const entry = document.createElement('li');
  const link = document.createElement('a');
  link.className = `gallery-card theme-${index % marks.length}`;
  link.href = registeredGameUrl(game.id, location.href);
  const art = textNode('div', marks[index % marks.length], 'gallery-art');
  art.setAttribute('aria-hidden', 'true');
  art.prepend(textNode('span', `GAME ${String(index + 1).padStart(2, '0')}`, 'gallery-index'));
  const copy = document.createElement('div');
  copy.className = 'gallery-copy';
  copy.append(textNode('h2', game.title));
  if (game.description) copy.append(textNode('p', game.description, 'hint'));
  copy.append(textNode('span', game.id, 'gallery-id'), textNode('span', '遊ぶ →', 'gallery-play'));
  link.append(art, copy);
  entry.append(link);
  return entry;
}

try {
  const response = await fetch('./games/index.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load game catalog');
  const games = await response.json();
  if (!Array.isArray(games) || games.some((game) => !isGameSlug(game?.id) || typeof game.title !== 'string' || typeof game.description !== 'string')) {
    throw new Error('Invalid game catalog');
  }
  function render() {
    const query = normalized(search.value.trim());
    const matching = games.map((game, index) => ({ game, index })).filter(({ game }) =>
      normalized(`${game.title} ${game.description} ${game.id}`).includes(query));
    grid.replaceChildren(...matching.map(({ game, index }) => card(game, index)));
    status.textContent = games.length === 0 ? '登録済みの作品はまだありません。'
      : matching.length === 0 ? '一致する作品がありません。'
        : query ? `${games.length}件中 ${matching.length}件` : `登録作品 ${games.length}件`;
  }
  search.closest('.field').hidden = games.length === 0;
  search.addEventListener('input', render);
  render();
} catch {
  status.textContent = '作品一覧を読み込めませんでした。時間をおいて再読み込みしてください。';
}
