/* ============================================================
 *  localStorage 중앙 레지스트리
 *  - R3: 용량 초과 시 조용한 데이터 손실 방지 (쓰기 결과를 호출자에게 알림)
 *  - R9: 백업 복원 시 스키마 검증
 * ============================================================ */

// 앱 전체에서 사용하는 모든 localStorage 키 상수 정의
export const AUTOEMBED_SAVED_PROJECTS = 'autoembed-saved-projects';
export const AUTOEMBED_PROJECT_PROGRESS = 'autoembed-project-progress';
export const AUTOEMBED_ACTIVITY = 'autoembed-activity';
export const AUTOEMBED_EVENTS = 'autoembed-events';
export const AUTOEMBED_DIAGNOSIS = 'autoembed-diagnosis';
export const AUTOEMBED_INTERVIEW_STATS = 'autoembed-interview-stats';
export const AUTOEMBED_GERMAN_STATS = 'autoembed-german-stats';
export const AUTOEMBED_CHECKLIST = 'autoembed-checklist';
export const AUTOEMBED_DEADLINE = 'autoembed-deadline';
export const AUTOEMBED_LAB_SOLVED = 'autoembed-lab-solved';
export const AUTOEMBED_REPO_SOLVED = 'autoembed-repo-solved';
export const AUTOEMBED_CUSTOM_LABS = 'autoembed-custom-labs';
export const AUTOEMBED_APPLY = 'autoembed-apply';
export const AUTOEMBED_BACKUP = 'autoembed-backup';

/** 앱이 사용하는 모든 키의 공통 접두사 */
export const KEY_PREFIX = 'autoembed-';

// 동적 키 생성 함수
export const codeKey = (projectId: string) => `${KEY_PREFIX}code-${projectId}`;
export const strategyKey = (uniId: string) => `${KEY_PREFIX}strategy-uni-${uniId}`;

/** localStorage 사용 가능 여부 (SSR·프라이빗 모드 대비) */
export function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** JSON 안전 읽기 — 파싱 실패/미존재 시 fallback 반환 */
export function safeGet<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unavailable' | 'error'; message: string };

/**
 * JSON 안전 쓰기.
 * 실패를 조용히 삼키지 않고 결과를 반환하므로, 호출자가 사용자에게 알릴 수 있다.
 */
export function safeSet(key: string, value: unknown): WriteResult {
  if (!storageAvailable()) {
    return { ok: false, reason: 'unavailable', message: '이 브라우저에서는 저장소를 사용할 수 없습니다.' };
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    const err = e as { name?: string; code?: number };
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;
    return isQuota
      ? {
          ok: false,
          reason: 'quota',
          message: '저장 공간이 가득 찼습니다. 백업 후 오래된 데이터를 정리하세요.',
        }
      : { ok: false, reason: 'error', message: (e as Error).message };
  }
}

/** 앱이 사용하는 모든 키 목록 */
export function allKeys(): string[] {
  if (!storageAvailable()) return [];
  return Object.keys(localStorage).filter((k) => k.startsWith(KEY_PREFIX));
}

/**
 * 대략적인 저장소 사용량(바이트, UTF-16 기준 2배 근사)과 임계치 초과 여부.
 * 대부분의 브라우저 상한은 약 5MB 이다.
 */
const APPROX_LIMIT_BYTES = 5 * 1024 * 1024;

export function checkStorageQuota(threshold = 0.8): {
  usedBytes: number;
  limitBytes: number;
  ratio: number;
  nearLimit: boolean;
} {
  let usedBytes = 0;
  if (storageAvailable()) {
    for (const k of Object.keys(localStorage)) {
      usedBytes += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
  }
  const ratio = usedBytes / APPROX_LIMIT_BYTES;
  return { usedBytes, limitBytes: APPROX_LIMIT_BYTES, ratio, nearLimit: ratio >= threshold };
}

/* ---------------- 백업 / 복원 (R9: 스키마 검증) ---------------- */

export interface BackupPayload {
  app: 'autoembed-lab';
  version: 1;
  exportedAt: string;
  /** 키 → 원본 문자열 (그대로 보관해야 왕복 시 값이 변형되지 않는다) */
  data: Record<string, string>;
}

export function buildBackup(): BackupPayload {
  const data: Record<string, string> = {};
  for (const k of allKeys()) {
    const raw = localStorage.getItem(k);
    if (raw !== null) data[k] = raw;
  }
  return { app: 'autoembed-lab', version: 1, exportedAt: new Date().toISOString(), data };
}

/** 백업 JSON 검증 — 형식이 맞지 않으면 null */
export function parseBackup(text: string): BackupPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Partial<BackupPayload> & { data?: unknown };
  if (p.app !== 'autoembed-lab') return null;
  if (typeof p.data !== 'object' || p.data === null || Array.isArray(p.data)) return null;

  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.data as Record<string, unknown>)) {
    if (!k.startsWith(KEY_PREFIX)) continue;
    // 구버전 백업은 파싱된 값을 담고 있었으므로 문자열로 정규화한다.
    data[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return {
    app: 'autoembed-lab',
    version: 1,
    exportedAt: typeof p.exportedAt === 'string' ? p.exportedAt : new Date().toISOString(),
    data,
  };
}

/** 백업 복원 — 복원된 키 수와 실패 목록 반환 */
export function restoreBackup(payload: BackupPayload): { restored: number; failed: string[] } {
  const failed: string[] = [];
  let restored = 0;
  for (const [k, raw] of Object.entries(payload.data)) {
    try {
      localStorage.setItem(k, raw);
      restored++;
    } catch {
      failed.push(k);
    }
  }
  return { restored, failed };
}
