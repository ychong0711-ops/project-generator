import type { Project } from '../types';
import { genArchitectureSvg } from '../utils/diagram';
import { DownloadIcon } from './icons';

/* ============================================================
 *  아키텍처 다이어그램 — 프로젝트 하드웨어 구성 자동 도식화
 *  .svg 다운로드로 GitHub README에 바로 사용
 * ============================================================ */

export default function ArchitectureDiagram({ project }: { project: Project }) {
  const svg = genArchitectureSvg(project);

  const download = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}-architecture.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0f16]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-2.5">
        <p className="font-mono text-xs font-bold text-white">🧩 {project.code} — 블록 다이어그램</p>
        <button
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/5"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          .svg 다운로드
        </button>
      </div>
      <div className="p-3" aria-label="아키텍처 다이어그램" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="border-t border-white/5 px-4 py-2 text-[10px] text-slate-600">
        MCU · 입력 · 출력 · 전원 · 버스 구성이 분야 템플릿으로 자동 생성됩니다. README에 삽입하거나 스타터팩 zip의
        docs/architecture.svg로도 제공됩니다.
      </p>
    </div>
  );
}
