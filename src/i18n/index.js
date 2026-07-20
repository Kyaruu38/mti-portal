import { DICT } from './dict.js';
import { getState } from '../core/store.js';

export const LANGS = [
  { code: 'id', label: 'ID', name: 'Bahasa Indonesia' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'zh', label: '中', name: '中文' },
];

// Translate key using the current language. Falls back id -> en -> key.
export function t(key) {
  const lang = getState().lang || 'id';
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] || entry.id || entry.en || key;
}

// Translate a raw {id,en,zh} object (for inline dynamic strings).
export function tr(obj) {
  const lang = getState().lang || 'id';
  if (!obj) return '';
  return obj[lang] || obj.id || obj.en || '';
}
