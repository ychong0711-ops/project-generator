import { describe, it, expect } from "vitest";
import { generateProject, scaffoldProjectIds } from "./generateProject";

/* ============================================================
 *  골든 테스트 (회귀 방지, M5)
 *  생성 트리(파일 경로 목록)를 스냅샷으로 고정한다.
 *  템플릿/보드/패밀리 변경 시 의도치 않은 트리 변동을 즉시 감지한다.
 *  갱신: npx vitest run src/scaffold/scaffold.golden.test.ts -u
 * ============================================================ */

describe("scaffold golden — 생성 파일트리 스냅샷", () => {
  for (const id of scaffoldProjectIds()) {
    it(`${id} (기본: make+cmake)`, () => {
      const paths = generateProject(id)
        .map((f) => f.path)
        .sort();
      expect(paths).toMatchSnapshot();
    });
  }

  it("can-uds-scanner 보드 오버라이드(F407) 트리 변동", () => {
    const paths = generateProject("can-uds-scanner", { board: "stm32f407-discovery" })
      .map((f) => f.path)
      .sort();
    expect(paths).toMatchSnapshot();
  });

  it("can-uds-scanner make-only 트리 변동", () => {
    const paths = generateProject("can-uds-scanner", { buildSystems: ["make"] })
      .map((f) => f.path)
      .sort();
    expect(paths).toMatchSnapshot();
  });
});
