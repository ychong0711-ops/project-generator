import { projectById } from '../data/projects';
import { samplesFor } from '../data/samples';
import type { BuildSystem, GenerateOptions, ScaffoldFile } from './types';
import { BOARD_SPECS, resolveBoard } from './boards';
import { familyFiles, familyOf } from './families';
import { commonFiles } from './common';
import { buildSystemFiles } from './buildsystems';
import { PROJECT_OVERLAYS } from './projects';

/* ============================================================
 *  Phase B 생성 엔진
 *  FileTree = baseSkeleton ⊕ categoryBase(family) ⊕ projectOverlay
 *             ⊕ buildSystem(make/cmake) ⊕ tests(algo, D5 1차)
 *  M3: 카테고리 패밀리 4종 + 보드 3종(F103/F407/host) + CMake
 *  M5: 전 17개 프로젝트 오버레이 완성
 * ============================================================ */

export function generateProject(projectId: string, opts: GenerateOptions = {}): ScaffoldFile[] {
  const project = projectById(projectId);
  if (!project) {
    throw new Error(`알 수 없는 프로젝트 id: ${projectId}`);
  }

  const overlay = PROJECT_OVERLAYS[projectId];
  if (!overlay) {
    throw new Error(`프로젝트 '${projectId}' 의 스캐폴드 오버레이가 없습니다.`);
  }

  const family = familyOf(project);

  /* 보드 도출 + 패밀리 정합성 보정 */
  let board = BOARD_SPECS[resolveBoard(project, opts.board)];
  if (family === 'linux' && !board.isHost) {
    board = BOARD_SPECS.host;
  } else if (family !== 'linux' && board.isHost) {
    board = BOARD_SPECS[resolveBoard(project)];
  }

  const systems: BuildSystem[] = opts.buildSystems ?? ['make', 'cmake'];

  const files: ScaffoldFile[] = [];
  files.push(...commonFiles(project, board, family));
  files.push(...buildSystemFiles(project, board, family, systems));
  files.push(...familyFiles(family));
  files.push(...overlay);

  /* D5 (1차): 알고리즘 샘플을 tests/ 로 이동해 make test 로 검증 */
  for (const sample of samplesFor(projectId)) {
    files.push({ path: `tests/${sample.id}.c`, content: sample.code });
  }

  return files;
}

export function isScaffoldSupported(projectId: string): boolean {
  return projectId in PROJECT_OVERLAYS;
}

export function scaffoldProjectIds(): string[] {
  return Object.keys(PROJECT_OVERLAYS);
}
