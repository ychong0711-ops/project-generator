import { describe, it, expect } from "vitest";
import { PROJECTS } from "../projects";
import {
  ALL_ENTRIES,
  PRACTICE_EXAMPLES,
  IMPLEMENTATION_GUIDES,
  entriesByProject,
  practiceByProject,
} from "./index";

/**
 * practice-examples 레지스트리 무결성 검증:
 * - 타입 차별화 (type: 'lab' | 'guide')
 * - id 유니크성, projectIds 실존 여부, 열거형 값 범위
 * - PracticeExample: lang, path 접두사 검증
 * - ImplementationGuide: htmlPath 접두사 검증
 * - 통합 레지스트리 합·조회 헬퍼 동작
 */

const projectIds = new Set(PROJECTS.map((p) => p.id));
const LEVELS = ["입문", "중급", "심화"] as const;
const HARDWARE = ["none", "vcan", "vcan-pair", "stm32-freertos"] as const;
const LAB_LANGS = ["C", "Python", "Shell"] as const;
const ENTRY_TYPES = ["lab", "guide"] as const;

describe("practice-examples 레지스트리 무결성", () => {
  /* ── 통합 레지스트리 ── */

  it("ALL_ENTRIES 총 개수가 22여야 함 (8 랩 + 14 HTML 가이드)", () => {
    expect(PRACTICE_EXAMPLES.length).toBe(8);
    expect(IMPLEMENTATION_GUIDES.length).toBe(14);
    expect(ALL_ENTRIES.length).toBe(22);
  });

  it("모든 id가 유니크해야 함 (lab + guide 합산)", () => {
    const ids = ALL_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 projectIds가 PROJECTS의 실존 id여야 함", () => {
    for (const e of ALL_ENTRIES) {
      expect(e.projectIds.length).toBeGreaterThan(0);
      for (const pid of e.projectIds) {
        expect(projectIds.has(pid), `[${e.id}] 알 수 없는 projectId: ${pid}`).toBe(true);
      }
    }
  });

  it("level/hardware 값이 유니온 범위 내여야 함 (런타임 데이터 방어)", () => {
    for (const e of ALL_ENTRIES) {
      expect(ENTRY_TYPES, `[${e.id}] type`).toContain(e.type);
      expect(LEVELS, `[${e.id}] level`).toContain(e.level);
      expect(HARDWARE, `[${e.id}] hardware`).toContain(e.hardware);
    }
  });

  /* ── PracticeExample 전용 ── */

  it("모든 PracticeExample의 type이 'lab'이어야 함", () => {
    for (const p of PRACTICE_EXAMPLES) {
      expect(p.type).toBe("lab");
    }
  });

  it("모든 PracticeExample lang이 유니온 범위 내", () => {
    for (const p of PRACTICE_EXAMPLES) {
      expect(LAB_LANGS, `[${p.id}] lang`).toContain(p.lang);
    }
  });

  it("모든 PracticeExample path가 'src/'|'scripts/'|'dbc/' 접두사로 시작", () => {
    const prefixes = ["src/", "scripts/", "dbc/"];
    for (const p of PRACTICE_EXAMPLES) {
      expect(
        prefixes.some((pre) => p.path.startsWith(pre)),
        `[${p.id}] 잘못된 path 접두사: ${p.path}`
      ).toBe(true);
    }
  });

  /* ── ImplementationGuide 전용 ── */

  it("모든 ImplementationGuide의 type이 'guide'이어야 함", () => {
    for (const g of IMPLEMENTATION_GUIDES) {
      expect(g.type).toBe("guide");
    }
  });

  it("모든 ImplementationGuide htmlPath가 '/example/' 접두사로 시작", () => {
    for (const g of IMPLEMENTATION_GUIDES) {
      expect(
        g.htmlPath.startsWith("/example/"),
        `[${g.id}] 잘못된 htmlPath 접두사: ${g.htmlPath}`
      ).toBe(true);
    }
  });

  it("모든 ImplementationGuide run이 '브라우저에서 가이드 열기' 이어야 함", () => {
    for (const g of IMPLEMENTATION_GUIDES) {
      expect(g.run, `[${g.id}] run`).toBe("브라우저에서 가이드 열기");
    }
  });

  /* ── 조회 헬퍼 ── */

  it("entriesByProject('can-uds-scanner') 최소 8개 반환 (lab+guide 합산)", () => {
    const hits = entriesByProject("can-uds-scanner");
    expect(hits.length).toBeGreaterThanOrEqual(8);
  });

  it("practiceByProject('can-uds-scanner') 최소 5개 반환 (lab 전용)", () => {
    const hits = practiceByProject("can-uds-scanner");
    expect(hits.length).toBeGreaterThanOrEqual(5);
  });
});
