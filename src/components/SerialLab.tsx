import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types';
import { genFirmware, BAUD_OPTIONS, LABEL_PRESETS } from '../serial/firmware';
import { useProjectProgress } from '../store/progress';
import { recordEvent } from '../store/activity';
import { measurementCitation } from '../data/apply';
import { copyText } from '../utils/markdown';
import { DownloadIcon, CheckIcon, ClipboardIcon } from './icons';
import { cn } from '../utils/cn';

/* Web Serial 타입 (lib.dom 미포함) */
interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbProductName?: string };
}

declare global {
  interface Navigator {
    serial?: {
      requestPort(): Promise<SerialPortLike>;
    };
  }
}

/* ============================================================
 * 실측 랩 (Web Serial) + 신호 처리 파이프라인
 *  수신 데이터 → 이상치 제거 → 캘리브레이션 → 노이즈 필터 → 그래프
 * ============================================================ */

interface SerialLabProps {
  project: Project;
}

interface RawPoint {
  t: number;
  raw: number;
}

interface Point {
  t: number;
  v: number;
}

const MAX_POINTS = 1200;
const PLOT_W = 560;
const PLOT_H = 180;

type NoiseMode = 'none' | 'ma' | 'ema' | 'median';
type CalMode = 'none' | 'manual' | '2pt';

const WINDOW_OPTIONS = [3, 5, 10, 20];

function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export default function SerialLab({ project }: SerialLabProps) {
  const supported = isSerialSupported();
  const [baud, setBaud] = useState(115200);
  const [label, setLabel] = useState('t_ms');
  const [connected, setConnected] = useState(false);
  const [rawPoints, setRawPoints] = useState<RawPoint[]>([]);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [alertActive, setAlertActive] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [lineCount, setLineCount] = useState(0);
  const [showFw, setShowFw] = useState(false);
  const [showSignal, setShowSignal] = useState(false);
  const [citationCopied, setCitationCopied] = useState(false);
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const firstSampleRef = useRef(false);
  const { isDone, toggle } = useProjectProgress(project.id);

  /* ---- 신호 처리 설정 ---- */
  const [noiseMode, setNoiseMode] = useState<NoiseMode>('none');
  const [maWindow, setMaWindow] = useState(5);
  const [emaAlpha, setEmaAlpha] = useState(0.2);
  const [outlierEnabled, setOutlierEnabled] = useState(false);
  const [outlierMax, setOutlierMax] = useState(10);
  const [calMode, setCalMode] = useState<CalMode>('none');
  const [calGain, setCalGain] = useState(1);
  const [calOffset, setCalOffset] = useState(0);
  const [refLow, setRefLow] = useState<number | null>(null);
  const [targetLow, setTargetLow] = useState('0');
  const [refHigh, setRefHigh] = useState<number | null>(null);
  const [targetHigh, setTargetHigh] = useState('100');
  const [showRaw, setShowRaw] = useState(false);

  const pushLog = (msg: string) => setLog((prev) => [...prev.slice(-30), msg]);

  const connect = async () => {
    try {
      if (!navigator.serial) {
        pushLog('이 브라우저는 Web Serial을 지원하지 않습니다.');
        return;
      }
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: baud });
      portRef.current = port;
      setConnected(true);
      pushLog(`연결됨: ${port.getInfo().usbProductName ?? 'serial device'} @ ${baud} baud`);
      if (!port.readable) {
        pushLog('포트 읽기 스트림이 없습니다.');
        return;
      }
      const reader = port.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buf = '';
      (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf('\n')) !== -1) {
              const line = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 1);
              if (!line) continue;
              if (line.startsWith('#')) {
                pushLog(`[보드] ${line}`);
                continue;
              }
              const m = line.match(/^\s*([A-Za-z0-9_]+)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
              if (!m) {
                pushLog(`[파싱 스킵] ${line.slice(0, 40)}`);
                continue;
              }
              const v = parseFloat(m[2]);
              if (!isFinite(v)) continue;
              if (!firstSampleRef.current) {
                firstSampleRef.current = true;
                recordEvent('measure-first');
              }
              setLineCount((c) => c + 1);
              setRawPoints((prev) => {
                const t = prev.length ? prev[prev.length - 1].t + 1 : 0;
                const next = [...prev, { t, raw: v }];
                return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
              });
              if (threshold !== null && v >= threshold) setAlertActive(true);
            }
          }
        } catch (e) {
          if ((e as Error).name !== 'AbortError') pushLog(`[오류] ${(e as Error).message}`);
        }
      })();
    } catch (e) {
      if ((e as Error).name === 'NotFoundError') {
        pushLog('포트 선택이 취소되었습니다.');
      } else {
        pushLog(`[연결 실패] ${(e as Error).message}`);
      }
    }
  };

  const disconnect = async () => {
    try {
      await readerRef.current?.cancel();
    } catch {
      /* ignore */
    }
    readerRef.current = null;
    try {
      await portRef.current?.close();
    } catch {
      /* ignore */
    }
    portRef.current = null;
    setConnected(false);
    pushLog('연결 종료됨.');
  };

  /* 언마운트 시 리소스 정리: 열린 포트/리더를 닫고 참조를 해제한다.
   * setState(setConnected/pushLog)를 호출하지 않아 React 18+ 언마운트 후
   * setState 경고를 피한다. 연결되어 있지 않으면(참조가 null) 무해하게 종료된다. */
  useEffect(() => {
    return () => {
      readerRef.current?.cancel().catch(() => {});
      portRef.current?.close().catch(() => {});
      readerRef.current = null;
      portRef.current = null;
    };
  }, []);

  /* ---------- 2점 캘리브레이션 계수 ---------- */
  const twoPoint = useMemo(() => {
    if (refLow !== null && refHigh !== null && refHigh !== refLow) {
      const tl = parseFloat(targetLow);
      const th = parseFloat(targetHigh);
      if (isFinite(tl) && isFinite(th)) {
        const gain = (th - tl) / (refHigh - refLow);
        const offset = tl - gain * refLow;
        return { gain, offset };
      }
    }
    return null;
  }, [refLow, refHigh, targetLow, targetHigh]);

  /* ---------- 신호 처리 파이프라인 ---------- */
  const processed = useMemo(() => {
    const out: Point[] = [];
    let rejected = 0;
    const buf: number[] = [];
    let ema: number | null = null;

    for (const p of rawPoints) {
      let v = p.raw;

      /* 1) 캘리브레이션 */
      if (calMode === 'manual') {
        v = calGain * v + calOffset;
      } else if (calMode === '2pt' && twoPoint) {
        v = twoPoint.gain * v + twoPoint.offset;
      }

      /* 2) 이상치 제거 (급격한 점프 클램프) */
      if (outlierEnabled && out.length > 0) {
        const last = out[out.length - 1].v;
        const diff = v - last;
        if (Math.abs(diff) > Math.abs(outlierMax)) {
          rejected++;
          v = last + Math.sign(diff) * Math.abs(outlierMax);
        }
      }

      /* 3) 노이즈 필터 */
      if (noiseMode === 'ma') {
        buf.push(v);
        if (buf.length > maWindow) buf.shift();
        v = buf.reduce((a, b) => a + b, 0) / buf.length;
      } else if (noiseMode === 'ema') {
        ema = ema === null ? v : emaAlpha * v + (1 - emaAlpha) * ema;
        v = ema;
      } else if (noiseMode === 'median') {
        buf.push(v);
        if (buf.length > maWindow) buf.shift();
        const sorted = [...buf].sort((a, b) => a - b);
        v = sorted[Math.floor(sorted.length / 2)];
      }

      out.push({ t: p.t, v });
    }
    return { points: out, rejected };
  }, [rawPoints, noiseMode, maWindow, emaAlpha, outlierEnabled, outlierMax, calMode, calGain, calOffset, twoPoint]);

  const points = processed.points;
  const rejectedCount = processed.rejected;

  /* 처리 요약 (인용문·배지용) */
  const processingNote = useMemo(() => {
    const parts: string[] = [];
    if (noiseMode === 'ma') parts.push(`이동평균(${maWindow}점)`);
    if (noiseMode === 'ema') parts.push(`EMA(α=${emaAlpha})`);
    if (noiseMode === 'median') parts.push(`중앙값(${maWindow}점)`);
    if (outlierEnabled) parts.push(`이상치 클램프(±${outlierMax})`);
    if (calMode === '2pt' && twoPoint) parts.push(`2점 캘리브레이션(g=${twoPoint.gain.toFixed(4)}, o=${twoPoint.offset.toFixed(4)})`);
    else if (calMode === 'manual') parts.push(`수동 캘리브레이션(g=${calGain}, o=${calOffset})`);
    return parts;
  }, [noiseMode, maWindow, emaAlpha, outlierEnabled, outlierMax, calMode, calGain, calOffset, twoPoint]);

  const processingActive = processingNote.length > 0;

  /* ---------- 통계 ---------- */
  const stats = useMemo(() => {
    if (points.length === 0) return null;
    let min = Infinity, max = -Infinity, sum = 0;
    for (const p of points) {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
      sum += p.v;
    }
    const mean = sum / points.length;
    return { min, max, mean, last: points[points.length - 1].v, n: points.length };
  }, [points]);

  /* ---------- 플롯 ---------- */
  const plot = useMemo(() => {
    if (points.length < 2) return null;
    const xs = points.map((_, i) => (i / Math.max(1, points.length - 1)) * (PLOT_W - 40) + 30);
    const vals = points.map((p) => p.v);
    let lo = Math.min(...vals, threshold ?? Infinity);
    let hi = Math.max(...vals, threshold ?? -Infinity);
    if (showRaw && rawPoints.length > 0) {
      const rawVals = rawPoints.map((p) => p.raw);
      lo = Math.min(lo, ...rawVals);
      hi = Math.max(hi, ...rawVals);
    }
    const span = hi - lo || 1;
    const ys = vals.map((v) => PLOT_H - 20 - ((v - lo) / span) * (PLOT_H - 40));
    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');

    let rawPath = '';
    if (showRaw && rawPoints.length > 1) {
      const rawYs = rawPoints.map((p) => PLOT_H - 20 - ((p.raw - lo) / span) * (PLOT_H - 40));
      rawPath = rawPoints.map((_, i) => `${i === 0 ? 'M' : 'L'}${(i / Math.max(1, rawPoints.length - 1)) * (PLOT_W - 40) + 30},${rawYs[i].toFixed(1)}`).join(' ');
    }

    const thY = threshold !== null ? PLOT_H - 20 - ((threshold - lo) / span) * (PLOT_H - 40) : null;
    return { path, rawPath, thY, lo, hi };
  }, [points, rawPoints, threshold, showRaw]);

  const downloadCsv = () => {
    if (!points.length) return;
    const csv =
      `sample,${label}_raw,${label}\n` +
      points.map((p, i) => `${p.t},${rawPoints[i]?.raw ?? p.v},${p.v.toFixed(4)}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}-${label}-measurements.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadFw = () => {
    const code = genFirmware({ baud, label, lineFormat: `${label},<value>\\n` });
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}-logger.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const dataDeliverable = project.deliverables.findIndex((d) => /데이터|측정|실측/i.test(d));
  const doneMeasured = dataDeliverable >= 0 && isDone(`d${dataDeliverable}`);
  const latestRaw = rawPoints.length ? rawPoints[rawPoints.length - 1].raw : null;

  const captureLow = () => latestRaw !== null && setRefLow(latestRaw);
  const captureHigh = () => latestRaw !== null && setRefHigh(latestRaw);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 text-sm">📡</span>
        <div>
          <p className="text-sm font-extrabold text-white">실측 랩 — Web Serial + 신호 처리</p>
          <p className="text-[10px] text-slate-500">보드 연결 → 이상치 제거 → 캘리브레이션 → 노이즈 필터 → 그래프</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold',
              supported ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', supported ? 'bg-emerald-400 animate-pulse-dot' : 'bg-amber-400')} />
            {supported ? 'Web Serial 지원 브라우저' : 'Web Serial 미지원 브라우저'}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ===== 좌측: 플롯 + 도구 ===== */}
        <div className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">
                {label} — 실시간 측정
                {processingActive && <span className="ml-2 rounded bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">신호 처리 적용</span>}
              </p>
              {stats && (
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  n={stats.n} · 마지막 <span className="text-sky-300">{stats.last.toFixed(3)}</span> · 평균{' '}
                  <span className="text-amber-300">{stats.mean.toFixed(3)}</span> · min {stats.min.toFixed(3)} · max{' '}
                  {stats.max.toFixed(3)}
                  {rejectedCount > 0 && <span className="ml-2 text-rose-400">이상치 {rejectedCount}개 제거</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={threshold ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                  setThreshold(isFinite(v as number) ? v : null);
                  if (v === null) setAlertActive(false);
                }}
                placeholder="임계값"
                className="w-24 rounded-lg border border-white/10 bg-[#0d1119] px-2 py-1 font-mono text-[11px] text-slate-200 outline-none focus:border-red-400/50"
              />
              <span className={cn('rounded-md border px-2 py-1 text-[10px] font-bold', alertActive ? 'border-red-400/50 bg-red-500/15 text-red-300' : 'border-white/10 bg-white/5 text-slate-500')}>
                {alertActive ? '⚠ 임계값 초과' : threshold !== null ? `임계값 ${threshold} 설정됨` : '임계값 없음'}
              </span>
            </div>
          </div>

          {/* 플롯 영역 */}
          <div className="mt-3 rounded-xl border border-white/5 bg-black/50 p-3">
            {plot ? (
              <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="w-full" style={{ height: 'auto' }}>
                <line x1="30" y1={PLOT_H - 20} x2={PLOT_W - 10} y2={PLOT_H - 20} stroke="#1e293b" strokeWidth="1" />
                <line x1="30" y1="10" x2="30" y2={PLOT_H - 20} stroke="#1e293b" strokeWidth="1" />
                {plot.thY !== null && (
                  <>
                    <line x1="30" y1={plot.thY} x2={PLOT_W - 10} y2={plot.thY} stroke="#f87171" strokeWidth="1" strokeDasharray="5 5" />
                    <text x={PLOT_W - 90} y={plot.thY - 4} fill="#f87171" fontSize="10" fontFamily="monospace">
                      임계값 {threshold}
                    </text>
                  </>
                )}
                {plot.rawPath && (
                  <>
                    <path d={plot.rawPath} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3 4" />
                    <text x={PLOT_W - 90} y="14" fill="#64748b" fontSize="9" fontFamily="monospace">- - 원본(raw)</text>
                  </>
                )}
                <path d={plot.path} fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                <text x="32" y={plot.rawPath ? 26 : 16} fill="#475569" fontSize="10" fontFamily="monospace">
                  {plot.hi.toFixed(2)}
                </text>
                <text x="32" y={PLOT_H - 24} fill="#475569" fontSize="10" fontFamily="monospace">
                  {plot.lo.toFixed(2)}
                </text>
              </svg>
            ) : (
              <div className="grid h-44 place-items-center text-center">
                <div>
                  <p className="text-sm font-bold text-slate-500">데이터가 없습니다</p>
                  <p className="mt-1 text-xs text-slate-600">
                    보드를 연결하면 여기에 <span className="font-mono">{label},&lt;value&gt;</span> 라인 그래프가 그려집니다
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 도구 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={connected ? disconnect : connect}
              disabled={!supported}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all active:scale-95',
                !supported
                  ? 'cursor-not-allowed bg-white/5 text-slate-600'
                  : connected
                  ? 'border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                  : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 hover:scale-[1.02]'
              )}
            >
              {connected ? '■ 연결 해제' : '🔌 시리얼 포트 연결'}
            </button>
            <button
              onClick={() => setShowSignal((s) => !s)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold',
                showSignal || processingActive
                  ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              )}
            >
              🎛 신호 처리 & 캘리브레이션 {showSignal ? '▲' : '▼'}
            </button>
            <button
              onClick={downloadCsv}
              disabled={!points.length}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold',
                points.length ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20' : 'border-white/10 text-slate-600'
              )}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              CSV (원본+처리)
            </button>
            <button
              onClick={() => setShowFw((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              {showFw ? '▲' : '▼'} 로거 펌웨어
            </button>
            {dataDeliverable >= 0 && (
              <button
                onClick={() => toggle(`d${dataDeliverable}`)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold',
                  doneMeasured ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-white/10 text-slate-400 hover:border-emerald-400/40'
                )}
              >
                {doneMeasured ? '✓ 실측 데이터 산출물 완료' : '▢ 실측 데이터 산출물 체크'}
              </button>
            )}
          </div>

          {/* ===== 신호 처리 패널 ===== */}
          {showSignal && (
            <div className="mt-4 rounded-xl border border-sky-400/20 bg-[#0b0f16] p-4 animate-fade-in">
              <div className="grid gap-4 lg:grid-cols-3">
                {/* 노이즈 제거 */}
                <div>
                  <p className="text-xs font-bold text-white">🌊 노이즈 제거</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {([
                      ['none', '없음'],
                      ['ma', '이동평균'],
                      ['ema', 'EMA'],
                      ['median', '중앙값'],
                    ] as [NoiseMode, string][]).map(([m, l]) => (
                      <button
                        key={m}
                        onClick={() => setNoiseMode(m)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                          noiseMode === m
                            ? 'border-sky-400/60 bg-sky-400/15 text-sky-300'
                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {noiseMode === 'ma' || noiseMode === 'median' ? (
                    <div className="mt-3">
                      <p className="text-[10px] text-slate-500">윈도우 크기: {maWindow}점</p>
                      <div className="mt-1 flex gap-1.5">
                        {WINDOW_OPTIONS.map((w) => (
                          <button
                            key={w}
                            onClick={() => setMaWindow(w)}
                            className={cn(
                              'rounded-md border px-2 py-1 font-mono text-[10px] font-bold',
                              maWindow === w ? 'border-sky-400/60 bg-sky-400/15 text-sky-300' : 'border-white/10 text-slate-400'
                            )}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : noiseMode === 'ema' ? (
                    <div className="mt-3">
                      <p className="text-[10px] text-slate-500">
                        α = {emaAlpha.toFixed(2)} <span className="text-slate-600">(작을수록 부드러움)</span>
                      </p>
                      <input
                        type="range"
                        min={0.05}
                        max={0.5}
                        step={0.05}
                        value={emaAlpha}
                        onChange={(e) => setEmaAlpha(parseFloat(e.target.value))}
                        className="mt-1 w-full accent-sky-400"
                      />
                    </div>
                  ) : null}
                </div>

                {/* 이상치 제거 */}
                <div>
                  <p className="text-xs font-bold text-white">🚫 이상치 제거</p>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={outlierEnabled}
                      onChange={(e) => setOutlierEnabled(e.target.checked)}
                      className="accent-sky-400"
                    />
                    급격한 점프 클램프
                  </label>
                  {outlierEnabled && (
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-500">허용 최대 점프: ±{outlierMax}</p>
                      <input
                        type="number"
                        step="any"
                        value={outlierMax}
                        onChange={(e) => setOutlierMax(parseFloat(e.target.value) || 0)}
                        className="mt-1 w-28 rounded-lg border border-white/10 bg-[#0d1119] px-2 py-1.5 font-mono text-[11px] text-slate-200 outline-none focus:border-sky-400/50"
                      />
                      <p className="mt-1.5 text-[9px] leading-relaxed text-slate-600">
                        이전 값과의 차이가 한도를 넘으면 한도값으로 잘라냅니다 (글리치 억제)
                      </p>
                    </div>
                  )}
                </div>

                {/* 캘리브레이션 */}
                <div>
                  <p className="text-xs font-bold text-white">🎛 캘리브레이션</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {([
                      ['none', '없음'],
                      ['manual', '수동 (y=g·x+o)'],
                      ['2pt', '2점 기준'],
                    ] as [CalMode, string][]).map(([m, l]) => (
                      <button
                        key={m}
                        onClick={() => setCalMode(m)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                          calMode === m
                            ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {calMode === 'manual' && (
                    <div className="mt-3 flex gap-2">
                      <div>
                        <p className="text-[9px] text-slate-500">이득 g</p>
                        <input
                          type="number"
                          step="any"
                          value={calGain}
                          onChange={(e) => setCalGain(parseFloat(e.target.value) || 0)}
                          className="w-20 rounded-lg border border-white/10 bg-[#0d1119] px-2 py-1.5 font-mono text-[11px] text-slate-200 outline-none focus:border-amber-400/50"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500">오프셋 o</p>
                        <input
                          type="number"
                          step="any"
                          value={calOffset}
                          onChange={(e) => setCalOffset(parseFloat(e.target.value) || 0)}
                          className="w-20 rounded-lg border border-white/10 bg-[#0d1119] px-2 py-1.5 font-mono text-[11px] text-slate-200 outline-none focus:border-amber-400/50"
                        />
                      </div>
                      <p className="self-end text-[9px] text-slate-500">y = g·x + o</p>
                    </div>
                  )}
                  {calMode === '2pt' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={captureLow}
                          disabled={latestRaw === null}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5 disabled:opacity-40"
                        >
                          📥 저점 캡처
                        </button>
                        <span className="font-mono text-[10px] text-sky-300">{refLow !== null ? refLow.toFixed(3) : '—'}</span>
                        <span className="text-[10px] text-slate-500">→ 실제값</span>
                        <input
                          type="number"
                          step="any"
                          value={targetLow}
                          onChange={(e) => setTargetLow(e.target.value)}
                          className="w-16 rounded-md border border-white/10 bg-[#0d1119] px-1.5 py-1 font-mono text-[10px] text-slate-200 outline-none focus:border-amber-400/50"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={captureHigh}
                          disabled={latestRaw === null}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/5 disabled:opacity-40"
                        >
                          📥 고점 캡처
                        </button>
                        <span className="font-mono text-[10px] text-sky-300">{refHigh !== null ? refHigh.toFixed(3) : '—'}</span>
                        <span className="text-[10px] text-slate-500">→ 실제값</span>
                        <input
                          type="number"
                          step="any"
                          value={targetHigh}
                          onChange={(e) => setTargetHigh(e.target.value)}
                          className="w-16 rounded-md border border-white/10 bg-[#0d1119] px-1.5 py-1 font-mono text-[10px] text-slate-200 outline-none focus:border-amber-400/50"
                        />
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-500">
                        {twoPoint
                          ? `계산 결과: g = ${twoPoint.gain.toFixed(4)}, o = ${twoPoint.offset.toFixed(4)} — 즉시 적용 중`
                          : '저점·고점 두 기준점을 캡처하고 실제값을 입력하면 계수가 자동 계산됩니다 (현재 값: ' + (latestRaw !== null ? latestRaw.toFixed(3) : '수신 대기') + ')'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 원본 표시 토글 + 요약 */}
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
                <label className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} className="accent-sky-400" />
                  그래프에 원본(raw) 겹쳐 보기
                </label>
                {processingActive && (
                  <span className="ml-auto font-mono text-[10px] text-sky-300">
                    파이프라인: {processingNote.join(' → ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 측정 데이터 → 서류 인용 */}
          {stats && stats.n >= 5 && (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 animate-fade-in">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-emerald-300">📄 측정 데이터 → 서류 자동 인용</p>
                <button
                  onClick={async () => {
                    const ok = await copyText(measurementCitation(label, stats, processingNote.join(' + ') || undefined));
                    if (ok) {
                      setCitationCopied(true);
                      setTimeout(() => setCitationCopied(false), 1500);
                    }
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-600"
                >
                  {citationCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
                  {citationCopied ? '복사됨' : '인용문 복사'}
                </button>
              </div>
              <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-300">
                {measurementCitation(label, stats, processingNote.join(' + ') || undefined)}
              </pre>
              <p className="mt-2 text-[10px] text-slate-500">
                적용한 신호 처리 설정이 인용문에 함께 기록되어, 보고서의 "측정 절차" 항목이 됩니다.
              </p>
            </div>
          )}

          {/* 펌웨어 */}
          {showFw && (
            <div className="mt-4 rounded-xl border border-white/5 bg-[#0b0f16] p-4 animate-fade-in">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-white">로거 펌웨어 설정</p>
                <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#0d1119] px-2 py-1.5 font-mono text-xs text-slate-200 outline-none">
                  {BAUD_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b} baud
                    </option>
                  ))}
                </select>
                <input value={label} onChange={(e) => setLabel(e.target.value.replace(/[^A-Za-z0-9_]/g, '_'))} className="rounded-lg border border-white/10 bg-[#0d1119] px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/50" />
                <div className="ml-auto flex flex-wrap gap-1">
                  {LABEL_PRESETS.slice(0, 4).map((p) => (
                    <button key={p} onClick={() => setLabel(p)} className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-400 hover:text-slate-200">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 rounded-lg border border-white/5 bg-black/50 p-3">
                <pre className="max-h-40 overflow-auto font-mono text-[10px] leading-relaxed text-slate-400">
{genFirmware({ baud, label, lineFormat: `${label},<value>\\n` }).split('\n').slice(0, 24).join('\n')}
... (전체는 다운로드로 확인)
                </pre>
              </div>
              <button
                onClick={downloadFw}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-black transition-transform hover:scale-[1.02] active:scale-95"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                {project.id}-logger.c 다운로드
              </button>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                1) CubeMX에서 UART 초기화 → 2) 이 파일을 main.c에 병합 → 3) measure_sensor()에 센서 코드 작성 → 4) 플래시 → 5) "시리얼 포트 연결"
              </p>
            </div>
          )}
        </div>

        {/* ===== 우측: 로그 ===== */}
        <div className="border-t border-white/5 bg-[#0a0e15] p-4 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">연결 로그</p>
            <span className="font-mono text-[10px] text-slate-500">{lineCount}줄 수신</span>
          </div>
          <pre className="mt-2 h-64 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-500">
            {log.length === 0 ? '포트를 연결하면 로그가 표시됩니다.\n\n필요한 것:\n- Chrome/Edge 브라우저\n- STM32 Nucleo 등 UART 보드\n- USB 케이블\n- 위에서 생성한 로거 펌웨어\n\n💡 신호 처리 팁:\n- 노이즈가 심하면 이동평균 5~10점\n- 글리치가 보이면 이상치 클램프 활성화\n- 센서 오차는 2점 캘리브레이션으로 보정' : log.join('\n')}
          </pre>
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3">
            <p className="text-[10px] font-bold text-amber-300">📝 보고서에 넣을 측정 절차</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-400">
              <li>환경: 보드, 센서, 샘플링 주기 명시</li>
              <li>캘리브레이션: 기준점·계수(g, o) 기록</li>
              <li>노이즈 처리: 필터 종류와 파라미터 기록</li>
              <li>수집: 여기서 연결해 100개 이상 샘플 획득</li>
              <li>결과: CSV로 내려받아 표/그래프로 가공</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
