import { useState, type FormEvent, type JSX } from 'react';
import {
  COURSE_TYPES,
  COURSE_TYPE_LABELS,
  DEFAULT_COURSE_ECTS,
  ECTS_PER_SEMESTER,
  GERMAN_GRADE_STEPS,
  SEMESTER_INDEXES,
  STUDY_NOTES,
  STUDY_PRESETS,
  TOTAL_ECTS_TARGET,
  addCourse,
  averageGrade,
  createCourse,
  ectsProgressPercent,
  isBestanden,
  isPassingGrade,
  loadStudyState,
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
  type Course,
  type CourseType,
  type SemesterIndex,
  type StudyState,
} from '../data/study';
import { CheckIcon, ClipboardIcon, TrashIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  학기 플래너 — 재학(study) 단계
 *  자체적으로 localStorage(autoembed-semester)에 저장한다.
 *  props 없음 · 단일 컴포넌트로 자급자족.
 * ============================================================ */

const EMPTY_NOTE = '변경 사항은 이 브라우저에만 저장됩니다.';

export default function SemesterPlanner(): JSX.Element {
  const [state, setState] = useState<StudyState>(() => loadStudyState());
  const [selected, setSelected] = useState<SemesterIndex>(1);
  const [saveNote, setSaveNote] = useState(EMPTY_NOTE);

  // 새 과목 입력 폼
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<CourseType>('Vorlesung');
  const [draftEcts, setDraftEcts] = useState(String(DEFAULT_COURSE_ECTS));
  const [draftKlausur, setDraftKlausur] = useState(false);

  // 상태 변경과 저장을 한 번에 처리해 저장 결과를 사용자에게 알린다.
  const commit = (next: StudyState, note?: string) => {
    setState(next);
    const result = saveStudyState(next);
    setSaveNote(result.ok ? note ?? '저장되었습니다.' : result.message);
  };

  /* ---------- 집계 ---------- */
  const earned = totalEctsEarned(state);
  const planned = totalEctsPlanned(state);
  const remaining = remainingEcts(state);
  const percent = ectsProgressPercent(state);
  const avg = averageGrade(state);

  const current = state.semesters.find((s) => s.index === selected) ?? state.semesters[0];
  const semEarned = semesterEctsEarned(current);
  const semPlanned = semesterEcts(current);
  const exams = current.courses.filter((c) => c.hasKlausur);
  const open = openKlausuren(current);

  /* ---------- 과목 편집 ---------- */
  const patchCourse = (courseId: string, patch: Partial<Omit<Course, 'id'>>) => {
    commit(updateCourse(state, selected, courseId, patch));
  };

  const handleAddCourse = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    const ects = Math.max(0, Math.round(Number(draftEcts) || 0));
    const course = createCourse({ name, type: draftType, ects, hasKlausur: draftKlausur });
    commit(addCourse(state, selected, course), `"${name}" 과목을 ${selected}학기에 추가했습니다.`);
    setDraftName('');
    setDraftEcts(String(DEFAULT_COURSE_ECTS));
    setDraftKlausur(false);
  };

  const handleRemoveCourse = (courseId: string, name: string) => {
    commit(removeCourse(state, selected, courseId), `"${name}" 과목을 삭제했습니다.`);
  };

  const applyPreset = (presetId: string) => {
    const preset = STUDY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const courses = presetToCourses(preset);
    const next = courses.reduce((acc, c) => addCourse(acc, selected, c), state);
    commit(next, `${preset.uni} 예시 과목 ${courses.length}개를 ${selected}학기에 추가했습니다.`);
  };

  return (
    <section id="semester" className="relative py-20 sm:py-24 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 헤더 */}
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">SEMESTER PLANNER</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">학기 플래너</h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            학기별 과목과 학점(ECTS)을 정리하고, Klausur(시험) 일정을 체크합니다. 입력 내용은 이 브라우저에만
            저장됩니다.
          </p>
        </div>

        {/* ECTS 진행률 */}
        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-white">ECTS 진행률</h3>
            <span className="font-mono text-sm font-bold text-amber-300">
              {earned}/{TOTAL_ECTS_TARGET} ECTS
            </span>
          </div>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={earned}
            aria-valuemin={0}
            aria-valuemax={TOTAL_ECTS_TARGET}
            aria-label="ECTS 진행률"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                percent === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500'
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-400">
            목표 120 ECTS 기준 · 남은 학점{' '}
            <span className="font-semibold text-amber-300">{remaining} ECTS</span> · 전체 계획{' '}
            <span className="font-semibold text-slate-200">{planned} ECTS</span>
          </p>
          <p className="mt-1 text-sm text-slate-400">
            ECTS 가중 평균 성적:{' '}
            <span className="font-semibold text-slate-200">{avg === null ? '—' : avg.toFixed(2)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500" role="status" aria-live="polite">
            {saveNote}
          </p>

          {/* 학기별 소계 */}
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {state.semesters.map((s) => (
              <div key={s.index} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                <dt className="font-mono text-xs font-bold text-slate-500">{s.index}학기</dt>
                <dd className="text-sm font-semibold text-slate-200">
                  {semesterEctsEarned(s)}/{semesterEcts(s)} ECTS
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 사실 안내 */}
        <aside
          className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          aria-label="Bologna · ECTS 일반 관행 안내"
        >
          <h3 className="text-sm font-extrabold text-slate-200">참고 (Bologna 공통 관행)</h3>
          <p className="mt-1 text-xs text-slate-500">
            아래는 일반적으로 통용되는 내용입니다. 학위과정별 학점·구성은 소속 학과 지침을 확인하세요.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            {STUDY_NOTES.map((note) => (
              <li key={note} className="flex gap-2">
                <span aria-hidden="true" className="text-amber-400">
                  •
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* 학기 탭 */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-white">학기 구성</h3>
          <span className="text-xs text-slate-500">Bologna 석사 4학기 기준</span>
        </div>

        <div role="tablist" aria-label="학기 선택" className="mt-4 flex flex-wrap gap-2">
          {SEMESTER_INDEXES.map((idx) => {
            const active = idx === selected;
            const sem = state.semesters.find((s) => s.index === idx);
            const activeEcts = sem ? semesterEcts(sem) : 0;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                id={`semester-tab-${idx}`}
                aria-selected={active}
                aria-controls="semester-panel"
                onClick={() => setSelected(idx)}
                className={cn(
                  'rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                  active
                    ? 'border-amber-400 bg-amber-400 text-black'
                    : 'border-slate-700 bg-white/5 text-slate-200 hover:bg-white/10'
                )}
              >
                {idx}학기
                <span className={cn('ml-2 font-mono text-xs', active ? 'text-black/70' : 'text-slate-500')}>
                  {activeEcts} ECTS
                </span>
              </button>
            );
          })}
        </div>

        {/* 학기 패널 */}
        <div
          id="semester-panel"
          role="tabpanel"
          aria-labelledby={`semester-tab-${selected}`}
          className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-base font-extrabold text-white">{selected}학기 과목</h4>
            <span className="font-mono text-sm font-bold text-amber-300">
              이수 {semEarned}/{semPlanned} ECTS · 학기당 {ECTS_PER_SEMESTER} ECTS 기준
            </span>
          </div>

          {current.courses.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
              아직 추가된 과목이 없습니다. 아래에서 과목을 추가하거나 예시 프리셋을 불러오세요.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {current.courses.map((course, i) => {
                const label = course.name.trim() || `${selected}학기 과목 ${i + 1}`;
                const passed = isPassingGrade(course.grade);
                return (
                  <li
                    key={course.id}
                    className={cn(
                      'rounded-2xl border p-4 transition-colors',
                      course.completed
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                        : 'border-slate-800 bg-slate-950/40'
                    )}
                  >
                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">과목 이름</span>
                          <input
                            type="text"
                            value={course.name}
                            onChange={(e) => patchCourse(course.id, { name: e.target.value })}
                            aria-label={`${label} 이름`}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">유형</span>
                          <select
                            value={course.type}
                            onChange={(e) => patchCourse(course.id, { type: e.target.value as CourseType })}
                            aria-label={`${label} 유형`}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400"
                          >
                            {COURSE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t} ({COURSE_TYPE_LABELS[t]})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">ECTS</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={course.ects}
                            onChange={(e) => patchCourse(course.id, { ects: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                            aria-label={`${label} ECTS`}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-500">
                            성적 (1.0–4.0)
                          </span>
                          <select
                            value={course.grade === null ? '' : String(course.grade)}
                            onChange={(e) =>
                              patchCourse(course.id, {
                                grade: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            aria-label={`${label} 성적`}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400"
                          >
                            <option value="">미입력</option>
                            {GERMAN_GRADE_STEPS.map((g) => (
                              <option key={g} value={String(g)}>
                                {g.toFixed(1)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="flex flex-col gap-2 md:w-48 md:shrink-0">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={course.completed}
                            onChange={() => patchCourse(course.id, { completed: !course.completed })}
                            aria-label={`${label} 이수 완료`}
                            className="h-4 w-4 accent-amber-400"
                          />
                          이수 완료
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={course.hasKlausur}
                            onChange={() => patchCourse(course.id, { hasKlausur: !course.hasKlausur })}
                            aria-label={`${label} Klausur 여부`}
                            className="h-4 w-4 accent-amber-400"
                          />
                          Klausur 있음
                        </label>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-xs font-semibold',
                              course.completed && passed
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-white/5 text-slate-500'
                            )}
                          >
                            {isBestanden(course) ? 'bestanden' : '미완료'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCourse(course.id, label)}
                            aria-label={`${label} 삭제`}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 과목 추가 */}
          <form onSubmit={handleAddCourse} className="mt-5 grid gap-3 border-t border-slate-800 pt-5 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">과목 이름</span>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="예: Embedded Systems"
                aria-label="새 과목 이름"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">유형</span>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as CourseType)}
                aria-label="새 과목 유형"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400"
              >
                {COURSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">ECTS</span>
              <input
                type="number"
                min={0}
                step={1}
                value={draftEcts}
                onChange={(e) => setDraftEcts(e.target.value)}
                aria-label="새 과목 ECTS"
                className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-400"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={draftKlausur}
                onChange={() => setDraftKlausur((v) => !v)}
                aria-label="새 과목 Klausur 여부"
                className="h-4 w-4 accent-amber-400"
              />
              Klausur
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-95"
            >
              <ClipboardIcon className="h-4 w-4" />
              과목 추가
            </button>
          </form>
        </div>

        {/* Klausur 관리 */}
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-white">Klausur 기간 관리</h3>
            <span className="font-mono text-sm font-bold text-amber-300">
              {selected}학기 · 열린 시험 {open.length}개
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            시험이 있는 과목을 모아 보여줍니다. 시험을 마치면 체크하세요. 시험 일정·응시 규정은 학과 시험 규정
            (Prüfungsordnung)에서 확인해야 합니다.
          </p>

          {exams.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
              이 학기에 Klausur가 표시된 과목이 없습니다. 과목에서 "Klausur 있음"을 체크하면 여기에 나타납니다.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {exams.map((course, i) => {
                const label = course.name.trim() || `${selected}학기 과목 ${i + 1}`;
                return (
                  <li
                    key={course.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
                      course.klausurDone
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                        : 'border-slate-800 bg-slate-900/60'
                    )}
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={course.klausurDone}
                        onChange={() => patchCourse(course.id, { klausurDone: !course.klausurDone })}
                        aria-label={`${label} Klausur 완료`}
                        className="h-4 w-4 accent-amber-400"
                      />
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          course.klausurDone ? 'text-slate-400 line-through' : 'text-slate-200'
                        )}
                      >
                        {label}
                      </span>
                    </label>
                    <span className="font-mono text-xs text-slate-500">
                      {course.ects} ECTS · {course.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 과목 프리셋 */}
        <div className="mt-12">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="text-lg font-extrabold text-white">과목 프리셋 (예시)</h3>
            <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-300">예시</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            대학별 참고용 예시 모듈명입니다. 공식 교육과정이 아니므로, 불러온 뒤 학과 모듈 핸드북에 맞게 고쳐
            사용하세요. 버튼을 누르면 현재 선택한 <span className="font-semibold text-slate-200">{selected}학기</span>
            에 과목으로 추가됩니다 (기본 {DEFAULT_COURSE_ECTS} ECTS).
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {STUDY_PRESETS.map((preset) => (
              <div key={preset.id} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-white">{preset.uni}</h4>
                  <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                    예시
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{preset.program}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-300">
                  {preset.modules.map((m) => (
                    <li key={m} className="flex gap-2">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">{preset.note}</p>
                <button
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  aria-label={`${preset.uni} ${preset.program} 예시를 ${selected}학기에 추가`}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                >
                  {selected}학기에 추가
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
