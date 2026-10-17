// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { UNI_PROFILES, profileFor, cityFor } from './profiles';
import { UNIVERSITIES } from './universities';

describe('UNI_PROFILES — 대학 프로필 무결성', () => {
  it('프로필 key 집합이 UNIVERSITIES id 집합과 정확히 일치한다', () => {
    const uniIds = UNIVERSITIES.map((u) => u.id).sort();
    const profileKeys = Object.keys(UNI_PROFILES).sort();
    expect(profileKeys).toEqual(uniIds);
  });

  it('모든 프로필이 비어 있지 않은 modules/labs/cities 를 가진다', () => {
    for (const [id, prof] of Object.entries(UNI_PROFILES)) {
      expect(prof.modules.length, `${id}: modules`).toBeGreaterThan(0);
      expect(prof.labs.length, `${id}: labs`).toBeGreaterThan(0);
      expect(prof.cities.length, `${id}: cities`).toBeGreaterThan(0);
      for (const m of prof.modules) expect(m.length).toBeGreaterThan(0);
      for (const l of prof.labs) expect(l.length).toBeGreaterThan(0);
      for (const c of prof.cities) expect(c.length).toBeGreaterThan(0);
    }
  });
});

describe('profileFor — 대학별 프로필 조회', () => {
  it('알려진 id 는 해당 프로필 객체를 반환한다', () => {
    expect(profileFor('rptu')).toBe(UNI_PROFILES.rptu);
    expect(profileFor('chemnitz').modules.length).toBeGreaterThan(0);
  });

  it('알 수 없는 id 는 기본 폴백 프로필을 반환한다 (경계)', () => {
    const fallback = profileFor('no-such-uni');
    expect(fallback).toEqual({
      modules: ['embedded systems', 'automotive electronics'],
      labs: [],
      cities: [],
    });
  });
});

describe('cityFor — 대학 도시 조회', () => {
  it('알려진 id 는 UNIVERSITIES 의 city 와 일치한다', () => {
    for (const u of UNIVERSITIES) {
      expect(cityFor(u.id)).toBe(u.city);
    }
  });

  it('알 수 없는 id 는 빈 문자열을 반환한다 (경계)', () => {
    expect(cityFor('no-such-uni')).toBe('');
  });
});
