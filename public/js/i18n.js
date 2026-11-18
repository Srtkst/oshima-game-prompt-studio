import { english, patterns } from './translations-en.js';

const storageKey = 'oshima-ui-language';
let language = 'ja';
try {
  const requested = new URL(location.href).searchParams.get('lang');
  const saved = localStorage.getItem(storageKey);
  language = requested === 'en' || requested === 'ja' ? requested : saved === 'en' ? 'en' : 'ja';
} catch { /* Node and browsers without storage use Japanese by default. */ }

export const getLanguage = () => language;
export function t(text, locale = language) {
  if (typeof text !== 'string' || locale === 'ja') return text;
  const value = text.trim();
  if (Object.hasOwn(english, value)) return text.replace(value, english[value]);
  for (const [pattern, replace] of patterns) {
    if (pattern.test(value)) return value.replace(pattern, (...args) => replace(...args, locale));
  }
  if (text.includes('\n')) return text.split('\n').map((line) => t(line, locale)).join('\n');
  return text;
}

export function setLanguage(value) {
  if (!['ja', 'en'].includes(value) || value === language) return;
  language = value;
  try { localStorage.setItem(storageKey, value); } catch { /* The selection still works in memory. */ }
  document.documentElement.lang = language;
  const url = new URL(location.href);
  url.searchParams.set('lang', value);
  history.replaceState(null, '', url);
  document.dispatchEvent(new CustomEvent('languagechange', { detail: language }));
}

const originalText = new WeakMap();
const originalAttrs = new WeakMap();
export function message(element, text) {
  element.dataset.i18nMessage = text;
  element.textContent = t(text);
}

export function localizeUI(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script, style, textarea, pre, [data-user-content], [data-i18n-message], .language-select')) continue;
    if (!originalText.has(node)) originalText.set(node, node.textContent);
    node.textContent = t(originalText.get(node));
  }
  for (const element of root.querySelectorAll('[data-i18n-message]')) element.textContent = t(element.dataset.i18nMessage);
  for (const element of root.querySelectorAll('[aria-label], [placeholder], iframe[title], meta[name="description"]')) {
    if (element.closest('[data-user-content]')) continue;
    let values = originalAttrs.get(element);
    if (!values) {
      values = {};
      for (const name of ['aria-label', 'placeholder', 'title', 'content']) {
        if (element.hasAttribute(name)) values[name] = element.getAttribute(name);
      }
      originalAttrs.set(element, values);
    }
    for (const [name, value] of Object.entries(values)) element.setAttribute(name, t(value));
  }
}

export function initLanguage() {
  const label = document.createElement('label');
  label.className = 'language-control';
  const select = document.createElement('select');
  select.className = 'language-select';
  select.id = 'site-language';
  select.setAttribute('aria-label', '表示言語 / Language');
  select.add(new Option('日本語', 'ja'));
  select.add(new Option('English', 'en'));
  select.value = language;
  select.addEventListener('change', () => setLanguage(select.value));
  label.append(select);
  document.querySelector('.header-row').append(label);
  const pageTitle = document.title;
  const update = () => {
    document.documentElement.lang = language;
    select.value = language;
    localizeUI();
    document.title = t(pageTitle);
  };
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  document.addEventListener('languagechange', update);
  update();
}
