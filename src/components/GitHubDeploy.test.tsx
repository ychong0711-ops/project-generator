import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubDeploy from './GitHubDeploy';
import { makeProject } from '../test/fixtures';

const project = makeProject();

const mockFetch = vi.fn();

function jsonRes(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  /* 모든 GitHub API 호출에 대해 sha 를 반환하는 기본 성공 응답 */
  mockFetch.mockResolvedValue(
    jsonRes({ sha: 'abc123', default_branch: 'main', object: { sha: 'p1' }, tree: { sha: 't1' } })
  );
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const tokenInput = () => screen.getByPlaceholderText('github_pat_...') as HTMLInputElement;
const deployBtn = () => screen.getByRole('button', { name: /GitHub에 배포/ });

describe('GitHubDeploy', () => {
  it('토큰 입력은 빈 문자열로 시작한다', () => {
    render(<GitHubDeploy savedProjects={[]} />);
    expect(tokenInput().value).toBe('');
  });

  it('저장된 프로젝트가 없으면 배포 버튼이 비활성화된다', () => {
    render(<GitHubDeploy savedProjects={[]} />);
    expect(deployBtn()).toBeDisabled();
  });

  it('배포 시 Authorization 헤더에 토큰을 실어 API를 호출한다', async () => {
    const user = userEvent.setup();
    render(<GitHubDeploy savedProjects={[project]} />);

    await user.type(screen.getByPlaceholderText('octocat'), 'octocat');
    await user.type(tokenInput(), 'github_pat_test123');
    await user.click(deployBtn());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/user/repos');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer github_pat_test123'
    );
  });

  it('배포가 끝나면 finally 블록에서 토큰을 비운다', async () => {
    const user = userEvent.setup();
    render(<GitHubDeploy savedProjects={[project]} />);

    await user.type(screen.getByPlaceholderText('octocat'), 'octocat');
    await user.type(tokenInput(), 'github_pat_test123');
    await user.click(deployBtn());

    await waitFor(() => expect(tokenInput().value).toBe(''));
    await waitFor(() => expect(deployBtn()).toBeEnabled());
  });

  it('401 오류가 나도 토큰을 비우고 안내 메시지를 남긴다', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue(jsonRes({ message: 'Bad credentials' }, { ok: false, status: 401 }));

    render(<GitHubDeploy savedProjects={[project]} />);
    await user.type(screen.getByPlaceholderText('octocat'), 'octocat');
    await user.type(tokenInput(), 'invalid_token');
    await user.click(deployBtn());

    await waitFor(() => expect(tokenInput().value).toBe(''));
    expect(await screen.findByText(/토큰이 유효하지 않습니다/)).toBeInTheDocument();
  });

  it('네트워크 예외가 나도 busy 상태가 풀린다', async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValue(new Error('offline'));

    render(<GitHubDeploy savedProjects={[project]} />);
    await user.type(screen.getByPlaceholderText('octocat'), 'octocat');
    await user.type(tokenInput(), 'github_pat_test123');
    await user.click(deployBtn());

    await waitFor(() => expect(deployBtn()).toBeEnabled());
    expect(await screen.findByText(/네트워크 오류/)).toBeInTheDocument();
  });
});
