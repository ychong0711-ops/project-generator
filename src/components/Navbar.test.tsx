import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from './Navbar';

function renderNavbar(props: Partial<Parameters<typeof Navbar>[0]> = {}) {
  return render(<Navbar active="home" onChange={() => {}} savedCount={0} {...props} />);
}

beforeEach(() => {
  // jsdom 은 레이아웃을 계산하지 않으므로 scrollIntoView 가 없다.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Navbar', () => {
  it('탭 9개를 모두 렌더링한다', () => {
    renderNavbar();
    const nav = screen.getByRole('navigation');
    expect(nav.querySelectorAll('button')).toHaveLength(9);
  });

  it('탭 클릭 시 해당 id 로 onChange 가 호출된다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderNavbar({ onChange });
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

  /* 회귀 방지: 실제 폭 측정은 jsdom 에서 불가하므로 문자 수로 상한을 건다. */
  it('탭 라벨 총 길이가 상한 이내다', () => {
    const labels = [
      '홈', '프로젝트 생성기', '대학 정보', '입학 로드맵',
      '내 포트폴리오', '경쟁력 센터', '실습 예제', '사용 가이드',
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
});
