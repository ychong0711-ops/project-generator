import { describe, it, expect } from "vitest";
import { generateProject, isScaffoldSupported, scaffoldProjectIds } from "./generateProject";
import { projectById } from "../data/projects";

const pathsOf = (id: string, opts?: Parameters<typeof generateProject>[1]) =>
  generateProject(id, opts).map((f) => f.path);

describe("scaffold — generateProject (M3 대표 프로젝트)", () => {
  it("전 17개 프로젝트를 지원한다 (M5)", () => {
    expect(scaffoldProjectIds()).toHaveLength(17);
    for (const id of scaffoldProjectIds()) {
      expect(projectById(id), `overlay id '${id}' 가 projects 데이터에 존재`).toBeTruthy();
    }
    expect(isScaffoldSupported("bldc-foc")).toBe(true);
    expect(isScaffoldSupported("unknown-id")).toBe(false);
  });

  it("can-uds-scanner → bare-metal / bluepill-f103 (F103)", () => {
    const paths = pathsOf("can-uds-scanner");
    for (const req of [
      "README.md",
      "Makefile",
      "CMakeLists.txt",
      "cmake/arm-none-eabi.cmake",
      "include/board.h",
      "include/can.h",
      "include/uds.h",
      "drivers/can.c",
      "app/uds.c",
      "src/main.c",
      "sim/board_sim.c",
      "bsp/arm/bluepill-f103/stm32f103.ld",
      "bsp/arm/bluepill-f103/startup_stm32f103.s",
      "tests/crc15.c",
    ]) {
      expect(paths).toContain(req);
    }
  });

  it("freertos-ecu → rtos 패밀리 / f407 보드 + rtos 라이브러리", () => {
    const paths = pathsOf("freertos-ecu");
    for (const req of [
      "include/rtos.h",
      "app/rtos.c",
      "include/tasks.h",
      "bsp/arm/stm32f407-discovery/stm32f407.ld",
      "bsp/arm/stm32f407-discovery/startup_stm32f407.s",
    ]) {
      expect(paths).toContain(req);
    }
  });

  it("linux-cluster → linux 패밀리 / host 보드 (ARM 산출물 없음)", () => {
    const paths = pathsOf("linux-cluster");
    expect(paths).toContain("include/mac.h");
    expect(paths).toContain("app/mac.c");
    expect(paths).toContain("CMakeLists.txt");
    // host: ARM 산출물/board 미포함
    expect(paths).not.toContain("include/board.h");
    expect(paths.some((p) => p.startsWith("bsp/"))).toBe(false);
    expect(paths).not.toContain("cmake/arm-none-eabi.cmake");
  });

  it("autosar-swc → autosar 패밀리 / f407 + RTE mock + SWC", () => {
    const paths = pathsOf("autosar-swc");
    for (const req of ["include/rte.h", "app/rte_mock.c", "include/swc.h", "app/swc_vehicle_speed.c"]) {
      expect(paths).toContain(req);
    }
  });

  it("보드 오버라이드 및 패밀리 정합성 보정", () => {
    const f407 = pathsOf("can-uds-scanner", { board: "stm32f407-discovery" });
    expect(f407).toContain("bsp/arm/stm32f407-discovery/stm32f407.ld");
    expect(f407.some((p) => p.includes("bluepill-f103"))).toBe(false);

    // ARM 프로젝트에 host 보드를 강제하면 ARM 보드로 보정
    const coerced = pathsOf("can-uds-scanner", { board: "host" });
    expect(coerced).toContain("include/board.h");
    expect(coerced.some((p) => p.startsWith("bsp/"))).toBe(true);
  });

  it("buildSystems 선택 (make만)", () => {
    const paths = pathsOf("can-uds-scanner", { buildSystems: ["make"] });
    expect(paths).toContain("Makefile");
    expect(paths).not.toContain("CMakeLists.txt");
  });

  it("경로 중복 없음 + 모든 내용 비어있지 않음 + 예외 처리", () => {
    for (const id of scaffoldProjectIds()) {
      const files = generateProject(id);
      const paths = files.map((f) => f.path);
      expect(new Set(paths).size).toBe(paths.length);
      expect(files.every((f) => f.content.length > 0)).toBe(true);
    }
    expect(() => generateProject("does-not-exist")).toThrow();
  });
});
