import { useRef, useState } from 'react';
import { DownloadIcon } from './icons';
import { buildBackup, parseBackup, restoreBackup } from '../utils/storage';

/* ============================================================
 *  데이터 백업/복원 — 18개월 준비의 생명줄
 *  진행률·코드·측정·진단·지원 상태 전체를 JSON으로 저장/복원
 * ============================================================ */

export default function Backup() {
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportAll = () => {
    const payload = buildBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoembed-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const n = Object.keys(payload.data).length;
    setMsg(`✅ ${n}개 항목 백업 완료 — 파일을 안전한 곳에 보관하세요.`);
  };

  const importAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => setMsg('⛔ 파일을 읽지 못했습니다.');
    reader.onload = () => {
      /* 스키마 검증 후 원본 문자열 그대로 복원 (이중 JSON 인코딩 방지) */
      const payload = parseBackup(String(reader.result));
      if (!payload) {
        setMsg('⛔ 백업 파일 형식이 올바르지 않습니다. 이 앱에서 내보낸 JSON인지 확인하세요.');
        return;
      }
      const { restored, failed } = restoreBackup(payload);
      if (failed.length > 0) {
        setMsg(`⚠ ${restored}개 복원, ${failed.length}개 실패 (저장 공간 부족일 수 있습니다).`);
        return;
      }
      setMsg(`✅ ${restored}개 항목 복원 완료 — 새로고침합니다.`);
      window.setTimeout(() => window.location.reload(), 1200);
    };
    reader.readAsText(f);
  };

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
      <h3 className="text-base font-extrabold text-white">💾 데이터 백업 / 복원</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        진행률·작성한 코드·측정 데이터·진단·지원 상태가 모두 브라우저에 저장됩니다. 브라우저 데이터 삭제나
        기기 변경 전에 반드시 백업하세요 — 수개월의 준비를 지키는 보험입니다.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={exportAll}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02] active:scale-95"
        >
          <DownloadIcon className="h-4 w-4" />
          전체 백업 (.json)
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
        >
          ⬆ 백업 파일 복원
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={importAll} className="hidden" />
      </div>
      {msg && <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-300">{msg}</p>}
      <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
        팁: GitHub 배포(포트폴리오 탭)를 쓰면 코드와 문서가 클라우드에도 저장됩니다. 백업은 GitHub에 담지 못하는
        진행 상태까지 통째로 보존합니다.
      </p>
    </div>
  );
}
