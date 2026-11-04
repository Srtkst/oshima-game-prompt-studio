import qrCode from '../vendor/qrcode-generator.js';
import { gameBytesLimit, gameDocument, gameIdPattern, isGameSlug, registeredGameUrl, registeredTitle, suggestGameSlug } from './game-file.js';

const get = (id) => document.getElementById(id);
const drop = get('game-import');
const staff = get('game-staff');
const registration = get('game-static');
const status = get('game-status');
const publishStatus = get('publish-status');
const frame = get('game-frame');
const view = get('game-view');
const fullscreen = get('game-fullscreen');
const remove = get('game-remove');
let source;
let eventConfig;
let sharedId;
let importVersion = 0;

function openGame(title, html) {
  const document = gameDocument(html);
  source = { title, html, document };
  frame.srcdoc = document;
  get('game-label').textContent = title;
  view.hidden = false;
}

async function loadFile(file) {
  const version = ++importVersion;
  source = undefined;
  frame.removeAttribute('srcdoc');
  view.hidden = true;
  staff.hidden = true;
  registration.hidden = true;
  get('game-approval').checked = false;
  try {
    if (!file || !/\.html?$/iu.test(file.name) || file.size > gameBytesLimit) throw new Error('512 KB以内の単一HTMLを1件選んでください。');
    const html = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (version !== importVersion) return;
    openGame(file.name, html);
    const title = file.name.replace(/\.html?$/iu, '').slice(0, 80);
    get('game-name').value = title;
    get('registered-title').value = title;
    get('registered-description').value = '';
    const suggestedId = suggestGameSlug(file.name);
    get('registered-id').value = isGameSlug(suggestedId) && suggestedId !== 'sorting-demo' ? suggestedId : '';
    updateRegistrationPreview();
    status.textContent = '読み込みました。下の画面で試遊できます。';
    publishStatus.textContent = '';
    staff.hidden = !eventConfig?.publishing;
    registration.hidden = false;
    get('game-static-status').textContent = '';
  } catch (error) {
    if (version === importVersion) status.textContent = `読み込めませんでした。${error.message}`;
  }
}

function showQr(raw, id) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 700) {
    throw new Error('700文字以内のHTTPまたはHTTPSのURLを入力してください。');
  }
  if (!id && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('別端末から開ける配信先のURLを入力してください。');
  const qr = qrCode(0, 'M');
  qr.addData(url.href, 'Byte');
  qr.make();
  get('game-qr').src = qr.createDataURL(5, 20);
  const link = get('game-link');
  link.href = url.href;
  link.textContent = url.href;
  sharedId = id;
  remove.hidden = !id;
  get('game-share').hidden = false;
}

async function request(path, options) {
  const response = await fetch(new URL(path, location.href), { ...options, cache: 'no-store' });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(response.status === 404 ? '作品が見つからないか、公開が反映されていません。' : '配信先に接続できません。');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '配信先でエラーが起きました。');
  return data;
}

get('game-file').addEventListener('change', (event) => {
  const [file] = event.currentTarget.files;
  if (file) loadFile(file);
  event.currentTarget.value = '';
});
drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', (event) => {
  if (!(event.relatedTarget instanceof Node) || !drop.contains(event.relatedTarget)) drop.classList.remove('dragging');
});
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('dragging');
  loadFile(event.dataTransfer.files.length === 1 ? event.dataTransfer.files[0] : undefined);
});
get('game-restart').addEventListener('click', () => { if (source) frame.srcdoc = source.document; });

function isExpanded() {
  return document.fullscreenElement === view || view.classList.contains('is-expanded');
}

function updateFullscreenLabel() {
  fullscreen.textContent = isExpanded() ? '⛶ 大画面を閉じる' : '⛶ 大画面';
  fullscreen.setAttribute('aria-pressed', String(isExpanded()));
}

function setExpanded(expanded) {
  view.classList.toggle('is-expanded', expanded);
  document.body.classList.toggle('game-expanded', expanded);
  for (const element of document.querySelectorAll('.site-header, .game-panel > :not(#game-view)')) element.inert = expanded;
  updateFullscreenLabel();
}

fullscreen.addEventListener('click', async () => {
  if (document.fullscreenElement === view) {
    await document.exitFullscreen();
    return;
  }
  if (!isExpanded() && document.fullscreenEnabled && view.requestFullscreen) {
    try { await view.requestFullscreen(); return; }
    catch { /* The in-page layout is available when the browser declines fullscreen. */ }
  }
  setExpanded(!isExpanded());
});
document.addEventListener('fullscreenchange', updateFullscreenLabel);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && view.classList.contains('is-expanded')) setExpanded(false);
});

function updateRegistrationPreview() {
  const id = get('registered-id').value.trim();
  get('registered-preview').textContent = isGameSlug(id) && id !== 'sorting-demo' ? `${id}.json → play.html?game=${id}` : '';
}

get('registered-id').addEventListener('input', updateRegistrationPreview);
get('game-export-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const selected = source;
  if (!selected) return;
  const status = get('game-static-status');
  const submit = get('game-export');
  const id = get('registered-id').value.trim();
  const title = get('registered-title').value.trim();
  const description = get('registered-description').value.trim();
  if (!title || !isGameSlug(id) || id === 'sorting-demo') {
    status.textContent = '作品名と、48文字以内の作品IDを入力してください。既定のファイル名や端末の予約名は使えません。';
    return;
  }
  submit.disabled = true;
  let checked = false;
  try {
    const response = await fetch(`./games/${encodeURIComponent(id)}.json`, { method: 'HEAD', cache: 'no-store' });
    if (response.ok) {
      status.textContent = `「${id}」は登録済みです。別の作品IDを入力してください。`;
      return;
    }
    checked = response.status === 404;
  } catch { /* The HTML can still be packaged when the registry is offline. */ }
  finally { submit.disabled = false; }
  if (source !== selected) return;
  const file = URL.createObjectURL(new Blob([JSON.stringify({ title, description, html: selected.html })], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = file;
  link.download = `${id}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(file), 1000);
  status.textContent = `${id}.json を保存します。公開後の作品URLは play.html?game=${id} です。${checked ? '' : '登録済みIDとの重複は、配置前に確認してください。'}`;
});

get('game-qr-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    showQr(get('game-url').value);
    get('game-qr-status').textContent = 'QRを作成しました。別の端末でURLが開くことを確認してください。';
  } catch (error) { get('game-qr-status').textContent = error.message; }
});

get('game-publish').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!source || !get('game-approval').checked) return;
  const submit = event.currentTarget.querySelector('button[type=submit]');
  const key = get('game-key').value;
  if (!/^[\x21-\x7e]{16,150}$/u.test(key)) {
    publishStatus.textContent = '16文字以上の半角英数字・記号の公開キーを入力してください。';
    return;
  }
  submit.disabled = true;
  publishStatus.textContent = '公開しています…';
  try {
    const { id, expiresAt } = await request('./api/games', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ title: get('game-name').value, html: source.html }),
    });
    const url = new URL('./play.html', eventConfig.publicUrl || location.href);
    url.searchParams.set('id', id);
    showQr(url.href, id);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    publishStatus.textContent = `公開期限 ${new Date(expiresAt).toLocaleString('ja-JP')}。${loopback ? '別の端末には配信先URLの設定が必要です。' : ''}`;
  } catch (error) { publishStatus.textContent = error.message; }
  finally { submit.disabled = false; }
});

remove.addEventListener('click', async () => {
  if (!sharedId || !confirm('この作品の公開を終了しますか？')) return;
  remove.disabled = true;
  try {
    await request(`./api/games/${sharedId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${get('game-key').value}` } });
    get('game-share').hidden = true;
    sharedId = undefined;
    publishStatus.textContent = '公開を終了しました。';
  } catch (error) { publishStatus.textContent = error.message; }
  finally { remove.disabled = false; }
});

const params = new URL(location.href).searchParams;
const id = params.get('id');
const staticGame = params.get('game');
if (id !== null || staticGame !== null) {
  drop.hidden = true;
  get('game-existing').hidden = true;
  status.textContent = 'ゲームを読み込んでいます…';
  try {
    if (id !== null ? staticGame !== null || !gameIdPattern.test(id) : !isGameSlug(staticGame)) {
      throw new Error('作品URLを確認してください。');
    }
    const game = await request(id !== null ? `./api/games/${id}` : `./games/${encodeURIComponent(staticGame)}.json`);
    if (typeof game?.title !== 'string' || !game.title.trim() || game.title.length > 80 || typeof game.html !== 'string') throw new Error('作品データを確認してください。');
    const title = staticGame === null ? game.title : registeredTitle(staticGame, game);
    openGame(title, game.html);
    get('game-title').textContent = title;
    status.textContent = 'ゲーム画面をタップして遊べます。';
    if (staticGame !== null && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) showQr(registeredGameUrl(staticGame, location.href));
  } catch (error) { status.textContent = error.message; }
} else {
  request('./api/event.json').then((config) => {
    eventConfig = config;
    staff.hidden = !source || !config.publishing;
  }).catch(() => {});
}
