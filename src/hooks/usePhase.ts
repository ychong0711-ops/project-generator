import { useCallback, useState } from 'react';
import type { Phase } from '../types';
import { AUTOEMBED_PHASE, safeGet, safeSet, type WriteResult } from '../utils/storage';

const KEY = AUTOEMBED_PHASE;
const DEFAULT_PHASE: Phase = 'apply';
const PHASE_VALUES: readonly Phase[] = ['apply', 'study', 'thesis'];

/** 값이 허용된 3개 단계 중 하나인지 검증한다. */
export function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && (PHASE_VALUES as readonly string[]).includes(value);
}

/**
 * localStorage 에서 단계를 복원한다.
 * 값이 없거나 알 수 없는 값·파싱 실패면 'apply' 로 폴백한다.
 */
export function loadPhase(): Phase {
  const stored = safeGet<unknown>(KEY, DEFAULT_PHASE);
  return isPhase(stored) ? stored : DEFAULT_PHASE;
}

/**
 * 현재 단계 상태와 변경 함수를 제공한다.
 * 초기값은 localStorage 에서 복원하며(값 검증 포함), 변경 시 즉시 저장한다.
 * 저장 실패는 safeSet 이 WriteResult 로 알려주므로 조용히 삼키지 않고 호출자에게 반환한다.
 */
export function usePhase() {
  const [phase, setPhaseState] = useState<Phase>(loadPhase);

  const setPhase = useCallback((next: Phase): WriteResult => {
    const safe = isPhase(next) ? next : DEFAULT_PHASE;
    setPhaseState(safe);
    return safeSet(KEY, safe);
  }, []);

  return [phase, setPhase] as const;
}
