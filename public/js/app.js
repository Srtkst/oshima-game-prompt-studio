import { generate, sections } from './generate.js';
import { applyTopic, choices, genres, newProject, recommend, topics, topicStory, validate } from './project.js';
import { steps } from './steps.js';

const workspace = document.querySelector('#workspace');
const announcement = document.querySelector('#announcement');
const lastStep = steps.length - 1;
let project;
let step = 0;
let editing = false;
let genreChanged = false;

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
      <div class="section-heading"><div><p class="eyebrow">START WITH A THEME</p><h2 id="topic-heading">題材から始める</h2></div><p class="small muted">創作プリセット · 3件</p></div>
      <div class="topic-grid"></div>
    </section>
    <section class="process" aria-label="作成の流れ">
      <div><span>01</span><strong>質問に答える</strong></div>
      <div><span>02</span><strong>設定を確認する</strong></div>
      <div><span>03</span><strong>制作指示書を受け取る</strong></div>
    </section>`;
  const actions = page.querySelector('.hero-actions');
  if (project) actions.append(button('作業に戻る →', 'button primary', renderWizard));
  actions.append(button('新規プロジェクト →', `button ${project ? 'secondary' : 'primary'}`, () => start()));

  const grid = page.querySelector('.topic-grid');
  const marks = { sorting: '◇', kit: '✦', hello: '◎' };
  for (const topic of topics) {
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
    [genres.find(({ id }) => id === project.genreId)?.name ?? project.genreCustom,
      `${project.playSeconds || rec.seconds}秒（${project.playSeconds ? '手動' : '推奨'}）`,
      `${choices.difficulty[project.difficulty || rec.difficulty]}（${project.difficulty ? '手動' : '推奨'}）`, group('accessibility')],
    [group('platforms'), group('controls'), group('languages')],
    [project.visual === 'custom' ? project.styleNotes : choice('visual'), choice('audio')],
    [choice('fileLayout'), 'HTML・CSS・JavaScript / プログラム生成素材 / オフライン実行・Web公開'],
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
    if (step === lastStep) return renderResult(generate(project));
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

function download(markdown) {
  const slug = project.projectTitle.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 45) || 'game';
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
  const link = node('a');
  link.href = url;
  link.download = `oshima_game_${slug}_integrated.md`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderResult(markdown) {
  const panel = node('section', 'panel result');
  const title = node('h1', '', '制作指示書ができました');
  const preview = node('pre', 'preview', markdown);
  preview.tabIndex = 0;
  preview.setAttribute('aria-label', 'Markdownの全文');
  const status = node('p', 'hint', 'コピーまたは保存して、制作に使うAIに渡してください。');
  status.setAttribute('role', 'status');
  const actions = node('div', 'result-actions');
  actions.append(button('全文をコピー', 'button primary', async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      status.textContent = 'Markdownをクリップボードにコピーしました。';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(preview);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = '自動コピーが使えないため、全文を選択しました。端末のコピー操作かファイル保存を使ってください。';
    }
  }), button('↓ Markdownを保存', 'button secondary', () => {
    download(markdown);
    announcement.textContent = 'Markdownのダウンロードを開始しました。';
  }));
  const bar = node('div', 'preview-bar');
  bar.append(node('span', '', '統合版 / 共通'), node('span', '', `MARKDOWN · ${sections.length} セクション`));
  panel.append(node('p', 'eyebrow', 'OUTPUT / READY'), title, node('p', 'intro', project.projectTitle.trim()),
    actions, status, bar, preview, button('← 設定確認へ', 'button secondary', () => {
      step = lastStep;
      renderWizard();
    }));
  show(panel);
}

document.querySelector('#home').addEventListener('click', () => renderHome());
renderHome(false);
