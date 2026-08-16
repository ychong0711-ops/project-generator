import { describe, it, expect } from 'vitest';
import { analyzeQuality } from './analyzer';

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
});
