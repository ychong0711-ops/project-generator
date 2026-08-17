import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ko from './ko/translation.json';
import de from './de/translation.json';
import en from './en/translation.json';

type Dict = Record<string, string>;
const koDict = ko as Dict;
const deDict = de as Dict;
const enDict = en as Dict;
const LOCALES: Record<string, Dict> = { ko: koDict, de: deDict, en: enDict };
const SRC = path.resolve(__dirname, '..');

/** src 전체에서 t('...') 형태로 참조하는 리터럴 키를 수집 */
function collectUsedKeys(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'\s*\)/g)) {
        const key = m[1];
        used.set(key, [...(used.get(key) ?? []), path.relative(SRC, full)]);
      }
    }
  };
  walk(SRC);
  return used;
}

describe('번역 리소스', () => {
  it('세 언어의 키 집합이 동일하다', () => {
    const koKeys = Object.keys(koDict).sort();
    expect(Object.keys(deDict).sort()).toEqual(koKeys);
    expect(Object.keys(enDict).sort()).toEqual(koKeys);
  });

  it('빈 문자열인 번역이 없다', () => {
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${lang}.${key} 가 비어 있음`).not.toBe('');
      }
    }
  });

  /* 회귀 방지: 과거 t('DE_Embedded_Systems_Master_Prep') 처럼 리소스에 없는 키를
     호출해 화면에 키 문자열이 그대로 노출된 적이 있다. */
  it('코드에서 호출하는 모든 t() 키가 리소스에 존재한다', () => {
    const used = collectUsedKeys();
    expect(used.size).toBeGreaterThan(0); // 수집 자체가 동작하는지 확인

    const missing: string[] = [];
    for (const [key, files] of used) {
      if (!(key in koDict)) missing.push(`${key}  (사용처: ${[...new Set(files)].join(', ')})`);
    }
    expect(missing, `리소스에 없는 키:\n${missing.join('\n')}`).toEqual([]);
  });

  it('독일어와 영어 번역이 한국어와 다르다 (미번역 방지)', () => {
    // 고유명사 등 의도적으로 동일할 수 있는 키는 제외
    const allowSame = new Set<string>();
    for (const key of Object.keys(koDict)) {
      if (allowSame.has(key)) continue;
      expect(deDict[key], `de.${key} 가 한국어 그대로임`).not.toBe(koDict[key]);
      expect(enDict[key], `en.${key} 가 한국어 그대로임`).not.toBe(koDict[key]);
    }
  });
});
