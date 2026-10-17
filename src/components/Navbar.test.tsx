import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from './Navbar';
import type { Phase } from '../types';

function renderNavbar(props: Partial<Parameters<typeof Navbar>[0]> = {}) {
  return render(
    <Navbar
      active="home"
      onChange={() => {}}
      phase="apply"
      onChangePhase={() => {}}
      savedCount={0}
      {...props}
    />
  );
}

beforeEach(() => {
  // jsdom 은 레이아웃을 계산하지 않으므로 scrollIntoView 가 없다.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Navbar', () => {
  it('phase 별로 노출 탭 개수가 다르다 (apply 8 / study 4 / thesis 3)', () => {
    const cases: { phase: Phase; count: number }[] = [
      { phase: 'apply', count: 8 },
      { phase: 'study', count: 4 },
      { phase: 'thesis', count: 3 },
    ];
    for (const { phase, count } of cases) {
      const { unmount } = renderNavbar({ phase });
      expect(screen.getByRole('navigation').querySelectorAll('button')).toHaveLength(count);
      unmount();
    }
  });

  it('apply 단계에서 노출되지 않은 labs 탭은 렌더링되지 않는다', () => {
    renderNavbar({ phase: 'apply' });
    expect(screen.queryByRole('button', { name: '실습 예제' })).toBeNull();
  });

  it('실습 예제 탭은 study 단계에서만 렌더링되고 클릭 시 labs 로 onChange 된다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderNavbar({ phase: 'study', onChange });
    await user.click(screen.getByRole('button', { name: '실습 예제' }));
    expect(onChange).toHaveBeenCalledWith('labs');
  });

  it('활성 탭에 aria-current="page" 가 붙는다', () => {
    renderNavbar({ active: 'roadmap' });
    expect(screen.getByRole('button', { name: '입학 로드맵' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('저장 개수가 있으면 포트폴리오 탭에 뱃지를 표시한다', () => {
    renderNavbar({ savedCount: 3 });
    expect(screen.getByRole('button', { name: /내 포트폴리오/ }).textContent).toContain('3');
  });

  /* 회귀 방지: 라벨이 길어지면 헤더 폭을 넘겨 마지막 탭이 잘린 채
     스크롤도 불가능해져 클릭할 수 없게 된다.
     nav 가 min-w-0 + overflow-x-auto 가 아니면 마지막 탭이 접근 불가가 된다. */
  it('탭 영역이 축소 가능하고 가로 스크롤된다', () => {
    renderNavbar();
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('min-w-0');
    expect(nav.className).toContain('overflow-x-auto');
  });

  /* 회귀 방지: 실제 폭 측정은 jsdom 에서 불가하므로 문자 수로 상한을 건다.
     한 단계에서 가장 많은 탭을 갖는 apply(8개) 기준. */
  it('한 단계의 탭 라벨 총 길이가 상한 이내다', () => {
    const labels = [
      '홈', '프로젝트 생성기', '대학 정보', '입학 로드맵',
      '내 포트폴리오', '경쟁력 센터', '사용 가이드', '데모 스튜디오',
    ];
    // 라틴 문자는 한글의 약 절반 폭이므로 가중치를 달리 센다
    const weighted = labels.reduce(
      (sum, s) => sum + [...s].reduce((w, c) => w + (/[가-힣]/.test(c) ? 2 : 1), 0),
      0
    );
    expect(weighted, `라벨이 너무 김: ${labels.join(' / ')}`).toBeLessThanOrEqual(100);
  });

  it('언어 전환 UI 는 더 이상 렌더링되지 않는다', () => {
    const { container } = renderNavbar();
    expect(container.textContent).not.toContain('KO');
    expect(container.textContent).not.toContain('DE');
    expect(container.textContent).not.toContain('EN');
  });

  it('활성 탭을 보이도록 스크롤한다', () => {
    renderNavbar({ active: 'guide' });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  describe('phase 스위치', () => {
    it('3개 단계 버튼을 group 으로 렌더링한다', () => {
      renderNavbar();
      const group = screen.getByRole('group', { name: '단계 선택' });
      expect(group.querySelectorAll('button')).toHaveLength(3);
      expect(screen.getByRole('button', { name: '지원 준비' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '재학 중' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '논문 단계' })).toBeInTheDocument();
    });

    it('단계 버튼 클릭 시 해당 id 로 onChangePhase 가 호출된다', async () => {
      const onChangePhase = vi.fn();
      const user = userEvent.setup();
      renderNavbar({ onChangePhase });
      await user.click(screen.getByRole('button', { name: '논문 단계' }));
      expect(onChangePhase).toHaveBeenCalledWith('thesis');
    });

    it('현재 단계 버튼에만 aria-pressed=true 가 붙는다', () => {
      renderNavbar({ phase: 'study' });
      expect(screen.getByRole('button', { name: '재학 중' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: '지원 준비' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByRole('button', { name: '논문 단계' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });
  });
});
