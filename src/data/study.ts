import { AUTOEMBED_SEMESTER, safeGet, safeSet, type WriteResult } from '../utils/storage';

/* ============================================================
 *  재학(study) 단계 — 학기 플래너
 *
 *  - 순수 함수 위주(React 의존성 없음)라 단위 테스트가 쉽다.
 *  - 사실 서술 규칙:
 *      · Bologna 공통 관행(석사 4학기 · 학기당 30 ECTS · 총 120 ECTS),
 *        독일식 1.0–4.0 성적 눈금, 일반적인 수업 유형(Vorlesung 등)만 단정한다.
 *      · 특정 대학(RPTU / TU Chemnitz / TU Dortmund)의 실제 모듈명·학점·구성은
 *        단정하지 않는다. 예시 프리셋의 모듈명은 모두 '예시'로 표시하며
 *        공식 교육과정이 아님을 UI/주석에 분명히 밝힌다.
 * ============================================================ */

/* ---------- 1) 상수 (Bologna 공통 관행) ---------- */

/** 독일 석사 학위과정의 표준 학기 수 (Bologna). */
export const MASTER_SEMESTERS = 4;
/** 학기당 표준 ECTS (Bologna 풀타임 기준). */
export const ECTS_PER_SEMESTER = 30;
/** 학위 목표 ECTS = 4학기 × 30 ECTS = 120. */
export const TOTAL_ECTS_TARGET = MASTER_SEMESTERS * ECTS_PER_SEMESTER;

/** 일반적인 독일 대학 수업 유형. */
export type CourseType = 'Vorlesung' | 'Übung' | 'Praktikum' | 'Seminar';

export const COURSE_TYPES: readonly CourseType[] = ['Vorlesung', 'Übung', 'Praktikum', 'Seminar'];

/** 수업 유형의 뜻 (참고용 표기). */
export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  Vorlesung: '강의',
  Übung: '연습',
  Praktikum: '실습',
  Seminar: '세미나',
};

/** 독일식 성적 눈금 (1.0 최고 · 4.0 합격). 일반적인 단계값. */
export const GERMAN_GRADE_MIN = 1.0;
export const GERMAN_GRADE_MAX = 4.0;
export const GERMAN_GRADE_STEPS: readonly number[] = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0];

/** 프리셋으로 만들 때 쓰는 기본 ECTS (일반적인 모듈 크기 가정). */
export const DEFAULT_COURSE_ECTS = 5;

export type SemesterIndex = 1 | 2 | 3 | 4;
export const SEMESTER_INDEXES: readonly SemesterIndex[] = [1, 2, 3, 4];

/** 화면에 노출하는 사실 안내 문구 (Bologna 공통 관행 + 확인 안내). */
export const STUDY_NOTES: readonly string[] = [
  'Bologna 기준 독일 석사는 보통 4학기 · 학기당 30 ECTS · 총 120 ECTS로 구성됩니다.',
  'ECTS 진행률은 "이수 완료"로 표시한 과목의 ECTS 합계로 계산합니다 (총 120 ECTS 기준).',
  '성적은 독일식 1.0(최고)–4.0(합격) 눈금입니다. 4.0을 넘는 값은 합격으로 보지 않습니다.',
  '과목 구성과 모듈명은 대학·학과마다 다릅니다. 아래 대학별 예시는 참고용이며 공식 교육과정이 아닙니다.',
];

/* ---------- 2) 상태 모델 ---------- */

export interface Course {
  id: string;
  /** 과목 이름 */
  name: string;
  /** 수업 유형 */
  type: CourseType;
  /** 학점 (ECTS) */
  ects: number;
  /** 성적 (1.0–4.0). 미입력이면 null */
  grade: number | null;
  /** 이수 완료 여부 (완료한 과목의 ECTS가 진행률에 합산됨) */
  completed: boolean;
  /** 이 과목에 Klausur(시험)가 있는지 */
  hasKlausur: boolean;
  /** Klausur를 마쳤는지 */
  klausurDone: boolean;
}

export interface Semester {
  index: SemesterIndex;
  courses: Course[];
}

export interface StudyState {
  semesters: Semester[];
}

/* ---------- 3) 생성 / 기본값 ---------- */

let idSeq = 0;

/** 충돌하지 않는 짧은 식별자 생성 (저장 후 재방문에도 안전하도록 랜덤 꼬리 포함). */
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}${idSeq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultSemester(index: SemesterIndex): Semester {
  return { index, courses: [] };
}

export function defaultStudyState(): StudyState {
  return { semesters: SEMESTER_INDEXES.map((i) => defaultSemester(i)) };
}

/** 새 과목 객체를 만든다. 넘긴 값만 반영하고 나머지는 기본값. */
export function createCourse(partial: Partial<Course> = {}): Course {
  return {
    id: partial.id && partial.id.length > 0 ? partial.id : nextId('c'),
    name: partial.name ?? '',
    type: partial.type ?? 'Vorlesung',
    ects: typeof partial.ects === 'number' && Number.isFinite(partial.ects) ? Math.max(0, partial.ects) : 0,
    grade: normalizeGrade(partial.grade),
    completed: partial.completed ?? false,
    hasKlausur: partial.hasKlausur ?? false,
    klausurDone: partial.klausurDone ?? false,
  };
}

/* ---------- 4) 순수 편집 연산 (불변) ---------- */

export function findSemester(state: StudyState, index: number): Semester | undefined {
  return state.semesters.find((s) => s.index === index);
}

export function addCourse(state: StudyState, semesterIndex: number, course: Course): StudyState {
  return {
    ...state,
    semesters: state.semesters.map((s) =>
      s.index === semesterIndex ? { ...s, courses: [...s.courses, course] } : s
    ),
  };
}

export function updateCourse(
  state: StudyState,
  semesterIndex: number,
  courseId: string,
  patch: Partial<Omit<Course, 'id'>>
): StudyState {
  return {
    ...state,
    semesters: state.semesters.map((s) =>
      s.index === semesterIndex
        ? {
            ...s,
            courses: s.courses.map((c) => (c.id === courseId ? { ...c, ...patch, id: c.id } : c)),
          }
        : s
    ),
  };
}

export function removeCourse(state: StudyState, semesterIndex: number, courseId: string): StudyState {
  return {
    ...state,
    semesters: state.semesters.map((s) =>
      s.index === semesterIndex
        ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) }
        : s
    ),
  };
}

/* ---------- 5) ECTS 집계 ---------- */

/** 학기에 계획된 전체 ECTS (이수 여부와 무관). */
export function semesterEcts(semester: Semester): number {
  return semester.courses.reduce((sum, c) => sum + c.ects, 0);
}

/** 학기에서 이수 완료한 ECTS. */
export function semesterEctsEarned(semester: Semester): number {
  return semester.courses.reduce((sum, c) => (c.completed ? sum + c.ects : sum), 0);
}

/** 전체 계획 ECTS. */
export function totalEctsPlanned(state: StudyState): number {
  return state.semesters.reduce((sum, s) => sum + semesterEcts(s), 0);
}

/** 전체 이수(획득) ECTS — 진행률의 분자. */
export function totalEctsEarned(state: StudyState): number {
  return state.semesters.reduce((sum, s) => sum + semesterEctsEarned(s), 0);
}

/** 120 ECTS 목표까지 남은 ECTS (음수는 0으로). */
export function remainingEcts(state: StudyState): number {
  return Math.max(0, TOTAL_ECTS_TARGET - totalEctsEarned(state));
}

/** 120 ECTS 대비 진행률(%) — 0–100으로 자른다. */
export function ectsProgressPercent(state: StudyState): number {
  const pct = (totalEctsEarned(state) / TOTAL_ECTS_TARGET) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** 이수 완료한 과목 수. */
export function countCompletedCourses(state: StudyState): number {
  return state.semesters.reduce((n, s) => n + s.courses.filter((c) => c.completed).length, 0);
}

/* ---------- 6) 성적 처리 ---------- */

/** 1.0–4.0 범위의 합격 성적인지. null·범위 밖은 false. */
export function isPassingGrade(grade: number | null): grade is number {
  return typeof grade === 'number' && Number.isFinite(grade) && grade >= GERMAN_GRADE_MIN && grade <= GERMAN_GRADE_MAX;
}

/** 이수 완료 + 합격 성적이면 bestanden(이수 인정). */
export function isBestanden(course: Course): boolean {
  return course.completed && isPassingGrade(course.grade);
}

/** ECTS 가중 평균 성적 (합격 성적만 대상). 대상이 없으면 null. */
export function averageGrade(state: StudyState): number | null {
  let weighted = 0;
  let weight = 0;
  for (const s of state.semesters) {
    for (const c of s.courses) {
      if (isPassingGrade(c.grade) && c.ects > 0) {
        weighted += c.grade * c.ects;
        weight += c.ects;
      }
    }
  }
  if (weight === 0) return null;
  return Math.round((weighted / weight) * 100) / 100;
}

/* ---------- 7) Klausur(시험) ---------- */

/** 학기에서 Klausur가 있는 과목 전부. */
export function klausurCourses(semester: Semester): Course[] {
  return semester.courses.filter((c) => c.hasKlausur);
}

/** 아직 치르지 않은(열려 있는) Klausur 과목. */
export function openKlausuren(semester: Semester): Course[] {
  return semester.courses.filter((c) => c.hasKlausur && !c.klausurDone);
}

/* ---------- 8) 정규화 / 저장 / 복원 ---------- */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** 1.0–4.0 범위의 숫자만 통과. 그 외(문자열·범위 밖·NaN·null)는 null. */
function normalizeGrade(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < GERMAN_GRADE_MIN || value > GERMAN_GRADE_MAX) return null;
  return value;
}

function isCourseType(value: unknown): value is CourseType {
  return typeof value === 'string' && (COURSE_TYPES as readonly string[]).includes(value);
}

function isSemesterIndex(value: unknown): value is SemesterIndex {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function normalizeCourse(raw: unknown): Course | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const ectsRaw = rec.ects;
  const ects =
    typeof ectsRaw === 'number' && Number.isFinite(ectsRaw) && ectsRaw >= 0 ? ectsRaw : 0;
  return {
    id: typeof rec.id === 'string' && rec.id.length > 0 ? rec.id : nextId('c'),
    name: typeof rec.name === 'string' ? rec.name : '',
    type: isCourseType(rec.type) ? rec.type : 'Vorlesung',
    ects,
    grade: normalizeGrade(rec.grade),
    completed: rec.completed === true,
    hasKlausur: rec.hasKlausur === true,
    klausurDone: rec.klausurDone === true,
  };
}

/**
 * 저장된 값을 안전하게 정규화한다.
 * - 객체가 아니거나 형식이 어긋나면 기본값(빈 4학기)으로 대체.
 * - 일부 학기만 있으면 있는 학기만 반영하고 나머지는 빈 학기 유지.
 */
export function normalizeStudyState(raw: unknown): StudyState {
  const base = defaultStudyState();
  const record = asRecord(raw);
  if (!record) return base;

  const semestersRaw = record.semesters;
  if (!Array.isArray(semestersRaw)) return base;

  for (const entry of semestersRaw) {
    const sRec = asRecord(entry);
    if (!sRec) continue;
    const indexRaw = sRec.index;
    if (!isSemesterIndex(indexRaw)) continue;
    const target = base.semesters[indexRaw - 1];
    const coursesRaw = Array.isArray(sRec.courses) ? sRec.courses : [];
    const courses: Course[] = [];
    for (const c of coursesRaw) {
      const course = normalizeCourse(c);
      if (course) courses.push(course);
    }
    target.courses = courses;
  }

  return base;
}

/** localStorage 에서 읽어 정규화. 깨진 값은 기본값으로 폴백. */
export function loadStudyState(): StudyState {
  return normalizeStudyState(safeGet<unknown>(AUTOEMBED_SEMESTER, null));
}

/** localStorage 에 저장 (실패 결과를 호출자에게 그대로 전달). */
export function saveStudyState(state: StudyState): WriteResult {
  return safeSet(AUTOEMBED_SEMESTER, state);
}

/* ---------- 9) 예시 프리셋 (공식 교육과정 아님) ---------- */

export interface ModulePreset {
  id: string;
  /** 대학 이름 */
  uni: string;
  /** 전공 표기 */
  program: string;
  /** 예시임을 분명히 하는 안내 (UI에 그대로 노출) */
  note: string;
  /** 예시 모듈명 목록 — 공식 목록이 아니다 */
  modules: string[];
}

/**
 * 대학별 예시 모듈명.
 * 주의: 아래 module 값은 일반적인 임베디드·자동차 주제어를 참고용으로 묶은 '예시'이며,
 *       각 대학의 실제 공식 모듈 목록이 아니다. 지원/수강 전 반드시 학과 홈페이지와
 *       모듈 핸드북(Modulhandbuch)에서 확인해야 한다.
 */
export const STUDY_PRESETS: readonly ModulePreset[] = [
  {
    id: 'rptu-cvt-ece',
    uni: 'RPTU',
    program: 'CVT / ECE',
    note: '예시 — RPTU의 공식 모듈 목록이 아닙니다. 수강 전 Modulhandbuch에서 확인하세요.',
    modules: [
      'Embedded Systems',
      'Control Engineering',
      'Automotive Electronics',
      'Model-Based Software Development',
      'Communication Networks',
    ],
  },
  {
    id: 'tu-chemnitz-es',
    uni: 'TU Chemnitz',
    program: 'Embedded Systems',
    note: '예시 — TU Chemnitz의 공식 모듈 목록이 아닙니다. 수강 전 Modulhandbuch에서 확인하세요.',
    modules: [
      'Embedded Software',
      'Real-Time Systems',
      'Hardware/Software Co-Design',
      'Microelectronics',
      'Signal Processing',
    ],
  },
  {
    id: 'tu-dortmund-ar',
    uni: 'TU Dortmund',
    program: 'Automation and Robotics',
    note: '예시 — TU Dortmund의 공식 모듈 목록이 아닙니다. 수강 전 Modulhandbuch에서 확인하세요.',
    modules: [
      'Robot Control',
      'Automation Systems',
      'Sensor Systems',
      'Machine Learning for Control',
      'Mechatronics',
    ],
  },
];

/** 프리셋 모듈명을 새 과목 목록으로 바꾼다 (유형 Vorlesung · 기본 ECTS · 미입력 성적). */
export function presetToCourses(preset: ModulePreset): Course[] {
  return preset.modules.map((name) =>
    createCourse({ name, type: 'Vorlesung', ects: DEFAULT_COURSE_ECTS })
  );
}
