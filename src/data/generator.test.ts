import { describe, it, expect } from "vitest";
import { generateSop } from "./generator";

/**
 * SOP 생성기 검증:
 * - 실존 대학(rwth) + 실존 프로젝트(can-uds-scanner, autosar-swc)로 4섹션 초안 생성
 * - plainText에 프로젝트 code/titleEn, 이름 플레이스홀더 포함 여부
 * - matchedFocus 교집합 로직 (rwth 'AUTOSAR' ↔ autosar-swc 'AUTOSAR Classic')
 * - 잘못된 입력(미지원 대학/빈 프로젝트)에 대한 Error throw
 */
const VALID_UNI_ID = "rwth";
const P1 = "can-uds-scanner"; // DE-EMB-1001 — CAN Bus Analyzer & UDS Diagnostic Scanner
const P2 = "autosar-swc"; // DE-EMB-1013 — AUTOSAR Classic SWC/RTE Layer Prototype

describe("generateSop — Motivationsschreiben 초안 생성", () => {
  const result = generateSop({ uniId: VALID_UNI_ID, projectIds: [P1, P2] });

  it("sections는 정확히 4개 (서론/왜 이 대학인가/프로젝트 경험/결론)", () => {
    expect(result.sections.length).toBe(4);
    expect(result.sections.map((s) => s.heading)).toEqual([
      "서론",
      "왜 이 대학인가",
      "프로젝트 경험",
      "결론",
    ]);
  });

  it("title에 대학 영문명이 포함됨", () => {
    expect(result.title).toContain("RWTH Aachen University");
  });

  it("plainText에 첫 프로젝트의 code와 titleEn, '[이름]' 플레이스홀더가 포함됨", () => {
    expect(result.plainText).toContain("DE-EMB-1001");
    expect(result.plainText).toContain("CAN Bus Analyzer & UDS Diagnostic Scanner");
    expect(result.plainText).toContain("[이름]");
  });

  it("applicantName 지정 시 플레이스홀더 대신 실제 이름 사용", () => {
    const named = generateSop({ uniId: VALID_UNI_ID, projectIds: [P1], applicantName: "홍길동" });
    expect(named.plainText).toContain("홍길동");
    expect(named.plainText).not.toContain("[이름]");
  });

  it("matchedFocus: rwth 'AUTOSAR' ↔ autosar-swc 'AUTOSAR Classic' 부분 문자열 매칭 1건", () => {
    // rwth focus 중 'AUTOSAR'(소문자 'autosar')만 프로젝트 skills('AUTOSAR Classic')와
    // 대소문자 무시 부분 문자열로 교차함
    expect(result.matchedFocus).toContain("AUTOSAR");
    expect(result.matchedFocus.length).toBe(1);
  });

  it("존재하지 않는 uniId → Error throw", () => {
    expect(() => generateSop({ uniId: "nonexistent-univ", projectIds: [P1] })).toThrow(Error);
  });

  it("유효한 프로젝트가 없으면(빈 배열/미지원 id) → Error throw", () => {
    expect(() => generateSop({ uniId: VALID_UNI_ID, projectIds: [] })).toThrow(Error);
    expect(() => generateSop({ uniId: VALID_UNI_ID, projectIds: ["ghost-project"] })).toThrow(Error);
  });
});
