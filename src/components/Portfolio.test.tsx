import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Portfolio from './Portfolio';
import { PROJECTS } from '../data/projects';
import type { Phase } from '../types';

const noop = () => {};

function renderPortfolio(phase: Phase, savedProjects: typeof PROJECTS = []) {
  return render(
    <Portfolio
      savedProjects={savedProjects}
      onView={noop}
      onRemove={noop}
      onClear={noop}
      onGoGenerate={noop}
      phase={phase}
    />
  );
}

/* 회귀 방지: study/thesis 에서는 generator 탭이 숨겨지므로,
   generator 로 가는 CTA 를 그대로 두면 눌러도 홈으로 착지하는
   반응 없는 버튼이 된다. */
describe('Portfolio — 단계별 생성기 링크 노출', () => {
  it('apply 단계에서는 "프로젝트 생성하러 가기" CTA 를 노출한다', () => {
    renderPortfolio('apply');
    expect(screen.getByRole('button', { name: /프로젝트 생성하러 가기/ })).toBeInTheDocument();
  });

  it('study 단계에서는 "프로젝트 생성하러 가기" CTA 를 숨긴다', () => {
    renderPortfolio('study');
    expect(screen.queryByRole('button', { name: /프로젝트 생성하러 가기/ })).toBeNull();
  });

  it('thesis 단계에서도 "프로젝트 생성하러 가기" CTA 를 숨긴다', () => {
    renderPortfolio('thesis');
    expect(screen.queryByRole('button', { name: /프로젝트 생성하러 가기/ })).toBeNull();
  });
});

describe('Portfolio — 단계별 프로젝트 상세 링크', () => {
  const one = [PROJECTS[0]];

  it('apply 단계에서는 저장된 프로젝트에 "상세 보기" 를 노출한다', () => {
    renderPortfolio('apply', one);
    expect(screen.getByRole('button', { name: /상세 보기/ })).toBeInTheDocument();
  });

  /* 상세는 phase 무관 오버레이로 열리므로 study / thesis 에서도 노출된다. */
  it('study 단계에서도 "상세 보기" 를 노출한다', () => {
    renderPortfolio('study', one);
    expect(screen.getByRole('button', { name: /상세 보기/ })).toBeInTheDocument();
  });

  it('thesis 단계에서도 "상세 보기" 를 노출한다', () => {
    renderPortfolio('thesis', one);
    expect(screen.getByRole('button', { name: /상세 보기/ })).toBeInTheDocument();
  });

  it('"상세 보기" 클릭 시 해당 프로젝트 id 로 onView 가 호출된다', async () => {
    const onView = vi.fn();
    render(
      <Portfolio
        savedProjects={one}
        onView={onView}
        onRemove={noop}
        onClear={noop}
        onGoGenerate={noop}
        phase="thesis"
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /상세 보기/ }));
    expect(onView).toHaveBeenCalledWith(PROJECTS[0].id);
  });
});
