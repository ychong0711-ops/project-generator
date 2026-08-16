import { describe, it, expect } from "vitest";
import {
  genMainC,
  genMakefile,
  genPlan,
  genInterview,
  genReadme,
  genAlgoReadme,
} from "./codegen";
import { projectById, PROJECTS } from "../data/projects";
import { samplesFor } from "../data/samples";

const projectIds = ["can-uds-scanner", "state-machine-intro", "freertos-ecu"];

describe("codegen — genMainC", () => {
  it.each(projectIds)("%s: 제목 포함, phase_N(void) 개수 === milestones, printf 포함", (id) => {
    const p = projectById(id);
    expect(p).toBeDefined();
    const src = genMainC(p!);

    expect(src).toContain(p!.title);
    expect(src).toContain(p!.titleEn);

    const phaseCount = (src.match(/void phase_\d+\(void\)/g) ?? []).length;
    expect(phaseCount).toBe(p!.milestones.length);

    // 각 milestone phase 텍스트가 주석으로 포함
    for (const m of p!.milestones) {
      expect(src).toContain(m.phase);
    }
    expect(src).toContain("printf");
    expect(src).toContain("int main(void)");
  });
});

describe("codegen — genMakefile", () => {
  it.each(projectIds)("%s: TARGET/arm-none-eabi-/all/flash/clean 포함", (id) => {
    const p = projectById(id);
    const mk = genMakefile(p!);

    expect(mk).toContain("TARGET");
    expect(mk).toContain(id);
    expect(mk).toContain("arm-none-eabi-");
    expect(mk).toContain("all:");
    expect(mk).toContain("flash:");
    expect(mk).toContain("clean:");
    expect(mk).toContain("PREFIX");
  });
});

describe("codegen — genPlan", () => {
  it.each(projectIds)("%s: milestone phase 와 task 체크박스 포함", (id) => {
    const p = projectById(id);
    const plan = genPlan(p!);

    for (const m of p!.milestones) {
      expect(plan).toContain(m.phase);
      for (const t of m.tasks) {
        expect(plan).toContain(`- [ ] ${t}`);
      }
    }
    // 목표/산출물도 체크박스
    for (const g of p!.goals) expect(plan).toContain(`- [ ] ${g}`);
    expect(plan).toContain(`# ${p!.title}`);
  });
});

describe("codegen — genInterview", () => {
  it.each(projectIds)("%s: 모든 interviewQs 포함", (id) => {
    const p = projectById(id);
    const txt = genInterview(p!);

    expect(p!.interviewQs.length).toBeGreaterThan(0);
    for (const q of p!.interviewQs) {
      expect(txt).toContain(q);
    }
    expect(txt).toContain("5분 발표 스크립트");
  });
});

describe("codegen — genReadme", () => {
  it.each(projectIds)("%s: projectToMarkdown 결과 + 스타터팩 파일 표 포함", (id) => {
    const p = projectById(id);
    const md = genReadme(p!);

    expect(md).toContain(`# ${p!.title} — ${p!.titleEn}`);
    expect(md).toContain(p!.tagline);
    expect(md).toContain("프로젝트 개요");
    expect(md).toContain("스타터팩 파일 구성");
    expect(md).toContain("src/main.c");
    expect(md).toContain("Makefile");
    expect(md).toContain("docs/plan.md");
    expect(md).toContain("docs/interview-prep.md");
    // 마크다운 표 헤더
    expect(md).toContain("| 파일 | 설명 |");
  });
});

describe("codegen — genAlgoReadme", () => {
  it.each(projectIds)("%s: samplesFor 의 모든 파일명 나열", (id) => {
    const p = projectById(id);
    const samples = samplesFor(id);
    expect(samples.length).toBeGreaterThan(0);

    const md = genAlgoReadme(p!);
    for (const s of samples) {
      expect(md).toContain(`\`${s.id}.c\``);
      expect(md).toContain(s.desc);
    }
    expect(md).toContain(`# 알고리즘 검증용 C 코드`);
  });
});

describe("codegen — 데이터 무결성", () => {
  it("모든 프로젝트가 codegen 에서 오류 없이 동작", () => {
    for (const p of PROJECTS) {
      expect(genMainC(p)).toContain("int main(void)");
      expect(genMakefile(p)).toContain("TARGET");
      expect(genPlan(p)).toContain("- [ ]");
      expect(genInterview(p)).toContain("Q1.");
      expect(genReadme(p)).toContain(p.title);
      expect(genAlgoReadme(p)).toBeTruthy();
    }
  });
});
