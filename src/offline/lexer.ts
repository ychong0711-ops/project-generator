/* ---------- 토큰 ---------- */
import { CError } from './errors';

export interface Tok {
  t: 'num' | 'str' | 'id' | 'op';
  v: string;
  line: number;
}

export const TYPE_WORDS = new Set([
  'int', 'double', 'float', 'char', 'void', 'long', 'short', 'unsigned', 'signed',
  'static', 'const', 'volatile', 'extern', 'register', 'inline',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
  'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'bool',
]);

export function preprocess(src: string): { code: string } {
  /* 줄 단위: // 주석 제거 */
  const raw = src
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  /* 블록 주석 제거 (문자열 인지) */
  let s = '';
  let i = 0;
  let inStr = false;
  while (i < raw.length) {
    const c = raw[i];
    if (inStr) {
      if (c === '\\') {
        s += c + (raw[i + 1] ?? '');
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      s += c;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      s += c;
      i++;
      continue;
    }
    if (c === '/' && raw[i + 1] === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    s += c;
    i++;
  }
  /* #define 수집 + 전처리 라인 제거 */
  const defines: [string, string][] = [];
  const lines: string[] = [];
  for (const ln of s.split('\n')) {
    const m = ln.match(/^\s*#\s*define\s+([A-Za-z_]\w*)\s+(.+?)\s*$/);
    if (m) {
      defines.push([m[1], m[2].trim()]);
      lines.push('');
      continue;
    }
    if (/^\s*#\s*(include|undef|pragma|ifndef|ifdef|endif|else|if)\b/.test(ln)) {
      lines.push('');
      continue;
    }
    lines.push(ln);
  }
  let code = lines.join('\n');
  /* 매크로 치환: 치환 결과에 다른 매크로 이름이 포함될 수 있으므로
     (#define BANK_B SECTOR_SIZE 같은 중첩) 고정점까지 반복 치환 */
  for (let pass = 0; pass < 20; pass++) {
    const next = defines.reduce(
      (acc, [name, rep]) => acc.replace(new RegExp(`\\b${name}\\b`, 'g'), rep),
      code
    );
    if (next === code) break;
    code = next;
  }
  return { code };
}

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  const isD = (c: string) => c >= '0' && c <= '9';
  const isIdS = (c: string) => /[A-Za-z_]/.test(c);
  const isIdC = (c: string) => /[A-Za-z0-9_]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (isD(c) || (c === '.' && isD(src[i + 1] ?? ''))) {
      const start = i;
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        i += 2;
        while (i < src.length && /[0-9a-fA-F]/.test(src[i])) i++;
      } else {
        while (i < src.length && (isD(src[i]) || src[i] === '.')) i++;
        if (src[i] === 'e' || src[i] === 'E') {
          i++;
          if (src[i] === '+' || src[i] === '-') i++;
          while (i < src.length && isD(src[i])) i++;
        }
      }
      while (i < src.length && /[uUlLfF]/.test(src[i])) i++;
      toks.push({ t: 'num', v: src.slice(start, i), line });
      continue;
    }
    if (isIdS(c)) {
      const start = i;
      while (i < src.length && isIdC(src[i])) i++;
      toks.push({ t: 'id', v: src.slice(start, i), line });
      continue;
    }
    if (c === '"') {
      i++;
      let s = '';
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') {
          i++;
          const e = src[i];
          if (e === 'n') s += '\n';
          else if (e === 't') s += '\t';
          else if (e === 'r') s += '\r';
          else if (e === '0') s += '\0';
          else s += e;
        } else {
          if (src[i] === '\n') line++;
          s += src[i];
        }
        i++;
      }
      if (src[i] !== '"') throw new CError(line, '문자열 종료 " 가 없습니다');
      i++;
      toks.push({ t: 'str', v: s, line });
      continue;
    }
    if (c === "'") {
      i++;
      let code: number;
      if (src[i] === '\\') {
        i++;
        const e = src[i];
        code = e === 'n' ? 10 : e === 't' ? 9 : e === 'r' ? 13 : e === '0' ? 0 : e.charCodeAt(0);
      } else {
        code = src.charCodeAt(i);
      }
      i++;
      if (src[i] !== "'") throw new CError(line, "문자 종료 ' 가 없습니다");
      i++;
      toks.push({ t: 'num', v: String(code), line });
      continue;
    }
    const two = src.substr(i, 2);
    if (['<=', '>=', '==', '!=', '&&', '||', '++', '--', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '^=', '->', '|=', '&='].includes(two)) {
      toks.push({ t: 'op', v: two, line });
      i += 2;
      continue;
    }
    if ('+-*/%<>&|^!~=?:,;(){}[]\.'.includes(c)) {
      toks.push({ t: 'op', v: c, line });
      i++;
      continue;
    }
    throw new CError(line, `알 수 없는 문자 '${c}'`);
  }
  toks.push({ t: 'op', v: '<eof>', line });
  return toks;
}
