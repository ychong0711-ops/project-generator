// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchRepoMeta,
  fetchRepoTree,
  fetchFileContent,
  classifyContent,
  searchRepos,
} from './repoAdapter';

/* ---------- fetch 목 헬퍼 ---------- */

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function textResponse(text: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function stubFetch() {
  vi.stubGlobal('fetch', fetchMock);
}

describe('classifyContent — 코드 내용 기반 스켈레톤 판정', () => {
  it('TODO 주석이 있으면 skeleton 이다', () => {
    expect(classifyContent('int main(void) { /* TODO: 구현 */ }')).toBe('skeleton');
  });

  it('FIXME / IMPLEMENT / YOUR CODE / ??? 도 skeleton 으로 판정한다', () => {
    expect(classifyContent('// FIXME 나중에 고침')).toBe('skeleton');
    expect(classifyContent('// IMPLEMENT THIS')).toBe('skeleton');
    expect(classifyContent('// YOUR CODE HERE')).toBe('skeleton');
    expect(classifyContent('uint8_t x = ???;')).toBe('skeleton');
  });

  it('대소문자를 구분하지 않는다', () => {
    expect(classifyContent('// todo: fill in')).toBe('skeleton');
    expect(classifyContent('// your code here')).toBe('skeleton');
  });

  it('마커가 없는 완성 코드는 reference 이다', () => {
    expect(classifyContent('#include <stdio.h>\nint main(void){return 0;}')).toBe('reference');
  });

  it('빈 문자열은 reference 이다 (경계)', () => {
    expect(classifyContent('')).toBe('reference');
  });
});

describe('fetchRepoMeta — 저장소 메타 조회', () => {
  it('정상 응답에서 스타/설명/라이선스를 파싱한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        stargazers_count: 1234,
        description: 'CRC 연습 저장소',
        license: { spdx_id: 'MIT' },
      })
    );

    const meta = await fetchRepoMeta('user/repo');

    expect(meta).toEqual({ stars: 1234, desc: 'CRC 연습 저장소', license: 'MIT', ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/user/repo',
      expect.objectContaining({ headers: { Accept: 'application/vnd.github+json' } })
    );
  });

  it('필드가 누락된 응답은 기본값(0/빈문자열/null)으로 채운다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    const meta = await fetchRepoMeta('user/repo');

    expect(meta).toEqual({ stars: 0, desc: '', license: null, ok: true });
  });

  it('HTTP 실패 시 ok:false 인 결과를 반환한다 (throw 하지 않음)', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 404));

    const meta = await fetchRepoMeta('user/none');

    expect(meta.ok).toBe(false);
    expect(meta.stars).toBe(0);
    expect(meta.license).toBeNull();
  });

  it('네트워크 예외 발생 시에도 ok:false 로 귀결된다', async () => {
    stubFetch();
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));

    const meta = await fetchRepoMeta('user/repo');

    expect(meta).toEqual({ stars: 0, desc: '', license: null, ok: false });
  });
});

describe('fetchRepoTree — 파일 트리 조회·분류', () => {
  function treeResponse(items: { type?: string; path?: string }[]) {
    return jsonResponse({ tree: items });
  }

  it('.c/.h 파일만 골라 경로 기준으로 분류한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(
      treeResponse([
        { type: 'blob', path: 'labs/lab01_crc8.c' },
        { type: 'blob', path: 'inc/crc.h' },
        { type: 'blob', path: 'src/ref_impl.c' },
        { type: 'blob', path: 'README.md' },
        { type: 'tree', path: 'src' },
        { type: 'blob', path: '' },
      ])
    );

    const files = await fetchRepoTree('user/repo');

    expect(files.map((f) => f.path)).toEqual(['labs/lab01_crc8.c', 'inc/crc.h', 'src/ref_impl.c']);
    expect(files[0]).toMatchObject({ name: 'lab01_crc8.c', kind: 'skeleton' });
    expect(files[1].kind).toBe('header');
    expect(files[2].kind).toBe('reference');
  });

  it('확장자 대소문자(.C/.H)도 분류한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(
      treeResponse([
        { type: 'blob', path: 'SRC/Main.C' },
        { type: 'blob', path: 'INC/Util.H' },
      ])
    );

    const files = await fetchRepoTree('user/repo');

    expect(files[0].kind).toBe('reference');
    expect(files[1].kind).toBe('header');
  });

  it('최대 60개로 제한한다', async () => {
    stubFetch();
    const items = Array.from({ length: 70 }, (_, i) => ({
      type: 'blob',
      path: `src/file${i}.c`,
    }));
    fetchMock.mockResolvedValueOnce(treeResponse(items));

    const files = await fetchRepoTree('user/repo');

    expect(files.length).toBe(60);
  });

  it('HTTP 실패 시 한국어 메시지로 throw 한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ tree: [] }, false, 404));

    await expect(fetchRepoTree('user/private')).rejects.toThrow('트리 조회 실패 (HTTP 404)');
  });
});

describe('fetchFileContent — raw 파일 내용 조회', () => {
  it('정상 응답에서 파일 본문을 반환한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(textResponse('int main(void){return 0;}'));

    const src = await fetchFileContent('user/repo', 'labs/lab01.c');

    expect(src).toBe('int main(void){return 0;}');
    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/user/repo/HEAD/labs/lab01.c');
  });

  it('HTTP 실패 시 throw 한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(textResponse('', false, 404));

    await expect(fetchFileContent('user/repo', 'nope.c')).rejects.toThrow('파일 조회 실패 (HTTP 404)');
  });
});

describe('searchRepos — GitHub 라이브 검색', () => {
  it('검색 결과를 SearchHit 로 매핑하고 쿼리를 인코딩한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            full_name: 'a/crc',
            description: null,
            stargazers_count: 42,
            language: undefined,
          },
          {
            full_name: 'b/lin',
            description: 'LIN tools',
            stargazers_count: 7,
            language: 'C',
          },
        ],
      })
    );

    const hits = await searchRepos('crc8 임베디드');

    expect(hits).toEqual([
      { full_name: 'a/crc', description: '', stars: 42, language: 'C' },
      { full_name: 'b/lin', description: 'LIN tools', stars: 7, language: 'C' },
    ]);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent('crc8 임베디드'));
    expect(url).toContain('language:c');
    expect(url).toContain('per_page=10');
  });

  it('items 가 없으면 빈 배열을 반환한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await expect(searchRepos('x')).resolves.toEqual([]);
  });

  it('403 은 레이트 리밋 안내 메시지로 throw 한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 403));

    await expect(searchRepos('x')).rejects.toThrow('검색 횟수 한도 초과');
  });

  it('그 외 HTTP 오류는 일반 실패 메시지로 throw 한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));

    await expect(searchRepos('x')).rejects.toThrow('검색 실패 (HTTP 500)');
  });
});
