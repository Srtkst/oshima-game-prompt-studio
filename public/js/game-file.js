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
  const language = new URL(base).searchParams.get('lang');
  if (language === 'en' || language === 'ja') url.searchParams.set('lang', language);
  return url.href;
}

export function registeredTitle(slug, game, language = 'ja') {
  if (game.titles?.[language]?.trim()) return game.titles[language].trim();
  if (!/^[a-f0-9]{24}$/u.test(slug)) return game.title;
  const title = game.html?.match(/<title(?:\s[^>]*)?>([^<]{1,80})<\/title\s*>/iu)?.[1].trim();
  return title || game.title;
}

export function registeredDescription(game, language = 'ja') {
  return typeof game.descriptions?.[language] === 'string' ? game.descriptions[language].trim() : game.description?.trim() || '';
}

export function validateGameMetadata(game) {
  if (typeof game?.title !== 'string' || !game.title.trim() || game.title.length > 80) throw new Error('作品名は1〜80文字で指定してください。');
  if (game.description !== undefined && (typeof game.description !== 'string' || game.description.length > 140)) throw new Error('紹介文は140文字以内です。');
  for (const [key, limit, required] of [['titles', 80, true], ['descriptions', 140, false]]) {
    if (game[key] === undefined) continue;
    if (!game[key] || typeof game[key] !== 'object' || Array.isArray(game[key])
      || ['ja', 'en'].some((locale) => typeof game[key][locale] !== 'string' || game[key][locale].length > limit
        || (required && !game[key][locale].trim()) || /[\p{Cc}\p{Cf}]/u.test(game[key][locale]))) {
      throw new Error(`${key}には日本語(ja)と英語(en)を指定してください。`);
    }
  }
}

export function suggestTitles(html, filename) {
  const meta = {};
  for (const tag of html.match(/<meta\b[^>]*>/giu) ?? []) {
    const name = tag.match(/\bname\s*=\s*["']game:title:(ja|en)["']/iu)?.[1];
    const value = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/iu)?.[2];
    if (name && value) meta[name.toLowerCase()] = value;
  }
  const title = html.match(/<title(?:\s[^>]*)?>([^<]{1,160})<\/title\s*>/iu)?.[1].trim() ?? filename.replace(/\.html?$/iu, '');
  const bilingual = title.split(/\s+(?:\/|\||-)\s+/u);
  const ja = meta.ja || (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(title) ? bilingual[0] : '');
  const en = meta.en || (bilingual.length === 2 && /^[\x20-\x7e]+$/u.test(bilingual[1]) ? bilingual[1] : !ja ? title : '');
  return { ja: ja.slice(0, 80), en: en.slice(0, 80) };
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

function installGameLanguage(initialLanguage) {
  let language = 'ja';
  let initialized = false;
  function apply(value) {
    if (!['ja', 'en'].includes(value) || (initialized && language === value)) return;
    const select = document.querySelector('select#language, select#lang');
    if (select && [...select.options].some((option) => option.value === value)) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const button = document.querySelector(`#lang-${value}, #btn-lang-${value}, [data-lang="${value}"]`);
      if (button) button.click();
      else if (language !== value) document.querySelector('#btn-lang')?.click();
    }
    language = value;
    initialized = true;
    document.documentElement.lang = value;
    document.dispatchEvent(new CustomEvent('oshima-language', { detail: value }));
  }
  window.addEventListener('message', (event) => {
    if (event.source === parent && event.data?.type === 'oshima-language') apply(event.data.language);
  });
  document.querySelector('#btn-lang')?.addEventListener('click', () => {
    language = language === 'ja' ? 'en' : 'ja';
  });
  apply(initialLanguage);
}

export function gameDocument(html, language = 'ja') {
  validateGame(html);
  // This prefix is parsed before the game. The parent iframe also has an opaque origin.
  const csp = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'";
  const locale = language === 'en' ? 'en' : 'ja';
  const bridge = `\n<script>(${installGameLanguage.toString()})('${locale}');<\/script>`;
  return `<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}">${html}${bridge}`;
}
