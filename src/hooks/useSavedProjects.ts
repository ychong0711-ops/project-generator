import { useCallback, useEffect, useState } from 'react';
import { AUTOEMBED_SAVED_PROJECTS, safeGet, safeSet } from '../utils/storage';

const KEY = AUTOEMBED_SAVED_PROJECTS;

function loadIds(): string[] {
  const v = safeGet<unknown>(KEY, []);
  if (!Array.isArray(v)) return [];
  // 손상된 백업 등으로 문자열이 아닌 값이 섞이면 걸러낸다.
  return [...new Set(v.filter((x): x is string => typeof x === 'string'))];
}

export function useSavedProjects() {
  const [savedIds, setSavedIds] = useState<string[]>(loadIds);

  useEffect(() => {
    safeSet(KEY, savedIds);
  }, [savedIds]);

  const toggle = useCallback(
    (id: string) =>
      setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    []
  );

  const remove = useCallback(
    (id: string) => setSavedIds((prev) => prev.filter((x) => x !== id)),
    []
  );

  const clear = useCallback(() => setSavedIds([]), []);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  return { savedIds, toggle, remove, clear, isSaved };
}
