import { describe, it, expect } from 'vitest';
import { runC } from './interpreter';

describe('scratch diagnostics', () => {
  it('case A: basic printf', () => {
    const r = runC(`
int main(void) {
    printf("%d\\n", 2 + 3 * 4);
    return 0;
}`);
    console.log('A:', JSON.stringify(r));
    expect(r.ok).toBe(true);
  });

  it('case B: hex literals', () => {
    const r = runC(`
int main(void) {
    printf("%d %d %d\\n", 0x1F, 0xFF, 0X10);
    return 0;
}`);
    console.log('B:', JSON.stringify(r));
    expect(r.ok).toBe(true);
  });

  it('case C: multi-decl with comma', () => {
    const r = runC(`
int main(void) {
    int x = 10, y = 20;
    printf("%d %d\\n", x, y);
    return 0;
}`);
    console.log('C:', JSON.stringify(r));
    expect(r.ok).toBe(true);
  });

  it('case D: one decl per line', () => {
    const r = runC(`
int main(void) {
    int x = 10;
    int y = 20;
    printf("%d %d\\n", x, y);
    return 0;
}`);
    console.log('D:', JSON.stringify(r));
    expect(r.ok).toBe(true);
  });

  it('case E: %X specifier', () => {
    const r = runC(`
int main(void) {
    printf("%X\\n", 255);
    return 0;
}`);
    console.log('E:', JSON.stringify(r));
    expect(r.ok).toBe(true);
  });

  it('case F: %u and %x', () => {
    const r = runC(`
int main(void) {
    printf("%u %x\\n", 4294967295u, 255);
    return 0;
}`);
    console.log('F:', JSON.stringify(r));
    expect(r.ok).toBe(true);
  });

  it('case G: sample-style code (like real samples)', () => {
    const r = runC(`
int main(void) {
    int sum = 0;
    int i;
    for (i = 0; i < 5; i++) {
        sum += i;
    }
    printf("sum=%d\\n", sum);
    return 0;
}`);
    console.log('G:', JSON.stringify(r));
    expect(r.ok).toBe(true);
  });
});
