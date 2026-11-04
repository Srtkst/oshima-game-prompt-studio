export const gameBytesLimit = 512 * 1024;
export const gameIdPattern = /^[a-f0-9]{32}$/u;
export const gameSlugLimit = 48;

export function suggestGameSlug(filename) {
  return filename.replace(/\.html?$/iu, '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/gu, '')
    .slice(0, gameSlugLimit).replace(/-+$/u, '');
}

export function isGameSlug(value) {
  return typeof value === 'string' && value.length <= gameSlugLimit
    && /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value)
    && value === value.normalize('NFKC').toLowerCase()
    && !/^(?:index|con|prn|aux|nul|com[1-9]|lpt[1-9])$/u.test(value);
}

export function registeredGameUrl(slug, base) {
  const url = new URL('./play.html', base);
  url.searchParams.set('game', slug);
  return url.href;
}

export function registeredTitle(slug, game) {
  if (!/^[a-f0-9]{24}$/u.test(slug)) return game.title;
  const title = game.html.match(/<title(?:\s[^>]*)?>([^<]{1,80})<\/title\s*>/iu)?.[1].trim();
  return title || game.title;
}

export function validateGame(html) {
  if (typeof html !== 'string') throw new Error('UTF-8のHTML文書（.html）を指定してください。');
  if (html.length > gameBytesLimit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(html) || new TextEncoder().encode(html).length > gameBytesLimit) {
    throw new Error('HTMLは512 KB以内の単一ファイルにしてください。');
  }
  let start = html.trimStart();
  while (start.startsWith('<!--')) {
    const end = start.indexOf('-->');
    if (end === -1) break;
    start = start.slice(end + 3).trimStart();
  }
  if (!/^(?:<!doctype\s+html\b|<html[\s>])/iu.test(start)) throw new Error('UTF-8のHTML文書（.html）を指定してください。');
}

export function gameDocument(html) {
  validateGame(html);
  // This prefix is parsed before the game. The parent iframe also has an opaque origin.
  const csp = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'";
  return `<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}">${html}`;
}
