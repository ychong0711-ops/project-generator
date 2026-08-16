import { describe, it, expect } from "vitest";
import { PROJECTS } from "./projects";
import { samplesFor } from "./samples";
import { runC } from "../offline/interpreter";

/**
 * 기존 수동 검증(expect) 자동화:
 * 모든 프로젝트의 offline:true 샘플을 runC 로 실행해
 * ok === true 이고 expect 배열의 모든 문자열이 output 에 포함되는지 검증.
 */
const offlineSamples = PROJECTS.flatMap((p) =>
  samplesFor(p.id)
    .filter((s) => s.offline && s.expect && s.expect.length > 0)
    .map((s) => ({ projectId: p.id, sample: s }))
);

describe("offline 샘플 통합 검증 (samplesFor → runC)", () => {
  it.each(offlineSamples)(
    "$sample.id (project: $projectId) — ok && 모든 expect 포함",
    ({ projectId, sample }) => {
      const r = runC(sample.code);

      if (!r.ok) {
        throw new Error(
          `[FAIL] ${sample.id} (project: ${projectId}) — 실행 실패: ${r.error?.message} (line ${r.error?.line})`
        );
      }

      const missing = (sample.expect ?? []).filter((e) => !r.output.includes(e));
      if (missing.length > 0) {
        throw new Error(
          `[FAIL] ${sample.id} (project: ${projectId}) — 기대 출력 누락: ${missing.join(", ")}`
        );
      }

      expect(r.ok).toBe(true);
      for (const e of sample.expect ?? []) {
        expect(r.output).toContain(e);
      }
    }
  );

  it("검증 대상 offline 샘플이 존재해야 함 (스모크)", () => {
    expect(offlineSamples.length).toBeGreaterThan(0);
  });
});
