/* ---------- 런타임 값 ---------- */
import { CError } from './errors';

export type ScalarType =
  | 'i8'
  | 'u8'
  | 'i16'
  | 'u16'
  | 'i32'
  | 'u32'
  | 'f32'
  | 'f64'
  | 'ptr';

export function sizeofScalar(t: ScalarType): number {
  switch (t) {
    case 'i8':
    case 'u8':
      return 1;
    case 'i16':
    case 'u16':
      return 2;
    case 'i32':
    case 'u32':
    case 'f32':
    case 'ptr':
      return 4;
    case 'f64':
      return 8;
  }
}

export interface ByteSlice {
  buffer: Uint8Array;
  view: DataView;
  offset: number;
  type: ScalarType;
  dim?: number | null;
  stride?: number;
}

export function readByteSlice(slice: ByteSlice, elemIdx = 0): number {
  const byteOffset = slice.offset + elemIdx * (slice.stride ?? sizeofScalar(slice.type));
  if (byteOffset < 0 || byteOffset >= slice.view.byteLength) return 0;
  const v = slice.view;
  switch (slice.type) {
    case 'i8':
      return v.getInt8(byteOffset);
    case 'u8':
      return v.getUint8(byteOffset);
    case 'i16':
      return v.getInt16(byteOffset, true);
    case 'u16':
      return v.getUint16(byteOffset, true);
    case 'i32':
      return v.getInt32(byteOffset, true);
    case 'u32':
      return v.getUint32(byteOffset, true);
    case 'f32':
      return v.getFloat32(byteOffset, true);
    case 'f64':
      return v.getFloat64(byteOffset, true);
    case 'ptr':
      return v.getUint32(byteOffset, true);
    default:
      return v.getInt32(byteOffset, true);
  }
}

export function writeByteSlice(slice: ByteSlice, val: number, elemIdx = 0): void {
  const stride = slice.stride ?? sizeofScalar(slice.type);
  const byteOffset = slice.offset + elemIdx * stride;
  if (byteOffset < 0 || byteOffset >= slice.view.byteLength) return;
  const v = slice.view;
  switch (slice.type) {
    case 'i8':
      v.setInt8(byteOffset, Math.trunc(val));
      break;
    case 'u8':
      v.setUint8(byteOffset, Math.trunc(val) & 0xff);
      break;
    case 'i16':
      v.setInt16(byteOffset, Math.trunc(val), true);
      break;
    case 'u16':
      v.setUint16(byteOffset, Math.trunc(val) & 0xffff, true);
      break;
    case 'i32':
      v.setInt32(byteOffset, Math.trunc(val), true);
      break;
    case 'u32':
      v.setUint32(byteOffset, (Math.trunc(val) >>> 0), true);
      break;
    case 'f32':
      v.setFloat32(byteOffset, val, true);
      break;
    case 'f64':
      v.setFloat64(byteOffset, val, true);
      break;
    case 'ptr':
      v.setUint32(byteOffset, (Math.trunc(val) >>> 0), true);
      break;
    default:
      v.setInt32(byteOffset, Math.trunc(val), true);
      break;
  }
}

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
  /* 정밀 바이트 메모리 모델용 필드 */
  byteSlice?: ByteSlice;
  rawBuffer?: Uint8Array;
  rawView?: DataView;
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
  if (cell.byteSlice) return readByteSlice(cell.byteSlice, 0);
  return cell.ptr ?? cell.n;
}
export function derefNum(p: Ptr): number {
  if (p.idx === -1) {
    if (p.cell.byteSlice) return readByteSlice(p.cell.byteSlice, 0);
    return p.cell.ptr ? 0 : p.cell.n;
  }
  if (p.cell.byteSlice && p.cell.byteSlice.dim !== undefined) {
    return readByteSlice(p.cell.byteSlice, p.idx);
  }
  const c = p.cell.arr ? p.cell.arr[p.idx] : null;
  if (!c) return 0;
  if (c.kind === 'arr') return 0;
  if (c.byteSlice) return readByteSlice(c.byteSlice, 0);
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
