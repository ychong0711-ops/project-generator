/* ---------- 런타임 값 ---------- */
import { CError } from './errors';

export interface Ptr {
  cell: Cell;
  idx: number; /* -1 이면 스칼라 셀 직접 */
}
export interface Cell {
  kind: 'num' | 'arr' | 'struct';
  n: number;
  ptr: Ptr | null;
  arr: Cell[] | null;
  isStr: boolean;
  structDef?: string; /* struct/union 정의 키 참조 */
  fields?: Map<string, Cell>; /* struct/union 멤버 저장소 */
}
export type Val = number | Ptr | Cell;

export function numCell(n: number): Cell {
  return { kind: 'num', n, ptr: null, arr: null, isStr: false };
}
export function arrCell(items: Cell[], isStr = false): Cell {
  return { kind: 'arr', n: 0, ptr: null, arr: items, isStr };
}
export function isCell(v: Val): v is Cell {
  return typeof v !== 'number' && (v as Cell).kind !== undefined;
}
export function isPtr(v: Val): v is Ptr {
  return typeof v !== 'number' && !isCell(v) && (v as Ptr).cell !== undefined;
}
export function isArrCell(v: Val): v is Cell {
  return isCell(v) && v.kind === 'arr';
}
export function isStructCell(v: Val): v is Cell {
  return isCell(v) && v.kind === 'struct';
}
export function readCell(cell: Cell): Val {
  if (cell.kind === 'arr') return { cell, idx: 0 };
  if (cell.kind === 'struct') return cell;
  return cell.ptr ?? cell.n;
}
export function derefNum(p: Ptr): number {
  const c = p.idx === -1 ? p.cell : p.cell.arr ? p.cell.arr[p.idx] : null;
  if (!c) return 0;
  if (c.kind === 'arr') return 0;
  return c.ptr ? 0 : c.n;
}
export function strFrom(v: Val): { cell: Cell; start: number } {
  if (isPtr(v)) return { cell: v.cell, start: Math.max(0, v.idx) };
  if (isArrCell(v)) return { cell: v, start: 0 };
  throw new CError(0, '문자열이 필요한 위치에 숫자가 있습니다');
}
export function strRead(v: Val): string {
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

export function resolveArr(v: Val, what: string): { cell: Cell; idx: number } {
  if (isPtr(v)) return { cell: v.cell, idx: Math.max(0, v.idx) };
  if (isArrCell(v)) return { cell: v, idx: 0 };
  throw new CError(0, `${what}: 배열/포인터 필요`);
}
