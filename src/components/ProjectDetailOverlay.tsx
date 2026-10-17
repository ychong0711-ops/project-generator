import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../types';
import ProjectCard from './ProjectCard';

/* ============================================================
 *  프로젝트 상세 오버레이 (드로어/모달)
 *  - phase 무관: 어느 단계에서든 저장 프로젝트 상세를 연다.
 *  - ProjectCard 를 그대로 재사용한다(중복 구현 없음).
 *  - 긴 콘텐츠를 위해 패널 내부 스크롤 + 상단 고정 헤더(제목·닫기).
 * ============================================================ */

interface ProjectDetailOverlayProps {
  project: Project;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ProjectDetailOverlay({
  project,
  saved,
  onToggleSave,
  onClose,
}: ProjectDetailOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  /* 열릴 때: 이전 포커스 기억 → 닫기 버튼으로 포커스 이동.
     닫힐 때: 이전 포커스 요소로 복귀. */
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      const el = restoreRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) {
        el.focus({ preventScroll: true });
      }
    };
  }, []);

  /* Esc 로 닫기. 단, 패널 밖(중첩 다이얼로그 등)에 포커스가 있으면 양보한다. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const panel = panelRef.current;
      const active = document.activeElement;
      const ours = !panel || !active || active === document.body || panel.contains(active);
      if (ours) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* 포커스 트랩: 패널 안에서 Tab/Shift+Tab 이 순환하도록 한다. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement;
      if (active && active !== document.body && !panel.contains(active)) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || active === panel || !active || active === document.body) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* body 스크롤 락 — 원래 overflow 값을 보존했다가 원복한다. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* Portal 로 document.body 에 렌더 — 부모의 transform/overflow 컨텍스트에서 벗어난다. */
  return createPortal(
    <div
      data-testid="overlay-backdrop"
      className="fixed inset-0 z-50 flex justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={project.title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col overflow-y-auto overscroll-contain border border-white/10 bg-[#0b0f16] shadow-2xl shadow-black/60 outline-none sm:m-6 sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl"
      >
        {/* 상단 고정 헤더 — 긴 스크롤에서도 제목과 닫기를 유지 */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#0b0f16]/95 px-4 py-3 backdrop-blur-xl sm:px-5 sm:rounded-t-2xl">
          <span className="shrink-0 rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] font-bold tracking-widest text-slate-400">
            {project.code}
          </span>
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-white sm:text-base">
            {project.title}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 focus-visible:border-amber-400/50"
          >
            닫기 ✕
          </button>
        </div>

        <div className="p-3 sm:p-5">
          <ProjectCard project={project} saved={saved} onToggleSave={onToggleSave} />
        </div>
      </div>
    </div>,
    document.body
  );
}
