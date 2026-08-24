import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepoExplorer from './RepoExplorer';
import { CURATED_REPOS } from '../data/curatedRepos';

/* ============================================================
 *  전역 fetch 를 GitHub API URL 패턴으로 라우팅하는 모킹 전략
 *  - /repos/{full}                → 메타(스타)
 *  - /repos/{full}/git/trees/...  → 파일 트리
 *  - raw.githubusercontent.com    → 파일 내용 (text())
 *  - /search/repositories?...     → 라이브 검색
 * ============================================================ */

const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonRes(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response;
}

function textRes(text: string, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    text: async () => text,
  } as unknown as Response;
}

/* ---------- 고정 응답 데이터 ---------- */

const REPO_FULL = CURATED_REPOS[0]?.full ?? 'TheAlgorithms/C';

const TREE_BLOBS = [
  { type: 'tree', path: 'src' },
  { type: 'blob', path: 'README.md' },
  { type: 'blob', path: 'src/motor_control.c' },
  { type: 'blob', path: 'exercises/lab01_blink.c' },
  { type: 'blob', path: 'inc/sensor.h' },
];

const SKELETON_CODE = [
  '#include <stdio.h>',
  '/* TODO: 두 수를 더해 출력하세요 */',
  'int main(void) {',
  '  printf("(PASS) done\\n");',
  '  return 0;',
  '}',
].join('\n');

const REFERENCE_CODE = 'int add(int a, int b) {\n  return a + b;\n}\n';

const SEARCH_HIT = {
  full_name: 'octocat/hello-c',
  description: 'hello embedded world',
  stargazers_count: 42,
  language: 'C',
};

/* ---------- URL 라우터 ---------- */

let respond: {
  meta: (full: string) => Response;
  tree: (full: string) => Response;
  raw: (full: string, path: string) => Response;
  search: (query: string) => Response;
};

beforeEach(() => {
  respond = {
    meta: (full) =>
      jsonRes(
        full === REPO_FULL
          ? { stargazers_count: 1234, description: '알고리즘 모음', license: { spdx_id: 'MIT' } }
          : { stargazers_count: 100, description: '기타 저장소', license: null }
      ),
    tree: () => jsonRes({ tree: TREE_BLOBS }),
    raw: (_full, path) => textRes(path.endsWith('.h') ? '#ifndef SENSOR_H\n#endif\n' : SKELETON_CODE),
    search: () => jsonRes({ items: [SEARCH_HIT] }),
  };

  mockFetch.mockReset();
  mockFetch.mockImplementation((input) => {
    const url = String(input);
    const meta = url.match(/^https:\/\/api\.github\.com\/repos\/([^/?#]+\/[^/?#]+)$/);
    if (meta) return Promise.resolve(respond.meta(meta[1] ?? ''));
    const tree = url.match(/^https:\/\/api\.github\.com\/repos\/([^/?#]+\/[^/?#]+)\/git\/trees\//);
    if (tree) return Promise.resolve(respond.tree(tree[1] ?? ''));
    const raw = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/?#]+\/[^/?#]+)\/HEAD\/(.+)$/);
    if (raw) return Promise.resolve(respond.raw(raw[1] ?? '', decodeURIComponent(raw[2] ?? '')));
    const search = url.match(/^https:\/\/api\.github\.com\/search\/repositories\?(.*)$/);
    if (search) return Promise.resolve(respond.search(search[1] ?? ''));
    return Promise.reject(new Error(`unhandled fetch: ${url}`));
  });

  vi.stubGlobal('fetch', mockFetch);

  /* jsdom 에 clipboard 가 없으므로 테스트용 스텁 */
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

/* ---------- 시나리오 단축 헬퍼 ---------- */

async function openFirstRepoFile(
  filePath: RegExp,
  badge: RegExp = /🧩 풀이 가능 \(TODO 감지\)/
): Promise<void> {
  const user = userEvent.setup();
  render(<RepoExplorer />);
  await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);
  await screen.findByText(/3개 C\/H 파일 발견/);
  await user.click(screen.getByRole('button', { name: filePath }));
  /* 에디터 배지는 고유하지만 트리 목록 라벨("풀이 가능" 등)과 부분 일치하므로 배지 전체 패턴 대기 */
  await screen.findByText(badge);
}

describe('RepoExplorer — 큐레이션 메타 조회', () => {
  it('마운트 시 추천 카드를 모두 렌더링하고 메타 API 를 호출한다', async () => {
    render(<RepoExplorer />);

    expect(screen.getAllByRole('button', { name: /파일 탐색하기/ })).toHaveLength(
      CURATED_REPOS.length
    );

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${REPO_FULL}`,
        expect.objectContaining({
          headers: { Accept: 'application/vnd.github+json' },
        })
      )
    );
  });

  it('메타 조회 성공 시 카드에 별 수를 표시한다', async () => {
    render(<RepoExplorer />);

    /* 첫 번째 저장소는 1234 별, 나머지는 100 별 */
    expect(await screen.findByText('★ 1,234')).toBeInTheDocument();
    expect(screen.getAllByText('★ 100')).toHaveLength(CURATED_REPOS.length - 1);
  });

  it('메타 조회가 실패해도 카드는 유지되고 "조회 중" 상태로 남는다', async () => {
    respond.meta = () => jsonRes({ message: 'Not Found' }, { ok: false, status: 404 });

    render(<RepoExplorer />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getAllByText(/조회 중/)).toHaveLength(CURATED_REPOS.length)
    );
  });
});

describe('RepoExplorer — 파일 트리 탐색', () => {
  it('"파일 탐색하기" 클릭 시 트리를 조회해 C/H 파일만 분류해서 보여준다', async () => {
    const user = userEvent.setup();
    render(<RepoExplorer />);

    await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);

    expect(await screen.findByText(/3개 C\/H 파일 발견/)).toBeInTheDocument();

    /* 경로 기반 분류: lab → 풀이 가능, 일반 .c → 참고 코드, .h → 헤더 */
    expect(screen.getByRole('button', { name: /exercises\/lab01_blink\.c/ }).textContent).toContain(
      '풀이 가능'
    );
    expect(screen.getByRole('button', { name: /motor_control\.c/ }).textContent).toContain(
      '참고 코드'
    );
    expect(screen.getByRole('button', { name: /sensor\.h/ }).textContent).toContain('헤더');

    /* blob 이 아니거나 C/H 가 아닌 파일은 제외된다 */
    expect(screen.queryByRole('button', { name: /README\.md/ })).toBeNull();
    expect(screen.queryByText(/3개 C\/H 파일 발견.*src$/)).toBeNull();

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`repos/${REPO_FULL}/git/trees/`),
        expect.anything()
      )
    );
  });

  it('트리 조회 실패 시 안내 메시지를 표시한다', async () => {
    respond.tree = () => jsonRes({ message: 'Not Found' }, { ok: false, status: 404 });

    const user = userEvent.setup();
    render(<RepoExplorer />);
    await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);

    expect(await screen.findByText(/트리 조회 실패 \(HTTP 404\)/)).toBeInTheDocument();
  });

  it('C/H 파일이 없는 저장소는 0개로 표시한다', async () => {
    respond.tree = () => jsonRes({ tree: [{ type: 'blob', path: 'README.md' }] });

    const user = userEvent.setup();
    render(<RepoExplorer />);
    await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);

    expect(await screen.findByText(/0개 C\/H 파일 발견/)).toBeInTheDocument();
  });
});

describe('RepoExplorer — 파일 열기·실행·채점', () => {
  it('TODO 가 있는 파일은 "풀이 가능"으로 분류되어 에디터에 열린다', async () => {
    await openFirstRepoFile(/exercises\/lab01_blink\.c/);

    expect(screen.getByText(/🧩 풀이 가능 \(TODO 감지\)/)).toBeInTheDocument();
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('에디터 textarea 없음');
    expect((textarea as HTMLTextAreaElement).value).toContain('TODO');
    /* 경로는 트리 목록과 에디터 헤더 양쪽에 표시된다 */
    expect(screen.getAllByText('exercises/lab01_blink.c').length).toBeGreaterThanOrEqual(2);
  });

  it('TODO 가 없는 파일은 "참고 코드"로 분류된다', async () => {
    respond.raw = (_full, path) =>
      textRes(path.includes('motor_control') ? REFERENCE_CODE : SKELETON_CODE);

    await openFirstRepoFile(/motor_control\.c/, /📖 참고 코드/);

    expect(screen.getByText(/📖 참고 코드/)).toBeInTheDocument();
    /* 참고 코드에는 "해결로 기록" 버튼이 없다 */
    expect(screen.queryByRole('button', { name: /해결로 기록/ })).toBeNull();
  });

  it('파일 내용 조회 실패 시 안내 메시지를 표시한다', async () => {
    respond.raw = () => textRes('', { ok: false, status: 404 });

    const user = userEvent.setup();
    render(<RepoExplorer />);
    await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);
    await screen.findByText(/3개 C\/H 파일 발견/);
    await user.click(screen.getByRole('button', { name: /exercises\/lab01_blink\.c/ }));

    expect(await screen.findByText(/파일 조회 실패 \(HTTP 404\)/)).toBeInTheDocument();
  });

  it('실행 후 기대 문자열이 모두 출력되면 채점 통과를 표시한다', async () => {
    const user = userEvent.setup();
    render(<RepoExplorer />);
    await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);
    await screen.findByText(/3개 C\/H 파일 발견/);
    await user.click(screen.getByRole('button', { name: /exercises\/lab01_blink\.c/ }));
    await screen.findByText(/TODO 감지/);

    await user.type(screen.getByPlaceholderText(/채점 기준/), '(PASS),done');
    await user.click(screen.getByRole('button', { name: /⚡ 실행/ }));

    expect(await screen.findByText(/✓ 채점 통과/)).toBeInTheDocument();
    /* 소스 하이라이트에도 동일 문자열이 있으므로 출력 <pre> 범위로 한정 검증 */
    const outputs = Array.from(document.querySelectorAll('pre'));
    expect(outputs.some((p) => p.textContent?.includes('(PASS) done'))).toBe(true);
  });

  it('기대 문자열이 출력에 없으면 미달 항목을 표시한다', async () => {
    const user = userEvent.setup();
    render(<RepoExplorer />);
    await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);
    await screen.findByText(/3개 C\/H 파일 발견/);
    await user.click(screen.getByRole('button', { name: /exercises\/lab01_blink\.c/ }));
    await screen.findByText(/TODO 감지/);

    await user.type(screen.getByPlaceholderText(/채점 기준/), '(NOPE)');
    await user.click(screen.getByRole('button', { name: /⚡ 실행/ }));

    expect(await screen.findByText(/△ 미달 항목/)).toBeInTheDocument();
    expect(screen.getByText(/"\(NOPE\)"/)).toBeInTheDocument();
  });

  it('"해결로 기록" 클릭 시 localStorage 에 저장되고 버튼이 해결 상태가 된다', async () => {
    const user = userEvent.setup();
    render(<RepoExplorer />);
    await user.click(screen.getAllByRole('button', { name: /파일 탐색하기/ })[0]!);
    await screen.findByText(/3개 C\/H 파일 발견/);
    await user.click(screen.getByRole('button', { name: /exercises\/lab01_blink\.c/ }));
    await screen.findByText(/TODO 감지/);

    await user.click(screen.getByRole('button', { name: '해결로 기록' }));

    expect(await screen.findByText(/✓ 해결 기록됨/)).toBeInTheDocument();
    const solvedKey = `${REPO_FULL}::exercises/lab01_blink.c`;
    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem('autoembed-repo-solved') ?? '[]'
      ) as string[];
      expect(stored).toContain(solvedKey);
    });
  });

  it('"복사" 클릭 시 코드가 클립보드에 기록되고 버튼이 "복사됨"으로 바뀐다', async () => {
    await openFirstRepoFile(/exercises\/lab01_blink\.c/);

    /* 전역 스텁은 restoreAllMocks 로 무력화될 수 있으므로 테스트 내에서 재정의 */
    /* userEvent.setup() 이 자체 클립보드 스텁을 설치하므로 setup 이후에 재정의해야 한다 */
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByRole('button', { name: '복사' }));

    expect(writeText).toHaveBeenCalledWith(SKELETON_CODE);
    expect(await screen.findByText('복사됨')).toBeInTheDocument();
  });

  it('".c 저장" 클릭 시 Blob 다운로드를 실행한다', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await openFirstRepoFile(/exercises\/lab01_blink\.c/);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /\.c 저장/ }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement | undefined;
    expect(anchor?.download).toBe('lab01_blink.c');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('RepoExplorer — 라이브 검색', () => {
  async function goToSearchTab(): Promise<void> {
    render(<RepoExplorer />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /라이브 검색/ }));
  }

  it('검색 탭에서는 추천 목록 대신 검색 입력이 노출된다', async () => {
    await goToSearchTab();

    expect(screen.getByPlaceholderText(/embedded c exercises/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /파일 탐색하기/ })).toBeNull();
    /* 쿼리가 비면 검색 버튼은 비활성화된다 */
    expect(screen.getByRole('button', { name: '검색' })).toBeDisabled();
  });

  it('검색 성공 시 결과 목록을 렌더링하고 Search API 를 호출한다', async () => {
    const user = userEvent.setup();
    await goToSearchTab();

    await user.type(screen.getByPlaceholderText(/embedded c exercises/), 'can protocol');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(await screen.findByText('octocat/hello-c')).toBeInTheDocument();
    expect(screen.getByText('★ 42')).toBeInTheDocument();
    expect(screen.getByText('hello embedded world')).toBeInTheDocument();

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search/repositories?q=can%20protocol+language:c&sort=stars'),
        expect.anything()
      )
    );
  });

  it('결과가 없으면 "결과가 없습니다" 메시지를 표시한다 (Enter 로도 검색)', async () => {
    respond.search = () => jsonRes({ items: [] });

    const user = userEvent.setup();
    await goToSearchTab();

    const input = screen.getByPlaceholderText(/embedded c exercises/);
    await user.type(input, 'nothing matches{Enter}');

    expect(await screen.findByText('결과가 없습니다')).toBeInTheDocument();
  });

  it('403 응답 시 검색 한도 초과 안내를 표시한다', async () => {
    respond.search = () => jsonRes({}, { ok: false, status: 403 });

    const user = userEvent.setup();
    await goToSearchTab();

    await user.type(screen.getByPlaceholderText(/embedded c exercises/), 'can protocol');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(await screen.findByText(/검색 횟수 한도 초과/)).toBeInTheDocument();
  });

  it('검색 결과의 "탐색" 버튼으로 해당 저장소의 트리를 연다', async () => {
    const user = userEvent.setup();
    await goToSearchTab();

    await user.type(screen.getByPlaceholderText(/embedded c exercises/), 'can protocol');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await screen.findByText('octocat/hello-c');

    await user.click(screen.getByRole('button', { name: /📂 탐색/ }));

    expect(await screen.findByText(/3개 C\/H 파일 발견/)).toBeInTheDocument();
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('repos/octocat/hello-c/git/trees/'),
        expect.anything()
      )
    );
  });
});
