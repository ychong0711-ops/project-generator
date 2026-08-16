import { useSyncExternalStore } from 'react';
import { AUTOEMBED_ACTIVITY, AUTOEMBED_EVENTS, safeGet, safeSet } from '../utils/storage';

/* ============================================================
 *  학습 활동 추적 — 연속 기록(스트릭)·활동일 계산
 *  체크/빌드/실행/면접 답변 등 모든 액션이 여기에 기록됨
 * ============================================================ */

const KEY = AUTOEMBED_ACTIVITY;

function load(): string[] {
  const v = safeGet<unknown>(KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

let state: string[] = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  safeSet(KEY, state);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): string[] {
  return state;
}

export function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 하루에 한 번만 기록 (날짜 중복 방지) */
export function recordActivity(): void {
  const d = ymdOf(new Date());
  if (!state.includes(d)) {
    state = [...state, d];
    persist();
    emit();
  }
}

export function useActivity(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** 오늘 포함 연속 활동 일수 (오늘 미활동이면 어제 기준으로 계산) */
export function calcStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  if (!set.has(ymdOf(d))) d.setDate(d.getDate() - 1);
  while (set.has(ymdOf(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** 최근 n일의 활동 여부 (오늘부터 과거순) */
export function recentActivity(dates: string[], n: number): { date: Date; active: boolean }[] {
  const set = new Set(dates);
  const out: { date: Date; active: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ date: d, active: set.has(ymdOf(d)) });
  }
  return out;
}

/* ---------- 일회성 이벤트 (배지 판정용) ---------- */
const EV_KEY = AUTOEMBED_EVENTS;

function loadEvents(): string[] {
  const v = safeGet<unknown>(EV_KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

let evState: string[] = loadEvents();
const evListeners = new Set<() => void>();
const evEmit = () => evListeners.forEach((l) => l());

export function recordEvent(id: string): void {
  if (!evState.includes(id)) {
    evState = [...evState, id];
    safeSet(EV_KEY, evState);
    evEmit();
  }
}

export function useEvents(): string[] {
  return useSyncExternalStore(
    (fn) => {
      evListeners.add(fn);
      return () => {
        evListeners.delete(fn);
      };
    },
    () => evState
  );
}
