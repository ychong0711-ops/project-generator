import JSZip from 'jszip';
import type { Project } from '../types';
import type { BoardId, BuildSystem } from '../scaffold/types';
import { generateProject, isScaffoldSupported } from '../scaffold/generateProject';
import { familyOf } from '../scaffold/families';
import {
  projectFiles,
  genPlan,
  genInterview,
  genGermanDoc,
  genMeasurementTemplate,
  genAlgoReadme,
  type ProjectFile,
} from './codegen';
import { genArchitectureSvg } from './diagram';

/* ============================================================
 *  Phase C — 생성 파이프라인 단일 진입점
 *  ZIP 다운로드 / GitHub 배포가 모두 이 모듈을 통과한다.
 *
 *  파일셋 = (스캐폴드: 실제 빌드 가능한 코드 트리) ⊕ (문서 표현 계층)
 *  미지원 프로젝트는 기존 문서 기반 스타터팩으로 폴백한다 (M5 에서 전량 대체).
 * ============================================================ */

export { isScaffoldSupported };

export interface ScaffoldOptions {
  buildSystems: BuildSystem[];
  /** 'auto' = 메타데이터 기반 도출 (D1). 미지정 시 auto */
  board?: BoardId | 'auto';
}

export const DEFAULT_SCAFFOLD_OPTIONS: ScaffoldOptions = {
  buildSystems: ['make', 'cmake'],
  board: 'auto',
};

/** 보드 선택지 — linux(POSIX) 패밀리는 host 고정 */
export function boardChoices(p: Project): { value: BoardId | 'auto'; label: string }[] {
  const choices: { value: BoardId | 'auto'; label: string }[] = [
    { value: 'auto', label: '자동 (메타데이터 기반)' },
  ];
  if (familyOf(p) === 'linux') {
    return choices;
  }
  choices.push({ value: 'bluepill-f103', label: 'STM32F103 BluePill' });
  choices.push({ value: 'stm32f407-discovery', label: 'STM32F407 Discovery' });
  return choices;
}

/** 문서 표현 계층 — 스캐폴드 코드 트리에 병합되는 docs/algo 파일 (A1 유지) */
export function docFiles(p: Project): ProjectFile[] {
  return [
    { path: 'docs/plan.md', content: genPlan(p) },
    { path: 'docs/interview-prep.md', content: genInterview(p) },
    { path: 'docs/architecture.svg', content: genArchitectureSvg(p) },
    { path: 'docs/technische-dokumentation.md', content: genGermanDoc(p) },
    { path: 'docs/messvorlage.md', content: genMeasurementTemplate(p) },
    { path: 'algo/README.md', content: genAlgoReadme(p) },
  ];
}

/**
 * 프로젝트 파일셋을 조립한다 (ZIP·GitHub 배포 공용).
 * 지원 프로젝트: 스캐폴드(실제 빌드 가능) + 문서. 미지원: 레거시 스타터팩.
 */
export function buildProjectFiles(
  p: Project,
  opts: ScaffoldOptions = DEFAULT_SCAFFOLD_OPTIONS
): ProjectFile[] {
  if (!isScaffoldSupported(p.id)) {
    return projectFiles(p);
  }
  const board = opts.board && opts.board !== 'auto' ? opts.board : undefined;
  return [
    ...generateProject(p.id, { buildSystems: opts.buildSystems, board }),
    ...docFiles(p),
  ];
}

/** 스타터/스캐폴드 zip 생성 및 다운로드 */
export async function downloadProjectZip(
  p: Project,
  opts: ScaffoldOptions = DEFAULT_SCAFFOLD_OPTIONS
): Promise<void> {
  const zip = new JSZip();
  for (const f of buildProjectFiles(p, opts)) {
    zip.file(f.path, f.content);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.id}-scaffold.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
