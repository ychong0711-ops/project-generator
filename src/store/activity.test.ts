import { describe, it, expect } from 'vitest';
import { calcStreak, recentActivity, ymdOf } from './activity';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymdOf(d);
}

describe('ymdOf', () => {
  it('YYYY-MM-DD 형식으로 0 패딩한다', () => {
    expect(ymdOf(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(ymdOf(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('calcStreak', () => {
  it('기록이 없으면 0', () => {
    expect(calcStreak([])).toBe(0);
  });

  it('오늘부터 연속된 날짜를 센다', () => {
    expect(calcStreak([daysAgo(0), daysAgo(1), daysAgo(2)])).toBe(3);
  });

  it('오늘 활동이 없으면 어제 기준으로 계산한다', () => {
    expect(calcStreak([daysAgo(1), daysAgo(2)])).toBe(2);
  });

  it('중간에 끊기면 거기서 멈춘다', () => {
    expect(calcStreak([daysAgo(0), daysAgo(1), daysAgo(5)])).toBe(2);
  });

  it('오늘도 어제도 없으면 0', () => {
    expect(calcStreak([daysAgo(3), daysAgo(4)])).toBe(0);
  });
});

describe('recentActivity', () => {
  it('요청한 일수만큼 과거→현재 순으로 돌려준다', () => {
    const out = recentActivity([daysAgo(0)], 7);
    expect(out).toHaveLength(7);
    expect(out[6].active).toBe(true); // 마지막 항목이 오늘
    expect(out[0].active).toBe(false);
  });
});
