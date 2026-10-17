import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThesisTracker from './ThesisTracker';
import { AUTOEMBED_THESIS } from '../utils/storage';

/* ---------------- 테스트 환경 준비 ---------------- */

let capturedBlobs: Blob[] = [];
let lastAnchor: HTMLAnchorElement | null = null;

async function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

function storedState() {
  return JSON.parse(localStorage.getItem(AUTOEMBED_THESIS) ?? '{}');
}

beforeEach(() => {
  localStorage.clear();
  capturedBlobs = [];
  lastAnchor = null;

  // jsdom 은 URL.createObjectURL 을 구현하지 않으므로 Blob 을 가로챈다.
  (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn((b: Blob) => {
    capturedBlobs.push(b);
    return 'blob:mock';
  });
  (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    lastAnchor = this;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ---------------- 렌더 / 진행률 ---------------- */

describe('ThesisTracker — 마일스톤 트래커', () => {
  it('7개 마일스톤과 0/7 진행률을 렌더한다', () => {
    render(<ThesisTracker />);
    expect(screen.getByRole('heading', { name: '논문 트래커' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
    expect(screen.getByText('0/7 완료')).toBeInTheDocument();
    expect(screen.getByText(/다음 할 일:/)).toBeInTheDocument();
  });

  it('마일스톤을 체크하면 진행률이 오르고 localStorage 에 저장된다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.click(screen.getByLabelText('주제 선정 (Themenwahl) 완료'));

    expect(screen.getByText('1/7 완료')).toBeInTheDocument();
    expect(storedState().milestones.topic.done).toBe(true);
  });

  it('저장된 상태를 다시 읽어 복원한다 (persistence 왕복)', async () => {
    const user = userEvent.setup();
    const first = render(<ThesisTracker />);
    await user.click(screen.getByLabelText('주제 선정 (Themenwahl) 완료'));
    expect(screen.getByText('1/7 완료')).toBeInTheDocument();
    first.unmount();

    render(<ThesisTracker />);
    expect(screen.getByText('1/7 완료')).toBeInTheDocument();
    expect(screen.getByLabelText('주제 선정 (Themenwahl) 완료')).toBeChecked();
  });

  it('목표일·메모 입력을 저장한다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.type(screen.getByLabelText('주제 선정 (Themenwahl) 메모'), '초안 정리');

    expect(storedState().milestones.topic.memo).toBe('초안 정리');
  });

  it('마일스톤 초기화 버튼이 완료 상태를 되돌린다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.click(screen.getByLabelText('Exposé 작성 완료'));
    expect(screen.getByText('1/7 완료')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '마일스톤 초기화' }));
    expect(screen.getByText('0/7 완료')).toBeInTheDocument();
  });

  it('깨진 저장 JSON 이 있어도 기본 상태로 렌더한다', () => {
    localStorage.setItem(AUTOEMBED_THESIS, '{ not valid json');
    render(<ThesisTracker />);
    expect(screen.getByText('0/7 완료')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
  });
});

/* ---------------- Exposé 생성기 ---------------- */

describe('ThesisTracker — Exposé 생성기', () => {
  const preview = () =>
    screen.getByText(
      (_content, el) => el?.tagName === 'PRE' && (el.textContent ?? '').includes('# Exposé')
    );

  it('입력하면 미리보기가 갱신된다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.type(screen.getByLabelText('Exposé 제목'), 'Embedded Thesis');
    await user.type(screen.getByLabelText('Exposé 연구 질문'), 'Can WCET be bounded?');

    const text = preview().textContent ?? '';
    expect(text).toContain('# Exposé — Embedded Thesis');
    expect(text).toContain('Can WCET be bounded?');
  });

  it('복사 버튼이 미리보기를 클립보드에 넣는다', async () => {
    // userEvent.setup() 이 클립보드 스텁을 설치하므로 readText 로 실제 값을 확인한다.
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.type(screen.getByLabelText('Exposé 제목'), 'Embedded Thesis');
    await user.click(screen.getByRole('button', { name: /복사$/ }));

    expect(await navigator.clipboard.readText()).toContain('Embedded Thesis');
  });

  it('입력 초기화가 Exposé 입력을 비운다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.type(screen.getByLabelText('Exposé 제목'), 'Temp');
    await user.click(screen.getByRole('button', { name: '입력 초기화' }));

    expect(screen.getByLabelText('Exposé 제목')).toHaveValue('');
  });
});

/* ---------------- LaTeX / BibTeX 다운로드 ---------------- */

describe('ThesisTracker — LaTeX / BibTeX 내보내기', () => {
  it('.tex 다운로드가 스캐폴드를 담은 파일을 만든다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.type(screen.getByLabelText('Exposé 제목'), 'Embedded Thesis');
    await user.click(screen.getByRole('button', { name: '.tex 다운로드' }));

    expect(capturedBlobs).toHaveLength(1);
    expect(lastAnchor?.download).toBe('thesis.tex');
    expect(await blobText(capturedBlobs[0])).toContain('\\documentclass');
  });

  it('.bib 다운로드가 참고문헌 항목을 만든다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.type(screen.getByLabelText('Exposé 참고문헌'), 'Doe | Paper | 2020');
    await user.click(screen.getByRole('button', { name: '.bib 다운로드' }));

    expect(capturedBlobs).toHaveLength(1);
    expect(lastAnchor?.download).toBe('references.bib');
    const text = await blobText(capturedBlobs[0]);
    expect(text).toContain('@misc{ref01,');
    expect(text).toContain('title  = {Paper}');
  });

  it('.md 다운로드가 Exposé 미리보기를 저장한다', async () => {
    const user = userEvent.setup();
    render(<ThesisTracker />);

    await user.type(screen.getByLabelText('Exposé 제목'), 'Embedded Thesis');
    await user.click(screen.getByRole('button', { name: '.md 다운로드' }));

    expect(lastAnchor?.download).toBe('thesis-expose.md');
    expect(await blobText(capturedBlobs[0])).toContain('# Exposé — Embedded Thesis');
  });
});
