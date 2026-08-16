import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import type { Project } from '../types';
import { portfolioToMarkdown, projectToMarkdown } from '../utils/markdown';
import { genMainC, genMakefile, genPlan, genInterview, genAlgoReadme } from '../utils/codegen';
import { samplesFor } from '../data/samples';
import { DownloadIcon, CheckIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  GitHub 원클릭 배포 — 심사관이 보는 저장소를 앱에서 직접 생성
 *  - Personal Access Token으로 저장소 생성 + 파일 커밋
 *  - 토큰 없이도 zip 백업 다운로드 가능
 * ============================================================ */

interface GitHubDeployProps {
  savedProjects: Project[];
}

interface DeployFile {
  path: string;
  content: string;
}

function buildFiles(projects: Project[]): DeployFile[] {
  const files: DeployFile[] = [
    { path: 'README.md', content: portfolioToMarkdown(projects) },
  ];
  for (const p of projects) {
    files.push(
      { path: `${p.id}/README.md`, content: projectToMarkdown(p) },
      { path: `${p.id}/src/main.c`, content: genMainC(p) },
      { path: `${p.id}/Makefile`, content: genMakefile(p) },
      { path: `${p.id}/docs/plan.md`, content: genPlan(p) },
      { path: `${p.id}/docs/interview-prep.md`, content: genInterview(p) },
      { path: `${p.id}/algo/README.md`, content: genAlgoReadme(p) }
    );
    samplesFor(p.id).forEach((s) => {
      files.push({ path: `${p.id}/algo/${s.id}.c`, content: s.code });
    });
    /* 코드 랩에서 사용자가 수정한 코드 포함 */
    try {
      const raw = localStorage.getItem(`autoembed-code-${p.id}`);
      if (raw) {
        const stored = JSON.parse(raw) as { sampleId: string; code: string };
        files.push({ path: `${p.id}/code-lab/${stored.sampleId}.c`, content: stored.code });
      }
    } catch {
      /* ignore */
    }
  }
  return files;
}

/* UTF-8 안전 base64 인코딩 (deprecated unescape 제거) */
function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export default function GitHubDeploy({ savedProjects }: GitHubDeployProps) {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [repo, setRepo] = useState('autoembed-portfolio');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [zipped, setZipped] = useState(false);

  /* 렌더마다 전체 파일을 다시 생성하지 않도록 메모이즈 */
  const files = useMemo(() => buildFiles(savedProjects), [savedProjects]);

  const pushLog = (msg: string) => setLog((prev) => [...prev.slice(-20), msg]);

  const deploy = async () => {
    if (busy) return;
    const tk = token.trim();
    const user = username.trim();
    const rp = repo.trim();
    if (!tk || !user || !rp) {
      pushLog('⚠ 토큰·GitHub 사용자명·저장소명을 모두 입력하세요.');
      return;
    }
    setBusy(true);
    setLog([]);
    setRepoUrl('');

    const headers = {
      Authorization: `Bearer ${tk}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    };
    const api = `https://api.github.com/repos/${user}/${rp}`;
    /* GitHub 오류 응답의 message 를 최대한 안전하게 추출 */
    const errMessage = async (res: Response): Promise<string> => {
      try {
        const data = (await res.json()) as { message?: string };
        return data.message ?? res.statusText;
      } catch {
        return res.statusText;
      }
    };

    try {
      /* 1) 저장소 생성 (이미 있으면 재사용) */
      pushLog('저장소 생성 중...');
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: rp,
          private: false,
          auto_init: false,
          description:
            'German automotive embedded systems master application portfolio (AutoEmbed LAB)',
        }),
      });
      if (!createRes.ok) {
        if (createRes.status === 422) {
          pushLog('저장소가 이미 존재합니다 — 기존 저장소에 파일을 푸시합니다.');
        } else if (createRes.status === 401) {
          pushLog(
            '⛔ 토큰이 유효하지 않습니다. GitHub → Settings → Developer settings → Personal access tokens에서 발급하세요 (repo 권한).'
          );
          return;
        } else {
          pushLog(
            `저장소 생성 실패 (HTTP ${createRes.status}) — ${await errMessage(createRes)}`
          );
          return;
        }
      } else {
        pushLog(`저장소 '${rp}' 생성 완료`);
      }

      /* 2) 기본 브랜치와 현재 HEAD 확인 (기존 저장소면 부모 커밋이 필요하다) */
      const repoRes = await fetch(api, { headers });
      const defaultBranch: string = repoRes.ok
        ? ((await repoRes.json()) as { default_branch?: string }).default_branch || 'main'
        : 'main';

      let parentSha: string | null = null;
      let baseTree: string | null = null;
      const refPath = `heads/${defaultBranch}`;
      const refRes = await fetch(`${api}/git/ref/${refPath}`, { headers });
      if (refRes.ok) {
        const refData = (await refRes.json()) as { object: { sha: string } };
        parentSha = refData.object.sha;
        const commitRes0 = await fetch(`${api}/git/commits/${parentSha}`, { headers });
        if (commitRes0.ok) {
          baseTree = ((await commitRes0.json()) as { tree: { sha: string } }).tree.sha;
        }
      }

      /* 3) 파일별 blob 생성 */
      pushLog(`파일 ${files.length}개 커밋 시작...`);
      const blobShas: string[] = [];
      for (const f of files) {
        const blobRes = await fetch(`${api}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content: b64(f.content), encoding: 'base64' }),
        });
        if (!blobRes.ok) {
          pushLog(
            `블롭 생성 실패: ${f.path} (HTTP ${blobRes.status}) — ${await errMessage(blobRes)}`
          );
          return;
        }
        blobShas.push(((await blobRes.json()) as { sha: string }).sha);
      }

      /* 4) 트리 생성 — base_tree 는 존재할 때만 보낸다 (빈 문자열은 400) */
      const treeRes = await fetch(`${api}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tree: files.map((f, i) => ({
            path: f.path,
            mode: '100644',
            type: 'blob',
            sha: blobShas[i],
          })),
          ...(baseTree ? { base_tree: baseTree } : {}),
        }),
      });
      if (!treeRes.ok) {
        pushLog(`트리 생성 실패 (HTTP ${treeRes.status}) — ${await errMessage(treeRes)}`);
        return;
      }
      const treeSha = ((await treeRes.json()) as { sha: string }).sha;

      /* 5) 커밋 생성 — 기존 HEAD가 있으면 부모로 연결해야 히스토리가 끊기지 않는다 */
      const commitRes = await fetch(`${api}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: `docs: add ${files.length} files`,
          tree: treeSha,
          parents: parentSha ? [parentSha] : [],
        }),
      });
      if (!commitRes.ok) {
        pushLog(`커밋 생성 실패 (HTTP ${commitRes.status}) — ${await errMessage(commitRes)}`);
        return;
      }
      const commitSha = ((await commitRes.json()) as { sha: string }).sha;

      /* 6) ref 갱신 — 없으면 생성(POST), 있으면 갱신(PATCH) */
      const refUpdate = parentSha
        ? await fetch(`${api}/git/refs/${refPath}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ sha: commitSha, force: true }),
          })
        : await fetch(`${api}/git/refs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ref: `refs/${refPath}`, sha: commitSha }),
          });
      if (!refUpdate.ok) {
        pushLog(
          `브랜치 갱신 실패 (HTTP ${refUpdate.status}) — ${await errMessage(refUpdate)}`
        );
        return;
      }

      pushLog(`✅ ${files.length}개 파일 단일 커밋 완료`);
      const url = `https://github.com/${user}/${rp}`;
      setRepoUrl(url);
      pushLog(`🌐 저장소: ${url}`);
    } catch (e) {
      pushLog(`네트워크 오류: ${(e as Error).message}`);
    } finally {
      /* 성공/실패와 무관하게 busy 해제 + 토큰 폐기 (한 곳에서만 처리) */
      setBusy(false);
      setToken('');
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const f of files) zip.file(f.path, f.content);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autoembed-portfolio.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setZipped(true);
    setTimeout(() => setZipped(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f16]">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-white/[0.03] px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-900 text-base">🐙</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-white">GitHub 원클릭 배포</p>
          <p className="text-[10px] text-slate-500">심사관이 여는 저장소를 이 앱에서 직접 생성합니다 (README + 코드 + 문서 커밋)</p>
        </div>
        <button
          onClick={downloadZip}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5"
        >
          {zipped ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <DownloadIcon className="h-3.5 w-3.5" />}
          {zipped ? '완료' : 'zip 백업'}
        </button>
      </div>

      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400">GitHub 사용자명</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="octocat" className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1119] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/50" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400">저장소명</label>
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="autoembed-portfolio" className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1119] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/50" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold text-slate-400">Personal Access Token (repo 권한)</label>
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1119] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/50"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void deploy()}
            disabled={busy || savedProjects.length === 0}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95',
              busy || savedProjects.length === 0
                ? 'cursor-not-allowed bg-white/5 text-slate-500'
                : 'bg-gradient-to-r from-slate-200 to-white text-black shadow-lg hover:scale-[1.02]'
            )}
          >
            {busy ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                배포 중... (파일 {files.length}개)
              </>
            ) : (
              <>🐙 GitHub에 배포</>
            )}
          </button>
          {savedProjects.length === 0 && (
            <span className="text-xs text-slate-500">포트폴리오에 프로젝트를 먼저 저장하세요.</span>
          )}
        </div>

        {log.length > 0 && (
          <pre className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-white/5 bg-black/50 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-400">
            {log.join('\n')}
            {repoUrl && <span className="text-emerald-300">{`\n\n→ 저장소 열기: ${repoUrl}`}</span>}
          </pre>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
          토큰은 브라우저에 저장되지 않으며 GitHub API 호출에만 사용됩니다. 발급 방법: GitHub → Settings →
          Developer settings → Personal access tokens → Fine-grained tokens (Contents 읽기/쓰기 권한).
        </p>
      </div>
    </div>
  );
}
