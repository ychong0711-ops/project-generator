import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LabExercises from './LabExercises';
import { ALL_ENTRIES } from '../data/practice-examples';
import { makeProject } from '../test/fixtures';

/* window.open 모의 — 새 탭 열기 동작 검증용 */
let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  openSpy.mockRestore();
});

const withVideo = ALL_ENTRIES.filter(
  (e) => typeof e.videoUrl === 'string' && e.videoUrl.trim().length > 0
);
const BADGE_NAME = /학습 영상 새 탭에서 열기/;

describe('LabExercises — 영상 미리보기 배지', () => {
  it('크래시 없이 렌더링된다', () => {
    const { container } = render(<LabExercises savedProjects={[makeProject()]} />);
    expect(container.childNodes.length).toBeGreaterThan(0);
  });

  it('videoUrl 이 있는 항목에만 영상 배지가 노출된다', () => {
    render(<LabExercises savedProjects={[]} />);
    expect(withVideo.length).toBeGreaterThan(0);

    const badges = screen.getAllByRole('button', { name: BADGE_NAME });
    expect(badges).toHaveLength(withVideo.length);
  });

  it('영상 배지 클릭 시 entry.videoUrl 을 새 탭으로 연다', async () => {
    const user = userEvent.setup();
    render(<LabExercises savedProjects={[]} />);

    const target = withVideo[0];
    await user.click(screen.getByRole('button', { name: `${target.title} 학습 영상 새 탭에서 열기` }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(target.videoUrl, '_blank', 'noopener,noreferrer');
  });

  it('배지 클릭이 카드의 원래 동작(풀이 화면 전환)을 발동시키지 않는다', async () => {
    const user = userEvent.setup();
    render(<LabExercises savedProjects={[]} />);

    const labTarget = withVideo.find((e) => e.type === 'lab')!;
    await user.click(screen.getByRole('button', { name: `${labTarget.title} 학습 영상 새 탭에서 열기` }));

    /* 목록 화면이 그대로 유지되고, window.open 은 정확히 한 번만 호출된다 */
    expect(screen.getAllByRole('button', { name: BADGE_NAME }).length).toBe(withVideo.length);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('videoUrl 이 없는 항목에는 배지가 렌더링되지 않는다', () => {
    render(<LabExercises savedProjects={[]} />);

    const noVideo = ALL_ENTRIES.filter(
      (e) => !(typeof e.videoUrl === 'string' && e.videoUrl.trim().length > 0)
    );
    expect(noVideo.length).toBeGreaterThan(0);
    /* 접근성 트리 반복 스캔은 계측(coverage) 시 느려지므로 버튼 이름을 한 번만 수집해 비교 */
    const badgeNames = new Set(
      screen.getAllByRole('button').map((b) => b.textContent ?? '')
    );
    for (const entry of noVideo) {
      expect(badgeNames.has(`${entry.title} 학습 영상 새 탭에서 열기`)).toBe(false);
    }
  });

  it('키보드 Enter 로도 영상을 열 수 있다', async () => {
    const user = userEvent.setup();
    render(<LabExercises savedProjects={[]} />);

    const target = withVideo[0];
    const badge = screen.getByRole('button', { name: `${target.title} 학습 영상 새 탭에서 열기` });
    badge.focus();
    await user.keyboard('{Enter}');

    expect(openSpy).toHaveBeenCalledWith(target.videoUrl, '_blank', 'noopener,noreferrer');
  });
});
