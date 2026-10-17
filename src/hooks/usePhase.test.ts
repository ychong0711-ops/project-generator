import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePhase, loadPhase } from './usePhase';
import { AUTOEMBED_PHASE } from '../utils/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('usePhase', () => {
  it('기본값은 apply 이다', () => {
    const { result } = renderHook(() => usePhase());
    expect(result.current[0]).toBe('apply');
  });

  it('저장된 유효 값을 초기 상태로 복원한다', () => {
    localStorage.setItem(AUTOEMBED_PHASE, JSON.stringify('thesis'));
    const { result } = renderHook(() => usePhase());
    expect(result.current[0]).toBe('thesis');
  });

  it('허용되지 않은 값은 apply 로 폴백한다', () => {
    localStorage.setItem(AUTOEMBED_PHASE, JSON.stringify('bogus'));
    expect(loadPhase()).toBe('apply');
  });

  it('JSON 이 깨져 있어도 apply 로 복구한다', () => {
    localStorage.setItem(AUTOEMBED_PHASE, '{{{');
    expect(loadPhase()).toBe('apply');
  });

  it('setPhase 로 값을 바꾸면 localStorage 에 저장된다', () => {
    const { result } = renderHook(() => usePhase());
    act(() => {
      result.current[1]('study');
    });
    expect(result.current[0]).toBe('study');
    expect(JSON.parse(localStorage.getItem(AUTOEMBED_PHASE)!)).toBe('study');
  });

  it('저장 실패를 조용히 삼키지 않고 WriteResult 로 알린다', () => {
    const { result } = renderHook(() => usePhase());
    let writeResult: ReturnType<typeof result.current[1]> | undefined;
    act(() => {
      writeResult = result.current[1]('apply');
    });
    expect(writeResult?.ok).toBe(true);
  });
});
