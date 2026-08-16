/** ============================================================
 *  Compiler Explorer(godbolt.org) 공개 API 클라이언트
 *  — 브라우저에서 실제 arm-none-eabi-gcc 크로스 컴파일 수행
 * ============================================================ */

export interface CompilerDiagnostic {
  line: number;
  text: string;
  type: 'error' | 'warning' | 'note';
}

export interface CompileResult {
  ok: boolean;
  networkError: boolean;
  httpStatus?: number;
  exitCode?: number;
  stdout: string;
  stderr: string;
  asm: string;
  ms: number;
  diagnostics: CompilerDiagnostic[];
}

export interface CompilerOption {
  id: string;
  name: string;
}

export const COMPILERS: CompilerOption[] = [
  { id: 'armg1320', name: 'arm-none-eabi-gcc 13.2.0 (ARM)' },
  { id: 'armg1413', name: 'arm-none-eabi-gcc 14.1.3 (ARM)' },
  { id: 'armg1421', name: 'arm-none-eabi-gcc 14.2.1 (ARM)' },
  { id: 'cg142', name: 'gcc 14.2 (x86-64, 로컬 실행용)' },
];

interface CELine {
  text: string;
  tag?: { line?: number; text?: string };
}

function parseDiagnostics(data: { stdout?: CELine[]; stderr?: CELine[] }): CompilerDiagnostic[] {
  const out: CompilerDiagnostic[] = [];
  const scan = (lines: CELine[] | undefined) => {
    (lines ?? []).forEach((l) => {
      if (l.tag && typeof l.tag.line === 'number' && l.tag.text) {
        const type = /error/i.test(l.tag.text) ? 'error' : /warning/i.test(l.tag.text) ? 'warning' : 'note';
        out.push({ line: l.tag.line, text: l.tag.text, type });
        return;
      }
      const m = l.text.match(/:(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.*)/);
      if (m) {
        const type = m[2].includes('error') ? 'error' : m[2] === 'warning' ? 'warning' : 'note';
        out.push({ line: Number(m[1]), text: `${m[2]}: ${m[3]}`, type });
      }
    });
  };
  scan(data.stdout);
  scan(data.stderr);
  return out;
}

interface CEResponse {
  code?: number;
  stdout?: CELine[];
  stderr?: CELine[];
  asm?: CELine[];
}

export async function compileWithCE(
  source: string,
  compilerId: string,
  userArguments: string
): Promise<CompileResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`https://godbolt.org/api/compiler/${compilerId}/compile`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        source,
        lang: 'c',
        allowStoreCodeDebug: false,
        options: {
          userArguments,
          compilerOptions: { skipAsm: false, executorRequest: false },
          filters: {
            binary: false,
            execute: false,
            intel: false,
            demangle: true,
            directives: false,
            labels: false,
            commentOnly: false,
            trim: true,
            optOutput: false,
          },
          tools: [],
        },
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        networkError: false,
        httpStatus: res.status,
        stdout: '',
        stderr: `HTTP ${res.status}: 컴파일러 ID(${compilerId})를 확인해 주세요. 목록에서 다른 컴파일러를 선택해 다시 시도해 보세요.`,
        asm: '',
        ms: Math.round(performance.now() - started),
        diagnostics: [],
      };
    }

    const data = (await res.json()) as CEResponse;
    const stdout = (data.stdout ?? []).map((l) => l.text).join('\n');
    const stderr = (data.stderr ?? []).map((l) => l.text).join('\n');
    const asm = (data.asm ?? []).map((l) => l.text).join('\n');
    const diagnostics = parseDiagnostics(data);

    return {
      ok: (data.code ?? 1) === 0,
      networkError: false,
      exitCode: data.code ?? 1,
      stdout,
      stderr,
      asm,
      ms: Math.round(performance.now() - started),
      diagnostics,
    };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    return {
      ok: false,
      networkError: true,
      stdout: '',
      stderr: aborted
        ? '요청 시간 초과 (30초). 네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
        : 'Compiler Explorer API에 연결할 수 없습니다. (브라우저에서 외부 네트워크 차단 또는 CORS 제한)\n\n직접 확인: https://godbolt.org 에서 코드를 붙여넣고 arm-none-eabi-gcc를 선택해 컴파일할 수 있습니다.',
      asm: '',
      ms: Math.round(performance.now() - started),
      diagnostics: [],
    };
  } finally {
    clearTimeout(timer);
  }
}
