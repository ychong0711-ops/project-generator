import { describe, it, expect } from 'vitest';
import { analyzeCode, analyzeQuality } from './analyzer';

describe('analyzeQuality — MISRA-C 기반 코드 품질 점수', () => {
  it('깨끗한 코드는 100점', () => {
    const src = `#include <stdio.h>
#define SAMPLE_RATE 1000
static int count = 0;
int main(void) {
    count += 1;
    printf("count=%d\\n", count);
    return 0;
}`;
    const r = analyzeQuality(src);
    expect(r.qualityScore).toBe(100);
    expect(r.qualityIssues).toHaveLength(0);
  });

  it('매직 넘버 감점', () => {
    const r = analyzeQuality(`
int main(void) {
    printf("%d %d %d %d\\n", 128, 256, 512, 1024);
    return 0;
}`);
    expect(r.qualityScore).toBeLessThan(100);
    expect(r.qualityIssues.some((i) => i.rule === 'magic-number')).toBe(true);
  });

  it('goto 사용 감점', () => {
    const r = analyzeQuality(`
int main(void) {
    goto cleanup;
cleanup:
    return 0;
}`);
    expect(r.qualityScore).toBeLessThan(100);
    expect(r.qualityIssues.some((i) => i.rule === 'goto')).toBe(true);
  });

  it('점수 하한은 0', () => {
    const r = analyzeQuality(`int main(void) { goto a; a: goto b; b: return 0; }`);
    expect(r.qualityScore).toBeGreaterThanOrEqual(0);
  });

  it('품질 이슈는 규칙명과 메시지 포함', () => {
    const r = analyzeQuality(`int main(void) { int x = 100; goto end; end: return x; }`);
    for (const issue of r.qualityIssues) {
      expect(typeof issue.rule).toBe('string');
      expect(issue.message.length).toBeGreaterThan(0);
      expect(['warning', 'info']).toContain(issue.severity);
    }
  });

  it('주석의 숫자는 MISRA 매직 넘버 감점에 포함되지 않는다', () => {
    const r = analyzeQuality(`
int main(void) {
    // 4096 8192 16384 32768 65536 131072
    return 0;
}`);
    expect(r.qualityIssues.some((i) => i.rule === 'magic-number')).toBe(false);
    expect(r.qualityScore).toBe(100);
  });

  it('주석의 goto는 MISRA goto 감점에 포함되지 않는다', () => {
    const r = analyzeQuality(`
// goto 를 쓰지 말라는 설명 주석
int main(void) {
    return 0;
}`);
    expect(r.qualityIssues.some((i) => i.rule === 'goto')).toBe(false);
    expect(r.qualityScore).toBe(100);
  });
});

describe('analyzeCode — 주석/문자열 오탐 방지', () => {
  it('문자열 안의 "printf("는 stdio.h 누락 진단을 일으키지 않는다', () => {
    const src = `#include <stdint.h>
char msg[] = "printf( is only a literal, not a call";
int main(void) {
    return 0;
}`;
    const r = analyzeCode(src, 'state-machine-intro');
    expect(r.issues.some((i) => i.title === 'stdio.h 누락')).toBe(false);
  });

  it('주석 안의 "gets()"는 금지 함수 진단을 일으키지 않는다', () => {
    const src = `#include <stdio.h>
// TODO: use gets() safely
int main(void) {
    return 0;
}`;
    const r = analyzeCode(src, 'state-machine-intro');
    expect(r.issues.some((i) => i.title === '금지 함수 gets()')).toBe(false);
  });

  it('실제 printf( 호출이 있는 코드는 여전히 stdio.h 누락을 잡는다', () => {
    const src = `int main(void) {
    printf("hello\\n");
    return 0;
}`;
    const r = analyzeCode(src, 'state-machine-intro');
    expect(r.issues.some((i) => i.title === 'stdio.h 누락' && i.line === 2)).toBe(true);
  });

  it('주석/문자열의 숫자는 매직 넘버 카운트에서 제외된다', () => {
    const src = `int main(void) {
    // 4096 8192 16384 32768 65536 131072
    return 0;
}`;
    const r = analyzeCode(src, 'state-machine-intro');
    expect(r.issues.some((i) => i.title.includes('매직 넘버'))).toBe(false);
  });

  it('주석의 "#include <stdio.h>"는 실제 include로 인정되지 않는다', () => {
    const src = `int main(void) {
    // TODO: #include <stdio.h> 라고 주석에 적어봤자 의미 없음
    printf("x\\n");
    return 0;
}`;
    const r = analyzeCode(src, 'state-machine-intro');
    expect(r.issues.some((i) => i.title === 'stdio.h 누락')).toBe(true);
  });

  it('문서화 비율(commentPct)은 주석을 포함한 원본 기준으로 계산된다', () => {
    const src = `#include <stdio.h>
// 설명 주석
int main(void) {
    return 0;
}`;
    const r = analyzeCode(src, 'state-machine-intro');
    expect(r.stats.commentPct).toBeGreaterThan(0);
  });
});
