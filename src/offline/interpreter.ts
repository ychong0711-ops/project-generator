/* ============================================================
 *  AutoEmbed Offline C Engine
 *  — 네트워크 없이 브라우저에서 C 서브셋 코드를 실행하는 인터프리터
 *
 *  지원: int/double/char, 배열, 포인터(기본), 함수, if/for/while/
 *        do-while/switch, printf(%d %u %x %X %f %.2f %e %g %c %s,
 *        폭/정밀도/0패딩), 수학/문자열/메모리 내장 함수,
 *        struct/union/enum/typedef(기본), 멤버 접근(. 및 ->)
 *  미지원: 2차원 배열, 구조체 값 대입/반환 — 미지원 문법은
 *          명확한 오류 메시지로 안내
 * ============================================================ */

import { BrkSignal, ContSignal, CError, RetSignal } from './errors';
import {
  arrCell,
  derefNum,
  isArrCell,
  isPtr,
  isStructCell,
  numCell,
  readCell,
} from './values';
import type { Cell, Ptr, Val } from './values';
import { TYPE_WORDS, preprocess, tokenize } from './lexer';
import type { Tok } from './lexer';
import type { AggDef, AggMember, DeclItem, ExprNode, Stmt } from './ast';
import { formatOne } from './printf';
import { BUILTINS } from './builtins';

export interface OfflineResult {
  ok: boolean;
  output: string;
  steps: number;
  error?: { line: number; message: string };
  /* 실행을 막지는 않지만 결과를 신뢰하기 전에 알아야 할 사항 */
  warnings?: string[];
}

/* 오프라인 엔진의 union은 "스칼라 멤버가 하나의 저장소를 공유"하는 근사 구현이다.
 * 같은 크기의 정수 계열끼리는 대체로 맞지만, 바이트 오버레이(예: union {int w; char b[4];})나
 * 타입 재해석(예: union {float f; int i;})은 실제 C와 다른 값을 낼 수 있다. */
export const UNION_APPROX_WARNING =
  'union은 오프라인 엔진에서 근사 구현입니다(스칼라 멤버가 저장소를 공유). ' +
  '바이트 오버레이나 타입 재해석 결과는 실제 C와 다를 수 있으니 온라인 모드로 검증하세요.';

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

export class CInterpreter {
  toks: Tok[] = [];
  pos = 0;
  fns = new Map<string, { params: string[]; body: Stmt }>();
  global: Scope = new Scope(null);
  scope: Scope = this.global;
  output = '';
  outputFull = false;
  warnings: string[] = [];
  steps = 0;
  rng = 12345;
  globals: { ty: string; items: DeclItem[]; line: number }[] = [];
  typedefNames = new Set<string>();
  /* struct/union 정의: 키는 'struct <tag>' / 'union <tag>' 또는 typedef 별칭 */
  structDefs = new Map<string, AggDef>();
  /* 가장 최근에 파싱한 타입의 struct/union 태그 (parseType의 부가 출력) */
  lastAggTag: string | null = null;
  anonSeq = 0;

  constructor(src: string) {
    const { code } = preprocess(src);
    this.toks = tokenize(code);
    this.global.vars.set('true', numCell(1));
    this.global.vars.set('false', numCell(0));
    this.parseProgram();
  }

  /* 같은 경고는 한 번만 쌓는다 */
  warn(message: string) {
    if (!this.warnings.includes(message)) this.warnings.push(message);
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
    if (this.cur().t !== 'id') return false;
    const v = this.cur().v;
    return TYPE_WORDS.has(v) || this.typedefNames.has(v) || v === 'struct' || v === 'union' || v === 'enum';
  }
  /* 타입을 소비하고 'int'|'double'|'char'|'void'|'struct'|'union'|'enum' 반환.
     struct/union 이면 this.lastAggTag 에 정의 키를 기록한다. */
  parseType(): string {
    this.lastAggTag = null;
    const c = this.cur();
    /* struct Tag / union Tag */
    if (c.t === 'id' && (c.v === 'struct' || c.v === 'union')) {
      const kw = this.next().v as 'struct' | 'union';
      if (this.cur().t !== 'id') throw new CError(this.cur().line, `${kw} 태그 이름 필요`);
      const tag = this.next().v;
      const key = `${kw} ${tag}`;
      if (!this.structDefs.has(key)) throw new CError(this.cur().line, `알려진 ${kw} '${tag}'가 없습니다`);
      this.lastAggTag = key;
      return kw;
    }
    if (c.t === 'id' && c.v === 'enum') {
      this.next();
      if (this.cur().t === 'id') this.next(); /* 태그 이름 */
      return 'int';
    }
    /* typedef 별칭 */
    if (c.t === 'id' && this.typedefNames.has(c.v) && !TYPE_WORDS.has(c.v)) {
      const name = this.next().v;
      const def = this.structDefs.get(name);
      if (def) {
        this.lastAggTag = name;
        return def.kind;
      }
      return 'int';
    }
    const words = new Set<string>();
    while (this.cur().t === 'id' && (TYPE_WORDS.has(this.cur().v) || this.typedefNames.has(this.cur().v))) {
      words.add(this.next().v);
    }
    if (words.size === 0) throw new CError(this.cur().line, '타입 키워드 필요');
    if (words.has('double') || words.has('float')) return 'double';
    if (words.has('void')) return 'void';
    if (words.has('char')) return 'char';
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

  /* struct/union 멤버 목록 파싱: '{' 부터 '}' 까지 */
  parseAggMembers(): AggMember[] {
    this.eat('{');
    const members: AggMember[] = [];
    while (!this.isOp('}')) {
      if (this.cur().v === '<eof>') throw new CError(this.cur().line, '닫는 } 가 없습니다');
      const mtype = this.parseType();
      const memberAgg = this.lastAggTag;
      for (;;) {
        const isPtrMember = this.isOp('*') ? (this.next(), true) : false;
        const mname = this.expectId();
        let dim: number | null = null;
        if (this.isOp('[')) {
          this.next();
          dim = Math.max(0, Math.trunc(this.foldConst(this.parseExpr())));
          this.eat(']');
        }
        members.push({
          name: mname,
          type: isPtrMember ? 'ptr' : mtype,
          dim,
          aggTag: isPtrMember ? null : memberAgg,
        });
        if (!this.isOp(',')) break;
        this.next();
      }
      this.eat(';'); /* 각 멤버 선언 뒤의 세미콜론 */
    }
    this.eat('}');
    return members;
  }

  /* 'struct'/'union' 키워드로 시작하는 최상위 정의 또는 변수 선언 */
  parseAggTopLevel(kw: 'struct' | 'union', isTypedef = false): boolean {
    /* 정의가 아닌 변수 선언(struct foo x;)이면 false 반환 후 호출자가 처리 */
    const save = this.pos;
    this.next(); /* struct|union */
    let tag = '';
    if (this.cur().t === 'id') tag = this.next().v;
    if (!this.isOp('{')) {
      this.pos = save;
      return false;
    }
    const members = this.parseAggMembers();
    const size = kw === 'union'
      ? Math.max(4, ...members.map((m) => 4 * (m.dim ?? 1)))
      : members.reduce((acc, m) => acc + 4 * (m.dim ?? 1), 0);
    const def: AggDef = { kind: kw, members, size };
    const key = tag ? `${kw} ${tag}` : `${kw} <anon${this.anonSeq++}>`;
    this.structDefs.set(key, def);
    if (this.cur().t === 'id') {
      const trailing = this.next().v;
      if (isTypedef) {
        /* typedef struct { ... } Alias; */
        this.typedefNames.add(trailing);
        this.structDefs.set(trailing, def);
      } else {
        /* struct Tag { ... } gvar; — 전역 변수 선언 */
        const line = this.cur().line;
        const items = this.parseDeclRest(trailing, false);
        for (const it of items) {
          it.aggTag = key;
          it.line = line;
        }
        this.globals.push({ ty: kw, items, line });
      }
    }
    this.eat(';');
    return true;
  }

  parseProgram() {
    while (this.cur().v !== '<eof>') {
      const line = this.cur().line;
      if (this.cur().t === 'id' && this.cur().v === 'typedef') {
        this.next();
        const kw = this.cur().v;
        if (this.cur().t === 'id' && kw === 'enum') {
          this.parseTypedefEnum();
          continue;
        }
        if (this.cur().t === 'id' && (kw === 'struct' || kw === 'union')) {
          if (this.parseAggTopLevel(kw as 'struct' | 'union', true)) continue;
          /* typedef struct Tag Alias; — 기존 정의의 별칭 */
          this.next(); /* struct|union */
          const tag = this.expectId();
          const alias = this.expectId();
          this.eat(';');
          const def = this.structDefs.get(`${kw} ${tag}`);
          if (!def) throw new CError(line, `알려진 ${kw} '${tag}'가 없습니다`);
          this.typedefNames.add(alias);
          this.structDefs.set(alias, def);
          continue;
        }
        /* typedef <기본타입> Alias; (예: typedef unsigned int u32;) */
        this.parseType();
        while (this.isOp('*')) this.next();
        const alias = this.expectId();
        this.eat(';');
        this.typedefNames.add(alias);
        continue;
      }
      if (this.cur().t === 'id' && (this.cur().v === 'struct' || this.cur().v === 'union')) {
        if (this.parseAggTopLevel(this.cur().v as 'struct' | 'union')) continue;
        /* 정의가 아니면 아래 일반 선언 경로로 진행 */
      }
      if (this.cur().t === 'id' && this.cur().v === 'enum' && this.toks[this.pos + 1]?.v !== '<eof>') {
        /* enum 정의: enum [Tag] { ... } [Alias];  — 값들을 전역 상수로 등록 */
        const save = this.pos;
        this.next();
        if (this.cur().t === 'id') this.next();
        if (this.isOp('{')) {
          this.next();
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
          if (this.cur().t === 'id') this.typedefNames.add(this.next().v);
          this.eat(';');
          continue;
        }
        this.pos = save; /* enum Tag var; — 일반 선언 */
      }
      if (this.cur().t === 'id' && this.cur().v === 'goto') {
        throw new CError(line, `'goto'는 오프라인 모드에서 지원하지 않습니다.`);
      }
      const gty = this.parseType();
      const gTag = this.lastAggTag;
      const isPtr = this.isOp('*') ? (this.next(), true) : false;
      const name = this.expectId();
      if ((gty === 'struct' || gty === 'union') && !this.isOp('(')) {
        const items = this.parseDeclRest(name, isPtr);
        for (const it of items) {
          if (!isPtr) it.aggTag = gTag!;
          it.line = line;
        }
        this.eat(';');
        this.globals.push({ ty: gty, items, line });
        continue;
      }
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
      const item: DeclItem = { name, isPtr: curPtr, dimExpr: null, line: this.cur().line };
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
      /* 지역 struct/union 정의: struct Tag { ... }; */
      if ((c.v === 'struct' || c.v === 'union') && this.toks[this.pos + 2]?.v === '{') {
        this.parseAggTopLevel(c.v as 'struct' | 'union');
        return { k: 'empty', line };
      }
      if (this.isTypeStart()) {
        const ty = this.parseType();
        const aggTag = this.lastAggTag;
        if (ty === 'void') throw new CError(line, 'void 변수는 선언할 수 없습니다');
        const isPtr = this.isOp('*') ? (this.next(), true) : false;
        const name = this.expectId();
        const items = this.parseDeclRest(name, isPtr);
        if ((ty === 'struct' || ty === 'union') && !isPtr) {
          for (const item of items) item.aggTag = aggTag!;
        }
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
    if (op.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^=', '|=', '&='].includes(op.v)) {
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
      if (this.isOp('.') || this.isOp('->')) {
        const arrow = this.cur().v === '->';
        this.next();
        if (this.cur().t !== 'id') throw new CError(line, '구조체 멤버명 필요');
        const mname = this.next().v;
        e = { k: 'member', e, mname, arrow, line };
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

  /* struct/union 인스턴스 셀 생성 */
  makeAggCell(tag: string, line: number): Cell {
    const def = this.structDefs.get(tag);
    if (!def) throw new CError(line, `알려진 struct/union '${tag}'가 없습니다`);
    const fields = new Map<string, Cell>();
    const cell: Cell = { kind: 'struct', n: 0, ptr: null, arr: null, isStr: false, structDef: tag, fields };
    /* union은 모든 스칼라 멤버가 같은 저장소를 공유한다 (근사 구현) */
    const shared = def.kind === 'union' ? numCell(0) : null;
    if (def.kind === 'union') this.warn(UNION_APPROX_WARNING);
    for (const m of def.members) {
      let mc: Cell;
      if (shared && m.dim === null && !m.aggTag) {
        fields.set(m.name, shared);
        continue;
      }
      if (m.dim !== null) {
        mc = arrCell(
          Array.from({ length: m.dim }, () =>
            m.aggTag ? this.makeAggCell(m.aggTag, line) : numCell(0)
          )
        );
      } else if (m.aggTag) {
        mc = this.makeAggCell(m.aggTag, line);
      } else {
        mc = numCell(0);
      }
      fields.set(m.name, mc);
    }
    return cell;
  }

  execDeclItem(item: DeclItem, scope: Scope) {
    let cell: Cell;
    /* struct/union 타입 변수 */
    if (item.aggTag) {
      const line = item.line ?? 0;
      if (item.dimExpr !== null) {
        const size = Math.max(0, Math.trunc(this.evalNum(item.dimExpr)));
        cell = arrCell(Array.from({ length: size }, () => this.makeAggCell(item.aggTag!, line)));
      } else {
        cell = this.makeAggCell(item.aggTag, line);
        if (item.init?.kind === 'list') {
          const def = this.structDefs.get(item.aggTag)!;
          const list = item.init.list ?? [];
          for (let i = 0; i < Math.min(list.length, def.members.length); i++) {
            const target = cell.fields!.get(def.members[i].name)!;
            const v = this.evalExpr(list[i]);
            if (isPtr(v)) target.ptr = v;
            else if (isArrCell(v)) target.ptr = { cell: v, idx: 0 };
            else if (isStructCell(v)) cell.fields!.set(def.members[i].name, v);
            else target.n = v;
          }
        } else if (item.init?.kind === 'expr') {
          const v = this.evalExpr(item.init.expr!);
          if (isStructCell(v)) cell = this.copyAggCell(v);
          else throw new CError(line, '구조체에는 구조체 값만 대입할 수 있습니다');
        }
      }
      scope.declare(item.name, cell);
      return;
    }
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

  /* struct 값 복사 (얕은 대입 의미론: 멤버 단위 값 복사) */
  copyAggCell(src: Cell): Cell {
    const fields = new Map<string, Cell>();
    const out: Cell = {
      kind: 'struct', n: 0, ptr: null, arr: null, isStr: false,
      structDef: src.structDef, fields,
    };
    src.fields?.forEach((v, k) => {
      if (v.kind === 'struct') fields.set(k, this.copyAggCell(v));
      else if (v.kind === 'arr') fields.set(k, arrCell((v.arr ?? []).map((c) => ({ ...c })), v.isStr));
      else fields.set(k, { ...v });
    });
    return out;
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
      case 'member':
        return readCell(this.resolveMemberCell(e));
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
  /* struct/union 멤버 셀 반환 (읽기/쓰기 공용) */
  resolveMemberCell(e: Extract<ExprNode, { k: 'member' }>): Cell {
    const base = this.evalExpr(e.e);
    let agg: Cell | null = null;
    if (isStructCell(base)) {
      agg = base;
    } else if (isPtr(base)) {
      const target = base.idx === -1 || base.idx === 0 ? base.cell : base.cell.arr?.[base.idx] ?? null;
      if (target && target.kind === 'struct') agg = target;
      else if (target && target.arr && target.arr[0]?.kind === 'struct') agg = target.arr[0];
      else if (base.cell.arr && base.cell.arr[Math.max(0, base.idx)]?.kind === 'struct')
        agg = base.cell.arr[Math.max(0, base.idx)];
      else if (base.cell.ptr) {
        const via = base.cell.ptr.cell;
        if (via.kind === 'struct') agg = via;
      }
    } else if (isArrCell(base)) {
      const first = base.arr?.[0];
      if (first && first.kind === 'struct') agg = first;
    }
    if (!agg) throw new CError(e.line, `${e.arrow ? '->' : '.'} 연산은 구조체/공용체에만 사용할 수 있습니다`);
    const cell = agg.fields?.get(e.mname);
    if (!cell) throw new CError(e.line, `구조체에 멤버 '${e.mname}'가 없습니다`);
    return cell;
  }

  evalLVal(e: ExprNode): { cell: Cell; idx?: number } {
    if (e.k === 'member') {
      const cell = this.resolveMemberCell(e);
      if (cell.kind === 'arr') return { cell, idx: 0 };
      return { cell };
    }
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
    /* 구조체 값 대입: 멤버 단위 복사 */
    if (e.op === '=' && lv.idx === undefined && lv.cell.kind === 'struct') {
      if (!isStructCell(rv)) throw new CError(e.line, '구조체에는 구조체 값만 대입할 수 있습니다');
      const copy = this.copyAggCell(rv);
      lv.cell.fields = copy.fields;
      return lv.cell;
    }
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
      case '|=': out = (Math.trunc(cur) | Math.trunc(n)) >>> 0; break;
      case '&=': out = (Math.trunc(cur) & Math.trunc(n)) >>> 0; break;
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

/* ---------- 공개 API ---------- */
export function runC(source: string): OfflineResult {
  let interp: CInterpreter | null = null;
  try {
    interp = new CInterpreter(source);
    interp.exec();
    return {
      ok: true,
      output: interp.output,
      steps: interp.steps,
      ...(interp.warnings.length > 0 ? { warnings: [...interp.warnings] } : {}),
    };
  } catch (e) {
    if (e instanceof CError) {
      return {
        ok: false,
        output: interp?.output ?? '',
        steps: interp?.steps ?? 0,
        error: { line: e.line, message: e.message },
        ...(interp && interp.warnings.length > 0 ? { warnings: [...interp.warnings] } : {}),
      };
    }
    return {
      ok: false,
      output: interp?.output ?? '',
      steps: interp?.steps ?? 0,
      error: { line: 0, message: '내부 오류: ' + (e as Error).message },
      ...(interp && interp.warnings.length > 0 ? { warnings: [...interp.warnings] } : {}),
    };
  }
}
