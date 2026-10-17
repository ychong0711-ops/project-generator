import { describe, it, expect, beforeEach } from 'vitest';
import { AUTOEMBED_SEMESTER } from '../utils/storage';
import {
  COURSE_TYPES,
  DEFAULT_COURSE_ECTS,
  ECTS_PER_SEMESTER,
  GERMAN_GRADE_STEPS,
  MASTER_SEMESTERS,
  STUDY_NOTES,
  STUDY_PRESETS,
  TOTAL_ECTS_TARGET,
  addCourse,
  averageGrade,
  countCompletedCourses,
  createCourse,
  defaultSemester,
  defaultStudyState,
  ectsProgressPercent,
  findSemester,
  isBestanden,
  isPassingGrade,
  klausurCourses,
  loadStudyState,
  normalizeStudyState,
  openKlausuren,
  presetToCourses,
  remainingEcts,
  removeCourse,
  saveStudyState,
  semesterEcts,
  semesterEctsEarned,
  totalEctsEarned,
  totalEctsPlanned,
  updateCourse,
} from './study';

beforeEach(() => {
  localStorage.clear();
});

/* ---------------- 상수 / Bologna 관행 ---------------- */

describe('상수 — Bologna 공통 관행', () => {
  it('4학기 · 학기당 30 ECTS · 총 120 ECTS', () => {
    expect(MASTER_SEMESTERS).toBe(4);
    expect(ECTS_PER_SEMESTER).toBe(30);
    expect(TOTAL_ECTS_TARGET).toBe(120);
    expect(TOTAL_ECTS_TARGET).toBe(MASTER_SEMESTERS * ECTS_PER_SEMESTER);
  });

  it('일반적인 수업 유형 4종을 정의한다', () => {
    expect([...COURSE_TYPES]).toEqual(['Vorlesung', 'Übung', 'Praktikum', 'Seminar']);
  });

  it('성적 눈금은 1.0–4.0 범위이고 안내 문구에 120 ECTS가 있다', () => {
    expect(GERMAN_GRADE_STEPS[0]).toBe(1.0);
    expect(GERMAN_GRADE_STEPS[GERMAN_GRADE_STEPS.length - 1]).toBe(4.0);
    expect(STUDY_NOTES.join(' ')).toContain('120 ECTS');
    expect(STUDY_NOTES.join(' ')).toContain('Bologna');
  });
});

/* ---------------- 기본 상태 ---------------- */

describe('defaultStudyState', () => {
  it('빈 4학기를 순서대로 만든다', () => {
    const s = defaultStudyState();
    expect(s.semesters).toHaveLength(4);
    expect(s.semesters.map((x) => x.index)).toEqual([1, 2, 3, 4]);
    for (const sem of s.semesters) expect(sem.courses).toEqual([]);
  });

  it('기본 집계는 모두 0이고 남은 ECTS는 120이다', () => {
    const s = defaultStudyState();
    expect(totalEctsPlanned(s)).toBe(0);
    expect(totalEctsEarned(s)).toBe(0);
    expect(remainingEcts(s)).toBe(120);
    expect(ectsProgressPercent(s)).toBe(0);
    expect(averageGrade(s)).toBeNull();
  });

  it('defaultSemester 는 빈 과목 목록을 돌려준다', () => {
    const sem = defaultSemester(2);
    expect(sem.index).toBe(2);
    expect(sem.courses).toEqual([]);
  });
});

/* ---------------- 편집 연산 ---------------- */

describe('addCourse / updateCourse / removeCourse', () => {
  const withCourse = () => {
    const course = createCourse({ name: 'Embedded Systems', type: 'Vorlesung', ects: 6 });
    return { base: defaultStudyState(), course };
  };

  it('과목을 추가하고 원본은 변형하지 않는다', () => {
    const { base, course } = withCourse();
    const next = addCourse(base, 1, course);
    expect(findSemester(next, 1)?.courses).toHaveLength(1);
    // 원본 상태는 변하지 않아야 한다 (불변 연산)
    expect(base.semesters[0].courses).toHaveLength(0);
  });

  it('과목을 수정한다 (id 는 유지)', () => {
    const { base, course } = withCourse();
    const state = addCourse(base, 2, course);
    const next = updateCourse(state, 2, course.id, { ects: 8, completed: true, grade: 2.3 });
    const updated = findSemester(next, 2)?.courses[0];
    expect(updated?.id).toBe(course.id);
    expect(updated?.ects).toBe(8);
    expect(updated?.completed).toBe(true);
    expect(updated?.grade).toBe(2.3);
  });

  it('과목을 삭제한다', () => {
    const { base, course } = withCourse();
    const state = addCourse(base, 3, course);
    const next = removeCourse(state, 3, course.id);
    expect(findSemester(next, 3)?.courses).toHaveLength(0);
  });
});

/* ---------------- ECTS 집계 ---------------- */

describe('ECTS 집계와 남은 학점 수학', () => {
  const build = () => {
    let s = defaultStudyState();
    // 1학기: 이수 완료 6 + 6, 미이수 6 = 계획 18, 이수 12
    s = addCourse(s, 1, createCourse({ name: 'A', ects: 6, completed: true, grade: 2.0 }));
    s = addCourse(s, 1, createCourse({ name: 'B', ects: 6, completed: true, grade: 3.0 }));
    s = addCourse(s, 1, createCourse({ name: 'C', ects: 6, completed: false }));
    // 2학기: 이수 30
    s = addCourse(s, 2, createCourse({ name: 'D', ects: 30, completed: true, grade: 1.7 }));
    return s;
  };

  it('학기별 계획·이수 ECTS를 계산한다', () => {
    const s = build();
    const sem1 = findSemester(s, 1)!;
    expect(semesterEcts(sem1)).toBe(18);
    expect(semesterEctsEarned(sem1)).toBe(12);
    const sem2 = findSemester(s, 2)!;
    expect(semesterEcts(sem2)).toBe(30);
    expect(semesterEctsEarned(sem2)).toBe(30);
  });

  it('전체 계획·이수 ECTS와 남은 ECTS를 계산한다', () => {
    const s = build();
    expect(totalEctsPlanned(s)).toBe(48);
    expect(totalEctsEarned(s)).toBe(42);
    expect(remainingEcts(s)).toBe(78);
    expect(countCompletedCourses(s)).toBe(3);
  });

  it('진행률은 이수 ECTS / 120 을 반올림한 값이다', () => {
    const s = build(); // 42 / 120 = 35%
    expect(ectsProgressPercent(s)).toBe(35);
  });

  it('120 ECTS를 넘겨도 남은 학점은 0, 진행률은 100이다', () => {
    let s = defaultStudyState();
    s = addCourse(s, 1, createCourse({ name: 'X', ects: 130, completed: true }));
    expect(totalEctsEarned(s)).toBe(130);
    expect(remainingEcts(s)).toBe(0);
    expect(ectsProgressPercent(s)).toBe(100);
  });

  it('findSemester 는 없는 학기에 undefined 를 돌려준다', () => {
    expect(findSemester(defaultStudyState(), 5)).toBeUndefined();
  });
});

/* ---------------- 성적 처리 ---------------- */

describe('성적 처리 (1.0–4.0 / bestanden)', () => {
  it('isPassingGrade 는 1.0–4.0 만 통과시킨다', () => {
    expect(isPassingGrade(1.0)).toBe(true);
    expect(isPassingGrade(4.0)).toBe(true);
    expect(isPassingGrade(3.7)).toBe(true);
    expect(isPassingGrade(4.3)).toBe(false);
    expect(isPassingGrade(0.7)).toBe(false);
    expect(isPassingGrade(null)).toBe(false);
  });

  it('isBestanden 은 이수 완료 + 합격 성적일 때만 참이다', () => {
    expect(isBestanden(createCourse({ completed: true, grade: 2.0 }))).toBe(true);
    expect(isBestanden(createCourse({ completed: false, grade: 2.0 }))).toBe(false);
    expect(isBestanden(createCourse({ completed: true, grade: null }))).toBe(false);
  });

  it('averageGrade 는 ECTS 가중 평균을 낸다', () => {
    let s = defaultStudyState();
    s = addCourse(s, 1, createCourse({ name: 'A', ects: 5, grade: 2.0 }));
    s = addCourse(s, 1, createCourse({ name: 'B', ects: 5, grade: 3.0 }));
    expect(averageGrade(s)).toBe(2.5);
  });

  it('averageGrade 는 합격 성적이 없으면 null 이다', () => {
    let s = defaultStudyState();
    s = addCourse(s, 1, createCourse({ name: 'A', ects: 5, grade: null }));
    expect(averageGrade(s)).toBeNull();
  });
});

/* ---------------- Klausur ---------------- */

describe('Klausur(시험) 필터링', () => {
  const build = () => {
    let s = defaultStudyState();
    s = addCourse(s, 1, createCourse({ name: 'MitKlausurOffen', ects: 5, hasKlausur: true }));
    s = addCourse(s, 1, createCourse({ name: 'MitKlausurFertig', ects: 5, hasKlausur: true, klausurDone: true }));
    s = addCourse(s, 1, createCourse({ name: 'OhneKlausur', ects: 5, hasKlausur: false }));
    s = addCourse(s, 2, createCourse({ name: 'AndereSemester', ects: 5, hasKlausur: true }));
    return s;
  };

  it('klausurCourses 는 시험이 있는 과목만 돌려준다', () => {
    const sem1 = findSemester(build(), 1)!;
    expect(klausurCourses(sem1).map((c) => c.name)).toEqual(['MitKlausurOffen', 'MitKlausurFertig']);
  });

  it('openKlausuren 은 아직 치르지 않은 시험만 돌려준다', () => {
    const sem1 = findSemester(build(), 1)!;
    expect(openKlausuren(sem1).map((c) => c.name)).toEqual(['MitKlausurOffen']);
  });

  it('다른 학기의 시험은 섞이지 않는다', () => {
    const sem2 = findSemester(build(), 2)!;
    expect(klausurCourses(sem2).map((c) => c.name)).toEqual(['AndereSemester']);
  });
});

/* ---------------- 정규화 / 폴백 ---------------- */

describe('normalizeStudyState — 깨진 값 폴백', () => {
  it('객체가 아니면 기본값을 돌려준다', () => {
    expect(normalizeStudyState(null)).toEqual(defaultStudyState());
    expect(normalizeStudyState(42)).toEqual(defaultStudyState());
    expect(normalizeStudyState('nope')).toEqual(defaultStudyState());
    expect(normalizeStudyState([1, 2, 3])).toEqual(defaultStudyState());
  });

  it('semesters 가 배열이 아니면 기본값을 돌려준다', () => {
    expect(normalizeStudyState({ semesters: 'oops' })).toEqual(defaultStudyState());
    expect(normalizeStudyState({})).toEqual(defaultStudyState());
  });

  it('일부 학기만 있으면 있는 값만 반영하고 나머지는 빈 학기로 둔다', () => {
    const result = normalizeStudyState({
      semesters: [
        { index: 2, courses: [{ id: 'x', name: 'Real-Time Systems', type: 'Übung', ects: 4, grade: 2.0, completed: true }] },
      ],
    });
    const sem2 = findSemester(result, 2)!;
    expect(sem2.courses).toHaveLength(1);
    expect(sem2.courses[0]).toMatchObject({
      id: 'x',
      name: 'Real-Time Systems',
      type: 'Übung',
      ects: 4,
      grade: 2.0,
      completed: true,
      hasKlausur: false,
      klausurDone: false,
    });
    expect(findSemester(result, 1)!.courses).toEqual([]);
    expect(findSemester(result, 3)!.courses).toEqual([]);
  });

  it('형식이 어긋난 과목 필드는 안전한 기본값으로 대체한다', () => {
    const result = normalizeStudyState({
      semesters: [
        {
          index: 1,
          courses: [
            { name: 123, type: 'Bogus', ects: -5, grade: 9, completed: 'yes', hasKlausur: 1 },
            'not-an-object',
          ],
        },
      ],
    });
    const sem1 = findSemester(result, 1)!;
    expect(sem1.courses).toHaveLength(1); // 잘못된 항목은 버린다
    expect(sem1.courses[0]).toMatchObject({
      name: '',
      type: 'Vorlesung',
      ects: 0,
      grade: null,
      completed: false,
      hasKlausur: false,
    });
  });

  it('범위 밖 학기 index 는 무시한다', () => {
    const result = normalizeStudyState({
      semesters: [{ index: 9, courses: [{ name: 'Hidden' }] }],
    });
    expect(result).toEqual(defaultStudyState());
  });
});

/* ---------------- 저장 / 복원 왕복 ---------------- */

describe('saveStudyState / loadStudyState — safeGet/safeSet 왕복', () => {
  const sample = () => {
    let s = defaultStudyState();
    s = addCourse(s, 1, createCourse({ name: 'Embedded Systems', ects: 6, completed: true, grade: 1.7 }));
    s = addCourse(s, 4, createCourse({ name: 'Masterarbeit', ects: 30, hasKlausur: false }));
    return s;
  };

  it('저장한 상태를 그대로 다시 읽는다', () => {
    const s = sample();
    const result = saveStudyState(s);
    expect(result.ok).toBe(true);
    expect(localStorage.getItem(AUTOEMBED_SEMESTER)).toBeTruthy();
    expect(loadStudyState()).toEqual(s);
  });

  it('저장 값이 없으면 기본 상태를 돌려준다', () => {
    expect(loadStudyState()).toEqual(defaultStudyState());
  });

  it('깨진 JSON 은 기본 상태로 폴백한다', () => {
    localStorage.setItem(AUTOEMBED_SEMESTER, '{ this is not valid json');
    expect(loadStudyState()).toEqual(defaultStudyState());
  });

  it('JSON 이지만 형식이 다른 값도 안전하게 정규화한다', () => {
    localStorage.setItem(
      AUTOEMBED_SEMESTER,
      JSON.stringify({ semesters: [{ index: 1, courses: [{ name: 'A', ects: 5, completed: true }] }] })
    );
    const loaded = loadStudyState();
    expect(totalEctsEarned(loaded)).toBe(5);
    expect(findSemester(loaded, 2)!.courses).toEqual([]);
  });
});

/* ---------------- 예시 프리셋 ---------------- */

describe('STUDY_PRESETS — 대학별 예시', () => {
  it('세 대학의 예시를 제공하고 모두 예시 라벨을 단다', () => {
    expect(STUDY_PRESETS.map((p) => p.uni)).toEqual(['RPTU', 'TU Chemnitz', 'TU Dortmund']);
    for (const p of STUDY_PRESETS) {
      expect(p.modules.length).toBeGreaterThan(0);
      expect(p.note).toContain('예시');
      expect(p.note).toContain('공식 모듈 목록이 아닙니다');
    }
  });

  it('프리셋 모듈을 기본 설정 과목으로 변환한다', () => {
    const courses = presetToCourses(STUDY_PRESETS[0]);
    expect(courses).toHaveLength(STUDY_PRESETS[0].modules.length);
    for (const c of courses) {
      expect(c.type).toBe('Vorlesung');
      expect(c.ects).toBe(DEFAULT_COURSE_ECTS);
      expect(c.grade).toBeNull();
      expect(c.completed).toBe(false);
      expect(c.name.length).toBeGreaterThan(0);
    }
    // 각 과목 id 는 서로 달라야 한다
    expect(new Set(courses.map((c) => c.id)).size).toBe(courses.length);
  });
});
