import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../data/presets.json', import.meta.url);
const target = new URL('../public/js/presets.generated.js', import.meta.url);
const data = JSON.parse(await readFile(source, 'utf8'));
const english = JSON.parse(await readFile(new URL('../data/presets.en.json', import.meta.url), 'utf8'));
const { version, topics, genres } = data;
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const validIds = (rows) => rows.every(({ id }) => /^[a-z][a-z0-9_-]*$/.test(id))
  && new Set(rows.map(({ id }) => id)).size === rows.length;

if (!Number.isInteger(version) || version < 1 || !Array.isArray(topics) || !Array.isArray(genres)
  || topics.length === 0 || genres.length === 0 || !validIds(topics) || !validIds(genres)
  || genres.some(({ name, seconds, actions, rules }) => ![name, actions, rules].every(isText)
    || !Number.isInteger(seconds) || seconds < 10 || seconds > 3600)
  || topics.some(({ name, category, story, description, provenance, genreId }) =>
    ![name, category, story, description].every(isText) || provenance !== 'fictional'
    || !genres.some(({ id }) => id === genreId))) {
  throw new Error('プリセットのID、根拠区分、ジャンル参照、必須項目を確認してください。');
}
for (const key of ['topics', 'genres']) {
  if (Object.keys(english[key]).length !== data[key].length || data[key].some((row) =>
    !english[key][row.id] || Object.keys(row).filter((field) => typeof row[field] === 'string' && !['id', 'genreId', 'provenance'].includes(field))
      .some((field) => !isText(english[key][row.id][field])))) throw new Error(`English ${key} translations are incomplete.`);
}

async function sync(file, output) {
  if (process.argv.includes('--check')) {
    const existing = await readFile(file, 'utf8');
    if (existing.replaceAll('\r\n', '\n') !== output) {
      throw new Error(`配布データが正本と一致しません。npm run build を実行してください。${file.pathname}`);
    }
  } else {
    await writeFile(file, output);
  }
}

await sync(target, `// Generated from data/presets*.json. Run npm run build after editing the source.\nexport const presets = ${JSON.stringify(data, null, 2)};\nexport const presetsEnglish = ${JSON.stringify(english, null, 2)};\n`);
const html = (await readFile(new URL('../examples/sorting/index.html', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
await sync(new URL('../public/games/sorting-demo.json', import.meta.url), JSON.stringify({ title: '分けて、つなごう',
  titles: { ja: '分けて、つなごう', en: 'Sort Together' }, descriptions: { ja: '形を見て道具を箱に戻そう。', en: 'Match shapes to put toys in their boxes.' }, html }) + '\n');
