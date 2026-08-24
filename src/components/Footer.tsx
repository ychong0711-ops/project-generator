export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#05070a]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-mono text-sm font-bold tracking-widest text-white">
              AutoEmbed <span className="text-amber-400">LAB</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-md leading-relaxed">
              독일 자동차 임베디드 석사 지원을 위한 올인원 포트폴리오 빌더. 프로젝트 생성부터 지원 서류와 면접 준비까지 한 곳에서 관리하세요.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-8 rounded-sm bg-black border border-white/20" />
            <span className="h-3 w-8 rounded-sm bg-red-600" />
            <span className="h-3 w-8 rounded-sm bg-amber-400" />
          </div>
        </div>
        <p className="mt-6 text-[11px] text-slate-600">
          © {new Date().getFullYear()} AutoEmbed LAB — 학습 목적으로 제작된 비영리 프로젝트입니다.
        </p>
      </div>
    </footer>
  );
}
