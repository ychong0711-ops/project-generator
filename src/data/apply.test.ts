// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  DEADLINES,
  daysUntil,
  APPLY_STATUS,
  APPLY_ORDER,
  nextStatus,
  MATCH_KEYWORDS,
  computeMatch,
  recommendForMissing,
  professorEmail,
  demoScript,
  measurementCitation,
  SERIES,
  seriesStory,
} from './apply';
import { PROJECTS } from './projects';
import { UNIVERSITIES } from './universities';
import type { Project } from '../types';
import { makeProject } from '../test/fixtures';

describe('DEADLINES / daysUntil — 지원 마감일', () => {
  it('모든 마감일 key 가 실제 대학 id 이고 winterISO 가 파싱 가능하다', () => {
    const uniIds = new Set(UNIVERSITIES.map((u) => u.id));
    expect(Object.keys(DEADLINES).length).toBeGreaterThan(0);
    for (const [id, d] of Object.entries(DEADLINES)) {
      expect(uniIds.has(id)).toBe(true);
      expect(d.winter.length).toBeGreaterThan(0);
      expect(d.winterISO).toBeDefined();
      expect(Number.isNaN(new Date(d.winterISO!).getTime())).toBe(false);
      expect(d.semester).toContain('겨울');
    }
  });

  it('iso 가 없으면 null 을 반환한다', () => {
    expect(daysUntil(undefined)).toBeNull();
    expect(daysUntil()).toBeNull();
  });

  it('미래 날짜는 양수, 과거 날짜는 음수이다', () => {
    expect(daysUntil('2999-01-01')).toBeGreaterThan(0);
    expect(daysUntil('2000-01-01')).toBeLessThan(0);
  });

  it('남은 일수를 올림으로 계산한다 (3.5일 남음 → 4)', () => {
    const target = Date.now() + 3 * 86400000 + 12 * 3600000;
    const iso = new Date(target).toISOString();
    expect(daysUntil(iso)).toBe(4);
  });
});

describe('APPLY_STATUS / nextStatus — 지원 트래커 상태', () => {
  it('상태 순서가 정의된 모든 상태를 포함하고 라벨/클래스가 있다', () => {
    for (const s of APPLY_ORDER) {
      expect(APPLY_STATUS[s].label.length).toBeGreaterThan(0);
      expect(APPLY_STATUS[s].cls.length).toBeGreaterThan(0);
    }
  });

  it('한 단계 앞 상태로 순환한다', () => {
    expect(nextStatus('none')).toBe('wish');
    expect(nextStatus('wish')).toBe('preparing');
    expect(nextStatus('preparing')).toBe('submitted');
    expect(nextStatus('submitted')).toBe('interview');
    expect(nextStatus('interview')).toBe('accepted');
  });

  it('합격에서 다음은 다시 none 으로 순환한다 (경계)', () => {
    expect(nextStatus('accepted')).toBe('none');
  });
});

describe('computeMatch — 프로그램 매칭 스코어', () => {
  it('스킬이 키워드와 대소문자 무관 매칭되어 점수가 나온다', () => {
    // kit 키워드: pid, foc, bms, 제어 — abs-sim 은 'PID 제어' 스킬 보유
    const absSim = PROJECTS.find((p) => p.id === 'abs-sim');
    expect(absSim).toBeDefined();

    const r = computeMatch('kit', [absSim!]);
    expect(r.matched).toContain('pid');
    expect(r.matched).toContain('제어');
    expect(r.missing).toEqual(expect.arrayContaining(['foc', 'bms']));
    expect(r.score).toBe(Math.round((r.matched.length / 4) * 100));
    expect(r.matched.length + r.missing.length).toBe(4);
  });

  it('매칭되는 스킬이 없으면 0점이다', () => {
    const p = makeProject({ skills: ['Zig'] });
    const r = computeMatch('rwth', [p]);
    expect(r.score).toBe(0);
    expect(r.matched).toEqual([]);
    expect(r.missing.length).toBe(MATCH_KEYWORDS.rwth.length);
  });

  it('알 수 없는 대학 id 는 키워드가 없어 0점/빈 배열이다', () => {
    expect(computeMatch('no-such-uni', [])).toEqual({ score: 0, matched: [], missing: [] });
  });

  it('프로젝트가 없으면 0점이다', () => {
    expect(computeMatch('tum', []).score).toBe(0);
  });
});

describe('recommendForMissing — 부족 키워드 프로젝트 추천', () => {
  it('키워드를 커버하는 프로젝트를 limit 개까지 추천한다', () => {
    const out = recommendForMissing(['can', 'autosar'], 2);
    expect(out.length).toBe(2);
    for (const p of out) {
      const skills = p.skills.map((s) => s.toLowerCase());
      const covers =
        skills.some((s) => s.includes('can')) || skills.some((s) => s.includes('autosar'));
      expect(covers).toBe(true);
    }
  });

  it('중복 없이 서로 다른 프로젝트를 추천한다', () => {
    const out = recommendForMissing(['can', 'pid', 'foc', 'bms'], 5);
    const ids = new Set(out.map((p) => p.id));
    expect(ids.size).toBe(out.length);
  });

  it('limit 보다 많이 추천하지 않는다', () => {
    expect(recommendForMissing(['can', 'pid', 'foc', 'bms'], 2).length).toBe(2);
  });

  it('매칭되는 프로젝트가 없으면 빈 배열이다', () => {
    expect(recommendForMissing(['nonexistent-keyword'])).toEqual([]);
  });
});

describe('professorEmail — 교수 컨택 이메일 생성', () => {
  const p: Project = makeProject({
    title: 'CAN-UDS 스캐너',
    code: 'P-CAN',
    skills: ['C', 'CAN 2.0B', 'UDS'],
  });

  it('대학/연구실/프로젝트 정보가 반영된 이메일을 만든다', () => {
    const mail = professorEmail('tum', p, '홍길동');
    expect(mail).toContain('Subject:');
    expect(mail).toContain('Technische Universität München');
    expect(mail).toContain('"CAN-UDS 스캐너" (P-CAN)');
    expect(mail).toContain('C, CAN 2.0B, UDS');
    expect(mail).toContain('Best regards,\n홍길동');
  });

  it('프로젝트 미선택 시 플레이스홀더 문구를 넣는다', () => {
    const mail = professorEmail('tum', null, '홍길동');
    expect(mail).toContain('[프로젝트 한 줄 — 포트폴리오에서 선택하면 자동 삽입됩니다]');
  });

  it('이름이 공백이면 [Your Name] 으로 폴백한다', () => {
    const mail = professorEmail('tum', null, '   ');
    expect(mail).toContain('[Your Name]');
  });
});

describe('demoScript — 데모 영상 스크립트 생성', () => {
  it('제목/영문 제목/코드/스킬/산출물이 반영된다', () => {
    const p = makeProject({
      title: 'FOC 모터 제어',
      titleEn: 'FOC Motor Control',
      code: 'P-FOC',
      skills: ['C', 'FOC', 'SVPWM'],
      deliverables: ['측정 그래프'],
    });
    const s = demoScript(p);

    expect(s).toContain('데모 영상 스크립트 — FOC 모터 제어');
    expect(s).toContain('FOC Motor Control');
    expect(s).toContain('P-FOC');
    expect(s).toContain('C, FOC, SVPWM');
    expect(s).toContain('측정 그래프');
    expect(s).toContain('촬영 체크리스트');
  });

  it('산출물이 비어도 기본 문구로 동작한다', () => {
    const p = makeProject({ deliverables: [] });
    expect(demoScript(p)).toContain('측정 결과');
  });
});

describe('measurementCitation — 측정 데이터 서류 인용', () => {
  const stats = { n: 100, mean: 1.23456, min: 0.1, max: 2.5, last: 1.2 };

  it('국문/영문 문장과 소수 3자리 표를 생성한다', () => {
    const cite = measurementCitation('전류 리플', stats);

    expect(cite).toContain('총 100개 샘플');
    expect(cite).toContain('평균 1.235'); // toFixed(3) 반올림
    expect(cite).toContain('Measurement was performed with 100 samples.');
    expect(cite).toContain('| 평균 | 1.235 |');
    expect(cite).toContain('| 최소 | 0.100 |');
    expect(cite).toContain('| 최대 | 2.500 |');
    expect(cite).toContain('| 마지막 값 | 1.200 |');
  });

  it('note 가 있으면 신호 처리 줄을 추가하고, 없으면 생략한다', () => {
    const withNote = measurementCitation('전류 리플', stats, '이동평균 N=8');
    expect(withNote).toContain('신호 처리: 이동평균 N=8');

    const withoutNote = measurementCitation('전류 리플', stats);
    expect(withoutNote).not.toContain('신호 처리:');
  });
});

describe('SERIES / seriesStory — 프로젝트 시리즈 트랙', () => {
  it('시리즈 id 가 중복되지 않고 소속 프로젝트 id 가 모두 실제 존재한다', () => {
    const projectIds = new Set(PROJECTS.map((p) => p.id));
    const seriesIds = SERIES.map((s) => s.id);
    expect(new Set(seriesIds).size).toBe(seriesIds.length);

    for (const s of SERIES) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.story.length).toBeGreaterThan(0);
      expect(s.projects.length).toBeGreaterThan(0);
      for (const pid of s.projects) {
        expect(projectIds.has(pid)).toBe(true);
      }
    }
  });

  it('알려진 id 는 story 를 반환한다', () => {
    expect(seriesStory('mini-ecu')).toBe(SERIES[0].story);
    expect(seriesStory('ev-drive').length).toBeGreaterThan(0);
  });

  it('알 수 없는 id 는 빈 문자열을 반환한다', () => {
    expect(seriesStory('no-such-series')).toBe('');
  });
});
