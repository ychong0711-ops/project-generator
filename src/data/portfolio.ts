import { useSyncExternalStore } from 'react';
import type { Project } from '../types';
import { PROJECTS } from './projects';

/* ============================================================
 *  Portfolio Demo Studio — 데모 영상 링크·노트 관리
 *  — localStorage 영속 + useSyncExternalStore 실시간 갱신
 * ============================================================ */

export interface DemoVideo {
  id: string;
  title: string;
  url: string;
  projectIds: string[];
  notes: string;
  createdAt: number; // timestamp
}

export const DEMO_VIDEOS_KEY = 'autoembed-demo-studio';

/* ---------- 저장/로드 헬퍼 ---------- */

function isValidVideo(v: unknown): v is DemoVideo {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Partial<DemoVideo>;
  return (
    typeof d.id === 'string' &&
    typeof d.title === 'string' &&
    typeof d.url === 'string' &&
    Array.isArray(d.projectIds) &&
    d.projectIds.every((x) => typeof x === 'string') &&
    typeof d.notes === 'string' &&
    typeof d.createdAt === 'number'
  );
}

function loadVideos(): DemoVideo[] {
  try {
    const raw = localStorage.getItem(DEMO_VIDEOS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidVideo);
  } catch {
    return []; // JSON 손상 등 → 빈 상태로 복구
  }
}

/* ---------- 모듈 레벨 스토어 (apply.ts 패턴) ---------- */

let demoState: DemoVideo[] = loadVideos();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    localStorage.setItem(DEMO_VIDEOS_KEY, JSON.stringify(demoState));
  } catch {
    /* ignore — private mode 등 저장 실패는 무시 */
  }
}

function newId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** React 외부(테스트·스크립트)에서 쓰는 순수 스토어 조작 API */
export const demoStore = {
  get(): DemoVideo[] {
    return demoState;
  },
  add(video: Omit<DemoVideo, 'id' | 'createdAt'>): DemoVideo {
    const created: DemoVideo = { ...video, id: newId(), createdAt: Date.now() };
    demoState = [...demoState, created];
    persist();
    emit();
    return created;
  },
  remove(id: string): void {
    demoState = demoState.filter((v) => v.id !== id);
    persist();
    emit();
  },
  clear(): void {
    demoState = [];
    try {
      localStorage.removeItem(DEMO_VIDEOS_KEY);
    } catch {
      /* ignore */
    }
    emit();
  },
};

/* ---------- LocalStorage Hook ---------- */

export function useDemoVideos(): {
  videos: DemoVideo[];
  add: (video: Omit<DemoVideo, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  clear: () => void;
} {
  const videos = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => demoState
  );

  return {
    videos,
    add: (video) => {
      demoStore.add(video);
    },
    remove: demoStore.remove,
    clear: demoStore.clear,
  };
}

/* ---------- 데이터 헬퍼: 데모 스크립트 생성 ---------- */

/**
 * 데모 영상 소개글(스크립트) 초안 생성
 * — 영상 제목 + 연결된 프로젝트(PROJECTS)의 코드/설명/기술 스택 기반
 */
export function generateDemoScript(demo: DemoVideo): string {
  const linked = demo.projectIds
    .map((id) => PROJECTS.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);

  const lines: string[] = [];
  lines.push(`안녕하세요! 이 영상은 "${demo.title}" 시연 영상입니다.`);

  if (linked.length === 0) {
    lines.push('직접 설계·구현한 자동차 임베디드 프로젝트의 동작 과정을 담았습니다.');
  } else {
    const totalWeeks = linked.reduce((sum, p) => sum + p.weeks, 0);
    lines.push(`총 ${linked.length}개 프로젝트(누적 약 ${totalWeeks}주)를 직접 설계·구현한 결과물입니다.`);

    for (const p of linked) {
      const hw = p.mcu[0] ? `하드웨어는 ${p.mcu[0]}` : '';
      const sw = p.sw[0] ? `${p.sw[0]} 기반` : '';
      const stack = [hw, sw].filter(Boolean).join(', ');
      lines.push(`[${p.code}] ${p.titleEn} — ${p.tagline}${stack ? ` (${stack})` : ''}`);
    }

    const skills = [...new Set(linked.flatMap((p) => p.skills))].slice(0, 6);
    if (skills.length > 0) {
      lines.push(`핵심 기술: ${skills.join(', ')}`);
    }
  }

  if (demo.notes.trim()) {
    lines.push(demo.notes.trim());
  }
  lines.push('전체 설계 문서와 소스 코드는 GitHub 리포지토리에 정리되어 있습니다. 시청해 주셔서 감사합니다!');

  return lines.join('\n');
}
