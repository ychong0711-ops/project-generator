/* 오프라인 C 엔진이 반환한 경고를 표시한다.
 * 실행은 성공했지만 결과를 그대로 믿으면 안 되는 경우(예: union 근사 구현)를 알린다. */
export default function OfflineWarnings({ warnings }: { warnings?: string[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="mt-2 space-y-1" data-testid="offline-warnings">
      {warnings.map((w, i) => (
        <p
          key={i}
          role="alert"
          className="rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-[11px] leading-relaxed text-amber-300"
        >
          ⚠️ {w}
        </p>
      ))}
    </div>
  );
}
