import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextbookTracks from './TextbookTracks';
import { TEXTBOOK_TRACKS, type CustomProblem } from '../data/textbooks';
import { LAB_EXAMPLES } from '../data/labs';

/* ---------- 헬퍼 ---------- */

function renderTracks(overrides: Partial<Parameters<typeof TextbookTracks>[0]> = {}) {
  const onOpenLab = vi.fn<(id: string, skeleton: string) => void>();
  const onOpenCustom = vi.fn<(p: CustomProblem) => void>();
  const onCustomChange = vi.fn<(list: CustomProblem[]) => void>();
  const props = {
    solvedIds: [] as string[],
    onOpenLab,
    onOpenCustom,
    customProblems: [] as CustomProblem[],
    onCustomChange,
    ...overrides,
  };
  render(<TextbookTracks {...props} />);
  return { ...props, onOpenLab, onOpenCustom, onCustomChange };
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CUSTOM_KEY = 'autoembed-custom-labs';

const sampleProblem: CustomProblem = {
  id: 'custom-x',
  title: '교재 7장 연습문제',
  desc: '타이머 계산',
  skeleton: 'int main(void) { return 0; }',
  expect: ['(PASS)'],
};

beforeEach(() => {
  localStorage.clear();
});

describe('TextbookTracks — 트랙 렌더링', () => {
  it('모든 트랙의 이름을 렌더링한다', () => {
    renderTracks();
    for (const track of TEXTBOOK_TRACKS) {
      expect(screen.getByText(track.name)).toBeInTheDocument();
    }
  });

  it('모든 챕터 번호와 제목을 렌더링한다', () => {
    renderTracks();
    const chapters = TEXTBOOK_TRACKS.flatMap((t) => t.chapters);
    for (const ch of chapters) {
      /* 번호("1장")·제목은 트랙 전역에서 중복될 수 있으므로 존재 유지만 검증 */
      expect(screen.getAllByText(ch.title).length).toBeGreaterThan(0);
      expect(screen.getAllByText(ch.num).length).toBeGreaterThan(0);
    }
  });

  it('solvedIds 로 트랙별 진행률(N/M 문제)을 계산한다', () => {
    const track0 = TEXTBOOK_TRACKS[0];
    if (!track0) throw new Error('TEXTBOOK_TRACKS 가 비어 있음');
    const labs = track0.chapters.flatMap((c) => c.labIds);
    expect(labs.length).toBeGreaterThan(0);

    const solved = labs.slice(0, 3);
    renderTracks({ solvedIds: solved });

    expect(screen.getByText(`${solved.length}/${labs.length} 문제`)).toBeInTheDocument();
    /* 미해결 트랙은 0 으로 표시된다 */
    const other = TEXTBOOK_TRACKS[1];
    if (other) {
      const otherLabs = other.chapters.flatMap((c) => c.labIds);
      expect(screen.getByText(`0/${otherLabs.length} 문제`)).toBeInTheDocument();
    }
  });
});

describe('TextbookTracks — 챕터 실습 연결', () => {
  it('챕터의 실습 버튼 클릭 시 onOpenLab(id, skeleton) 을 호출한다', async () => {
    const user = userEvent.setup();
    const { onOpenLab } = renderTracks();

    const chapter = TEXTBOOK_TRACKS[0]?.chapters[0];
    if (!chapter) throw new Error('챕터가 없음');
    const labId = chapter.labIds[0];
    if (!labId) throw new Error('1장 챕터에 labId 가 없음');
    const lab = LAB_EXAMPLES.find((l) => l.id === labId);
    if (!lab) throw new Error(`LAB_EXAMPLES 에 ${labId} 없음`);

    await user.click(screen.getByRole('button', { name: new RegExp(esc(lab.title)) }));

    expect(onOpenLab).toHaveBeenCalledTimes(1);
    expect(onOpenLab).toHaveBeenCalledWith(labId, lab.skeleton);
  });

  it('해결한 실습 버튼은 해결 스타일로 표시된다', () => {
    const chapter = TEXTBOOK_TRACKS[0]?.chapters[0];
    if (!chapter) throw new Error('챕터가 없음');
    const labId = chapter.labIds[0];
    if (!labId) throw new Error('labId 가 없음');
    const lab = LAB_EXAMPLES.find((l) => l.id === labId);
    if (!lab) throw new Error('lab 을 찾을 수 없음');

    renderTracks({ solvedIds: [labId] });

    const btn = screen.getByRole('button', { name: new RegExp(esc(lab.title)) });
    expect(btn.className).toContain('emerald');
    expect(btn.textContent).not.toContain('▶');
  });

  it('labId 가 없는 챕터는 샘플 코드 안내로 대체한다', () => {
    renderTracks();
    const emptyChapters = TEXTBOOK_TRACKS.flatMap((t) => t.chapters).filter(
      (c) => c.labIds.length === 0
    );
    expect(emptyChapters.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/코드 랩의 관련 샘플 코드로 실습하세요/)
    ).toHaveLength(emptyChapters.length);
  });
});

describe('TextbookTracks — 내 문제 만들기', () => {
  it('제목·스켈레톤이 비면 등록하지 않고 안내문을 표시한다', async () => {
    const user = userEvent.setup();
    const { onCustomChange } = renderTracks();

    await user.click(screen.getByRole('button', { name: '문제 등록하기' }));

    expect(screen.getByText('제목과 스켈레톤 코드는 필수입니다.')).toBeInTheDocument();
    expect(onCustomChange).not.toHaveBeenCalled();
    expect(localStorage.getItem(CUSTOM_KEY)).toBeNull();
  });

  it('정상 입력 시 문제를 등록하고 localStorage 에 저장·폼을 비운다', async () => {
    const user = userEvent.setup();
    const { onCustomChange } = renderTracks();

    await user.type(screen.getByPlaceholderText(/문제 제목/), '7장 연습문제 3');
    await user.type(screen.getByPlaceholderText(/스켈레톤 C 코드/), 'int main(void){{}return 0;}');
    await user.type(screen.getByPlaceholderText(/채점 기준/), '(PASS), done ,');
    await user.click(screen.getByRole('button', { name: '문제 등록하기' }));

    expect(onCustomChange).toHaveBeenCalledTimes(1);
    const list = onCustomChange.mock.calls[0]?.[0] ?? [];
    expect(list).toHaveLength(1);
    expect(list[0]?.id.startsWith('custom-')).toBe(true);
    expect(list[0]).toMatchObject({
      title: '7장 연습문제 3',
      desc: '내 교재의 실습 문제',
      expect: ['(PASS)', 'done'],
    });

    const saved = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') as CustomProblem[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.title).toBe('7장 연습문제 3');

    expect(await screen.findByText(/✅ 문제가 등록되었습니다/)).toBeInTheDocument();
    expect((screen.getByPlaceholderText(/문제 제목/) as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText(/스켈레톤 C 코드/) as HTMLTextAreaElement).value).toBe('');
  });
});

describe('TextbookTracks — 등록된 내 문제 목록', () => {
  it('등록된 문제를 렌더링하고 "풀기" 클릭 시 onOpenCustom 을 호출한다', async () => {
    const user = userEvent.setup();
    const { onOpenCustom } = renderTracks({ customProblems: [sampleProblem] });

    expect(screen.getByText(/내가 등록한 문제 \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(sampleProblem.title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /풀기/ }));
    expect(onOpenCustom).toHaveBeenCalledWith(sampleProblem);
  });

  it('삭제 버튼 클릭 시 목록에서 제거하고 localStorage 를 갱신한다', async () => {
    const user = userEvent.setup();
    const { onCustomChange } = renderTracks({ customProblems: [sampleProblem] });

    const row = screen.getByText(sampleProblem.title).closest('div');
    if (!row) throw new Error('문제 행을 찾을 수 없음');
    const deleteBtn = within(row)
      .getAllByRole('button')
      .find((b) => !b.textContent.includes('풀기'));
    if (!deleteBtn) throw new Error('삭제 버튼을 찾을 수 없음');

    await user.click(deleteBtn);

    expect(onCustomChange).toHaveBeenCalledWith([]);
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]')).toHaveLength(0);
  });

  it('solvedIds 에 포함된 내 문제는 해결 배지를 표시한다', () => {
    renderTracks({ customProblems: [sampleProblem], solvedIds: [sampleProblem.id] });
    expect(screen.getByText('✓ 해결')).toBeInTheDocument();
  });
});
