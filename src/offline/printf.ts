import type { Val } from './values';
import { derefNum, isArrCell, isPtr, strRead } from './values';

export function padStr(s: string, width: number, flag: string): string {
  if (width <= s.length) return s;
  const pad = flag.includes('0') && !flag.includes('-') ? '0' : ' ';
  const p = pad.repeat(width - s.length);
  return flag.includes('-') ? s + p : p + s;
}

export function formatOne(spec: string, arg: Val, flag: string, width: number, prec: number): string {
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

export function derefAnyNum(v: Val): number {
  if (typeof v === 'number') return v;
  if (isPtr(v)) return derefNum(v);
  if (isArrCell(v)) return 0;
  return 0;
}
