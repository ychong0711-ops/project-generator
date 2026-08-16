import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GitHubDeploy from './GitHubDeploy';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const mockResponseOk = {
  ok: true,
  status: 210,
  json: async () => ({ id: 1, name: 'test-repo' }),
  text: async () => '{"id": 1, "name": "test-repo"}',
};

const mockResponseErr = {
  ok: false,
  status: 401,
  statusText: 'Unauthorized',
  json: async () => ({ message: 'Bad credentials' }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue(mockResponseOk);
});

describe('GitHubDeploy', () => {
  it('token state renders with initial empty string', () => {
    const { unmount } = render(<GitHubDeploy savedProjects={[]} />);
    const tokenInput = screen.getByPlaceholderText('github_pat_...');
    expect(tokenInput.value).toBe('');
    unmount();
  });

  it('deploy function calls API with proper headers and token', async () => {
    mockFetch.mockResolvedValue(mockResponseOk);

    const { container } = render(
      <GitHubDeploy savedProjects={[{ id: 'test', name: 'Test', description: 'Test' }]} />
    );

    // Find all inputs
    const inputs = container.querySelectorAll('input');
    
    // Find inputs by their placeholder texts
    const usernameInput = Array.from(inputs).find((inp) => inp.placeholder === 'octocat');
    const repoInput = Array.from(inputs).find((inp) => inp.placeholder === 'autoembed-portfolio');
    const tokenInput = Array.from(inputs).find((inp) => inp.placeholder === 'github_pat_...');

    expect(usernameInput).toBeDefined();
    expect(repoInput).toBeDefined();
    expect(tokenInput).toBeDefined();

    if (usernameInput && repoInput && tokenInput) {
      // Type username using userEvent.type
      await userEvent.type(usernameInput, 'octocat');
      await new Promise(process.nextTick);

      // Type repo using userEvent.type
      await userEvent.type(repoInput, 'my-repo');
      await new Promise(process.nextTick);

      // Type token using userEvent.type
      await userEvent.type(tokenInput, 'github_pat_test123');
      await new Promise(process.nextTick);

      // Click deploy button - find by class and disabled state
      const allButtons = container.querySelectorAll('button');
      const deployBtn = Array.from(allButtons).find((btn) => {
        const classes = btn.className || '';
        return classes.includes('rounded-xl') && !btn.disabled;
      });
      expect(deployBtn).toBeDefined();
      if (deployBtn) {
        await userEvent.click(deployBtn);

        // Wait for any pending fetches
        await new Promise(process.nextTick);

        // Verify fetch was called with proper authorization header
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        expect(lastCall).toBeDefined();
        expect(lastCall?.[0]).toBe('https://api.github.com/user/repos');
        expect(lastCall?.[1]?.headers?.Authorization).toBe('Bearer github_pat_test123');
      }
    }
  });

  it('finally block sets token to empty string after deploy completes', async () => {
    mockFetch.mockResolvedValue(mockResponseOk);

    const { container } = render(
      <GitHubDeploy savedProjects={[{ id: 'test', name: 'Test', description: 'Test' }]} />
    );

    // Find token input
    const inputs = container.querySelectorAll('input');
    const tokenInput = Array.from(inputs).find((inp) => inp.placeholder === 'github_pat_...');

    expect(tokenInput).toBeDefined();
    if (tokenInput) {
      // Type token using userEvent.type
      await userEvent.type(tokenInput, 'github_pat_test123');
      await new Promise(process.nextTick);

      // Click deploy button
      const allButtons = container.querySelectorAll('button');
      const deployBtn = Array.from(allButtons).find((btn) => {
        const classes = btn.className || '';
        return classes.includes('rounded-xl') && !btn.disabled;
      });
      expect(deployBtn).toBeDefined();
      if (deployBtn) {
        await userEvent.click(deployBtn);

        // Wait for state update with longer timeout for re-render
        await waitFor(() => {
          const inputs2 = container.querySelectorAll('input');
          const tokenInput2 = Array.from(inputs2).find((inp) => inp.placeholder === 'github_pat_...');
          expect(tokenInput2).toBeDefined();
          if (tokenInput2) {
            expect(tokenInput2.value).toBe('');
          }
        }, { timeout: 1000 });

        // Also verify busy state is false after completion
        const buttons2 = container.querySelectorAll('button');
        const deployBtn2 = Array.from(buttons2).find((btn) => {
          const classes = btn.className || '';
          return classes.includes('rounded-xl') && !btn.disabled;
        });
        expect(deployBtn2).toBeEnabled();
      }
    }
  });

  it('deploy function handles error cases and still clears token in finally block', async () => {
    mockFetch.mockResolvedValue(mockResponseErr);

    const { container } = render(
      <GitHubDeploy savedProjects={[{ id: 'test', name: 'Test', description: 'Test' }]} />
    );

    // Find token input
    const inputs = container.querySelectorAll('input');
    const tokenInput = Array.from(inputs).find((inp) => inp.placeholder === 'github_pat_...');

    expect(tokenInput).toBeDefined();
    if (tokenInput) {
      // Type token using userEvent.type
      await userEvent.type(tokenInput, 'invalid_token');
      await new Promise(process.nextTick);

      // Click deploy button
      const allButtons = container.querySelectorAll('button');
      const deployBtn = Array.from(allButtons).find((btn) => {
        const classes = btn.className || '';
        return classes.includes('rounded-xl') && !btn.disabled;
      });
      expect(deployBtn).toBeDefined();
      if (deployBtn) {
        await userEvent.click(deployBtn);

        // Wait for state update
        await waitFor(() => {
          const inputs2 = container.querySelectorAll('input');
          const tokenInput2 = Array.from(inputs2).find((inp) => inp.placeholder === 'github_pat_...');
          expect(tokenInput2).toBeDefined();
          if (tokenInput2) {
            expect(tokenInput2.value).toBe('');
          }
        }, { timeout: 1000 });
      }
    }
  });
});