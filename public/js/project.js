import { presets } from './presets.generated.js';

export const topics = presets.topics;
export const genres = presets.genres;
export const limits = { title: 80, story: 1800, source: 180, genre: 100, style: 150 };
export const choices = {
  objective: { fun: '子どもが楽しめる遊び', community: '住民同士の交流のきっかけ', preparedness: '防災への自然な関心' },
  sourceType: { fictional: '架空・創作', unverified: '未確認', verified: '確認済み' },
  age: { younger: '6〜8歳', children: '9〜12歳', mixed: '子どもと大人' },
  mode: { solo: '1人', duo: '2人協力', family: '親子協力' },
  cooperation: { turns: '交互に操作', discuss: '一緒に相談・代表者が操作' },
  difficulty: { easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい' },
  platforms: { pc: 'PC', phone: 'スマートフォン', tablet: 'タブレット' },
  controls: { keyboard: 'キーボード', mouse: 'マウス', touch: 'タッチ' },
  languages: { ja: '日本語', en: '英語', zh: '中国語（簡体字）', ko: '韓国語', vi: 'ベトナム語', ne: 'ネパール語' },
  accessibility: { large: '大きな操作対象と文字', generous: '入力の猶予', contrast: '形や文字を併用した識別' },
  visual: { picture: '絵本風', pixel: '16ビットドット', comic: 'アメコミPOP', animation: '2Dアニメ', watercolor: '水彩', custom: '自由指定' },
  audio: { effects: '効果音のみ', music: 'BGMと効果音', silent: '音なし' },
  fileLayout: { single: '単一HTML', multiple: '複数ファイル' },
};

export function newProject(topicId = 'custom') {
  const project = {
    schemaVersion: 1, projectTitle: '', objective: 'fun', topicId: 'custom', story: '',
    sourceType: 'fictional', sourceTitle: '', sourceUrl: '', verifiedAt: '', applicability: '',
    age: 'children', mode: 'solo', cooperation: 'turns', genreId: 'sorting', genreCustom: '',
    playSeconds: '', difficulty: '', accessibility: ['large', 'contrast'],
    platforms: ['pc', 'phone'], controls: ['keyboard', 'mouse', 'touch'], languages: ['ja', 'en'],
    visual: 'picture', styleNotes: '', audio: 'effects', fileLayout: 'single',
  };
  applyTopic(project, topicId);
  return project;
}

export function applyTopic(project, topicId) {
  project.topicId = topicId;
  const topic = topics.find(({ id }) => id === topicId);
  if (topic) project.genreId = topic.genreId;
}

export function topicStory(project) {
  return project.story.trim() || topics.find(({ id }) => id === project.topicId)?.story || '';
}

export function recommend(project) {
  const genre = genres.find(({ id }) => id === project.genreId);
  const isYoung = project.age === 'younger';
  const isCooperative = project.mode !== 'solo';
  const seconds = (genre?.seconds ?? 60) - (isYoung ? 15 : 0) + (isCooperative ? 30 : 0);
  return {
    seconds,
    secondsReason: [genre ? `${genre.name}の目安` : '自由指定ジャンルの目安',
      isYoung && '低年齢向けに短め', isCooperative && '協力の相談時間を追加'].filter(Boolean).join('・'),
    difficulty: isYoung || isCooperative ? 'easy' : 'normal',
    difficultyReason: isYoung ? '低年齢でも遊び始めやすく' : isCooperative ? '異なる習熟度でも協力しやすく' : '9〜12歳の初回プレイを想定',
  };
}

export function validate(project, step) {
  const issues = [];
  const check = (index, invalid, field, message) => {
    if ((step === undefined || index === step) && invalid) issues.push({ step: index, field, message });
  };
  const invalidText = (value, limit) => value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/u.test(value);
  check(0, !project.projectTitle.trim() || invalidText(project.projectTitle, limits.title), 'projectTitle', 'プロジェクト名を1〜80文字で入力してください。');
  check(1, !topicStory(project) || invalidText(project.story, limits.story), 'story', '題材を選ぶか、ストーリーを1〜1,800文字で入力してください。');
  check(1, project.sourceType !== 'fictional' && !project.story.trim() && project.topicId !== 'custom', 'story', '創作プリセットとは別に、根拠区分に対応する本文を入力してください。');
  if (project.sourceType === 'verified') {
    check(1, !project.sourceTitle.trim() || invalidText(project.sourceTitle, limits.source), 'sourceTitle', '出典名を入力してください。');
    check(1, !/^https?:\/\/[^\s]+$/iu.test(project.sourceUrl) || !isWebUrl(project.sourceUrl), 'sourceUrl', '公式情報のURLを http:// または https:// から入力してください。');
    check(1, !isDate(project.verifiedAt), 'verifiedAt', '確認日を入力してください。');
    check(1, !project.applicability.trim() || invalidText(project.applicability, limits.source), 'applicability', 'その出典が適用される地域・範囲を入力してください。');
  }
  check(3, project.genreId === 'custom' && (!project.genreCustom.trim() || invalidText(project.genreCustom, limits.genre)), 'genreCustom', 'ジャンルと遊び方のイメージを入力してください。');
  const seconds = Number(project.playSeconds);
  check(3, project.playSeconds !== '' && (!Number.isInteger(seconds) || seconds < 10 || seconds > 3600), 'playSeconds', 'プレイ時間は10〜3,600秒の整数で指定してください。');
  check(4, !project.platforms.length, 'platforms', '対応端末を1つ以上選んでください。');
  const mobile = project.platforms.some((id) => id === 'phone' || id === 'tablet');
  const pc = project.platforms.includes('pc');
  const pcControls = project.controls.includes('mouse') || project.controls.includes('keyboard');
  const touch = project.controls.includes('touch');
  check(4, (mobile && !touch) || (!mobile && touch) || (pc !== pcControls), 'controls', 'PCにはキーボードかマウス、スマートフォン・タブレットにはタッチを選んでください。使わない端末の操作は外してください。');
  check(5, project.visual === 'custom' && (!project.styleNotes.trim() || invalidText(project.styleNotes, limits.style)), 'styleNotes', '希望する画風を入力してください。');
  return issues;
}

function isWebUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && value.length <= 500;
  } catch {
    return false;
  }
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
