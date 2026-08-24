/* ---------- AST ---------- */
export interface InitVal {
  kind: 'expr' | 'list' | 'str';
  expr?: ExprNode;
  list?: ExprNode[];
  str?: string;
}
export interface DeclItem {
  name: string;
  isPtr: boolean;
  dimExpr: ExprNode | null;
  init?: InitVal;
  line?: number;
  /* struct/union 선언인 경우 태그 이름 (structDefs 키) */
  aggTag?: string;
}
export type ExprNode =
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
  | { k: 'cast'; ty: string; e: ExprNode; line: number }
  | { k: 'member'; e: ExprNode; mname: string; arrow: boolean; line: number };

export type Stmt =
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

/* ---------- struct / union 정의 ---------- */
export interface AggMember {
  name: string;
  type: string;
  /* 멤버가 배열이면 요소 개수 */
  dim: number | null;
  /* 멤버 자신이 struct/union 이면 그 정의 키 */
  aggTag: string | null;
}
export interface AggDef {
  kind: 'struct' | 'union';
  members: AggMember[];
  size: number;
}
