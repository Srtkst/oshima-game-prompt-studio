import { generateOutput } from './generate.js';
import { validate } from './project.js';

const section = (text, number) => text.split(/^## /mu).find((part) => part.startsWith(`${number}. `)) ?? '';
const line = (text, label) => text.split('\n').find((entry) => entry.startsWith(`- ${label}：`));

export function inspect(project, markdown, kind = 'integrated', target = 'generic', projectId = '') {
  const findings = [];
  const result = (id, subject, status, reason, fix) => findings.push({ id: `Q-${String(id).padStart(3, '0')}`, subject, status, reason, fix });
  const check = (id, subject, failed, reason, fix, level = 'error') => result(id, subject, failed ? level : 'pass', failed ? reason : '機械検査で問題は検出されませんでした。', failed ? fix : '');
  const problems = validate(project);
  if (problems.length) {
    result(1, '必須設定', 'error', problems.map(({ message }) => message).join(' '), '設定確認に戻り、入力を修正してください。');
    return findings;
  }

  const canonical = generateOutput(project, kind, target, projectId);
  const headings = (text) => [...text.matchAll(/^## (.+)$/gmu)].map((match) => match[1]);
  const currentHeadings = new Set(headings(markdown));
  const missing = headings(canonical).filter((heading) => !currentHeadings.has(heading));
  const has = (n) => Boolean(section(canonical, n));
  const body = (n) => section(markdown, n);
  const changed = (n, label) => has(n) && line(body(n), label) !== line(section(canonical, n), label);
  check(1, '必須セクション', missing.length > 0 || !markdown.trim(), `不足：${missing.join('、') || '本文'}`, '元の生成版から見出しと必要な本文を戻してください。');
  check(2, 'ファイル構成', has(13) && (project.fileLayout === 'single' ? !/index\.html`?\s*のみ/u.test(body(13)) || /(?:styles\.css|game\.js|sw\.js)/u.test(body(13)) : !/styles\.css/u.test(body(13)) || !/game\.js/u.test(body(13))), '選択した構成との不一致を検出しました。', 'ファイル一覧と実際に必要なファイルを照合してください。');
  check(3, '入力方式', has(6) && (changed(6, '対応端末') || (project.controls.includes('touch') && !/タップ|ポインター|タッチ/u.test(body(6)))), '対応端末かタッチの指示が変更・欠落しています。', '対象端末ごとの操作と代替手段を明記してください。');
  check(4, '人数と操作', changed(6, '参加方式'), '参加方式の指示が設定と異なります。', '人数、役割、交代・同時操作を照合してください。');
  check(5, '多言語', has(11) && (!/日本語.*英語/u.test(body(11)) || !/切り替え|切替/u.test(body(11))), '日本語・英語または切替指示がありません。', '対応言語と辞書、切替方法を記載してください。');
  check(6, 'オフライン', (has(15) && !/オフライン|キャッシュ/u.test(body(15))) || /https?:\/\/\S+|\bCDN\s*(?:必須|から|を使)/iu.test([body(12), body(13), body(14), body(15)].join('\n')), '通信依存またはオフライン手順の不足を検出しました。', 'ネット接続が必要な項目を同梱・埋め込みに置き換え、オフラインで検証してください。', 'warning');
  check(7, '素材・ライセンス', project.assetStrategy !== 'procedural' && has(14) && !/ライセンス.*利用条件/u.test(body(14)), '外部素材の利用条件が不足しています。', '提供元・許諾・同梱方法・代替を列挙してください。', 'warning');
  check(8, '根拠情報', changed(3, '根拠区分') || (project.sourceType === 'verified' && (!line(body(3), '確認日') || !line(body(3), '出典URL') || !line(body(3), '適用範囲'))), '根拠区分か確認済み出典の情報が変わりました。', '題材と出典区分・確認日・適用地域を照合してください。');
  const bias = /(?:外国人|国籍|宗教).{0,12}(?:排除し|追い出|全員が悪|を嘲笑し)/u.test(markdown);
  result(9, '表現上の配慮', 'warning', bias ? '属性を問題の原因とする可能性のある表現を検出しました。' : '文化的な配慮と実在情報は人が確認してください。', '属性と行動を結びつける表現や、個人を特定できる記述を見直してください。');
  check(10, 'リザルト', has(9) && (!/リザルト/u.test(body(9)) || !/メッセージ.*置かない/u.test(body(9)) || /(?:学習|防災)(?:メッセージ|解説).{0,12}(?:表示する|必ず読)/u.test(body(9))), 'リザルトの教育方針が変わった可能性があります。', 'スコア・達成状況・再挑戦など通常の結果表示にしてください。', 'warning');
  check(11, '自己完結性', /(?:詳細|仕様|素材|手順)(?:は|については)[^。\n]{0,18}(?:別紙|別添|別ファイル)を参照/u.test(markdown), '外部の資料への必須参照を検出しました。', '制作に必要な情報をこのMarkdownに書いてください。', 'warning');
  check(12, 'AI別の差分', target !== 'generic' && ([5, 6, 7, 12, 13].some((n) => has(n) && body(n) !== section(canonical, n))), 'AI別の出力で主要仕様が編集されています。', '共通版との差分が、作業手順・出力形式に限られることを確認してください。', 'warning');
  const originalQuote = section(canonical, 3).split('\n').filter((entry) => entry.startsWith('> ')).join('\n').trimEnd();
  check(13, '題材反映', has(3) && !body(3).includes(originalQuote), '企画者の題材本文と出力が一致しません。', '手動編集を確認するか、設定から再生成してください。');
  check(14, '開発実行性', (has(15) && !/index\.html|Service Worker/u.test(body(15))) || (has(17) && !/確認|試す/u.test(body(17))), '起動方法か検証手順が不足しています。', '実行環境と起動・テストの手順を明記してください。');
  check(15, '共有・インポート', markdown.length > 30_000, '編集版が保存できる長さを超えています。', '3万文字以内に整理してください。JSONやURLは読込時に別途検証します。');
  return findings;
}
