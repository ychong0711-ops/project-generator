import type { Category, CategoryId } from '../types';

export const CATEGORIES: Record<CategoryId, Category> = {
  basic: {
    id: 'basic',
    label: '임베디드 기초',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
  },
  comm: {
    id: 'comm',
    label: '차량 통신 (CAN/LIN)',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dot: 'bg-sky-400',
    bar: 'bg-sky-400',
  },
  rtos: {
    id: 'rtos',
    label: '실시간 OS / 미들웨어',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    dot: 'bg-violet-400',
    bar: 'bg-violet-400',
  },
  motor: {
    id: 'motor',
    label: '모터 제어',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    dot: 'bg-orange-400',
    bar: 'bg-orange-400',
  },
  sensor: {
    id: 'sensor',
    label: '센서 / 신호 처리',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-400',
  },
  power: {
    id: 'power',
    label: '전력 / BMS',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    dot: 'bg-yellow-400',
    bar: 'bg-yellow-400',
  },
  diag: {
    id: 'diag',
    label: '진단 / 부트로더',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
    bar: 'bg-red-400',
  },
  linux: {
    id: 'linux',
    label: '임베디드 리눅스',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dot: 'bg-teal-400',
    bar: 'bg-teal-400',
  },
  adas: {
    id: 'adas',
    label: 'ADAS / 컴퓨터 비전',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    dot: 'bg-fuchsia-400',
    bar: 'bg-fuchsia-400',
  },
  autosar: {
    id: 'autosar',
    label: 'AUTOSAR / 아키텍처',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    dot: 'bg-indigo-400',
    bar: 'bg-indigo-400',
  },
  control: {
    id: 'control',
    label: '제어 시스템',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    dot: 'bg-cyan-400',
    bar: 'bg-cyan-400',
  },
  wireless: {
    id: 'wireless',
    label: '무선 / 저전력',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
    bar: 'bg-blue-400',
  },
};

export const LEVEL_STYLE: Record<string, { badge: string }> = {
  입문: { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  중급: { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  심화: { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

import { PROJECTS } from './project-entries';
export { PROJECTS };

export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);
