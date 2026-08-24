// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { GCC_HELP, findGccHelp } from './gccHelp';

describe('GCC_HELP — 지식베이스 무결성', () => {
  it('규칙이 10개 이상이고 모든 항목이 4개 필드(제목/원인/해결/학습)를 가진다', () => {
    expect(GCC_HELP.length).toBeGreaterThanOrEqual(10);
    for (const rule of GCC_HELP) {
      expect(rule.re).toBeInstanceOf(RegExp);
      for (const field of [rule.help.title, rule.help.cause, rule.help.fix, rule.help.learn]) {
        expect(field.length).toBeGreaterThan(0);
      }
    }
  });

  it('help 제목이 중복되지 않는다', () => {
    const titles = GCC_HELP.map((r) => r.help.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('findGccHelp — 에러 텍스트 매칭', () => {
  it('미선언 식별자 에러를 진단한다', () => {
    const out = findGccHelp("error: 'crc8' was not declared in this scope");
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('미선언 식별자 (변수/함수 이름 오류)');
    expect(out[0].fix.length).toBeGreaterThan(0);
  });

  it('링커 오류(undefined reference)를 진단한다', () => {
    const out = findGccHelp('undefined reference to `uart_send`');
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('링커 오류 — 함수를 찾을 수 없음');
  });

  it('대소문자를 구분하지 않는다', () => {
    const out = findGccHelp('UNDEFINED REFERENCE TO `foo`');
    expect(out.some((h) => h.title.includes('링커 오류'))).toBe(true);
  });

  it('여러 규칙에 걸치면 최대 2개까지만 반환한다', () => {
    // "expected ';'" (구문 오류) + "undefined reference" (링커) 동시 매칭
    const out = findGccHelp("expected ';' before ... undefined reference to `f`");
    expect(out.length).toBe(2);
    expect(new Set(out.map((h) => h.title)).size).toBe(2);
  });

  it('매칭되는 규칙이 없으면 빈 배열을 반환한다', () => {
    expect(findGccHelp('hello world')).toEqual([]);
    expect(findGccHelp('')).toEqual([]);
  });

  it('세미콜론 누락 / 암시적 선언 등 주요 케이스를 각각 진단한다', () => {
    expect(findGccHelp("error: expected ';' before '}' token")[0].title).toBe(
      '구문 오류 — 세미콜론/괄호/중괄호'
    );
    expect(findGccHelp("warning: implicit declaration of function 'delay'")[0].title).toBe(
      '함수 암시적 선언 경고'
    );
    expect(findGccHelp('error: redefinition of `crc_calc`')[0].title).toBe(
      '중복 정의 / 타입 충돌'
    );
    expect(findGccHelp('fatal error: stm32f4xx_hal.h: No such file or directory')[0].title).toBe(
      '헤더 파일을 찾을 수 없음'
    );
    expect(findGccHelp('warning: unused variable `tmp`')[0].title).toBe(
      '사용하지 않는 변수 (경고)'
    );
    expect(
      findGccHelp('error: lvalue required as left operand of assignment')[0].title
    ).toBe('대입 불가능한 대상 (lvalue 오류)');
  });
});
