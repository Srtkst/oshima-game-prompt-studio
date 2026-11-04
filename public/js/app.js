import { generateOutput, outputs, sections, targets } from './generate.js';
import { applyTopic, choices, genres, newProject, recommend, topics, topicStory, validate } from './project.js';
import { steps } from './steps.js';
import { draftLimit, jsonLimit, newProjectId, packProject, parseProject, projectLink, readProjectLink, storageKey } from './storage.js';
import { inspect } from './quality.js';
import { markdownPreview } from './markdown-preview.js';

const workspace = document.querySelector('#workspace');
const announcement = document.querySelector('#announcement');
const lastStep = steps.length - 1;
let project;
let step = 0;
let editing = false;
let genreChanged = false;
let projectId;
let drafts = {};
let screen = 'wizard';
let kind = 'integrated';
let target = 'generic';
let saveTimer;
let sharedProject;
let openMessage = '';
const storageNotice = document.querySelector('#storage-notice');

function snapshot() {
  return { project, projectId, drafts, screen, step, genreChanged, kind, target };
}

function persist() {
  if (!project) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(packProject(snapshot())));
    storageNotice.textContent = '';
  } catch {
    storageNotice.textContent = 'ブラウザーに保存できませんでした。設定JSONを保存してください。';
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}

function loadState(state) {
  ({ project, projectId, drafts, screen, step, genreChanged, kind, target } = state);
  editing = false;
}

function resume() {
  const issues = validate(project);
  if (screen === 'result' && !issues.length) return renderResult();
  if (issues.length) step = Math.min(step, issues[0].step);
  renderWizard();
}

function replaceState(state) {
  if (project && !window.confirm('現在の作業を、読み込んだ企画に置き換えますか？')) return;
  loadState(state);
  if (location.hash.startsWith('#project=')) history.replaceState(null, '', location.pathname + location.search);
  sharedProject = undefined;
  persist();
  resume();
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(text, className, action) {
  const element = node('button', className, text);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

function show(content, focus = true) {
  workspace.replaceChildren(content);
  const heading = workspace.querySelector('h1');
  if (focus && heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function start(topicId) {
  if (project && !window.confirm('作業中の入力を破棄して、新しい企画を始めますか？')) return;
  project = newProject(topicId);
  step = 0;
  editing = false;
  genreChanged = false;
  projectId = newProjectId();
  drafts = {};
  kind = 'integrated';
  target = 'generic';
  if (topicId) project.projectTitle = topics.find(({ id }) => id === topicId).name;
  renderWizard();
}

function renderHome(focus = true) {
  const page = node('div', 'home');
  page.innerHTML = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="indicator"></span> COMMUNITY GAME DESIGN TOOL</p>
        <h1 id="hero-title">団地の暮らしを、<br><span>遊びに変える。</span></h1>
        <p class="hero-description">暮らし・交流・防災を、子どもが夢中になるゲームの題材に。質問に沿って企画を組み立て、AIに渡せるゲーム制作指示書を作ります。</p>
        <div class="hero-actions"></div>
        <p class="small muted">ログイン不要 <span class="separator">·</span> Markdownで持ち出し</p>
      </div>
      <figure class="hero-image">
        <img src="./assets/courtyard.svg" alt="" width="540" height="392">
        <figcaption><span>OS<span class="separator"> / </span>01</span><span>架空の団地の広場</span></figcaption>
      </figure>
    </section>
    <section class="topic-section" aria-labelledby="topic-heading">
      <div class="section-heading"><div><p class="eyebrow">START WITH A THEME</p><h2 id="topic-heading">題材から始める</h2></div><p class="small muted">創作プリセット · ${topics.length}件</p></div>
      <div class="topic-grid"></div>
    </section>
    <section class="process" aria-label="作成の流れ">
      <div><span>01</span><strong>質問に答える</strong></div>
      <div><span>02</span><strong>設定を確認する</strong></div>
      <div><span>03</span><strong>制作指示書を受け取る</strong></div>
    </section>`;
  const actions = page.querySelector('.hero-actions');
  if (project) actions.append(button('続きから →', 'button primary', resume));
  actions.append(button('新規プロジェクト →', `button ${project ? 'secondary' : 'primary'}`, () => start()));
  const play = node('a', 'button secondary', 'HTMLで遊ぶ ↗');
  play.href = './play.html';
  const gallery = node('a', 'button secondary', 'ゲーム作品一覧 ↗');
  gallery.href = './gallery.html';
  actions.append(play, gallery);
  const importInput = node('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.hidden = true;
  const homeStatus = node('p', 'hint', openMessage);
  homeStatus.setAttribute('role', 'status');
  importInput.addEventListener('change', async () => {
    const [file] = importInput.files;
    importInput.value = '';
    if (!file) return;
    try {
      if (file.size > jsonLimit) throw new Error('設定JSONは8 MB以内にしてください。');
      replaceState(parseProject(await file.text()));
    } catch (error) { homeStatus.textContent = `Q-015 ${error.message}`; }
  });
  const manage = node('div', 'project-actions');
  manage.append(button('設定JSONを読み込む', 'button secondary', () => importInput.click()), importInput);
  if (project) manage.append(button('設定JSONを保存', 'button secondary', exportProject));
  if (sharedProject) manage.append(button('共有設定を開く', 'button primary', () => replaceState(sharedProject)));
  page.querySelector('.hero-copy').append(manage, homeStatus);

  const grid = page.querySelector('.topic-grid');
  const marks = { sorting: '◇', kit: '✦', hello: '◎' };
  for (const topic of topics.slice(0, 3)) {
    const card = button(undefined, `topic-card ${topic.id}`, () => start(topic.id));
    const mark = node('span', 'topic-mark', marks[topic.id]);
    mark.setAttribute('aria-hidden', 'true');
    const arrow = node('span', 'topic-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    card.append(node('span', 'topic-top'), node('strong', 'topic-name', topic.name), node('span', 'topic-description', topic.description));
    card.firstChild.append(mark, node('span', 'topic-category', topic.category), arrow);
    grid.append(card);
  }
  show(page, focus);
}

function renderField(field) {
  const wrap = node(field.type === 'checks' ? 'fieldset' : 'div', 'field');
  wrap.id = `field-${field.id}`;
  const label = node(field.type === 'checks' ? 'legend' : 'label', 'field-label', field.label);
  if (field.required) label.append(node('span', 'required', '必須'));
  wrap.append(label);
  const descriptionId = field.help ? `help-${field.id}` : undefined;

  if (field.type === 'checks') {
    const options = node('div', 'checks');
    for (const [value, text] of Object.entries(field.items)) {
      const option = node('label', 'check');
      const control = node('input');
      control.type = 'checkbox';
      control.checked = project[field.id].includes(value);
      control.disabled = field.locked?.includes(value) ?? false;
      control.addEventListener('change', () => {
        const selected = new Set(project[field.id]);
        if (control.checked) selected.add(value);
        else selected.delete(value);
        project[field.id] = Object.keys(field.items).filter((id) => selected.has(id));
        scheduleSave();
      });
      option.append(control, node('span', '', text));
      options.append(option);
    }
    if (descriptionId) wrap.setAttribute('aria-describedby', descriptionId);
    wrap.append(options);
  } else {
    const control = node({ textarea: 'textarea', select: 'select' }[field.type] ?? 'input');
    control.id = field.id;
    label.htmlFor = control.id;
    if (control instanceof HTMLInputElement) control.type = field.type;
    if (field.items) {
      for (const [value, text] of Object.entries(field.items)) control.add(new Option(text, value));
    }
    if (field.required) control.required = true;
    if (field.placeholder) control.placeholder = field.placeholder;
    if (field.type === 'number') {
      control.min = field.min;
      control.max = field.max;
      control.step = 1;
    } else if (field.max) control.maxLength = field.max;
    if (field.type === 'textarea') control.rows = 4;
    if (descriptionId) control.setAttribute('aria-describedby', descriptionId);
    control.value = project[field.id];
    control.addEventListener(field.type === 'select' ? 'change' : 'input', () => {
      if (field.id === 'topicId') {
        const previousGenre = project.genreId;
        applyTopic(project, control.value);
        if (genreChanged) project.genreId = previousGenre;
      } else {
        project[field.id] = field.type === 'number' && control.validity.badInput ? 'invalid' : control.value;
        if (field.id === 'genreId') genreChanged = true;
      }
      if (field.refresh) {
        renderWizard(false);
        document.getElementById(field.id).focus();
      }
      scheduleSave();
    });
    wrap.append(control);
  }

  if (field.help) {
    const hint = node('p', 'hint', field.help);
    hint.id = descriptionId;
    wrap.append(hint);
  }
  if (field.example) {
    const details = node('details', 'preset-example');
    details.append(node('summary', '', 'プリセットの本文を見る'), node('p', '', field.example));
    wrap.append(details);
  }
  return wrap;
}

function renderReview() {
  const choice = (key) => choices[key][project[key]];
  const group = (key) => project[key].map((id) => choices[key][id]).join('・');
  const rec = recommend(project);
  const source = project.sourceType === 'verified'
    ? `${project.sourceTitle}\n${project.sourceUrl}\n${project.verifiedAt} · ${project.applicability}` : '';
  const summaries = [
    [project.projectTitle, choice('objective')],
    [topics.find(({ id }) => id === project.topicId)?.name ?? '自由記述', choice('sourceType'), source, topicStory(project)],
    [choice('age'), choice('mode'), project.mode === 'solo' ? '' : choice('cooperation')],
    [genres.find(({ id }) => id === project.genreId)?.name ?? project.genreCustom, project.genreId === 'rhythm' ? choice('rhythmTiming') : '',
      `${project.playSeconds || rec.seconds}秒（${project.playSeconds ? '手動' : '推奨'}）`,
      `${choices.difficulty[project.difficulty || rec.difficulty]}（${project.difficulty ? '手動' : '推奨'}）`, group('accessibility')],
    [group('platforms'), group('controls'), group('languages')],
    [project.visual === 'custom' ? project.styleNotes : choice('visual'), choice('audio'), choice('assetStrategy'), project.assetStrategy === 'procedural' ? '' : project.assetNotes],
    [choice('fileLayout'), project.techStack === 'auto' ? `${choices.techStack[rec.techStack]}（推奨）` : project.techStack === 'custom' ? project.techCustom : choice('techStack'), choice('offlineMode')],
  ];
  const list = node('dl', 'review');
  summaries.forEach((values, index) => {
    const entry = node('div', 'review-row');
    const edit = button('変更', 'text-button', () => {
      editing = true;
      step = index;
      renderWizard();
    });
    edit.setAttribute('aria-label', `${steps[index].name}の設定を変更`);
    entry.append(node('dt', '', steps[index].name), node('dd', '', values.filter(Boolean).join('\n')), edit);
    list.append(entry);
  });
  return list;
}

function showIssues(issues) {
  const error = document.querySelector('#errors');
  error.hidden = false;
  error.textContent = issues.map(({ message }) => message).join('\n');
  const first = document.getElementById(issues[0].field) ?? document.querySelector(`#field-${issues[0].field} input`);
  if (first) {
    first.setAttribute('aria-invalid', 'true');
    const description = first.getAttribute('aria-describedby');
    first.setAttribute('aria-describedby', description ? `${description} errors` : 'errors');
    first.focus();
  }
}

function renderWizard(focus = true) {
  screen = 'wizard';
  scheduleSave();
  const current = steps[step];
  const page = node('div', 'studio');
  const sidebar = node('aside', 'step-sidebar');
  const roadmap = node('ol', 'roadmap');
  steps.forEach(({ name }, index) => {
    const item = node('li', index === step ? 'current' : index < step ? 'completed' : '');
    if (index === step) item.setAttribute('aria-current', 'step');
    item.append(node('span', 'step-index', String(index + 1).padStart(2, '0')), node('span', '', name));
    roadmap.append(item);
  });
  sidebar.append(node('p', 'eyebrow', 'PROJECT WORKFLOW'), roadmap);

  const panel = node('section', 'panel');
  const progress = node('progress', 'progress');
  progress.max = steps.length;
  progress.value = step + 1;
  progress.setAttribute('aria-label', '作成の進捗');
  panel.append(node('p', 'eyebrow', `STEP ${String(step + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}　·　${current.name}`),
    progress, node('h1', '', current.title), node('p', 'intro', current.note));

  const form = node('form', 'wizard-form');
  form.noValidate = true;
  if (step === lastStep) form.append(renderReview());
  else current.fields(project).forEach((field) => form.append(renderField(field)));
  const errors = node('p', 'errors');
  errors.id = 'errors';
  errors.hidden = true;
  errors.setAttribute('role', 'alert');
  const controls = node('div', 'wizard-actions');
  controls.append(button(editing ? '← 確認に戻る' : '← 戻る', 'button secondary', () => {
    if (editing) {
      const issues = validate(project, step);
      if (issues.length) return showIssues(issues);
      editing = false;
      step = lastStep;
    } else if (step === 0) return renderHome();
    else step -= 1;
    renderWizard();
  }));
  if (!editing) {
    const submit = node('button', 'button primary', step === lastStep ? 'Markdownを生成 →' : '次へ →');
    submit.type = 'submit';
    controls.append(submit);
  }
  controls.append(button('設定JSONを保存', 'button secondary', exportProject));
  form.append(errors, controls);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const issues = validate(project, step === lastStep ? undefined : step);
    if (issues.length) {
      if (issues[0].step !== step) {
        step = issues[0].step;
        editing = true;
        renderWizard();
      }
      showIssues(issues.filter((issue) => issue.step === step));
      return;
    }
    if (step === lastStep) {
      const stale = Object.keys(drafts).filter((key) => {
        const [variant, adapter] = key.split(':');
        return drafts[key].generatedMarkdown !== generateOutput(project, variant, adapter, projectId);
      });
      if (stale.length) confirmRegenerate(stale);
      else renderResult();
      return;
    }
    if (editing) {
      editing = false;
      step = lastStep;
    } else step += 1;
    renderWizard();
  });
  panel.append(form);
  page.append(sidebar, panel);
  show(page, focus);
}

function download(content, extension, suffix, type) {
  const slug = project.projectTitle.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 45) || 'game';
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = node('a');
  link.href = url;
  link.download = `oshima_game_${slug}_${suffix}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportProject() {
  download(JSON.stringify(packProject(snapshot()), null, 2), 'json', 'project', 'application/json');
  announcement.textContent = '設定JSONのダウンロードを開始しました。';
}

function confirmRegenerate(keys) {
  const dialog = node('dialog', 'regenerate-dialog');
  const title = node('h2', '', '編集版を破棄して再生成しますか？');
  title.id = 'regenerate-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const controls = node('div', 'result-actions');
  controls.append(button('中止', 'button secondary', () => dialog.close()), button('編集版を含むJSONを保存', 'button secondary', exportProject),
    button('破棄して再生成', 'button primary', () => {
      keys.forEach((key) => { delete drafts[key]; });
      dialog.close();
      renderResult();
    }));
  dialog.append(title, node('p', 'hint', '必要な編集内容はJSONで保存できます。'), controls);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

function resultSelect(labelText, key, items, value, onChange) {
  const wrap = node('div', 'field');
  const label = node('label', 'field-label', labelText);
  const select = node('select');
  select.id = key;
  label.htmlFor = key;
  for (const [id, name] of Object.entries(items)) select.add(new Option(name, id));
  select.value = value;
  select.addEventListener('change', () => {
    onChange(select.value);
    document.getElementById(key)?.focus();
  });
  wrap.append(label, select);
  return wrap;
}

function renderResult({ view = 'raw', version } = {}, focus = true) {
  screen = 'result';
  const key = `${kind}:${target}`;
  const draft = drafts[key];
  const original = generateOutput(project, kind, target, projectId);
  version ??= draft ? 'edited' : 'original';
  const current = () => version === 'edited' ? drafts[key]?.editedMarkdown ?? original : original;
  scheduleSave();
  const panel = node('section', 'panel result');
  const title = node('h1', '', '制作指示書ができました');
  const selectors = node('div', 'result-selectors');
  selectors.append(resultSelect('出力の種類', 'output-kind', Object.fromEntries(Object.entries(outputs).map(([id, value]) => [id, value.label])), kind, (value) => {
    kind = value;
    renderResult({}, false);
  }), resultSelect('制作AI向けの形式', 'ai-target', targets, target, (value) => {
    target = value;
    renderResult({}, false);
  }));

  let preview;
  if (view === 'edit') {
    version = 'edited';
    preview = node('textarea', 'preview prompt-editor');
    preview.value = current();
    preview.maxLength = draftLimit;
    preview.rows = 16;
    preview.addEventListener('input', () => {
      drafts[key] = { generatedMarkdown: draft?.generatedMarkdown ?? original, editedMarkdown: preview.value };
      scheduleSave();
      staleNotice.hidden = false;
      qualitySummary.textContent = '品質チェック · 未検査';
      qualityBody.replaceChildren(node('p', 'hint', '編集後の内容を検査してください。'));
    });
  } else if (view === 'preview') preview = markdownPreview(current());
  else preview = node('pre', 'preview', current());
  preview.tabIndex = 0;
  preview.setAttribute('aria-label', 'Markdownの全文');
  const status = node('p', 'hint copy-status', 'コピーまたは保存して、制作に使うAIに渡してください。');
  status.setAttribute('role', 'status');
  const staleNotice = node('p', 'hint', draft && draft.generatedMarkdown !== original
    ? 'この編集版は設定変更前の生成原文をもとにしています。' : '生成原文と編集版を別々に保持します。');
  staleNotice.hidden = !draft;
  const actions = node('div', 'result-actions');
  actions.append(button('全文をコピー', 'button primary', async () => {
    try {
      await navigator.clipboard.writeText(current());
      status.textContent = 'Markdownをクリップボードにコピーしました。';
    } catch {
      let selectable = preview;
      let feedback = status;
      if (view === 'preview') {
        renderResult({ version }, false);
        selectable = workspace.querySelector('pre.preview');
        feedback = workspace.querySelector('.copy-status');
      }
      if (selectable instanceof HTMLTextAreaElement) selectable.select();
      else {
        const range = document.createRange();
        range.selectNodeContents(selectable);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      feedback.textContent = '自動コピーが使えないため、全文を選択しました。端末のコピー操作かファイル保存を使ってください。';
    }
  }), button('↓ Markdownを保存', 'button secondary', () => {
    download(current(), 'md', `${kind}${target === 'generic' ? '' : `_${target}`}${version === 'edited' ? '_edited' : ''}`, 'text/markdown');
    announcement.textContent = 'Markdownのダウンロードを開始しました。';
  }), button('設定JSONを保存', 'button secondary', exportProject));
  const editorActions = node('div', 'result-actions');
  editorActions.append(button('Markdown原文', 'button secondary', () => renderResult({ version }, false)),
    button('プレビュー', 'button secondary', () => renderResult({ view: 'preview', version }, false)),
    button('直接編集', 'button secondary', () => renderResult({ view: 'edit' }, false)),
    button('元の生成版を表示', 'button secondary', () => renderResult({ version: 'original' }, false)),
    button('再生成', 'button secondary', () => drafts[key] ? confirmRegenerate([key]) : renderResult()));

  const quality = node('details', 'share-panel quality');
  const qualitySummary = node('summary', '', '品質チェック');
  const qualityBody = node('div', 'quality-body');
  const scan = () => {
    const findings = inspect(project, current(), kind, target, projectId);
    const errors = findings.filter(({ status }) => status === 'error').length;
    const warnings = findings.filter(({ status }) => status === 'warning').length;
    qualitySummary.textContent = `品質チェック · エラー ${errors} / 要確認 ${warnings}`;
    quality.open = errors > 0 || quality.open;
    const list = node('ul', 'quality-list');
    const sorted = [...findings].sort((a, b) => ['error', 'warning', 'pass'].indexOf(a.status) - ['error', 'warning', 'pass'].indexOf(b.status));
    for (const finding of sorted) {
      const item = node('li', finding.status);
      const label = { pass: '検出なし', warning: '要確認', error: 'エラー' }[finding.status];
      item.append(node('strong', '', `${finding.id} ${finding.subject} · ${label}`), node('p', '', `${finding.reason} ${finding.fix}`.trim()));
      list.append(item);
    }
    qualityBody.replaceChildren(list);
  };
  quality.append(qualitySummary, node('p', 'hint', '検査は目安です。事実性や表現の配慮は人が確認してください。エラーがある場合も編集・保存はできます。'),
    button('現在の文面を再検査', 'button secondary', scan), qualityBody);
  scan();

  const sharing = node('details', 'share-panel');
  const sharingStatus = node('p', 'hint', 'URLには入力した設定が含まれます。個人情報・未公開情報を共有する場合は内容を見直してください。編集済みMarkdownは設定JSONで共有できます。');
  sharingStatus.setAttribute('role', 'status');
  const link = node('input');
  link.type = 'url';
  link.readOnly = true;
  link.hidden = true;
  link.setAttribute('aria-label', '設定の共有URL');
  const shareActions = node('div', 'result-actions');
  const shareMenu = navigator.share ? button('端末の共有メニュー', 'button secondary', async () => {
    try { await navigator.share({ title: project.projectTitle, url: link.value }); }
    catch (error) { if (error.name !== 'AbortError') sharingStatus.textContent = error.message; }
  }) : null;
  shareActions.append(button('共有URLを作成', 'button secondary', async () => {
    try {
      link.value = await projectLink(snapshot(), location.href);
      link.hidden = false;
      if (shareMenu) shareMenu.disabled = false;
      try {
        await navigator.clipboard.writeText(link.value);
        sharingStatus.textContent = '設定の共有URLをコピーしました。';
      } catch { link.select(); sharingStatus.textContent = '選択したURLを端末のコピー操作で共有できます。'; }
    } catch (error) { sharingStatus.textContent = error.message; }
  }));
  if (shareMenu) {
    shareMenu.disabled = true;
    shareActions.append(shareMenu);
  }
  sharing.append(node('summary', '', '設定を共有する'), sharingStatus, shareActions, link);
  const bar = node('div', 'preview-bar');
  bar.append(node('span', '', `${outputs[kind].label} / ${targets[target]}`), node('span', '', version === 'edited' ? '編集版' : kind === 'integrated' ? `生成原文 · ${sections.length} セクション` : '生成原文'));
  panel.append(node('p', 'eyebrow', 'OUTPUT / READY'), title, node('p', 'intro', project.projectTitle.trim()),
    selectors, actions, status, editorActions, staleNotice, bar, preview, quality, sharing, button('← 設定確認へ', 'button secondary result-back', () => {
      step = lastStep;
      renderWizard();
    }));
  show(panel, focus);
}

document.querySelector('#home').addEventListener('click', () => renderHome());
window.addEventListener('pagehide', persist);
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) loadState(parseProject(saved));
} catch { openMessage = 'このブラウザーの保存状態を復元できませんでした。設定JSONがあれば読み込めます。'; }
if (location.hash.startsWith('#project=')) {
  try {
    sharedProject = await readProjectLink(location.hash);
    openMessage = `共有設定「${sharedProject.project.projectTitle || '名称未設定'}」を開けます。`;
  } catch (error) { openMessage = `Q-015 共有URLを開けませんでした。${error.message}`; }
}
renderHome(false);
