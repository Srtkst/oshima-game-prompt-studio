import assert from 'node:assert/strict';
import test from 'node:test';
import { generate, generateOutput, outputs, targets } from '../public/js/generate.js';
import { genres, newProject, topics, validate } from '../public/js/project.js';
import { inspect } from '../public/js/quality.js';
import { packProject, parseProject, projectLink, readProjectLink } from '../public/js/storage.js';

const project = { ...newProject('sorting'), projectTitle: '町のゲーム' };
const state = { project, projectId: 'fixture-id', step: 7, screen: 'result',
  drafts: { 'integrated:generic': { generatedMarkdown: generate(project), editedMarkdown: '# 編集済み' } } };

test('20の創作題材と旧14基盤に対応した独自ジャンルで、題材とルールを合成できる', () => {
  assert.equal(new Set(topics.map(({ category }) => category)).size, 20);
  const arcade = ['platform', 'runner', 'catch', 'falling', 'memory', 'mines', 'tic', 'breakout', 'shooter', 'snake', 'maze', 'climb', 'micro', 'bounce'];
  for (const id of arcade) {
    const genre = genres.find((row) => row.id === id);
    const body = generate({ ...project, genreId: id, story: '独自の場面でアイテムを集める。' });
    assert.ok(body.includes(genre.name) && body.includes(genre.rules) && body.includes('独自の場面でアイテムを集める。'));
  }
});

test('リズム、2人同時操作、素材指定とオフライン設定を反映する', () => {
  const advanced = { ...project, genreId: 'rhythm', mode: 'duo', cooperation: 'simultaneous', rhythmTiming: 'standard',
    fileLayout: 'multiple', offlineMode: 'pwa', assetStrategy: 'mixed', assetNotes: '自作音と許諾済みの写真', techStack: 'native' };
  const markdown = generate(advanced);
  for (const text of ['±110ms', 'WASD', 'ポインターID', 'ライセンス', 'Service Worker', '自作音と許諾済みの写真']) assert.ok(markdown.includes(text));
  assert.equal(validate({ ...advanced, fileLayout: 'single' })[0].field, 'offlineMode');
  assert.equal(validate({ ...advanced, controls: ['mouse', 'touch'] })[0].field, 'controls');
});

test('個別版は共通の根拠・題材を含み、AI別の差分は末尾の提示手順だけ', () => {
  for (const kind of Object.keys(outputs)) {
    const base = generateOutput(project, kind, 'generic', 'fixture-id');
    assert.ok(base.includes('根拠区分：架空・創作') && base.includes('集会室'));
    if (kind !== 'integrated') assert.ok(base.includes('企画ID：fixture-id') && base.includes(outputs[kind].task));
    for (const target of Object.keys(targets)) {
      const output = generateOutput(project, kind, target, 'fixture-id');
      assert.ok(output.startsWith(base));
      const checks = inspect(project, output, kind, target, 'fixture-id');
      assert.equal(checks.length, 15);
      assert.ok(!checks.some(({ status }) => status === 'error'));
    }
  }
});

test('編集で欠けた多言語指示と題材の差し替えを検出する', () => {
  const body = generate(project).replace(/## 11\.[^]*?(?=## 12\.)/u, '').replace(/> 集会室[^\n]+/u, '> 別の話');
  const errors = inspect(project, body).filter(({ status }) => status === 'error').map(({ id }) => id);
  assert.deepEqual(errors, ['Q-001', 'Q-005', 'Q-013']);
});

test('JSONが設定と編集版を復元し、不正な型・未知項目と必須言語の欠落を拒否する', () => {
  const packed = packProject(state);
  assert.deepEqual(parseProject(JSON.stringify(packed)).drafts, state.drafts);
  assert.deepEqual(parseProject(JSON.stringify(packed)).project, project);
  for (const answers of [{ story: {} }, { languages: ['ja'] }, { topicId: 'missing' }, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => parseProject(JSON.stringify({ ...packed, answers })), /確認してください/);
  }
  assert.throws(() => parseProject(JSON.stringify({ ...packed, schemaVersion: 9 })), /バージョン/);
});

test('設定だけをURLで復元し、長すぎる共有と破損した圧縮データは拒否する', async () => {
  const url = await projectLink(state, 'https://example.test/studio/');
  const restored = await readProjectLink(new URL(url).hash);
  assert.deepEqual(restored.project, project);
  assert.deepEqual(restored.drafts, {});
  assert.equal(restored.step, 0);
  await assert.rejects(readProjectLink('#project=v1.test'));
  await assert.rejects(projectLink(state, `https://example.test/${'a'.repeat(1800)}`), /設定JSON/);
});
