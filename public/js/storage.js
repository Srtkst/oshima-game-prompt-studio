import { choices, genres, limits, newProject, topics } from './project.js';
import { outputs, targets } from './generate.js';

export const storageKey = 'oshima-project-v1';
export const jsonLimit = 8 * 1024 * 1024;
export const draftLimit = 30_000;
export const shareLimit = 1800;
const settingBytes = 32 * 1024;
const projectFields = newProject();
const stringLimits = { projectTitle: limits.title, story: limits.story, sourceTitle: limits.source, sourceUrl: 500,
  verifiedAt: 10, applicability: limits.source, genreCustom: limits.genre, styleNotes: limits.style, playSeconds: 12,
  assetNotes: limits.assets, techCustom: limits.tech };
const asObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validText = (value, limit) => typeof value === 'string' && value.length <= limit
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/u.test(value);
const draftKey = /^([a-z_]+):([a-z]+)$/u;

function invalid(field) {
  throw new Error(`設定JSONの「${field}」を確認してください。`);
}

export function newProjectId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function packProject({ project, projectId, drafts = {}, step = 0, screen = 'wizard', genreChanged = false,
  kind = 'integrated', target = 'generic' }, withDrafts = true) {
  const { schemaVersion, projectTitle, ...answers } = project;
  const recommendationsOverridden = ['playSeconds', 'difficulty', 'techStack']
    .filter((key) => answers[key] && answers[key] !== 'auto');
  return { schemaVersion, appVersion: '0.2.0', projectId, projectTitle, answers, recommendationsOverridden,
    drafts: withDrafts ? drafts : {}, updatedAt: new Date().toISOString(), step: withDrafts ? step : 0,
    screen: withDrafts ? screen : 'wizard', genreChanged, kind, target };
}

export function unpackProject(value) {
  if (!asObject(value) || value.schemaVersion !== 1) throw new Error('対応していない設定JSONのバージョンです。');
  if (typeof value.projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/u.test(value.projectId)) invalid('projectId');
  if (!validText(value.projectTitle, limits.title)) invalid('プロジェクト名');
  if (!asObject(value.answers)) invalid('answers');
  const project = { ...newProject(), projectTitle: value.projectTitle };
  for (const [key, answer] of Object.entries(value.answers)) {
    if (!Object.hasOwn(projectFields, key) || key === 'projectTitle' || key === 'schemaVersion') invalid(key);
    if (Object.hasOwn(stringLimits, key)) {
      if (!validText(answer, stringLimits[key])) invalid(key);
    } else if (key === 'topicId' || key === 'genreId') {
      const rows = key === 'topicId' ? topics : genres;
      if (answer !== 'custom' && !rows.some(({ id }) => id === answer)) invalid(key);
    } else if (Array.isArray(project[key])) {
      if (!Array.isArray(answer) || answer.length > Object.keys(choices[key]).length
        || new Set(answer).size !== answer.length || answer.some((id) => typeof id !== 'string' || !Object.hasOwn(choices[key], id))) invalid(key);
      if (key === 'languages' && (!answer.includes('ja') || !answer.includes('en'))) invalid(key);
    } else if (typeof answer !== 'string' || !(Object.hasOwn(choices[key], answer) || (key === 'difficulty' && answer === ''))) invalid(key);
    project[key] = answer;
  }

  const drafts = {};
  if (value.drafts !== undefined) {
    if (!asObject(value.drafts)) invalid('drafts');
    for (const [key, draft] of Object.entries(value.drafts)) {
      const match = key.match(draftKey);
      if (!match || !Object.hasOwn(outputs, match[1]) || !Object.hasOwn(targets, match[2]) || !asObject(draft)
        || !validText(draft.generatedMarkdown, draftLimit) || !validText(draft.editedMarkdown, draftLimit)) invalid('drafts');
      drafts[key] = { generatedMarkdown: draft.generatedMarkdown, editedMarkdown: draft.editedMarkdown };
    }
  }
  const { step = 0, screen = 'wizard', kind = 'integrated', target = 'generic', genreChanged = false } = value;
  if (!Number.isInteger(step) || step < 0 || step > 7 || !['wizard', 'result'].includes(screen)
    || typeof kind !== 'string' || !Object.hasOwn(outputs, kind) || typeof target !== 'string' || !Object.hasOwn(targets, target)
    || typeof genreChanged !== 'boolean') invalid('画面情報');
  return { project, projectId: value.projectId, drafts, step, screen, kind, target, genreChanged };
}

export function parseProject(text) {
  if (new TextEncoder().encode(text).length > jsonLimit) throw new Error('設定JSONは8 MB以内にしてください。');
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('設定JSONを読み取れませんでした。'); }
  return unpackProject(value);
}

export async function projectLink(state, base) {
  const text = JSON.stringify(packProject(state, false));
  const compressed = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const encoded = btoa(String.fromCharCode(...new Uint8Array(compressed))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  const url = new URL(base);
  url.hash = `project=v1.${encoded}`;
  if (url.href.length > shareLimit) throw new Error('設定が長いためURLに収まりません。設定JSONを保存して共有してください。');
  return url.href;
}

export async function readProjectLink(hash) {
  if (!hash.startsWith('#project=')) return null;
  const encoded = hash.slice('#project=v1.'.length);
  if (!/^#project=v1\.[a-zA-Z0-9_-]+$/u.test(hash) || encoded.length > shareLimit) throw new Error('共有URLの形式または長さを確認してください。');
  const bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > settingBytes) {
        await reader.cancel();
        throw new Error('共有設定の容量が上限を超えています。');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(await new Blob(chunks).arrayBuffer());
  const restored = parseProject(text);
  return { ...restored, drafts: {}, step: 0, screen: 'wizard' };
}
