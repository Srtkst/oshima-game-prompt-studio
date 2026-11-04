import assert from 'node:assert/strict';
import test from 'node:test';
import { generate, sections } from '../public/js/generate.js';
import { applyTopic, newProject, recommend, topics, validate } from '../public/js/project.js';

function ready(topicId = 'sorting', changes = {}) {
  return { ...newProject(topicId), projectTitle: 'テスト企画', ...changes };
}

for (const topic of topics) {
  test(`${topic.name}で18セクションの統合版が再現できる`, () => {
    const project = ready(topic.id);
    const markdown = generate(project);
    assert.equal(markdown, generate(structuredClone(project)));
    assert.deepEqual([...markdown.matchAll(/^## \d+\. (.+)$/gm)].map((match) => match[1]), sections);
    assert.ok(markdown.includes(topic.story));
    assert.match(markdown, /根拠区分：架空・創作/);
    assert.match(markdown, /日本語 \(ja\)、英語 \(en\)/);
    assert.match(markdown, /リザルトに置かない/);
    assert.match(markdown, /オフラインでは `index\.html` をブラウザで開く/);
    for (const other of topics.filter(({ id }) => id !== topic.id)) {
      assert.ok(!markdown.includes(other.story));
    }
  });
}

test('題材を変更しても自由記述を優先し、記号で見出しやHTMLを挿入できない', () => {
  const project = ready('sorting', { story: '別の物語\n## 偽の見出し\n<img src=x onerror=alert(1)>' });
  applyTopic(project, 'hello');
  const markdown = generate(project);
  assert.match(markdown, /> 別の物語/);
  assert.match(markdown, /> \\#\\# 偽の見出し/);
  assert.ok(!markdown.includes('<img'));
  for (const topic of topics) assert.ok(!markdown.includes(topic.story));
});

test('題材の未確認区分と、確認済みの出典・日付・適用範囲を区別する', () => {
  const project = ready('kit', { sourceType: 'unverified' });
  assert.deepEqual(validate(project, 1).map(({ field }) => field), ['story']);
  project.story = '企画者が提示した場面。';
  assert.match(generate(project), /未確認[\s\S]*仮説・確認待ち/);
  project.sourceType = 'verified';
  assert.deepEqual(validate(project, 1).map(({ field }) => field), ['sourceTitle', 'sourceUrl', 'verifiedAt', 'applicability']);
  Object.assign(project, { sourceTitle: '出典（テスト）', sourceUrl: 'https://example.org/reference', verifiedAt: '2026-11-04', applicability: 'テスト地域' });
  assert.match(generate(project), /確認済み[\s\S]*出典URL：https:\/\/example\.org\/reference[\s\S]*確認日：2026-11-04[\s\S]*適用範囲：テスト地域/);
  project.sourceUrl = 'javascript:alert(1)';
  project.verifiedAt = '2026-02-30';
  assert.deepEqual(validate(project, 1).map(({ field }) => field), ['sourceUrl', 'verifiedAt']);
});

test('推奨の変化に関係なく手動の時間と難易度を出力する', () => {
  const project = ready('hello', { age: 'younger', mode: 'duo', playSeconds: '140', difficulty: 'hard' });
  assert.equal(recommend(project).seconds, 75);
  assert.equal(recommend(project).difficulty, 'easy');
  assert.match(generate(project), /2人協力。交互に操作/);
  assert.match(generate(project), /140秒[\s\S]*難易度：むずかしい/);
});

test('タッチ専用、追加言語、複数ファイル、画風指定を反映する', () => {
  const project = ready('sorting', {
    platforms: ['phone'], controls: ['touch'], languages: ['ja', 'en', 'vi'],
    fileLayout: 'multiple', visual: 'custom', styleNotes: '切り絵風',
  });
  const markdown = generate(project);
  assert.match(markdown, /対応端末：スマートフォン/);
  assert.doesNotMatch(markdown, /矢印キー/);
  assert.match(markdown, /ベトナム語 \(vi\)/);
  assert.match(markdown, /画風：切り絵風/);
  assert.match(markdown, /`styles\.css`、`game\.js`、`README\.md`/);
});

test('入力の欠落・上限・端末との矛盾を生成前に拒否する', () => {
  assert.equal(validate(newProject(), 0)[0].field, 'projectTitle');
  assert.equal(validate(newProject(), 1)[0].field, 'story');
  for (const playSeconds of ['9', '3601', '11.5', 'invalid']) {
    assert.equal(validate(ready('sorting', { playSeconds }), 3)[0].field, 'playSeconds');
  }
  assert.deepEqual(validate(ready('sorting', { playSeconds: '3600' })), []);
  assert.throws(() => generate(ready('sorting', { story: 'あ'.repeat(1801) })), /1,800文字/);
  assert.throws(() => generate(ready('sorting', { platforms: ['phone'], controls: ['keyboard'] })), /タッチ/);
  assert.throws(() => generate(ready('sorting', { genreId: 'custom' })), /ジャンル/);
});
