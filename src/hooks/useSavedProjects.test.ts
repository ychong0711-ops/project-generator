import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSavedProjects } from './useSavedProjects';
import { AUTOEMBED_SAVED_PROJECTS } from '../utils/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('useSavedProjects', () => {
  it('빈 상태로 시작한다', () => {
    const { result } = renderHook(() => useSavedProjects());
    expect(result.current.savedIds).toEqual([]);
  });

  it('toggle 로 추가·제거된다', () => {
    const { result } = renderHook(() => useSavedProjects());
    act(() => result.current.toggle('p1'));
    expect(result.current.savedIds).toEqual(['p1']);
    expect(result.current.isSaved('p1')).toBe(true);

    act(() => result.current.toggle('p1'));
    expect(result.current.savedIds).toEqual([]);
  });

  it('localStorage 에 저장된다', () => {
    const { result } = renderHook(() => useSavedProjects());
    act(() => result.current.toggle('p1'));
    expect(JSON.parse(localStorage.getItem(AUTOEMBED_SAVED_PROJECTS)!)).toEqual(['p1']);
  });

  it('저장된 값을 초기 상태로 읽어온다', () => {
    localStorage.setItem(AUTOEMBED_SAVED_PROJECTS, JSON.stringify(['a', 'b']));
    const { result } = renderHook(() => useSavedProjects());
    expect(result.current.savedIds).toEqual(['a', 'b']);
  });

  it('손상된 데이터(문자열 아님/중복)는 정규화한다', () => {
    localStorage.setItem(AUTOEMBED_SAVED_PROJECTS, JSON.stringify(['a', 1, null, 'a', 'b']));
    const { result } = renderHook(() => useSavedProjects());
    expect(result.current.savedIds).toEqual(['a', 'b']);
  });

  it('JSON 이 깨져 있어도 빈 배열로 복구한다', () => {
    localStorage.setItem(AUTOEMBED_SAVED_PROJECTS, '{{{');
    const { result } = renderHook(() => useSavedProjects());
    expect(result.current.savedIds).toEqual([]);
  });

  it('remove 와 clear 가 동작한다', () => {
    const { result } = renderHook(() => useSavedProjects());
    act(() => {
      result.current.toggle('a');
      result.current.toggle('b');
    });
    act(() => result.current.remove('a'));
    expect(result.current.savedIds).toEqual(['b']);

    act(() => result.current.clear());
    expect(result.current.savedIds).toEqual([]);
  });
});
