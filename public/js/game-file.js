export const gameBytesLimit = 512 * 1024;
export const gameIdPattern = /^[a-f0-9]{32}$/u;

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
