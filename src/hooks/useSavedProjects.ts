import { useEffect, useState } from 'react';

const KEY = 'autoembed-saved-projects';

export function useSavedProjects() {
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(savedIds));
    } catch {
      /* ignore */
    }
  }, [savedIds]);

  const toggle = (id: string) =>
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const remove = (id: string) => setSavedIds((prev) => prev.filter((x) => x !== id));

  const clear = () => setSavedIds([]);

  const isSaved = (id: string) => savedIds.includes(id);

  return { savedIds, toggle, remove, clear, isSaved };
}
