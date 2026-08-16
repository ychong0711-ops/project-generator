/* ============================================================
 *  GitHub 저장소 어댑터 — 트리 탐색 · 파일 분류 · 라이브 검색
 * ============================================================ */

export interface RepoMeta {
  stars: number;
  desc: string;
  license: string | null;
  ok: boolean;
}

export interface RepoTreeFile {
  path: string;
  name: string;
  kind: 'skeleton' | 'reference' | 'source' | 'header';
}

export interface SearchHit {
  full_name: string;
  description: string;
  stars: number;
  language: string;
}

const gh = (path: string) =>
  fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } });

/** 저장소 메타(스타 수 등) — 실패해도 null 반환 (정적 카드에도 표시 가능) */
export async function fetchRepoMeta(full: string): Promise<RepoMeta> {
  try {
    const res = await gh(`/repos/${full}`);
    if (!res.ok) return { stars: 0, desc: '', license: null, ok: false };
    const d = (await res.json()) as {
      stargazers_count?: number;
      description?: string | null;
      license?: { spdx_id?: string } | null;
    };
    return {
      stars: d.stargazers_count ?? 0,
      desc: d.description ?? '',
      license: d.license?.spdx_id ?? null,
      ok: true,
    };
  } catch {
    return { stars: 0, desc: '', license: null, ok: false };
  }
}

const SKELETON_HINTS = /(lab|exercise|practice|tutorial|example|task|aufgabe|uebung|skeleton|stub)/i;

/** 저장소의 C/H 파일 트리 (최대 60개, 경로 기반 분류) */
export async function fetchRepoTree(full: string): Promise<RepoTreeFile[]> {
  const res = await gh(`/repos/${full}/git/trees/HEAD?recursive=1`);
  if (!res.ok) throw new Error(`트리 조회 실패 (HTTP ${res.status}) — 저장소가 공개 상태인지 확인하세요`);
  const d = (await res.json()) as { tree?: { type?: string; path?: string }[] };
  const out: RepoTreeFile[] = [];
  for (const item of d.tree ?? []) {
    if (item.type !== 'blob' || !item.path) continue;
    const p = item.path;
    if (!/\.(c|h)$/i.test(p)) continue;
    let kind: RepoTreeFile['kind'] = 'source';
    if (/\.h$/i.test(p)) kind = 'header';
    else if (SKELETON_HINTS.test(p.toLowerCase())) kind = 'skeleton';
    else kind = 'reference';
    out.push({ path: p, name: p.split('/').pop() ?? p, kind });
    if (out.length >= 60) break;
  }
  return out;
}

/** 파일 내용 (raw) */
export async function fetchFileContent(full: string, path: string): Promise<string> {
  const res = await fetch(`https://raw.githubusercontent.com/${full}/HEAD/${path}`);
  if (!res.ok) throw new Error(`파일 조회 실패 (HTTP ${res.status})`);
  return res.text();
}

/** 파일 내용을 열어 스켈레톤(풀이 가능)인지 최종 판정 */
export function classifyContent(code: string): 'skeleton' | 'reference' {
  return /TODO|FIXME|IMPLEMENT|YOUR CODE|\?\?\?/i.test(code) ? 'skeleton' : 'reference';
}

/** GitHub 라이브 검색 (C 언어, 별점순 상위 10개) */
export async function searchRepos(q: string): Promise<SearchHit[]> {
  const res = await gh(`/search/repositories?q=${encodeURIComponent(q)}+language:c&sort=stars&order=desc&per_page=10`);
  if (res.status === 403) throw new Error('검색 횟수 한도 초과 (미인증 10회/분) — 잠시 후 다시 시도하세요');
  if (!res.ok) throw new Error(`검색 실패 (HTTP ${res.status})`);
  const d = (await res.json()) as {
    items?: { full_name: string; description?: string | null; stargazers_count?: number; language?: string }[];
  };
  return (d.items ?? []).map((it) => ({
    full_name: it.full_name,
    description: it.description ?? '',
    stars: it.stargazers_count ?? 0,
    language: it.language ?? 'C',
  }));
}
