import { choices, genres, limits, recommend, topics } from './project.js';

const topicChoices = Object.fromEntries([...topics.map(({ id, name }) => [id, name]), ['custom', '自由記述']]);
const genreChoices = Object.fromEntries([...genres.map(({ id, name }) => [id, name]), ['custom', '自由指定']]);
const field = (id, label, type, options = {}) => ({ id, label, type, ...options });
const select = (id, label, items, options = {}) => field(id, label, 'select', { items, ...options });

export const steps = [
  { name: '企画', title: 'どんなゲームを作りますか？', note: '企画の名前と、遊びを通じて届けたいことを決めます。', fields: () => [
    field('projectTitle', 'プロジェクト名', 'text', { required: true, max: limits.title, placeholder: '例　おおしま まちの仕分けゲーム' }),
    select('objective', 'ゲームのねらい', choices.objective),
  ] },
  { name: '題材', title: 'どんな場面で遊びますか？', note: '暮らし・交流・防災から着想を選び、物語の根拠を明確にします。', fields: (p) => [
    select('topicId', '題材プリセット', topicChoices, { refresh: true }),
    field('story', p.topicId === 'custom' || p.sourceType !== 'fictional' ? 'ストーリー' : 'ストーリーを変更（任意）', 'textarea', {
      max: limits.story, required: p.topicId === 'custom' || p.sourceType !== 'fictional',
      placeholder: topics.find(({ id }) => id === p.topicId)?.story ?? '場所、登場人物、道具、起きることを書いてください。',
      help: p.topicId === 'custom' || p.sourceType !== 'fictional' ? '名前や部屋番号など、個人を特定できる情報は避けてください。' : '空欄のときは、下に表示されるプリセットの本文を使います。',
      example: topics.find(({ id }) => id === p.topicId)?.story,
    }),
    select('sourceType', '根拠区分', choices.sourceType, { refresh: true, help: '確認していない情報は「未確認」、ゲーム用に作った設定は「架空・創作」を選びます。' }),
    ...(p.sourceType === 'verified' ? [
      field('sourceTitle', '出典名', 'text', { required: true, max: limits.source }),
      field('sourceUrl', '出典URL', 'url', { required: true, max: 500, placeholder: 'https://…' }),
      field('verifiedAt', '確認日', 'date', { required: true }),
      field('applicability', '適用地域・範囲', 'text', { required: true, max: limits.source }),
    ] : []),
  ] },
  { name: '参加者', title: '誰と、どう遊びますか？', note: 'プレイヤーの年齢と参加方式を選ぶと、時間と難易度の提案に反映されます。', fields: (p) => [
    select('age', '主なプレイヤー', choices.age),
    select('mode', 'プレイ方式', choices.mode, { refresh: true }),
    ...(p.mode === 'solo' ? [] : [select('cooperation', '協力のしかた', choices.cooperation)]),
  ] },
  { name: '遊び方', title: '遊びのルールを決めましょう', note: 'ジャンルを選び、1回の長さや遊びやすさを調整します。', fields: (p) => {
    const suggestion = recommend(p);
    return [
      select('genreId', 'ゲームジャンル', genreChoices, { refresh: true, help: genres.find(({ id }) => id === p.genreId)?.actions }),
      ...(p.genreId === 'custom' ? [field('genreCustom', 'ジャンルと主な操作', 'text', { max: limits.genre, required: true })] : []),
      field('playSeconds', 'プレイ時間（秒）', 'number', { min: 10, max: 3600, placeholder: `推奨 ${suggestion.seconds} 秒`, help: `推奨 ${suggestion.seconds} 秒 · ${suggestion.secondsReason}。空欄で推奨値を使います。` }),
      select('difficulty', '難易度', { '': `推奨 · ${choices.difficulty[suggestion.difficulty]}`, ...choices.difficulty }, { help: suggestion.difficultyReason }),
      field('accessibility', '操作の配慮', 'checks', { items: choices.accessibility }),
    ];
  } },
  { name: '端末と言語', title: 'どの端末で遊びますか？', note: '対応端末と操作は、使う環境に合わせて複数選べます。', fields: () => [
    field('platforms', '対応端末', 'checks', { items: choices.platforms }),
    field('controls', '操作方法', 'checks', { items: choices.controls, help: 'スマートフォン・タブレットを選ぶ場合はタッチ操作を含めます。' }),
    field('languages', '表示言語', 'checks', { items: choices.languages, locked: ['ja', 'en'], help: '日本語・英語は標準です。必要な言語を追加できます。' }),
  ] },
  { name: '見た目と音', title: 'ゲームの雰囲気を選びましょう', note: '色や形、音の方向性を決めると、制作AIが素材をそろえやすくなります。', fields: (p) => [
    select('visual', 'ビジュアル', choices.visual, { refresh: true }),
    ...(p.visual === 'custom' ? [field('styleNotes', '希望する画風', 'text', { required: true, max: limits.style })] : []),
    select('audio', 'サウンド', choices.audio),
  ] },
  { name: 'ファイル', title: 'どんな形で受け取りますか？', note: '用途に合わせて、生成されるゲームのファイル構成を選びます。', fields: () => [
    select('fileLayout', 'ゲームのファイル構成', choices.fileLayout, { help: '単一HTMLは1ファイルで配布。複数ファイルはゲームの処理とデザインを分けて編集しやすい構成です。' }),
  ] },
  { name: '設定確認', title: '制作指示書をつくる前に', note: '入力した内容を確認します。各項目から設定に戻れます。' },
];
