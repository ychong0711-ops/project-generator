/* ---------- 내장 함수 ---------- */
import type { CInterpreter } from './interpreter';
import { CError } from './errors';
import { resolveArr, strRead } from './values';
import type { Val } from './values';
import { derefAnyNum } from './printf';

export type BuiltinFn = (interp: CInterpreter, args: Val[]) => Val;

export const BUILTINS: Record<string, BuiltinFn> = {
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
