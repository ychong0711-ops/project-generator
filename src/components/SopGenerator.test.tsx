import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SopGenerator from './SopGenerator';
import { PROJECTS } from '../data/projects';
import { UNIVERSITIES } from '../data/universities';
import { AUTOEMBED_SAVED_PROJECTS } from '../utils/storage';
import { generateSop } from '../data/generator';

/* 실제 구현을 유지하되 개별 테스트에서 Once 모의로 오류 경로를 검증한다 */
vi.mock('../data/generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/generator')>();
  return { ...actual, generateSop: vi.fn(actual.generateSop) };
});

type User = ReturnType<typeof userEvent.setup>;

/* window.open 처럼 jsdom에 없는 클립보드를 모킹 */
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText },
  });
  vi.mocked(generateSop).mockClear();
});

afterEach(() => {
  Reflect.deleteProperty(navigator as object, 'clipboard');
});

/* 첫 프로젝트를 체크하고 초안 생성까지 진행하는 헬퍼 */
async function checkFirstAndGenerate(user: User) {
  await user.click(screen.getAllByRole('checkbox')[0]);
  await user.click(screen.getByRole('button', { name: /동기서 초안 생성/ }));
}

describe('SopGenerator', () => {
  it('크래시 없이 렌더링되며, 초기에는 생성 버튼이 비활성화된다', () => {
    render(<SopGenerator />);

    expect(screen.getByRole('combobox', { name: '대학 선택' })).toBeInTheDocument();
    expect(screen.getByText('0개 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /동기서 초안 생성/ })).toBeDisabled();
  });

  it('프로젝트 체크 시 선택 카운트가 늘고 생성 버튼이 활성화된다', async () => {
    const user = userEvent.setup();
    render(<SopGenerator />);

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByText('1개 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /동기서 초안 생성/ })).toBeEnabled();
  });

  it('생성 시 generateSop 이 호출되고 제목·섹션이 표시된다', async () => {
    const user = userEvent.setup();
    render(<SopGenerator />);

    await checkFirstAndGenerate(user);

    expect(await screen.findByText(`Motivationsschreiben — ${UNIVERSITIES[0].name}`)).toBeInTheDocument();
    expect(screen.getByText('서론')).toBeInTheDocument();
    expect(vi.mocked(generateSop)).toHaveBeenCalledWith(
      expect.objectContaining({ uniId: UNIVERSITIES[0].id, projectIds: [PROJECTS[0].id] })
    );
  });

  it('복사 버튼이 plainText 를 클립보드에 쓰고 완료 피드백을 보여준다', async () => {
    const user = userEvent.setup();
    // userEvent.setup() 이 navigator.clipboard 를 자체 목업으로 교체하므로,
    // 검증 가능한 vi.fn 목업을 setup 이후 다시 정의한다
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText },
    });

    render(<SopGenerator />);
    await checkFirstAndGenerate(user);

    await user.click(await screen.findByRole('button', { name: '복사' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Motivationsschreiben'));
    expect(await screen.findByText('복사됨 ✓')).toBeInTheDocument();
  });

  it('.txt 다운로드 버튼이 Blob 을 만들고 다운로드를 트리거한다', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    const user = userEvent.setup();
    render(<SopGenerator />);
    await checkFirstAndGenerate(user);

    await user.click(await screen.findByRole('button', { name: /.txt 다운로드/ }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('생성 실패 시 에러 메시지가 빨간 배너로 표시된다', async () => {
    vi.mocked(generateSop).mockImplementationOnce(() => {
      throw new Error('유효한 프로젝트가 없습니다.');
    });

    const user = userEvent.setup();
    render(<SopGenerator />);
    await checkFirstAndGenerate(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('유효한 프로젝트가 없습니다.');
    expect(screen.queryByText(new RegExp(`^Motivationsschreiben`))).toBeNull();
  });

  it('마운트 시 저장된 프로젝트를 한 번만 미리 체크한다', async () => {
    localStorage.setItem(AUTOEMBED_SAVED_PROJECTS, JSON.stringify([PROJECTS[0].id]));

    render(<SopGenerator />);

    expect(await screen.findByText('1개 선택')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
  });
});
