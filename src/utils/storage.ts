/* ============================================================
 *  localStorage 중앙 레지스트리 — R3(Runtime: localStorage 용량 초과 시 조용한 데이터 손실)
 *  및 R9(백업 복원 시 스키마 미검증) 보완
 * ============================================================ */

// 앱 전체에서 사용하는 모든 localStorage 키 상수 정의
// R3: 용량 임계치 체크용 key당 크기 추적
// R9: 백업/복원 시 스키마 검증을 위한 타입 매핑

export const AUTOEMBED_SAVED_PROJECTS = 'autoembed-saved-projects';
export const AUTOEMBED_PROJECT_PROGRESS = 'autoembed-project-progress';
export const AUTOEMBED_ACTIVITY = 'autoembed-activity';
export const AUTOEMBED_EVENTS = 'autoembed-events';
export const AUTOEMBED_DIAGNOSIS = 'autoembed-diagnosis';
export const AUTOEMBED_INTERVIEW_STATS = 'autoembed-interview-stats';
export const AUTOEMBED_GERMAN_STATS = 'autoembed-german-stats';
export const AUTOEMBED_CHECKLIST = 'autoembed-checklist';
export const AUTOEMBED_DEADLINE = 'autoembed-deadline';
export const AUTOEMBED_LAB_SOLVED = 'autoembed-lab-solved';
export const AUTOEMBED_REPO_SOLVED = 'autoembed-repo-solved';
export const AUTOEMBED_CUSTOM_LABS = 'autoembed-custom-labs';
export const AUTOEMBED_APPLY = 'autoembed-apply';
export const AUTOEMBED_BACKUP = 'autoembed-backup';

// 동적 키 생성 함수
export const codeKey = (projectId: string) => `autoembed-code-${projectId}`;
export const strategyKey = (uniId: string) => `autoembed-strategy-uni-${uniId}`;

/* -------------------------------------------------------
 *  사용 예시:
 *  import { AUTOEMBED_SAVED_PROJECTS, codeKey, checkStorageQuota } from './storage';
 *  const key = AUTOEMBED_SAVED_PROJECTS;
 *  checkStorageQuota(key, localStorage.length, 0.8);
 * ------------------------------------------------------- */