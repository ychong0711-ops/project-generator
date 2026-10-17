import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectDetailOverlay from './ProjectDetailOverlay';
import { makeProject } from '../test/fixtures';

function renderOverlay(overrides: { onClose?: () => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const project = makeProject({ id: 'p1', title: '상세 오버레이 프로젝트' });
  const utils = render(
    <ProjectDetailOverlay
      project={project}
      saved={false}
      onToggleSave={() => {}}
      onClose={onClose}
    />
  );
  return { ...utils, onClose, project };
}

beforeEach(() => {
  document.body.style.overflow = '';
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ProjectDetailOverlay', () => {
  it('(a) 다이얼로그(role/aria-modal)와 프로젝트 제목을 렌더링한다', () => {
    const { project } = renderOverlay();
    const dialog = screen.getByRole('dialog', { name: project.title });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // 제목이 (헤더와 ProjectCard 양쪽에) 노출된다
    expect(screen.getAllByText(project.title).length).toBeGreaterThan(0);
  });

  it('(b) Esc 키로 onClose 가 호출된다', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('(c) 배경 클릭으로 onClose 가 호출된다', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.click(screen.getByTestId('overlay-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('(d) 패널 내부 클릭은 onClose 를 호출하지 않는다', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('(e) 닫힐 때 이전 포커스 요소로 복귀한다', () => {
    render(<button>열기</button>);
    const opener = screen.getByRole('button', { name: '열기' });
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = renderOverlay();
    expect(document.activeElement).not.toBe(opener); // 오버레이로 포커스 이동

    unmount();
    expect(document.activeElement).toBe(opener); // 복귀
  });

  it('열려 있는 동안 body 스크롤을 잠그고, 닫힘 시 원복한다', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = renderOverlay();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('열릴 때 포커스가 오버레이 안으로 이동한다', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  /* 회귀 방지: 트랩이 없으면 Tab 이 오버레이 밖(배경 페이지)으로 새어 나가
     배경 콘텐츠가 키보드로 조작 가능해진다. */
  it('포커스 트랩: Tab 은 패널 안 첫 요소로, Shift+Tab 은 마지막 요소로 순환한다', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog');

    // 패널 자체에 포커스가 있을 때 Tab → 패널 내부 첫 포커서블로 이동
    dialog.focus();
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(window, { key: 'Tab' });
    const first = document.activeElement as HTMLElement;
    expect(dialog.contains(first)).toBe(true);
    expect(first).not.toBe(dialog);

    // 첫 요소에서 Shift+Tab → 패널 내부 마지막 포커서블로 이동(밖으로 나가지 않음)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    const last = document.activeElement as HTMLElement;
    expect(dialog.contains(last)).toBe(true);
    expect(last).not.toBe(first);
  });
});
