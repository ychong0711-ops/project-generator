import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { generateProject, scaffoldProjectIds } from "./generateProject";
import { familyOf } from "./families";
import { projectById } from "../data/projects";

/* ============================================================
 *  통합 검증 (M5 DoD) — 전 17개 프로젝트를 실제로 물질화하여
 *   (1) 호스트 빌드+실행 (전체)  (2) make test  (3) ARM ELF  (4) CMake
 *  를 검증한다. 툴체인 없는 환경에서는 해당 케이스를 자동 skip.
 *  SCAFFOLD_FULL_ARM=1 이면 전체 ARM 매트릭스(nightly)를 돌린다.
 * ============================================================ */

const IS_WIN = process.platform === "win32";
const EXE = IS_WIN ? ".exe" : "";

const EXTRA_PATHS = (IS_WIN ? ["C:/msys64/mingw64/bin", "C:/Program Files/LLVM/bin"] : []).filter(
  (p) => existsSync(p)
);
const MAKE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  PATH: [...EXTRA_PATHS, process.env.PATH ?? ""].join(delimiter),
};

function has(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, { stdio: "ignore", env: MAKE_ENV });
    return true;
  } catch {
    return false;
  }
}

function probeHostCC(cmd: string): boolean {
  try {
    const d = mkdtempSync(join(tmpdir(), "cc-probe-"));
    writeFileSync(join(d, "p.c"), "int main(void){return 0;}\n");
    execFileSync(cmd, ["-std=c11", join(d, "p.c"), "-o", join(d, `p${EXE}`)], {
      stdio: "ignore",
      env: MAKE_ENV,
    });
    rmSync(d, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

const MAKE = has("make", ["--version"]) ? "make" : "";
const HOST_CC = process.env.SCAFFOLD_CC ?? ["cc", "gcc", "clang"].find(probeHostCC) ?? "";
const ARM_OK = has("arm-none-eabi-gcc", ["--version"]);
const CMAKE = has("cmake", ["--version"]) ? "cmake" : "";

const HAS_MAKE_BUILD = !!MAKE && !!HOST_CC;

const ALL = scaffoldProjectIds();
const isHostFamily = (id: string) => familyOf(projectById(id)!) === "linux";
const ARM_IDS_ALL = ALL.filter((id) => !isHostFamily(id));

/* PR: ARM 대표 3종만. nightly(SCAFFOLD_FULL_ARM=1): 전체 ARM. */
const ARM_REPS = ["can-uds-scanner", "autosar-swc", "freertos-ecu"];
const ARM_IDS = process.env.SCAFFOLD_FULL_ARM === "1" ? ARM_IDS_ALL : ARM_REPS;

const dirs = new Map<string, string>();

function materialize(id: string): string {
  const d = mkdtempSync(join(tmpdir(), `autoembed-${id}-`));
  for (const f of generateProject(id)) {
    const full = join(d, f.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, f.content, "utf8");
  }
  dirs.set(id, d);
  return d;
}

function run(cmd: string, args: string[], cwd: string, timeout = 180000): string {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", timeout, env: MAKE_ENV });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    throw new Error(
      `${cmd} ${args.join(" ")} failed in ${cwd}:\n--- stdout ---\n${err.stdout ?? ""}\n--- stderr ---\n${err.stderr ?? ""}`
    );
  }
}

describe("scaffold build — 전 프로젝트 실제 빌드 (M5)", () => {
  beforeAll(() => {
    for (const id of ALL) materialize(id);
  });
  afterAll(() => {
    for (const d of dirs.values()) rmSync(d, { recursive: true, force: true });
  });

  it("overlay 17개 = 버그 없이 전량 생성", () => {
    for (const id of ALL) {
      const f = generateProject(id);
      expect(f.length, id).toBeGreaterThan(5);
      expect(new Set(f.map((x) => x.path)).size, id).toBe(f.length);
    }
  });

  describe("호스트 빌드 + 실행 (전체)", () => {
    for (const id of ALL) {
      it.runIf(HAS_MAKE_BUILD)(`${id}: make sim → "self-test done"`, () => {
        const dir = dirs.get(id)!;
        run(MAKE, ["sim", `CC=${HOST_CC}`], dir);
        const bin = join(dir, "build", isHostFamily(id) ? `${id}${EXE}` : `sim${EXE}`);
        expect(existsSync(bin)).toBe(true);
        const out = execFileSync(bin, [], {
          cwd: dir,
          encoding: "utf8",
          timeout: 30000,
          env: MAKE_ENV,
        });
        expect(out).toContain("self-test done");
      }, 200000);
    }
  });

  describe("알고리즘 자체 테스트 (make test, 전체)", () => {
    for (const id of ALL) {
      it.runIf(HAS_MAKE_BUILD)(`${id}: make test`, () => {
        run(MAKE, ["test", `CC=${HOST_CC}`], dirs.get(id)!);
      }, 200000);
    }
  });

  describe("ARM ELF", () => {
    for (const id of ARM_IDS) {
      it.runIf(!!MAKE && ARM_OK)(`${id}: make arm → .elf`, () => {
        const dir = dirs.get(id)!;
        run(MAKE, ["arm"], dir);
        expect(existsSync(join(dir, "build", `${id}.elf`))).toBe(true);
      }, 240000);
    }
  });

  describe("CMake 빌드", () => {
    it.runIf(!!CMAKE && HAS_MAKE_BUILD)("linux-cluster: CMake 네이티브 빌드", () => {
      const dir = dirs.get("linux-cluster")!;
      run(CMAKE, ["-S", ".", "-B", "build/cmake", "-G", "Ninja", `-DCMAKE_C_COMPILER=${HOST_CC}`], dir);
      run(CMAKE, ["--build", "build/cmake"], dir);
    }, 240000);

    it.runIf(!!CMAKE && ARM_OK)("can-uds-scanner: CMake ARM(toolchain) 빌드", () => {
      const dir = dirs.get("can-uds-scanner")!;
      run(
        CMAKE,
        ["-S", ".", "-B", "build/cmake", "-G", "Ninja", "-DCMAKE_TOOLCHAIN_FILE=cmake/arm-none-eabi.cmake"],
        dir
      );
      run(CMAKE, ["--build", "build/cmake"], dir);
    }, 240000);
  });
});
