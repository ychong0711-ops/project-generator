import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Navbar from './Navbar';
import ko from '../locales/ko/translation.json';
import de from '../locales/de/translation.json';
import en from '../locales/en/translation.json';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { ko: { translation: ko }, de: { translation: de }, en: { translation: en } },
    lng: 'ko',
    fallbackLng: 'ko',
  });
}

function renderNavbar(props: Partial<Parameters<typeof Navbar>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Navbar active="home" onChange={() => {}} savedCount={0} {...props} />
    </I18nextProvider>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
  // jsdom 은 레이아웃을 계산하지 않으므로 scrollIntoView 가 없다.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Navbar', () => {
  it('탭 8개를 모두 렌더링한다', () => {
    renderNavbar();
    const nav = screen.getByRole('navigation');
    // 언어 전환 버튼(KO/DE/EN)은 nav 밖이므로 포함되지 않아야 한다
    expect(nav.querySelectorAll('button')).toHaveLength(8);
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

  /* 회귀 방지: 독일어/영어 라벨은 한국어보다 훨씬 길어 헤더 폭을 넘긴다.
     nav 가 min-w-0 + overflow-x-auto 가 아니면 마지막 탭이 잘린 채
     스크롤도 불가능해져 클릭할 수 없게 된다. */
  it('탭 영역이 축소 가능하고 가로 스크롤된다', () => {
    renderNavbar();
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('min-w-0');
    expect(nav.className).toContain('overflow-x-auto');
  });

  it('언어 전환 버튼이 헤더 안에 있고 탭 위에 겹치지 않는다', () => {
    const { container } = renderNavbar();
    const header = container.querySelector('header')!;
    expect(header.textContent).toContain('KO');
    expect(header.textContent).toContain('DE');
    // absolute 오버레이로 띄우면 탭을 가린다 (과거 버그)
    expect(container.querySelector('.absolute.top-0.right-0')).toBeNull();
  });

  it.each([
    ['de', 'Projekt-Generator'],
    ['en', 'Project Generator'],
  ])('언어(%s) 전환 시 탭 라벨이 번역된다', async (lng, expected) => {
    await i18n.changeLanguage(lng);
    renderNavbar();
    // 접근성 이름은 축약형이 아닌 전체 명칭이어야 한다
    expect(screen.getByRole('button', { name: expected })).toBeInTheDocument();
  });

  it('축약 라벨을 쓰되 툴팁/접근성 이름에는 전체 명칭을 유지한다', async () => {
    await i18n.changeLanguage('de');
    renderNavbar();
    const btn = screen.getByRole('button', { name: 'Wettbewerbsfähigkeit' });
    expect(btn.textContent).toBe('Wettbewerb'); // 화면에는 축약형
    expect(btn).toHaveAttribute('title', 'Wettbewerbsfähigkeit');
  });

  /* 회귀 방지: 라벨이 길어지면 헤더 폭을 넘겨 마지막 탭이 잘린다.
     실제 폭 측정은 jsdom 에서 불가하므로 문자 수로 상한을 건다.
     (독일어 합성어가 길어 과거 995px 로 초과, 2개 탭이 접근 불가였다) */
  it.each(['ko', 'de', 'en'])('언어(%s) 탭 라벨 총 길이가 상한 이내다', (lng) => {
    const dict = { ko, de, en }[lng] as Record<string, string>;
    const keys = [
      'navHome', 'navGenerator', 'navUniversities', 'navRoadmap',
      'navPortfolio', 'navCompete', 'navLabs', 'navGuide',
    ];
    const labels = keys.map((k) => dict[k]);
    // 라틴 문자는 한글의 약 절반 폭이므로 가중치를 달리 센다
    const weighted = labels.reduce(
      (sum, s) => sum + [...s].reduce((w, c) => w + (/[가-힣]/.test(c) ? 2 : 1), 0),
      0
    );
    expect(weighted, `${lng} 라벨이 너무 김: ${labels.join(' / ')}`).toBeLessThanOrEqual(100);
  });

  it('활성 탭을 보이도록 스크롤한다', () => {
    renderNavbar({ active: 'guide' });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
