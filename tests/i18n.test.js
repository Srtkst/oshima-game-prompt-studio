import assert from 'node:assert/strict';
import test from 'node:test';
import { generateOutput, outputs, targets } from '../public/js/generate.js';
import { genres, newProject } from '../public/js/project.js';
import { inspect } from '../public/js/quality.js';
import { packProject, parseProject } from '../public/js/storage.js';
import { registeredTitle, registeredDescription, suggestTitles, validateGameMetadata } from '../public/js/game-file.js';
import { t } from '../public/js/i18n.js';

test('English briefs preserve settings, pass structural checks, and keep edited drafts separate', () => {
  const project = { ...newProject('sorting'), projectTitle: 'Community Game' };
  for (const kind of Object.keys(outputs)) {
    const generic = generateOutput(project, kind, 'generic', 'fixture', 'en');
    assert.match(generic, /Source status: Fiction/);
    assert.match(generic, /Children are putting toys away/);
    for (const target of Object.keys(targets)) {
      const markdown = generateOutput(project, kind, target, 'fixture', 'en');
      assert.ok(markdown.startsWith(generic));
      assert.deepEqual(inspect(project, markdown, kind, target, 'fixture', 'en').filter(({ status }) => status === 'error'), []);
    }
  }
  for (const genre of genres) {
    const markdown = generateOutput({ ...project, genreId: genre.id }, 'integrated', 'generic', 'fixture', 'en');
    assert.doesNotMatch(markdown, /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u);
  }
  const drafts = { 'integrated:generic': { generatedMarkdown: '原文', editedMarkdown: '日本語編集' },
    'integrated:generic:en': { generatedMarkdown: 'Original', editedMarkdown: 'English edit' } };
  assert.deepEqual(parseProject(JSON.stringify(packProject({ project, projectId: 'fixture', drafts }))).drafts, drafts);
});

test('English quality checks detect removed languages and story replacement', () => {
  const project = { ...newProject('sorting'), projectTitle: 'Community Game' };
  const modified = generateOutput(project, 'integrated', 'generic', '', 'en')
    .replace(/## 11\.[^]*?(?=## 12\.)/u, '').replace(/> Children[^\n]+/u, '> Replaced story');
  assert.deepEqual(inspect(project, modified, 'integrated', 'generic', '', 'en').filter(({ status }) => status === 'error').map(({ id }) => id), ['Q-001', 'Q-005', 'Q-013']);
});

test('Bilingual game metadata selects the requested language and keeps legacy records readable', () => {
  const game = { title: '旧タイトル', description: '旧紹介', titles: { ja: '道具', en: 'Tools' }, descriptions: { ja: '紹介', en: 'Description' } };
  validateGameMetadata(game);
  assert.equal(registeredTitle('tools', game, 'en'), 'Tools');
  assert.equal(registeredTitle('tools', game), '道具');
  assert.equal(registeredDescription(game, 'en'), 'Description');
  assert.equal(registeredDescription({ ...game, descriptions: { ja: '紹介', en: '' } }, 'en'), '');
  assert.equal(registeredTitle('tools', { title: 'Legacy' }, 'en'), 'Legacy');
  assert.equal(registeredTitle('24c5d0ee5340aeaf053cdca9', { title: 'Legacy' }, 'en'), 'Legacy');
  assert.throws(() => validateGameMetadata({ ...game, titles: { ja: '道具' } }));
  assert.deepEqual(suggestTitles('<html><title>道具 / Tools</title></html>', 'tools.html'), { ja: '道具', en: 'Tools' });
  assert.deepEqual(suggestTitles('<html><title>Game</title><meta content="道具" name="game:title:ja"><meta name="game:title:en" content="Tools"></html>', 'tools.html'), { ja: '道具', en: 'Tools' });
  assert.equal(t('登録作品 6件', 'en'), '6 registered games');
  assert.equal(t('自由入力の内容', 'en'), '自由入力の内容');
});
