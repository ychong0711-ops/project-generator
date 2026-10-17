import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SemesterPlanner from './SemesterPlanner';
import { AUTOEMBED_SEMESTER } from '../utils/storage';

/* ---------------- 테스트 환경 준비 ---------------- */

function storedState() {
  return JSON.parse(localStorage.getItem(AUTOEMBED_SEMESTER) ?? '{"semesters":[]}');
}

function storedCourses(semesterIndex: number): Record<string, unknown>[] {
  const state = storedState() as { semesters: { index: number; courses: Record<string, unknown>[] }[] };
  return state.semesters.find((s) => s.index === semesterIndex)?.courses ?? [];
}

/** 과목 추가 폼을 채워 넣고 제출한다. */
async function addCourse(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  opts: { ects?: string; klausur?: boolean } = {}
) {
  await user.type(screen.getByLabelText('새 과목 이름'), name);
  if (opts.ects !== undefined) {
    const ects = screen.getByLabelText('새 과목 ECTS');
    await user.clear(ects);
    await user.type(ects, opts.ects);
  }
  if (opts.klausur) {
    await user.click(screen.getByLabelText('새 과목 Klausur 여부'));
  }
  await user.click(screen.getByRole('button', { name: '과목 추가' }));
}

beforeEach(() => {
  localStorage.clear();
});

/* ---------------- 렌더 / ECTS 진행률 ---------------- */

describe('SemesterPlanner — 렌더와 ECTS 진행률', () => {
  it('제목과 4개 학기 탭, 0/120 진행률을 렌더한다', () => {
    render(<SemesterPlanner />);
    expect(screen.getByRole('heading', { name: '학기 플래너', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByText('0/120 ECTS')).toBeInTheDocument();
    expect(screen.getByText(/남은 학점/)).toHaveTextContent('120 ECTS');
  });

  it('기본 선택은 1학기이고 탭 전환이 된다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    expect(screen.getByRole('tab', { name: /1학기/ })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: /3학기/ }));
    expect(screen.getByRole('tab', { name: /3학기/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('3학기 과목')).toBeInTheDocument();
  });

  it('Bologna 120 ECTS 안내 문구를 보여준다', () => {
    render(<SemesterPlanner />);
    expect(screen.getByText(/Bologna 기준 독일 석사는 보통 4학기/)).toBeInTheDocument();
  });
});

/* ---------------- 과목 추가 / 삭제 ---------------- */

describe('SemesterPlanner — 과목 추가/삭제', () => {
  it('과목을 추가하면 목록과 저장소에 반영된다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);

    await addCourse(user, 'Embedded Systems', { ects: '6' });

    expect(screen.getByLabelText('Embedded Systems ECTS')).toHaveValue(6);
    expect(storedCourses(1)).toHaveLength(1);
    // 추가만으로는 이수(획득) ECTS 가 늘지 않는다.
    expect(screen.getByText('이수 0/6 ECTS · 학기당 30 ECTS 기준')).toBeInTheDocument();

    // '이수 완료'를 체크해야 획득 ECTS 에 반영된다.
    await user.click(screen.getByLabelText('Embedded Systems 이수 완료'));
    expect(screen.getByText('이수 6/6 ECTS · 학기당 30 ECTS 기준')).toBeInTheDocument();
  });

  it('이름이 비면 추가하지 않는다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await user.click(screen.getByRole('button', { name: '과목 추가' }));
    expect(screen.getByText(/아직 추가된 과목이 없습니다/)).toBeInTheDocument();
    expect(storedCourses(1)).toHaveLength(0);
  });

  it('과목을 삭제한다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await addCourse(user, 'Temp', { ects: '4' });
    expect(storedCourses(1)).toHaveLength(1);

    await user.click(screen.getByLabelText('Temp 삭제'));
    expect(screen.getByText(/아직 추가된 과목이 없습니다/)).toBeInTheDocument();
    expect(storedCourses(1)).toHaveLength(0);
  });

  it('선택한 학기에만 과목을 추가한다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await user.click(screen.getByRole('tab', { name: /2학기/ }));
    await addCourse(user, 'Signal Processing', { ects: '5' });

    expect(storedCourses(2)).toHaveLength(1);
    expect(storedCourses(1)).toHaveLength(0);
  });
});

/* ---------------- ECTS 진행률 수학 ---------------- */

describe('SemesterPlanner — ECTS 진행률', () => {
  it('이수 완료 체크 시 진행률과 남은 학점이 갱신된다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await addCourse(user, 'Control Engineering', { ects: '10' });

    // 아직 미완료 — 이수 ECTS 0
    expect(screen.getByText('0/120 ECTS')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Control Engineering 이수 완료'));

    expect(screen.getByText('10/120 ECTS')).toBeInTheDocument();
    expect(screen.getByText(/남은 학점/)).toHaveTextContent('110 ECTS');
    expect(storedCourses(1)[0]).toMatchObject({ ects: 10, completed: true });
  });
});

/* ---------------- 성적 처리 ---------------- */

describe('SemesterPlanner — 성적 처리', () => {
  it('성적을 선택하면 저장되고 평균에 반영된다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await addCourse(user, 'Microelectronics', { ects: '5' });

    await user.selectOptions(screen.getByLabelText('Microelectronics 성적'), '2.0');

    expect(storedCourses(1)[0]).toMatchObject({ grade: 2.0 });
    expect(screen.getByText(/ECTS 가중 평균 성적:/)).toHaveTextContent('2.00');
  });

  it('이수 완료 + 합격 성적이면 bestanden 을 표시한다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await addCourse(user, 'Real-Time Systems', { ects: '5' });

    await user.selectOptions(screen.getByLabelText('Real-Time Systems 성적'), '3.0');
    await user.click(screen.getByLabelText('Real-Time Systems 이수 완료'));

    expect(screen.getByText('bestanden')).toBeInTheDocument();
  });
});

/* ---------------- Klausur 관리 ---------------- */

describe('SemesterPlanner — Klausur 관리', () => {
  it('Klausur 과목만 시험 목록에 나타나고 체크할 수 있다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await addCourse(user, 'MitKlausur', { ects: '6', klausur: true });
    await addCourse(user, 'OhneKlausur', { ects: '6' });

    // 시험 패널에는 Klausur 과목만
    const examList = screen.getByText('Klausur 기간 관리').closest('div')!.parentElement!;
    expect(within(examList).getByText('MitKlausur')).toBeInTheDocument();
    expect(within(examList).queryByText('OhneKlausur')).not.toBeInTheDocument();
    expect(screen.getByText(/열린 시험 1개/)).toBeInTheDocument();

    await user.click(screen.getByLabelText('MitKlausur Klausur 완료'));
    expect(screen.getByText(/열린 시험 0개/)).toBeInTheDocument();
    expect(storedCourses(1).find((c) => c.name === 'MitKlausur')).toMatchObject({
      klausurDone: true,
    });
  });
});

/* ---------------- 지속성 / 폴백 ---------------- */

describe('SemesterPlanner — 저장/복원', () => {
  it('저장된 과목을 다시 읽어 복원한다 (persistence 왕복)', async () => {
    const user = userEvent.setup();
    const first = render(<SemesterPlanner />);
    await addCourse(user, 'Embedded Software', { ects: '6' });
    await user.click(screen.getByLabelText('Embedded Software 이수 완료'));
    expect(screen.getByText('6/120 ECTS')).toBeInTheDocument();
    first.unmount();

    render(<SemesterPlanner />);
    expect(screen.getByText('6/120 ECTS')).toBeInTheDocument();
    expect(screen.getByLabelText('Embedded Software 이수 완료')).toBeChecked();
  });

  it('깨진 저장 JSON 이 있어도 기본 상태로 렌더한다', () => {
    localStorage.setItem(AUTOEMBED_SEMESTER, '{ not valid json');
    render(<SemesterPlanner />);
    expect(screen.getByText('0/120 ECTS')).toBeInTheDocument();
    expect(screen.getByText(/아직 추가된 과목이 없습니다/)).toBeInTheDocument();
  });

  it('형식이 다른 JSON 도 안전하게 처리한다', () => {
    localStorage.setItem(AUTOEMBED_SEMESTER, JSON.stringify({ semesters: 'oops' }));
    render(<SemesterPlanner />);
    expect(screen.getByText('0/120 ECTS')).toBeInTheDocument();
  });
});

/* ---------------- 예시 프리셋 ---------------- */

describe('SemesterPlanner — 예시 프리셋', () => {
  it('세 대학 예시 카드를 예시 라벨과 함께 렌더한다', () => {
    render(<SemesterPlanner />);
    expect(screen.getByText('RPTU')).toBeInTheDocument();
    expect(screen.getByText('TU Chemnitz')).toBeInTheDocument();
    expect(screen.getByText('TU Dortmund')).toBeInTheDocument();
    expect(screen.getAllByText('예시').length).toBeGreaterThanOrEqual(3);
  });

  it('프리셋을 불러오면 선택한 학기에 예시 과목이 추가된다', async () => {
    const user = userEvent.setup();
    render(<SemesterPlanner />);
    await user.click(
      screen.getByRole('button', { name: 'RPTU CVT / ECE 예시를 1학기에 추가' })
    );

    const courses = storedCourses(1) as { name: string }[];
    expect(courses).toHaveLength(5);
    expect(courses.map((c) => c.name)).toContain('Embedded Systems');
    expect(screen.getByText(/예시 과목 5개를 1학기에 추가했습니다/)).toBeInTheDocument();
  });
});
