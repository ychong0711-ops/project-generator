import { describe, it, expect } from 'vitest';
import { projectById } from '../data/projects';
import { makeProject } from '../test/fixtures';
import {
  buildProjectFiles,
  boardChoices,
  isScaffoldSupported,
  DEFAULT_SCAFFOLD_OPTIONS,
} from './scaffold-pipeline';

const paths = (id: string, opts?: Parameters<typeof buildProjectFiles>[1]) =>
  buildProjectFiles(projectById(id)!, opts).map((f) => f.path);

describe('scaffold-pipeline — Phase C 단일 파이프라인', () => {
  it('지원 프로젝트: 실제 빌드 코드 + 문서 계층을 병합한다', () => {
    const p = paths('can-uds-scanner');
    for (const req of [
      'Makefile',
      'CMakeLists.txt',
      'src/main.c',
      'include/board.h',
      'tests/crc15.c',
      'docs/plan.md',
      'docs/technische-dokumentation.md',
      'docs/architecture.svg',
    ]) {
      expect(p).toContain(req);
    }
    expect(new Set(p).size).toBe(p.length); // 경로 중복 없음
  });

  it('미지원 프로젝트: 레거시 문서 스타터팩으로 폴백한다', () => {
    const fake = makeProject(); // id 'test-project' → overlay 없음
    expect(isScaffoldSupported(fake.id)).toBe(false);
    const p = buildProjectFiles(fake).map((f) => f.path);
    expect(p).toContain('README.md');
    expect(p).toContain('Makefile');
    expect(p).toContain('docs/plan.md');
    expect(p).not.toContain('CMakeLists.txt'); // 레거시는 CMake 없음
    expect(p.some((x) => x.startsWith('bsp/'))).toBe(false);
  });

  it('빌드시스템 옵션을 반영한다 (make만)', () => {
    const p = paths('can-uds-scanner', { buildSystems: ['make'], board: 'auto' });
    expect(p).toContain('Makefile');
    expect(p).not.toContain('CMakeLists.txt');
  });

  it('보드 선택지: linux 패밀리는 host 고정, ARM은 3종', () => {
    expect(boardChoices(projectById('linux-cluster')!)).toHaveLength(1);
    expect(boardChoices(projectById('can-uds-scanner')!).map((c) => c.value)).toEqual([
      'auto',
      'bluepill-f103',
      'stm32f407-discovery',
    ]);
  });

  it('기본 옵션은 make + cmake', () => {
    expect(DEFAULT_SCAFFOLD_OPTIONS.buildSystems).toEqual(['make', 'cmake']);
  });
});
