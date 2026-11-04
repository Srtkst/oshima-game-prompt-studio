// The preview supports headings, quotes, lists, paragraphs and fences. All text is inert.
export function markdownPreview(markdown) {
  const root = document.createElement('div');
  root.className = 'preview markdown-preview';
  let code;
  let group;
  function add(tag, text, parent = root) {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  }
  for (const line of markdown.split(/\r?\n/u)) {
    if (/^```/u.test(line)) {
      code = code ? null : add('pre', '');
      group = undefined;
      continue;
    }
    if (code) { code.append(`${line}\n`); continue; }
    const heading = line.match(/^(#{1,5}) (.*)$/u);
    if (/^[-*] /u.test(line)) {
      if (!group) group = add('ul', '');
      add('li', line.slice(2), group);
      continue;
    }
    group = undefined;
    if (heading) add(`h${heading[1].length + 1}`, heading[2]);
    else if (line.startsWith('> ')) add('blockquote', line.slice(2));
    else if (line.trim()) add('p', line);
  }
  return root;
}
