import { useState } from 'react';
import type { Project } from '../types';
import { demoScript } from '../data/apply';
import { copyText } from '../utils/markdown';
import { CheckIcon, ClipboardIcon } from './icons';

/* ============================================================
 *  데모 영상 스튜디오 — 프로젝트별 촬영 스크립트 + 체크리스트
 * ============================================================ */

export default function DemoStudio({ project }: { project: Project }) {
  const [copied, setCopied] = useState(false);
  const script = demoScript(project);

  const copy = async () => {
    const ok = await copyText(script);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3">
        <span className="text-sm">🎬</span>
        <div>
          <p className="text-xs font-bold text-white">데모 영상 스튜디오</p>
          <p className="text-[10px] text-slate-500">90~120초 영상 — 심사관이 GitHub에서 실제로 재생합니다</p>
        </div>
        <button
          onClick={copy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/5"
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
          {copied ? '복사됨' : '스크립트 복사'}
        </button>
      </div>
      <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-sans text-[11px] leading-relaxed text-slate-400">
        {script}
      </pre>
    </div>
  );
}
