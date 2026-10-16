/* ============================================================
 *  실습 예제 은행 (내장) + GitHub 저장소 연계 규격
 *  - 문제 스켈레톤 + 힌트 + 기대 출력(채점 기준)
 *  - 외부 저장소도 동일한 포맷으로 불러올 수 있음
 * ============================================================ */

export interface LabExample {
  id: string;          // 예제 id (파일명 규격: <id>.c)
  title: string;       // 예제 제목
  level: '입문' | '중급' | '심화';
  category: string;    // 주제 (예: 통신, 제어, 알고리즘)
  desc: string;        // 문제 설명
  hints: string[];     // 단계별 힌트
  skeleton: string;    // 스켈레톤 코드 (사용자가 채워야 할 부분은 TODO)
  expect: string[];    // 기대 출력 — 오프라인 실행 자동 채점 기준
}

import { LABS_1 } from './lab-entries/part1';
import { LABS_2 } from './lab-entries/part2';

export const LAB_EXAMPLES: LabExample[] = [...LABS_1, ...LABS_2];


/* ---------- GitHub 저장소 연계 규격 ---------- */

export interface RepoExampleFile {
  id: string;
  title: string;
  desc: string;
  skeleton: string;
  expect: string[];
}

/** GitHub raw URL에서 예제 인덱스(JSON)를 가져옴 */
export async function fetchRepoIndex(repo: string, branch = 'main'): Promise<RepoExampleFile[]> {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/labs/index.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    title?: string;
    examples?: { id: string; title: string; desc: string; expect?: string[] }[];
  };
  if (!Array.isArray(data.examples)) throw new Error('index.json 형식 오류: examples 배열 필요');

  /* 예제 소스는 서로 독립적이므로 병렬로 받는다 (직렬 fetch는 N배 느리다) */
  const settled = await Promise.all(
    data.examples.map(async (ex): Promise<RepoExampleFile | null> => {
      try {
        const cUrl = `https://raw.githubusercontent.com/${repo}/${branch}/labs/${ex.id}.c`;
        const cRes = await fetch(cUrl);
        if (!cRes.ok) return null;
        return {
          id: ex.id,
          title: ex.title,
          desc: ex.desc,
          skeleton: await cRes.text(),
          expect: ex.expect ?? [],
        };
      } catch {
        return null;
      }
    })
  );
  return settled.filter((x): x is RepoExampleFile => x !== null);
}
