/* ============================================================
 *  AutoEmbed Offline C Engine
 *  — 네트워크 없이 브라우저에서 C 서브셋 코드를 실행하는 인터프리터
 *
 *  지원: int/double/char, 배열, 포인터(기본), 함수, if/for/while/
 *        do-while/switch, printf(%d %u %x %X %f %.2f %e %g %c %s,
 *        폭/정밀도/0패딩), 수학/문자열/메모리 내장 함수
 *  미지원: struct/enum/typedef, 전역 변수 초기화식, 2차원 배열,
 *          sizeof — 미지원 문법은 명확한 오류 메시지로 안내
 * ============================================================ */

export interface OfflineResult {
  ok: boolean;
  output: string;
  steps: number;
  error?: { line: number; message: string };
}

class CError extends Error {
  constructor(public line: number, message: string) {
    super(message);
  }
}
class RetSignal {
  constructor(public v: Val | null) {}
}
class BrkSignal {}
class ContSignal {}

/* ---------- 런타임 값 ---------- */
interface Ptr {
  cell: Cell;
  idx: number; /* -1 이면 스칼라 셀 직접 */
}
interface Cell {
  kind: 'num' | 'arr';
  n: number;
  ptr: Ptr | null;
  arr: Cell[] | null;
  isStr: boolean;
}
type Val = number | Ptr | Cell;

function numCell(n: number): Cell {
  return { kind: 'num', n, ptr: null, arr: null, isStr: false };
}
function arrCell(items: Cell[], isStr = false): Cell {
  return { kind: 'arr', n: 0, ptr: null, arr: items, isStr };
}
function isPtr(v: Val): v is Ptr {
  return typeof v !== 'number' && (v as Ptr).cell !== undefined && (v as Cell).arr === undefined;
}
function isArrCell(v: Val): v is Cell {
  return typeof v !== 'number' && (v as Cell).kind === 'arr';
}
function readCell(cell: Cell): Val {
  if (cell.kind === 'arr') return { cell, idx: 0 };
  return cell.ptr ?? cell.n;
}
function derefNum(p: Ptr): number {
  const c = p.idx === -1 ? p.cell : p.cell.arr ? p.cell.arr[p.idx] : null;
  if (!c) return 0;
  if (c.kind === 'arr') return 0;
  return c.ptr ? 0 : c.n;
}
function strFrom(v: Val): { cell: Cell; start: number } {
  if (isPtr(v)) return { cell: v.cell, start: Math.max(0, v.idx) };
  if (isArrCell(v)) return { cell: v, start: 0 };
  throw new CError(0, '문자열이 필요한 위치에 숫자가 있습니다');
}
function strRead(v: Val): string {
  const { cell, start } = strFrom(v);
  if (cell.kind === 'num') return String.fromCharCode(cell.n & 0xff);
  let out = '';
  const arr = cell.arr ?? [];
  for (let i = start; i < arr.length; i++) {
    const c = arr[i];
    if (!c || c.kind !== 'num' || c.n === 0) break;
    out += String.fromCharCode(c.n & 0xff);
  }
  return out;
}

/* ---------- 토큰 ---------- */
interface Tok {
  t: 'num' | 'str' | 'id' | 'op';
  v: string;
  line: number;
}

const TYPE_WORDS = new Set([
  'int', 'double', 'char', 'void', 'long', 'short', 'unsigned', 'signed', 'static', 'const',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
  'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t', 'bool',
]);

function preprocess(src: string): { code: string } {
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

function tokenize(src: string): Tok[] {
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
    if (['<=', '>=', '==', '!=', '&&', '||', '++', '--', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '^='].includes(two)) {
      toks.push({ t: 'op', v: two, line });
      i += 2;
      continue;
    }
    if ('+-*/%<>&|^!~=?:,;(){}[]'.includes(c)) {
      toks.push({ t: 'op', v: c, line });
      i++;
      continue;
    }
    throw new CError(line, `알 수 없는 문자 '${c}'`);
  }
  toks.push({ t: 'op', v: '<eof>', line });
  return toks;
}

/* ---------- AST ---------- */
interface InitVal {
  kind: 'expr' | 'list' | 'str';
  expr?: ExprNode;
  list?: ExprNode[];
  str?: string;
}
interface DeclItem {
  name: string;
  isPtr: boolean;
  dimExpr: ExprNode | null;
  init?: InitVal;
}
type ExprNode =
  | { k: 'num'; n: number; line: number }
  | { k: 'str'; s: string; line: number }
  | { k: 'id'; name: string; line: number }
  | { k: 'bin'; op: string; l: ExprNode; r: ExprNode; line: number }
  | { k: 'un'; op: string; e: ExprNode; line: number }
  | { k: 'post'; op: string; e: ExprNode; line: number }
  | { k: 'assign'; op: string; l: ExprNode; r: ExprNode; line: number }
  | { k: 'tern'; c: ExprNode; t: ExprNode; e: ExprNode; line: number }
  | { k: 'call'; f: string; args: ExprNode[]; line: number }
  | { k: 'idx'; a: ExprNode; i: ExprNode; line: number }
  | { k: 'sizeof'; e: ExprNode; line: number }
  | { k: 'cast'; ty: string; e: ExprNode; line: number };

type Stmt =
  | { k: 'block'; body: Stmt[]; line: number }
  | { k: 'decl'; items: DeclItem[]; line: number }
  | { k: 'if'; c: ExprNode; t: Stmt; e: Stmt | null; line: number }
  | { k: 'while'; c: ExprNode; b: Stmt; line: number }
  | { k: 'dowhile'; b: Stmt; c: ExprNode; line: number }
  | { k: 'for'; init: Stmt | null; cond: ExprNode | null; iter: ExprNode | null; body: Stmt; line: number }
  | { k: 'switch'; e: ExprNode; cases: { isDefault: boolean; e: ExprNode | null; body: Stmt[] }[]; line: number }
  | { k: 'return'; e: ExprNode | null; line: number }
  | { k: 'break'; line: number }
  | { k: 'continue'; line: number }
  | { k: 'expr'; e: ExprNode | null; line: number }
  | { k: 'empty'; line: number };

/* ---------- 파서 + 런타임 ---------- */
class Scope {
  vars = new Map<string, Cell>();
  constructor(public parent: Scope | null) {}
  declare(name: string, cell: Cell) {
    if (this.vars.has(name)) throw new CError(0, `변수 '${name}' 중복 선언`);
    this.vars.set(name, cell);
  }
  lookup(name: string): Cell | null {
    let s: Scope | null = this;
    while (s) {
      const c = s.vars.get(name);
      if (c) return c;
      s = s.parent;
    }
    return null;
  }
}

class CInterpreter {
  toks: Tok[] = [];
  pos = 0;
  fns = new Map<string, { params: string[]; body: Stmt }>();
  global: Scope = new Scope(null);
  scope: Scope = this.global;
  output = '';
  outputFull = false;
  steps = 0;
  rng = 12345;
  globals: { ty: string; items: DeclItem[]; line: number }[] = [];
  typedefNames = new Set<string>();

  constructor(src: string) {
    const { code } = preprocess(src);
    this.toks = tokenize(code);
    this.global.vars.set('true', numCell(1));
    this.global.vars.set('false', numCell(0));
    this.parseProgram();
  }

  /* ---------- 파서 유틸 ---------- */
  cur(): Tok {
    return this.toks[this.pos];
  }
  next(): Tok {
    const t = this.toks[this.pos];
    if (this.pos < this.toks.length - 1) this.pos++;
    return t;
  }
  isOp(v: string): boolean {
    return this.cur().t === 'op' && this.cur().v === v;
  }
  eat(v: string) {
    if (!this.isOp(v)) throw new CError(this.cur().line, `'${v}' 필요 (실제: '${this.cur().v}')`);
    this.next();
  }
  expectId(): string {
    if (this.cur().t !== 'id') throw new CError(this.cur().line, `식별자 필요 (실제: '${this.cur().v}')`);
    return this.next().v;
  }
  isTypeStart(): boolean {
    return this.typedefNames.has(this.cur().v) || (this.cur().t === 'id' && TYPE_WORDS.has(this.cur().v));
  }
  parseType(): string {
    if (this.typedefNames.has(this.cur().v)) {
      this.next();
      return 'int';
    }
    const words = new Set<string>();
    while (this.cur().t === 'id' && (TYPE_WORDS.has(this.cur().v) || this.typedefNames.has(this.cur().v))) {
      words.add(this.next().v);
    }
    if (words.size === 0) throw new CError(this.cur().line, '타입 키워드 필요');
    if (words.has('double')) return 'double';
    if (words.has('char')) return 'char';
    if (words.has('void')) return 'void';
    return 'int';
  }

  /* ---------- typedef enum 지원 ---------- */
  foldConst(e: ExprNode): number {
    switch (e.k) {
      case 'num':
        return e.n;
      case 'id': {
        const cell = this.global.vars.get(e.name);
        return cell ? (cell.ptr ? 0 : cell.n) : 0;
      }
      case 'un':
        return e.op === '-' ? -this.foldConst(e.e) : this.foldConst(e.e);
      case 'bin': {
        const a = this.foldConst(e.l);
        const b = this.foldConst(e.r);
        switch (e.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b !== 0 ? a / b : 0;
          case '%': return b !== 0 ? a % b : 0;
          case '<<': return (Math.trunc(a) << Math.trunc(b)) >>> 0;
          case '>>': return Math.trunc(a) >>> Math.trunc(b);
          case '|': return (Math.trunc(a) | Math.trunc(b)) >>> 0;
          case '&': return (Math.trunc(a) & Math.trunc(b)) >>> 0;
          case '^': return (Math.trunc(a) ^ Math.trunc(b)) >>> 0;
        }
        return 0;
      }
    }
    return 0;
  }

  parseTypedefEnum() {
    this.next(); /* enum */
    if (this.cur().t === 'id') this.next(); /* optional tag name */
    this.eat('{');
    let val = 0;
    while (!this.isOp('}')) {
      const ename = this.expectId();
      if (this.isOp('=')) {
        this.next();
        val = Math.trunc(this.foldConst(this.parseAssign()));
      }
      if (!this.global.vars.has(ename)) this.global.declare(ename, numCell(val));
      val++;
      if (this.isOp(',')) {
        this.next();
        continue;
      }
      break;
    }
    this.eat('}');
    const typename = this.expectId();
    this.eat(';');
    this.typedefNames.add(typename);
  }

  parseProgram() {
    while (this.cur().v !== '<eof>') {
      const line = this.cur().line;
      if (this.cur().t === 'id' && this.cur().v === 'typedef') {
        this.next();
        if (this.cur().t === 'id' && this.cur().v === 'enum') {
          this.parseTypedefEnum();
          continue;
        }
        throw new CError(line, "typedef는 enum만 지원합니다. struct는 온라인 모드(arm-gcc)로 검증하세요.");
      }
      if (this.cur().t === 'id' && ['struct', 'enum', 'union'].includes(this.cur().v)) {
        throw new CError(
          line,
          `'${this.cur().v}'는 오프라인 모드에서 지원하지 않습니다. 온라인 모드(arm-gcc)에서 빌드하거나 구조체 없이 작성해 주세요.`
        );
      }
      if (this.cur().t === 'id' && this.cur().v === 'goto') {
        throw new CError(line, `'goto'는 오프라인 모드에서 지원하지 않습니다.`);
      }
      this.parseType();
      const isPtr = this.isOp('*') ? (this.next(), true) : false;
      const name = this.expectId();
      if (this.isOp('(')) {
        /* 함수 정의 */
        this.next();
        const params: string[] = [];
        if (!this.isOp(')')) {
          do {
            const pty = this.parseType();
            if (pty === 'void') break;
            if (this.isOp('*')) this.next();
            const pname = this.expectId();
            /* 배열 파라미터(uint8_t out[4])는 C처럼 포인터로 취급 */
            if (this.isOp('[')) {
              this.next();
              if (!this.isOp(']')) {
                this.parseExpr();
              }
              this.eat(']');
            }
            params.push(pname);
          } while (this.isOp(',') && this.next());
        }
        this.eat(')');
        const body = this.parseBlock();
        this.fns.set(name, { params, body });
      } else {
        /* 전역 변수 */
        const items = this.parseDeclRest(name, isPtr);
        this.eat(';');
        this.globals.push({ ty: 'int', items, line });
      }
    }
  }

  parseDeclRest(firstName: string, firstIsPtr = false): DeclItem[] {
    const items: DeclItem[] = [];
    let name = firstName;
    let curPtr = firstIsPtr;
    for (;;) {
      const item: DeclItem = { name, isPtr: curPtr, dimExpr: null };
      if (this.isOp('[')) {
        this.next();
        if (this.isOp(']')) {
          this.next();
          item.dimExpr = null; /* 크기 추론 (초기화 리스트 필요) */
        } else {
          item.dimExpr = this.parseExpr();
          this.eat(']');
        }
        if (this.isOp('[')) throw new CError(this.cur().line, '2차원 배열은 지원하지 않습니다');
      }
      if (this.isOp('=')) {
        this.next();
        if (this.cur().t === 'str') {
          item.init = { kind: 'str', str: this.next().v };
        } else if (this.isOp('{')) {
          this.next();
          const list: ExprNode[] = [];
          if (!this.isOp('}')) {
            do {
              list.push(this.parseAssign());
            } while (this.isOp(',') && this.next() && !this.isOp('}')); /* C99 허용: 후행 콤마 */
          }
          this.eat('}');
          item.init = { kind: 'list', list };
        } else {
          item.init = { kind: 'expr', expr: this.parseAssign() };
        }
      }
      items.push(item);
      if (!this.isOp(',')) break;
      this.next();
      curPtr = false;
      if (this.isOp('*')) {
        this.next();
        curPtr = true;
      }
      name = this.expectId();
    }
    return items;
  }

  parseBlock(): Stmt {
    const line = this.cur().line;
    this.eat('{');
    const body: Stmt[] = [];
    while (!this.isOp('}')) {
      if (this.cur().v === '<eof>') throw new CError(this.cur().line, '닫는 } 가 없습니다');
      body.push(this.parseStmt());
    }
    this.next();
    return { k: 'block', body, line };
  }

  parseStmt(): Stmt {
    const line = this.cur().line;
    const c = this.cur();

    if (c.t === 'id') {
      if (c.v === 'if') {
        this.next();
        this.eat('(');
        const cond = this.parseExpr();
        this.eat(')');
        const t = this.parseStmt();
        let e: Stmt | null = null;
        if (this.cur().t === 'id' && this.cur().v === 'else') {
          this.next();
          e = this.parseStmt();
        }
        return { k: 'if', c: cond, t, e, line };
      }
      if (c.v === 'puts') {
        this.next();
        this.eat('(');
        const arg = this.parseExpr();
        this.eat(')');
        this.eat(';');
        return { k: 'expr', e: { k: 'call', f: 'printf', args: [arg], line }, line };
      }
      if (c.v === 'while') {
        this.next();
        this.eat('(');
        const cond = this.parseExpr();
        this.eat(')');
        return { k: 'while', c: cond, b: this.parseStmt(), line };
      }
      if (c.v === 'do') {
        this.next();
        const b = this.parseStmt();
        if (!(this.cur().t === 'id' && this.cur().v === 'while')) throw new CError(this.cur().line, "do 뒤에 while 필요");
        this.next();
        this.eat('(');
        const cond = this.parseExpr();
        this.eat(')');
        this.eat(';');
        return { k: 'dowhile', b, c: cond, line };
      }
      if (c.v === 'for') {
        this.next();
        this.eat('(');
        let init: Stmt | null = null;
        if (this.isOp(';')) {
          this.next();
        } else if (this.isTypeStart()) {
          this.parseType();
          const isPtr = this.isOp('*') ? (this.next(), true) : false;
          const name = this.expectId();
          const items = this.parseDeclRest(name, isPtr);
          this.eat(';');
          init = { k: 'decl', items, line };
        } else {
          const e = this.parseExpr();
          this.eat(';');
          init = { k: 'expr', e, line };
        }
        const cond = this.isOp(';') ? null : this.parseExpr();
        this.eat(';');
        const iter = this.isOp(')') ? null : this.parseExpr();
        this.eat(')');
        return { k: 'for', init, cond, iter, body: this.parseStmt(), line };
      }
      if (c.v === 'switch') {
        this.next();
        this.eat('(');
        const e = this.parseExpr();
        this.eat(')');
        this.eat('{');
        const cases: { isDefault: boolean; e: ExprNode | null; body: Stmt[] }[] = [];
        while (!this.isOp('}')) {
          if (this.cur().t === 'id' && this.cur().v === 'case') {
            this.next();
            const ce = this.parseExpr();
            this.eat(':');
            cases.push({ isDefault: false, e: ce, body: [] });
          } else if (this.cur().t === 'id' && this.cur().v === 'default') {
            this.next();
            this.eat(':');
            cases.push({ isDefault: true, e: null, body: [] });
          } else {
            if (cases.length === 0) throw new CError(this.cur().line, 'case 이전의 문장은 허용되지 않습니다');
            cases[cases.length - 1].body.push(this.parseStmt());
          }
        }
        this.next();
        return { k: 'switch', e, cases, line };
      }
      if (c.v === 'return') {
        this.next();
        if (this.isOp(';')) {
          this.next();
          return { k: 'return', e: null, line };
        }
        const e = this.parseExpr();
        this.eat(';');
        return { k: 'return', e, line };
      }
      if (c.v === 'break') {
        this.next();
        this.eat(';');
        return { k: 'break', line };
      }
      if (c.v === 'continue') {
        this.next();
        this.eat(';');
        return { k: 'continue', line };
      }
      if (c.v === 'struct' || c.v === 'enum' || c.v === 'typedef' || c.v === 'union') {
        throw new CError(line, `'${c.v}'는 오프라인 모드에서 지원하지 않습니다. 온라인 모드(arm-gcc)에서 빌드하세요.`);
      }
      if (TYPE_WORDS.has(c.v) || this.typedefNames.has(c.v)) {
        const ty = this.parseType();
        if (ty === 'void') throw new CError(line, 'void 변수는 선언할 수 없습니다');
        void ty;
        const isPtr = this.isOp('*') ? (this.next(), true) : false;
        const name = this.expectId();
        const items = this.parseDeclRest(name, isPtr);
        this.eat(';');
        return { k: 'decl', items, line };
      }
    }

    if (c.t === 'op' && c.v === '{') return this.parseBlock();
    if (c.t === 'op' && c.v === ';') {
      this.next();
      return { k: 'empty', line };
    }
    const e = this.parseExpr();
    this.eat(';');
    return { k: 'expr', e, line };
  }

  /* ---------- 표현식 파서 ---------- */
  parseExpr(): ExprNode {
    const first = this.parseAssign();
    if (!this.isOp(',')) return first;
    let last = first;
    while (this.isOp(',')) {
      this.next();
      last = this.parseAssign();
    }
    return last;
  }
  parseAssign(): ExprNode {
    const line = this.cur().line;
    const l = this.parseTern();
    const op = this.cur();
    if (op.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^='].includes(op.v)) {
      this.next();
      const r = this.parseAssign();
      return { k: 'assign', op: op.v, l, r, line };
    }
    return l;
  }
  parseTern(): ExprNode {
    const line = this.cur().line;
    const c = this.parseLor();
    if (this.isOp('?')) {
      this.next();
      const t = this.parseExpr();
      this.eat(':');
      const e = this.parseTern();
      return { k: 'tern', c, t, e, line };
    }
    return c;
  }
  parseLor(): ExprNode {
    let l = this.parseLand();
    while (this.isOp('||')) {
      const line = this.cur().line;
      this.next();
      l = { k: 'bin', op: '||', l, r: this.parseLand(), line };
    }
    return l;
  }
  parseLand(): ExprNode {
    let l = this.parseBitor();
    while (this.isOp('&&')) {
      const line = this.cur().line;
      this.next();
      l = { k: 'bin', op: '&&', l, r: this.parseBitor(), line };
    }
    return l;
  }
  parseBitor(): ExprNode {
    let l = this.parseBitxor();
    while (this.isOp('|')) {
      const line = this.cur().line;
      this.next();
      l = { k: 'bin', op: '|', l, r: this.parseBitxor(), line };
    }
    return l;
  }
  parseBitxor(): ExprNode {
    let l = this.parseBitand();
    while (this.isOp('^')) {
      const line = this.cur().line;
      this.next();
      l = { k: 'bin', op: '^', l, r: this.parseBitand(), line };
    }
    return l;
  }
  parseBitand(): ExprNode {
    let l = this.parseEq();
    while (this.isOp('&')) {
      const line = this.cur().line;
      this.next();
      l = { k: 'bin', op: '&', l, r: this.parseEq(), line };
    }
    return l;
  }
  parseEq(): ExprNode {
    let l = this.parseCmp();
    while (this.isOp('==') || this.isOp('!=')) {
      const line = this.cur().line;
      const op = this.next().v;
      l = { k: 'bin', op, l, r: this.parseCmp(), line };
    }
    return l;
  }
  parseCmp(): ExprNode {
    let l = this.parseShift();
    while (this.isOp('<') || this.isOp('>') || this.isOp('<=') || this.isOp('>=')) {
      const line = this.cur().line;
      const op = this.next().v;
      l = { k: 'bin', op, l, r: this.parseShift(), line };
    }
    return l;
  }
  parseShift(): ExprNode {
    let l = this.parseAdd();
    while (this.isOp('<<') || this.isOp('>>')) {
      const line = this.cur().line;
      const op = this.next().v;
      l = { k: 'bin', op, l, r: this.parseAdd(), line };
    }
    return l;
  }
  parseAdd(): ExprNode {
    let l = this.parseMul();
    while (this.isOp('+') || this.isOp('-')) {
      const line = this.cur().line;
      const op = this.next().v;
      l = { k: 'bin', op, l, r: this.parseMul(), line };
    }
    return l;
  }
  parseMul(): ExprNode {
    let l = this.parseUnary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const line = this.cur().line;
      const op = this.next().v;
      l = { k: 'bin', op, l, r: this.parseUnary(), line };
    }
    return l;
  }
  parseUnary(): ExprNode {
    const line = this.cur().line;
    const c = this.cur();
    if (c.t === 'op' && ['-', '+', '!', '~', '++', '--', '*', '&'].includes(c.v)) {
      this.next();
      return { k: 'un', op: c.v, e: this.parseUnary(), line };
    }
    if (c.t === 'op' && c.v === '(' && this.toks[this.pos + 1]?.t === 'id' && (TYPE_WORDS.has(this.toks[this.pos + 1].v) || this.typedefNames.has(this.toks[this.pos + 1].v))) {
      this.next();
      const ty = this.parseType();
      if (this.isOp('*')) this.next();
      this.eat(')');
      return { k: 'cast', ty, e: this.parseUnary(), line };
    }
    if (c.t === 'id' && c.v === 'sizeof') {
      this.next();
      this.eat('(');
      const e = this.parseExpr();
      this.eat(')');
      return { k: 'sizeof', e, line };
    }
    return this.parsePostfix();
  }
  parsePostfix(): ExprNode {
    let e = this.parsePrimary();
    for (;;) {
      const line = this.cur().line;
      if (this.isOp('[')) {
        this.next();
        const i = this.parseExpr();
        this.eat(']');
        e = { k: 'idx', a: e, i, line };
        continue;
      }
      if (this.isOp('(')) {
        this.next();
        const args: ExprNode[] = [];
        if (!this.isOp(')')) {
          do {
            args.push(this.parseAssign());
          } while (this.isOp(',') && this.next());
        }
        this.eat(')');
        if (e.k !== 'id') throw new CError(line, '함수 호출은 함수 이름에만 지원됩니다');
        e = { k: 'call', f: e.name, args, line };
        continue;
      }
      if (this.isOp('++') || this.isOp('--')) {
        const op = this.next().v;
        e = { k: 'post', op, e, line };
        continue;
      }
      break;
    }
    return e;
  }
  parsePrimary(): ExprNode {
    const line = this.cur().line;
    const c = this.cur();
    if (c.t === 'num') {
      this.next();
      const n = c.v.startsWith('0x') || c.v.startsWith('0X') ? parseInt(c.v, 16) : parseFloat(c.v);
      return { k: 'num', n, line };
    }
    if (c.t === 'str') {
      this.next();
      return { k: 'str', s: c.v, line };
    }
    if (c.t === 'id') {
      this.next();
      return { k: 'id', name: c.v, line };
    }
    if (c.t === 'op' && c.v === '(') {
      this.next();
      const e = this.parseExpr();
      this.eat(')');
      return e;
    }
    throw new CError(line, `식 시작 필요 (실제: '${c.v}')`);
  }

  /* ---------- 실행 ---------- */
  exec() {
    for (const g of this.globals) {
      for (const item of g.items) this.execDeclItem(item, this.global);
    }
    const main = this.fns.get('main');
    if (!main) throw new CError(0, 'main() 함수가 없습니다');
    this.callUser('main', []);
  }

  execDeclItem(item: DeclItem, scope: Scope) {
    let cell: Cell;
    if (item.dimExpr !== null) {
      const size = Math.max(0, Math.trunc(this.evalNum(item.dimExpr)));
      cell = arrCell(Array.from({ length: size }, () => numCell(0)));
      if (item.init?.kind === 'list') {
        /* int a[4] = {10,20,30,40}; — 명시 크기 + 초기화 리스트 */
        const list = item.init.list ?? [];
        const n = Math.min(list.length, size);
        for (let i = 0; i < n; i++) {
          const v = this.evalExpr(list[i]);
          const c = cell.arr![i];
          if (isPtr(v) || isArrCell(v)) {
            c.ptr = isPtr(v) ? v : { cell: v, idx: 0 };
          } else {
            c.n = this.numOf(v);
          }
        }
      } else if (item.init?.kind === 'str') {
        /* char buf[16] = "abc"; — 나머지는 0(널) 자동 */
        const s = item.init.str!;
        const n = Math.min(s.length, size);
        for (let i = 0; i < n; i++) {
          const c = cell.arr![i];
          c.n = s.charCodeAt(i);
          c.ptr = null;
        }
      }
    } else if (item.init?.kind === 'list') {
      const list = item.init.list ?? [];
      cell = arrCell(
        list.map((e) => {
          const v = this.evalExpr(e);
          if (isPtr(v) || isArrCell(v)) {
            const c = numCell(0);
            c.ptr = isPtr(v) ? v : { cell: v, idx: 0 };
            return c;
          }
          return numCell(this.numOf(v));
        })
      );
    } else if (item.init?.kind === 'str') {
      if (item.isPtr) {
        const strCell = this.strLiteralCell(item.init.str!);
        cell = numCell(0);
        cell.ptr = { cell: strCell, idx: 0 };
      } else {
        const strCell = this.strLiteralCell(item.init.str!);
        cell = strCell;
      }
    } else {
      cell = numCell(0);
      if (item.init?.kind === 'expr') {
        const v = this.evalExpr(item.init.expr!);
        if (isPtr(v)) {
          cell.ptr = v;
        } else if (isArrCell(v)) {
          cell.ptr = { cell: v, idx: 0 };
        } else {
          cell.n = v;
        }
      }
    }
    scope.declare(item.name, cell);
  }

  strLiteralCell(s: string): Cell {
    const cells = s.split('').map((ch) => numCell(ch.charCodeAt(0)));
    cells.push(numCell(0));
    return arrCell(cells, true);
  }

  execStmt(s: Stmt) {
    this.steps++;
    if (this.steps > 3000000) throw new CError(s.line, '실행 단계 한도 초과 (무한 루프 의심)');
    switch (s.k) {
      case 'block': {
        const prev = this.scope;
        this.scope = new Scope(prev);
        try {
          for (const st of s.body) this.execStmt(st);
        } finally {
          this.scope = prev;
        }
        break;
      }
      case 'decl':
        for (const item of s.items) this.execDeclItem(item, this.scope);
        break;
      case 'if':
        if (this.evalNum(s.c) !== 0) this.execStmt(s.t);
        else if (s.e) this.execStmt(s.e);
        break;
      case 'while': {
        const prev = this.scope;
        this.scope = new Scope(prev);
        try {
          while (this.evalNum(s.c) !== 0) {
            try {
              this.execStmt(s.b);
            } catch (e) {
              if (e instanceof BrkSignal) break;
              if (e instanceof ContSignal) continue;
              throw e;
            }
          }
        } finally {
          this.scope = prev;
        }
        break;
      }
      case 'dowhile': {
        const prev = this.scope;
        this.scope = new Scope(prev);
        try {
          do {
            try {
              this.execStmt(s.b);
            } catch (e) {
              if (e instanceof BrkSignal) break;
              if (e instanceof ContSignal) continue;
              throw e;
            }
          } while (this.evalNum(s.c) !== 0);
        } finally {
          this.scope = prev;
        }
        break;
      }
      case 'for': {
        const prev = this.scope;
        this.scope = new Scope(prev);
        try {
          if (s.init) this.execStmt(s.init);
          while (s.cond === null || this.evalNum(s.cond) !== 0) {
            try {
              this.execStmt(s.body);
            } catch (e) {
              if (e instanceof BrkSignal) break;
              if (e instanceof ContSignal) {
                if (s.iter) this.evalExpr(s.iter);
                continue;
              }
              throw e;
            }
            if (s.iter) this.evalExpr(s.iter);
          }
        } finally {
          this.scope = prev;
        }
        break;
      }
      case 'switch': {
        const target = this.evalNum(s.e);
        let start = -1;
        for (let i = 0; i < s.cases.length; i++) {
          const cs = s.cases[i];
          if (cs.isDefault) start = i;
          else if (this.evalNum(cs.e!) === target) {
            start = i;
            break;
          }
        }
        if (start >= 0) {
          try {
            for (let i = start; i < s.cases.length; i++) {
              for (const st of s.cases[i].body) this.execStmt(st);
            }
          } catch (e) {
            if (!(e instanceof BrkSignal)) throw e;
          }
        }
        break;
      }
      case 'return': {
        const v = s.e ? this.evalExpr(s.e) : null;
        throw new RetSignal(v);
      }
      case 'break':
        throw new BrkSignal();
      case 'continue':
        throw new ContSignal();
      case 'expr':
        if (s.e) this.evalExpr(s.e);
        break;
      case 'empty':
        break;
    }
  }

  /* ---------- 표현식 평가 ---------- */
  evalNum(e: ExprNode): number {
    const v = this.evalExpr(e);
    return this.numOf(v);
  }
  numOf(v: Val): number {
    if (typeof v === 'number') return v;
    if (isPtr(v)) return derefNum(v);
    throw new CError(0, '숫자가 필요한 위치에 문자열/배열이 있습니다');
  }
  evalExpr(e: ExprNode): Val {
    switch (e.k) {
      case 'num':
        return e.n;
      case 'str':
        return this.strLiteralCell(e.s);
      case 'id': {
        const cell = this.scope.lookup(e.name);
        if (!cell) throw new CError(e.line, `정의되지 않은 변수 '${e.name}'`);
        return readCell(cell);
      }
      case 'bin':
        return this.evalBin(e);
      case 'un':
        return this.evalUn(e);
      case 'post':
        return this.evalPost(e);
      case 'assign':
        return this.evalAssign(e);
      case 'tern':
        return this.evalNum(e.c) !== 0 ? this.evalExpr(e.t) : this.evalExpr(e.e);
      case 'call':
        return this.call(e);
      case 'idx':
        return this.evalIdx(e);
      case 'sizeof': {
        /* 배열은 요소 개수, 그 외(요소/스칼라)는 1 반환
           -> sizeof(arr)/sizeof(arr[0]) 패턴으로 배열 길이 계산 지원 */
        if (e.e.k === 'id') {
          const cell = this.scope.lookup(e.e.name);
          if (cell && cell.kind === 'arr') return cell.arr?.length ?? 0;
        }
        return 1;
      }
      case 'cast': {
        if (e.ty === 'void') return 0;
        const v = this.evalExpr(e.e);
        if (isPtr(v) || isArrCell(v)) return isPtr(v) ? v : { cell: v, idx: 0 };
        const n = this.numOf(v);
        if (e.ty === 'int') return Math.trunc(n);
        if (e.ty === 'char') return n & 0xff;
        return n;
      }
    }
  }
  evalBin(e: Extract<ExprNode, { k: 'bin' }>): Val {
    const op = e.op;
    if (op === '&&') return this.evalNum(e.l) !== 0 && this.evalNum(e.r) !== 0 ? 1 : 0;
    if (op === '||') return this.evalNum(e.l) !== 0 || this.evalNum(e.r) !== 0 ? 1 : 0;
    /* 포인터 산술: 배열/포인터 +- 정수 (예: flash + BANK_A) */
    if (op === '+' || op === '-') {
      const lv = this.evalExpr(e.l);
      const b = Math.trunc(this.evalNum(e.r));
      const sign = op === '+' ? b : -b;
      if (isArrCell(lv)) return { cell: lv, idx: sign };
      if (isPtr(lv)) return { cell: lv.cell, idx: lv.idx + sign };
      return op === '+' ? this.numOf(lv) + b : this.numOf(lv) - b;
    }
    const a = this.evalNum(e.l);
    const b = this.evalNum(e.r);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return a / b;
      case '%': return Math.trunc(a) % Math.trunc(b);
      /* 비트 연산은 uint32(무부호) 의미론: 결과를 >>>0 으로 정규화, >> 는 논리 시프트 */
      case '<<': return (Math.trunc(a) << Math.trunc(b)) >>> 0;
      case '>>': return Math.trunc(a) >>> Math.trunc(b);
      case '<': return a < b ? 1 : 0;
      case '>': return a > b ? 1 : 0;
      case '<=': return a <= b ? 1 : 0;
      case '>=': return a >= b ? 1 : 0;
      case '==': return a === b ? 1 : 0;
      case '!=': return a !== b ? 1 : 0;
      case '&': return (Math.trunc(a) & Math.trunc(b)) >>> 0;
      case '|': return (Math.trunc(a) | Math.trunc(b)) >>> 0;
      case '^': return (Math.trunc(a) ^ Math.trunc(b)) >>> 0;
    }
    return 0;
  }
  evalUn(e: Extract<ExprNode, { k: 'un' }>): Val {
    const op = e.op;
    if (op === '&') {
      const lv = this.evalLVal(e.e);
      if (lv.idx === undefined) {
        if (lv.cell.kind === 'arr') return { cell: lv.cell, idx: 0 };
        return { cell: lv.cell, idx: -1 };
      }
      return { cell: lv.cell, idx: lv.idx };
    }
    if (op === '*') {
      const v = this.evalExpr(e.e);
      if (isPtr(v)) return this.readPtrVal(v);
      if (isArrCell(v)) return this.readPtrVal({ cell: v, idx: 0 });
      throw new CError(e.line, '포인터가 아닌 값에 * 연산');
    }
    if (op === '++' || op === '--') {
      const lv = this.evalLVal(e.e);
      const cur = this.readLValNum(lv);
      this.writeLValNum(lv, cur + (op === '++' ? 1 : -1), e.line);
      return cur + (op === '++' ? 1 : -1);
    }
    const v = this.evalNum(e.e);
    if (op === '+') return v;
    if (op === '-') return -v;
    if (op === '!') return v === 0 ? 1 : 0;
    if (op === '~') return ~Math.trunc(v);
    return v;
  }
  evalPost(e: Extract<ExprNode, { k: 'post' }>): number {
    const lv = this.evalLVal(e.e);
    const cur = this.readLValNum(lv);
    this.writeLValNum(lv, cur + (e.op === '++' ? 1 : -1), e.line);
    return cur;
  }
  evalIdx(e: Extract<ExprNode, { k: 'idx' }>): Val {
    const base = this.evalExpr(e.a);
    const i = Math.trunc(this.evalNum(e.i));
    if (isPtr(base)) return this.readPtrVal({ cell: base.cell, idx: base.idx + i });
    if (isArrCell(base)) return this.readPtrVal({ cell: base, idx: i });
    throw new CError(e.line, '배열/포인터가 아닌 값에 인덱스 연산');
  }
  readPtrVal(p: Ptr): Val {
    if (p.idx === -1) return readCell(p.cell);
    const arr = p.cell.arr;
    if (!arr) return 0;
    const c = arr[p.idx];
    if (!c) return 0;
    return readCell(c);
  }
  evalLVal(e: ExprNode): { cell: Cell; idx?: number } {
    if (e.k === 'id') {
      const cell = this.scope.lookup(e.name);
      if (!cell) throw new CError(e.line, `정의되지 않은 변수 '${e.name}'`);
      if (cell.kind === 'arr') return { cell, idx: 0 };
      return { cell };
    }
    if (e.k === 'idx') {
      const base = this.evalExpr(e.a);
      const i = Math.trunc(this.evalNum(e.i));
      if (isPtr(base)) return { cell: base.cell, idx: base.idx + i };
      if (isArrCell(base)) return { cell: base, idx: i };
      throw new CError(e.line, '배열/포인터가 아닌 값에 인덱스 연산');
    }
    if (e.k === 'un' && e.op === '*') {
      const v = this.evalExpr(e.e);
      if (isPtr(v)) return v.idx === -1 ? { cell: v.cell } : { cell: v.cell, idx: v.idx };
      if (isArrCell(v)) return { cell: v, idx: 0 };
      throw new CError(e.line, '포인터가 아닌 값에 * 연산');
    }
    throw new CError(e.line, '대입 가능한 표현식(변수/배열 요소)이 필요합니다');
  }
  readLValNum(lv: { cell: Cell; idx?: number }): number {
    if (lv.idx === undefined) {
      const c = lv.cell;
      if (c.kind === 'arr') return 0;
      return c.ptr ? 0 : c.n;
    }
    const c = lv.cell.arr?.[lv.idx];
    if (!c || c.kind !== 'num') return 0;
    return c.ptr ? 0 : c.n;
  }
  writeLValNum(lv: { cell: Cell; idx?: number }, v: number, line: number) {
    if (lv.idx === undefined) {
      lv.cell.n = v;
      lv.cell.ptr = null;
      return;
    }
    const arr = lv.cell.arr;
    if (!arr)
      throw new CError(line, '배열이 아닌 값에 인덱스 쓰기');
    if (lv.idx < 0 || lv.idx >= arr.length)
      throw new CError(line, `배열 인덱스 범위 초과: ${lv.idx} (배열 크기 ${arr.length})`);
    const c = arr[lv.idx];
    c.n = v;
    c.ptr = null;
  }
  evalAssign(e: Extract<ExprNode, { k: 'assign' }>): Val {
    const lv = this.evalLVal(e.l);
    const rv = this.evalExpr(e.r);
    if (e.op === '=') {
      if (typeof rv === 'number') {
        this.writeLValNum(lv, rv, e.line);
        return rv;
      }
      if (lv.idx === undefined && lv.cell.kind === 'num') {
        if (isPtr(rv)) lv.cell.ptr = rv;
        else if (isArrCell(rv)) lv.cell.ptr = { cell: rv, idx: 0 };
        else throw new CError(e.line, '대입 불가능한 값');
        return rv;
      }
      throw new CError(e.line, '배열 요소에는 숫자만 대입할 수 있습니다');
    }
    const cur = this.readLValNum(lv);
    const n = this.numOf(rv);
    let out = cur;
    switch (e.op) {
      case '+=': out = cur + n; break;
      case '-=': out = cur - n; break;
      case '*=': out = cur * n; break;
      case '/=': out = cur / n; break;
      case '%=': out = Math.trunc(cur) % Math.trunc(n); break;
      case '^=': out = Math.trunc(cur) ^ Math.trunc(n); break;
    }
    this.writeLValNum(lv, out, e.line);
    return out;
  }

  call(e: Extract<ExprNode, { k: 'call' }>): Val {
    const args = e.args.map((a) => this.evalExpr(a));
    return this.callByName(e.f, args, e.line);
  }
  callByName(name: string, args: Val[], line: number): Val {
    const builtin = BUILTINS[name];
    if (builtin) return builtin(this, args);
    const fn = this.fns.get(name);
    if (!fn) throw new CError(line, `정의되지 않은 함수 '${name}'`);
    return this.callUser(name, args);
  }
  callUser(name: string, args: Val[]): Val {
    const fn = this.fns.get(name)!;
    if (args.length !== fn.params.length)
      throw new CError(0, `함수 ${name}: 인자 ${fn.params.length}개 필요, ${args.length}개 전달됨`);
    const prev = this.scope;
    const s = new Scope(this.global);
    this.scope = s;
    try {
      fn.params.forEach((p, i) => {
        const v = args[i];
        let cell: Cell;
        if (isPtr(v)) {
          cell = numCell(0);
          cell.ptr = v;
        } else if (isArrCell(v)) {
          cell = numCell(0);
          cell.ptr = { cell: v, idx: 0 };
        } else {
          cell = numCell(v);
        }
        s.declare(p, cell);
      });
      try {
        this.execStmt(fn.body);
      } catch (e) {
        if (e instanceof RetSignal) return e.v ?? 0;
        throw e;
      }
      return 0;
    } finally {
      this.scope = prev;
    }
  }

  /* ---------- printf ---------- */
  print(fmt: string, args: Val[]) {
    if (this.outputFull) return;
    const f = fmt.replace(/%%/g, '\u0001');
    const re = /%([-+0 ]*)(\d*)(?:\.(\d+))?([hljzt]*)([diufFcxsXeEg])/g;
    let out = '';
    let ai = 0;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f))) {
      out += f.slice(last, m.index);
      last = re.lastIndex;
      const flag = m[1];
      const widthS = m[2];
      const precS = m[3];
      const spec = m[5];
      const width = widthS ? parseInt(widthS, 10) : 0;
      const prec = precS !== undefined ? parseInt(precS, 10) : 6;
      if (ai >= args.length) throw new CError(0, 'printf 인자 부족');
      const arg = args[ai++];
      out += formatOne(spec, arg, flag, width, prec);
    }
    out += f.slice(last);
    this.output += out.replace(/\u0001/g, '%');
    if (this.output.length > 30000) {
      this.output = this.output.slice(0, 30000) + '\n... (출력 제한)';
      this.outputFull = true;
    }
  }
}

function padStr(s: string, width: number, flag: string): string {
  if (width <= s.length) return s;
  const pad = flag.includes('0') && !flag.includes('-') ? '0' : ' ';
  const p = pad.repeat(width - s.length);
  return flag.includes('-') ? s + p : p + s;
}

function formatOne(spec: string, arg: Val, flag: string, width: number, prec: number): string {
  switch (spec) {
    case 'd':
    case 'i': {
      const n = Math.trunc(derefAnyNum(arg));
      return padStr(String(n), width, flag);
    }
    case 'u': {
      const n = Math.trunc(derefAnyNum(arg)) >>> 0;
      return padStr(String(n), width, flag);
    }
    case 'x':
    case 'X': {
      const n = Math.trunc(derefAnyNum(arg)) >>> 0;
      const h = n.toString(16);
      return padStr(spec === 'X' ? h.toUpperCase() : h, width, flag);
    }
    case 'f':
    case 'F': {
      const n = derefAnyNum(arg);
      return padStr(n.toFixed(prec), width, flag);
    }
    case 'e':
    case 'E': {
      const n = derefAnyNum(arg);
      return padStr(n.toExponential(prec), width, flag);
    }
    case 'g': {
      const n = derefAnyNum(arg);
      let s = n === 0 ? '0' : n.toPrecision(Math.min(15, prec || 6));
      s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      return padStr(s, width, flag);
    }
    case 'c': {
      const n = derefAnyNum(arg) & 0xff;
      return padStr(String.fromCharCode(n), width, flag);
    }
    case 's': {
      const s = strRead(arg);
      return padStr(s, width, flag);
    }
  }
  return '';
}

function derefAnyNum(v: Val): number {
  if (typeof v === 'number') return v;
  if (isPtr(v)) return derefNum(v);
  if (isArrCell(v)) return 0;
  return 0;
}

/* ---------- 내장 함수 ---------- */
type BuiltinFn = (interp: CInterpreter, args: Val[]) => Val;

const BUILTINS: Record<string, BuiltinFn> = {
  printf: (i, args) => {
    if (args.length === 0) throw new CError(0, 'printf: 포맷 문자열 필요');
    i.print(strRead(args[0]), args.slice(1));
    return 0;
  },
  snprintf: (i, args) => {
    if (args.length < 3) throw new CError(0, 'snprintf: (버퍼, 크기, 포맷, ...) 필요');
    const dst = resolveArr(args[0], 'snprintf 대상');
    const fmt = strRead(args[2]);
    const save = i.output;
    const saveFull = i.outputFull;
    i.output = '';
    i.outputFull = false;
    i.print(fmt, args.slice(3));
    const s = i.output;
    i.output = save;
    i.outputFull = saveFull;
    for (let k = 0; k < s.length; k++) {
      const c = dst.cell.arr?.[dst.idx + k];
      if (c) {
        c.n = s.charCodeAt(k);
        c.ptr = null;
      }
    }
    const t = dst.cell.arr?.[dst.idx + s.length];
    if (t) {
      t.n = 0;
      t.ptr = null;
    }
    return s.length;
  },
  strlen: (_i, args) => strRead(args[0]).length,
  strcmp: (_i, args) => {
    const a = strRead(args[0]);
    const b = strRead(args[1]);
    return a < b ? -1 : a > b ? 1 : 0;
  },
  strncmp: (_i, args) => {
    const a = strRead(args[0]).slice(0, Math.trunc(derefAnyNum(args[2])));
    const b = strRead(args[1]).slice(0, Math.trunc(derefAnyNum(args[2])));
    return a < b ? -1 : a > b ? 1 : 0;
  },
  memcpy: (_i, args) => {
    const dst = resolveArr(args[0], 'memcpy 대상');
    const src = resolveArr(args[1], 'memcpy 원본');
    const n = Math.trunc(derefAnyNum(args[2]));
    for (let k = 0; k < n; k++) {
      const sc = src.cell.arr?.[src.idx + k];
      const dc = dst.cell.arr?.[dst.idx + k];
      if (dc && sc) {
        dc.n = sc.kind === 'num' ? sc.n : 0;
        dc.ptr = null;
      }
    }
    return args[0];
  },
  memset: (_i, args) => {
    const dst = resolveArr(args[0], 'memset 대상');
    const v = Math.trunc(derefAnyNum(args[1])) & 0xff;
    const n = Math.trunc(derefAnyNum(args[2]));
    for (let k = 0; k < n; k++) {
      const dc = dst.cell.arr?.[dst.idx + k];
      if (dc) {
        dc.n = v;
        dc.ptr = null;
      }
    }
    return args[0];
  },
  memcmp: (_i, args) => {
    const a = resolveArr(args[0], 'memcmp');
    const b = resolveArr(args[1], 'memcmp');
    const n = Math.trunc(derefAnyNum(args[2]));
    for (let k = 0; k < n; k++) {
      const ac = a.cell.arr?.[a.idx + k];
      const bc = b.cell.arr?.[b.idx + k];
      const av = ac && ac.kind === 'num' ? ac.n : 0;
      const bv = bc && bc.kind === 'num' ? bc.n : 0;
      if (av !== bv) return av < bv ? -1 : 1;
    }
    return 0;
  },
  fabs: (_i, args) => Math.abs(derefAnyNum(args[0])),
  abs: (_i, args) => Math.abs(Math.trunc(derefAnyNum(args[0]))),
  sqrt: (_i, args) => Math.sqrt(derefAnyNum(args[0])),
  sin: (_i, args) => Math.sin(derefAnyNum(args[0])),
  cos: (_i, args) => Math.cos(derefAnyNum(args[0])),
  tan: (_i, args) => Math.tan(derefAnyNum(args[0])),
  atan2: (_i, args) => Math.atan2(derefAnyNum(args[0]), derefAnyNum(args[1])),
  pow: (_i, args) => Math.pow(derefAnyNum(args[0]), derefAnyNum(args[1])),
  exp: (_i, args) => Math.exp(derefAnyNum(args[0])),
  log: (_i, args) => Math.log(derefAnyNum(args[0])),
  fmod: (_i, args) => derefAnyNum(args[0]) % derefAnyNum(args[1]),
  floor: (_i, args) => Math.floor(derefAnyNum(args[0])),
  ceil: (_i, args) => Math.ceil(derefAnyNum(args[0])),
  srand: (i, args) => {
    i.rng = Math.trunc(derefAnyNum(args[0])) & 0x7fffffff;
    return 0;
  },
  rand: (i) => {
    i.rng = (i.rng * 1103515245 + 12345) & 0x7fffffff;
    return (i.rng >> 16) & 0x7fff;
  },
};

function resolveArr(v: Val, what: string): { cell: Cell; idx: number } {
  if (isPtr(v)) return { cell: v.cell, idx: Math.max(0, v.idx) };
  if (isArrCell(v)) return { cell: v, idx: 0 };
  throw new CError(0, `${what}: 배열/포인터 필요`);
}

/* ---------- 공개 API ---------- */
export function runC(source: string): OfflineResult {
  let interp: CInterpreter | null = null;
  try {
    interp = new CInterpreter(source);
    interp.exec();
    return { ok: true, output: interp.output, steps: interp.steps };
  } catch (e) {
    if (e instanceof CError) {
      return {
        ok: false,
        output: interp?.output ?? '',
        steps: interp?.steps ?? 0,
        error: { line: e.line, message: e.message },
      };
    }
    return {
      ok: false,
      output: interp?.output ?? '',
      steps: interp?.steps ?? 0,
      error: { line: 0, message: '내부 오류: ' + (e as Error).message },
    };
  }
}
