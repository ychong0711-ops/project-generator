// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LAB_EXAMPLES, fetchRepoIndex } from './labs';

const LEVELS = ['입문', '중급', '심화'] as const;

describe('LAB_EXAMPLES — 내장 실습 예제 은행 무결성', () => {
  it('예제가 12개이고 id 가 중복되지 않는다', () => {
    expect(LAB_EXAMPLES.length).toBe(12);
    const ids = LAB_EXAMPLES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 예제가 필수 필드를 가진다 (title/desc/category/hints/expect)', () => {
    for (const lab of LAB_EXAMPLES) {
      expect(lab.id).toMatch(/^lab\d+_/);
      expect(lab.title.length).toBeGreaterThan(0);
      expect(lab.desc.length).toBeGreaterThan(0);
      expect(lab.category.length).toBeGreaterThan(0);
      expect(LEVELS).toContain(lab.level);
      expect(lab.hints.length).toBeGreaterThan(0);
      expect(lab.expect.length).toBeGreaterThan(0);
    }
  });

  it('스켈레톤은 TODO 마커와 main 함수를 포함하고 기대 출력에 (PASS) 가 있다', () => {
    for (const lab of LAB_EXAMPLES) {
      expect(lab.skeleton).toContain('TODO');
      expect(lab.skeleton).toContain('int main(void)');
      expect(lab.expect).toContain('(PASS)');
    }
  });

  it('기대 출력은 스켈레톤의 printf 문자열과 일치한다 (채점 기준 정합성)', () => {
    for (const lab of LAB_EXAMPLES) {
      for (const e of lab.expect) {
        expect(lab.skeleton).toContain(e);
      }
    }
  });
});

describe('fetchRepoIndex — GitHub 저장소 예제 인덱스 로딩', () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function stubFetch() {
    vi.stubGlobal('fetch', fetchMock);
  }

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

  it('인덱스와 각 예제 .c 파일을 병렬로 가져와 규격대로 조립한다', async () => {
    stubFetch();
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith('/labs/index.json')) {
        return Promise.resolve(
          jsonResponse({
            title: '외부 랩',
            examples: [
              { id: 'ex1', title: '예제 1', desc: '설명 1', expect: ['OK'] },
              { id: 'ex2', title: '예제 2', desc: '설명 2' },
            ],
          })
        );
      }
      if (u.endsWith('/labs/ex1.c')) return Promise.resolve(textResponse('// ex1 source'));
      if (u.endsWith('/labs/ex2.c')) return Promise.resolve(textResponse('// ex2 source'));
      return Promise.resolve(textResponse('', false, 404));
    });

    const labs = await fetchRepoIndex('user/repo', 'dev');

    // 인덱스 URL 에 repo/branch 반영 확인
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://raw.githubusercontent.com/user/repo/dev/labs/index.json'
    );
    expect(labs).toEqual([
      { id: 'ex1', title: '예제 1', desc: '설명 1', skeleton: '// ex1 source', expect: ['OK'] },
      { id: 'ex2', title: '예제 2', desc: '설명 2', skeleton: '// ex2 source', expect: [] },
    ]);
  });

  it('branch 를 생략하면 main 을 사용한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ examples: [] }));

    await fetchRepoIndex('user/repo');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://raw.githubusercontent.com/user/repo/main/labs/index.json'
    );
  });

  it('개별 .c 파일 조회 실패 시 해당 예제만 건너뛴다', async () => {
    stubFetch();
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith('/labs/index.json')) {
        return Promise.resolve(
          jsonResponse({
            examples: [
              { id: 'good', title: '정상', desc: 'd' },
              { id: 'missing', title: '유실', desc: 'd' },
            ],
          })
        );
      }
      if (u.endsWith('/labs/good.c')) return Promise.resolve(textResponse('// ok'));
      return Promise.resolve(textResponse('', false, 404));
    });

    const labs = await fetchRepoIndex('user/repo');

    expect(labs.length).toBe(1);
    expect(labs[0].id).toBe('good');
  });

  it('개별 .c 파일 fetch 가 네트워크 예외로 실패해도 건너뛴다', async () => {
    stubFetch();
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith('/labs/index.json')) {
        return Promise.resolve(
          jsonResponse({ examples: [{ id: 'boom', title: 't', desc: 'd' }] })
        );
      }
      return Promise.reject(new TypeError('network error'));
    });

    await expect(fetchRepoIndex('user/repo')).resolves.toEqual([]);
  });

  it('index.json HTTP 오류 시 throw 한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 404));

    await expect(fetchRepoIndex('user/none')).rejects.toThrow('HTTP 404');
  });

  it('examples 배열이 없으면 형식 오류로 throw 한다', async () => {
    stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse({ title: '잘못된 인덱스' }));

    await expect(fetchRepoIndex('user/repo')).rejects.toThrow('examples 배열 필요');
  });
});
