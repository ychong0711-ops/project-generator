import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUTOEMBED_SAVED_PROJECTS,
  buildBackup,
  checkStorageQuota,
  codeKey,
  parseBackup,
  restoreBackup,
  safeGet,
  safeSet,
  allKeys,
} from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('safeGet / safeSet', () => {
  it('값을 왕복 저장·읽기 한다', () => {
    expect(safeSet(AUTOEMBED_SAVED_PROJECTS, ['a', 'b'])).toEqual({ ok: true });
    expect(safeGet(AUTOEMBED_SAVED_PROJECTS, [])).toEqual(['a', 'b']);
  });

  it('손상된 JSON 이면 fallback 을 반환한다', () => {
    localStorage.setItem(AUTOEMBED_SAVED_PROJECTS, '{not json');
    expect(safeGet(AUTOEMBED_SAVED_PROJECTS, ['fallback'])).toEqual(['fallback']);
  });

  it('키가 없으면 fallback 을 반환한다', () => {
    expect(safeGet('autoembed-missing', 42)).toBe(42);
  });
});

describe('codeKey', () => {
  it('프로젝트별 키를 만든다', () => {
    expect(codeKey('can-bus')).toBe('autoembed-code-can-bus');
  });
});

describe('allKeys', () => {
  it('autoembed- 접두사 키만 반환한다', () => {
    safeSet(AUTOEMBED_SAVED_PROJECTS, []);
    localStorage.setItem('other-app', '1');
    expect(allKeys()).toEqual([AUTOEMBED_SAVED_PROJECTS]);
  });
});

describe('checkStorageQuota', () => {
  it('사용량과 비율을 계산한다', () => {
    safeSet(AUTOEMBED_SAVED_PROJECTS, ['x']);
    const q = checkStorageQuota();
    expect(q.usedBytes).toBeGreaterThan(0);
    expect(q.ratio).toBeGreaterThanOrEqual(0);
    expect(q.nearLimit).toBe(false);
  });
});

describe('백업 / 복원', () => {
  it('왕복해도 값이 변형되지 않는다 (이중 인코딩 방지)', () => {
    safeSet(AUTOEMBED_SAVED_PROJECTS, ['p1', 'p2']);
    safeSet(codeKey('p1'), { sampleId: 's', code: 'int main(void){}' });

    const payload = buildBackup();
    localStorage.clear();

    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed).not.toBeNull();
    const { restored, failed } = restoreBackup(parsed!);
    expect(restored).toBe(2);
    expect(failed).toEqual([]);

    expect(safeGet(AUTOEMBED_SAVED_PROJECTS, [])).toEqual(['p1', 'p2']);
    expect(safeGet(codeKey('p1'), null)).toEqual({ sampleId: 's', code: 'int main(void){}' });
  });

  it('앱이 다르거나 형식이 틀리면 null 을 반환한다', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'other', data: {} }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'autoembed-lab' }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'autoembed-lab', data: [] }))).toBeNull();
  });

  it('접두사가 없는 키는 복원 대상에서 제외한다', () => {
    const parsed = parseBackup(
      JSON.stringify({ app: 'autoembed-lab', data: { 'evil-key': '1', 'autoembed-ok': '2' } })
    );
    expect(Object.keys(parsed!.data)).toEqual(['autoembed-ok']);
  });

  it('구버전 백업(파싱된 값)도 문자열로 정규화한다', () => {
    const parsed = parseBackup(
      JSON.stringify({ app: 'autoembed-lab', data: { [AUTOEMBED_SAVED_PROJECTS]: ['a'] } })
    );
    restoreBackup(parsed!);
    expect(safeGet(AUTOEMBED_SAVED_PROJECTS, [])).toEqual(['a']);
  });
});
