import { BoltIcon } from './icons';

interface HeroProps {
  onGenerate: () => void;
  onUni: () => void;
}

const STATS = [
  { value: '14', label: '엄선된 프로젝트' },
  { value: '10', label: '독일 대학 프로그램' },
  { value: '8', label: '입학 로드맵 단계' },
  { value: '40+', label: '면접 예상 질문' },
];

const MARQUEE = [
  'CAN · UDS', 'AUTOSAR', 'FreeRTOS', 'FOC 모터제어', 'ISO 26262', 'SOME/IP', 'EKF 센서퓨전',
  'LIN 2.x', 'BMS/SoC', 'SocketCAN', 'ISO-TP', 'SVPWM', 'Bootloader', 'ADAS',
];

export default function Hero({ onGenerate, onUni }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* 배경 이미지 */}
      <div className="absolute inset-0">
        <img src="images/hero.jpg" alt="" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090d]/70 via-[#07090d]/80 to-[#07090d]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07090d]/90 via-transparent to-[#07090d]/60" />
        <div className="grid-bg absolute inset-0 opacity-60" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-32 pb-16 sm:pt-40 sm:pb-24">
        <div className="max-w-3xl animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
            <BoltIcon className="h-3.5 w-3.5" />
            독일 자동차 임베디드 석사 지원 준비
          </div>

<h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.15] tracking-tight text-white">
              프로젝트로 증명하는 ,
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                독일 대학원 지원 포트폴리오
              </span>
            </h1>

<p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-300 max-w-2xl">
              난이도·분야·기간을 고르면 목표, 주차별 로드맵, 산출물, 면접 질문까지 갖춘 임베디드 프로젝트가 만들어집니다. 코드 작성부터 GitHub 배포까지 한 곳에서 준비하세요.
            </p>

<div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={onGenerate}
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3.5 text-sm sm:text-base font-bold text-black shadow-xl shadow-orange-500/25 transition-transform hover:scale-[1.03] active:scale-95"
              >
                프로젝트 생성하기
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
              <button
                onClick={onUni}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm sm:text-base font-semibold text-slate-200 backdrop-blur transition-colors hover:bg-white/10"
              >
                대학 정보 보기
              </button>
            </div>

          {/* 통계 */}
          <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-2xl">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
                <dt className="font-mono text-2xl font-bold text-amber-300">{s.value}</dt>
                <dd className="mt-0.5 text-xs text-slate-400">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* 마퀴 */}
      <div className="relative border-y border-white/5 bg-black/40 py-3 overflow-hidden">
        <div className="flex w-max animate-marquee gap-8">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-8 font-mono text-xs text-slate-500 whitespace-nowrap">
              {m} <span className="text-amber-500/60">●</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
