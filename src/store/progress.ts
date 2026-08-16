import { useSyncExternalStore } from 'react';
import type { Project } from '../types';
import { recordActivity } from './activity';

const KEY = 'autoembed-project-progress';

export type ProgressMap = Record<string, string[]>;

function load(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

let state: ProgressMap = load();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): ProgressMap {
  return state;
}

/** 태스크 키: 목표 g0.., 주차 태스크 m{week}-{idx}, 산출물 d0.. */
export function toggleTask(projectId: string, key: string) {
  recordActivity();
  const cur = state[projectId] ?? [];
  const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
  state = { ...state, [projectId]: next };
  persist();
  emit();
}

export function resetProject(projectId: string) {
  const next = { ...state };
  delete next[projectId];
  state = next;
  persist();
  emit();
}

/** 전체 진행 맵 구독 (여러 컴포넌트 간 실시간 동기화) */
export function useAllProgress(): ProgressMap {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** 훅 없이 현재 진행 맵 읽기 (순수 함수 내 계산용) */
export function getProgressMap(): ProgressMap {
  return state;
}

/** 특정 프로젝트의 진행 상태 */
export function useProjectProgress(projectId: string) {
  const map = useAllProgress();
  const done = map[projectId] ?? [];
  const isDone = (key: string) => done.includes(key);
  return { done, isDone, toggle: (key: string) => toggleTask(projectId, key) };
}

/** 프로젝트의 전체 체크 항목 수 */
export function projectTotal(p: Project): number {
  return p.goals.length + p.deliverables.length + p.milestones.reduce((a, m) => a + m.tasks.length, 0);
}

/** 완료된 체크 항목 수 */
export function projectDoneCount(p: Project, done: string[]): number {
  let c = 0;
  p.goals.forEach((_, i) => {
    if (done.includes(`g${i}`)) c++;
  });
  p.deliverables.forEach((_, i) => {
    if (done.includes(`d${i}`)) c++;
  });
  p.milestones.forEach((m, mi) =>
    m.tasks.forEach((_, ti) => {
      if (done.includes(`m${mi}-${ti}`)) c++;
    })
  );
  return c;
}
