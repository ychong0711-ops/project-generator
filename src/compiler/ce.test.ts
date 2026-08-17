import { describe, it, expect } from 'vitest';
import { parseDiagnostics, COMPILERS } from './ce';

describe('parseDiagnostics', () => {
  it('tag 정보가 있으면 그대로 사용한다', () => {
    const out = parseDiagnostics({
      stderr: [{ text: 'ignored', tag: { line: 12, text: "error: 'x' undeclared" } }],
    });
    expect(out).toEqual([{ line: 12, text: "error: 'x' undeclared", type: 'error' }]);
  });

  it('gcc 텍스트 출력에서 행/심각도/메시지를 올바르게 뽑는다', () => {
    const out = parseDiagnostics({
      stderr: [{ text: "main.c:7:5: error: 'foo' undeclared (first use in this function)" }],
    });
    expect(out).toHaveLength(1);
    // 열(5)이 아니라 심각도가 type 이 되어야 한다 (인덱스 오프바이원 회귀 방지)
    expect(out[0].line).toBe(7);
    expect(out[0].type).toBe('error');
    expect(out[0].text).toBe("error: 'foo' undeclared (first use in this function)");
  });

  it('warning / note / fatal error 를 구분한다', () => {
    const out = parseDiagnostics({
      stderr: [
        { text: 'main.c:1:1: warning: unused variable' },
        { text: 'main.c:2:1: note: declared here' },
        { text: 'main.c:3:1: fatal error: stdio.h: No such file' },
      ],
    });
    expect(out.map((d) => d.type)).toEqual(['warning', 'note', 'error']);
    expect(out[0].text).toBe('warning: unused variable');
    expect(out[2].line).toBe(3);
  });

  it('진단이 아닌 줄은 무시한다', () => {
    expect(parseDiagnostics({ stdout: [{ text: 'Compilation succeeded' }] })).toEqual([]);
  });

  it('stdout 과 stderr 를 모두 훑는다', () => {
    const out = parseDiagnostics({
      stdout: [{ text: 'a.c:1:1: warning: w' }],
      stderr: [{ text: 'a.c:2:1: error: e' }],
    });
    expect(out).toHaveLength(2);
  });
});

describe('COMPILERS', () => {
  it('컴파일러 id 가 중복되지 않는다', () => {
    const ids = COMPILERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
