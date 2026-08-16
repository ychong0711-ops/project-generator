import { describe, it, expect } from 'vitest';
import { highlightLine, editorHtml } from './highlight';

describe('highlightLine — C 문법 하이라이터', () => {
  it('키워드는 보라색, 숫자는 하늘색으로 컬러링', () => {
    const out = highlightLine('int x = 0xFF; return 42;');
    expect(out).toContain('<span class="text-violet-300">int</span>');
    expect(out).toContain('<span class="text-violet-300">return</span>');
    expect(out).toContain('<span class="text-sky-300">0xFF</span>');
    expect(out).toContain('<span class="text-sky-300">42</span>');
  });

  it('문자열 안의 키워드/숫자는 컬러링되지 않는다', () => {
    const out = highlightLine('printf("int x = 5");');
    expect(out).toContain('<span class="text-amber-300">"int x = 5"</span>');
    expect(out).not.toContain('text-violet-300">int</span>');
    expect(out).not.toContain('text-sky-300">5</span>');
  });

  it('라인 주석은 italic 처리되고 주석 안의 코드 토큰은 컬러링되지 않는다', () => {
    const out = highlightLine('// return 42; int x = 0xFF');
    expect(out).toContain('<span class="text-slate-500 italic">// return 42; int x = 0xFF</span>');
    expect(out).not.toContain('text-violet-300">return</span>');
    expect(out).not.toContain('text-sky-300">42</span>');
    expect(out).not.toContain('text-violet-300">int</span>');
    expect(out).not.toContain('text-sky-300">0xFF</span>');
  });

  it('블록 주석은 italic 처리되고 주석 안의 토큰은 컬러링되지 않는다', () => {
    const only = highlightLine('/* int 42 "str" */');
    expect(only).toContain('<span class="text-slate-500 italic">/* int 42 "str" */</span>');
    expect(only).not.toContain('text-violet-300');
    expect(only).not.toContain('text-sky-300');
    expect(only).not.toContain('text-amber-300');

    // 주석 밖의 코드는 정상 컬러링
    const out = highlightLine('/* int 42 "str" */ int y = 1;');
    expect(out).toContain('<span class="text-violet-300">int</span>');
    expect(out).toContain('<span class="text-sky-300">1</span>');
    expect(out).not.toContain('text-sky-300">42</span>');
    expect(out).not.toContain('text-amber-300">"str"</span>');
  });

  it('이스케이프 시퀀스가 있는 문자열이 온전하다', () => {
    const out = highlightLine('printf("a\\n\\"b\\"");');
    expect(out).toContain('<span class="text-amber-300">"a\\n\\"b\\""</span>');
    expect(out).not.toContain('\u0000');
  });

  it('빈 문자열 / 한 글자 문자열 / 연속 문자열이 깨지지 않는다', () => {
    expect(highlightLine('char *a = "";')).toContain('<span class="text-amber-300">""</span>');
    expect(highlightLine("char c = 'a';")).toContain('<span class="text-amber-300">\'a\'</span>');
    const out = highlightLine('printf("a" "b");');
    expect(out).toContain('<span class="text-amber-300">"a"</span>');
    expect(out).toContain('<span class="text-amber-300">"b"</span>');
  });

  it('플레이스홀더가 리터럴로 유출되지 않는다 (회귀: 숫자 인덱스 컬러링 버그)', () => {
    for (const line of [
      'int main(void) { return 0; }',
      'printf("count=%d\\n", count);',
      '// comment 123',
      '/* block 456 */',
      'x = "a" "b" 1.5f;',
      '#define FOO 2',
    ]) {
      expect(highlightLine(line), line).not.toContain('\u0000');
    }
  });

  it('플레이스홀더 인덱스는 매치 전용 형식으로 복원된다', () => {
    const out = highlightLine('char s1[] = "aa"; char s2[] = "bb"; int n = 7;');
    expect(out).toContain('<span class="text-amber-300">"aa"</span>');
    expect(out).toContain('<span class="text-amber-300">"bb"</span>');
    expect(out).toContain('<span class="text-sky-300">7</span>');
    expect(out).not.toContain('\u0000');
  });

  it('전처리기 지시문은 푸시아로 컬러링되고 클래스명이 훼손되지 않는다', () => {
    const out = highlightLine('#include <stdio.h>');
    expect(out).toContain('<span class="text-fuchsia-400">#include &lt;stdio.h&gt;</span>');
    // NUMBER 패스가 클래스명 안의 "400"을 컬러링하지 않아야 한다
    expect(out).not.toContain('text-sky-300">400</span>');
  });

  it('지시문 안의 문자열/주석은 지시문 내부에서 개별 컬러링된다', () => {
    const out = highlightLine('#include "config.h"');
    expect(out).toContain('<span class="text-fuchsia-400">#include ');
    expect(out).toContain('<span class="text-amber-300">"config.h"</span>');
    expect(out).not.toContain('\u0000');
  });

  it('지시문 안의 숫자는 지시문 컬러링에 흡수된다', () => {
    const out = highlightLine('#define SAMPLE_RATE 1000');
    expect(out).toContain('<span class="text-fuchsia-400">#define SAMPLE_RATE 1000</span>');
    expect(out).not.toContain('text-sky-300">1000</span>');
  });

  it('HTML 특수문자는 이스케이프된다', () => {
    const out = highlightLine('if (a < b && c > d) {}');
    expect(out).toContain('a &lt; b');
    expect(out).toContain('c &gt; d');
    expect(out).toContain('&amp;&amp;');
    expect(out).not.toContain('<b>');
  });
});

describe('editorHtml — 오류/경고 라인 배경', () => {
  it('오류 라인과 경고 라인에 배경 클래스가 붙는다', () => {
    const map = new Map<number, 'error' | 'warning'>([
      [1, 'error'],
      [2, 'warning'],
    ]);
    const out = editorHtml('int x = 0;\nint y = 1;', map);
    expect(out).toContain('bg-red-500/15');
    expect(out).toContain('bg-amber-400/10');
    expect(out).toContain('<div class="bg-red-500/15">');
    expect(out).toContain('<div class="bg-amber-400/10">');
    expect(out).not.toContain('\u0000');
  });

  it('빈 라인은 &nbsp;로 출력된다', () => {
    const out = editorHtml('a\n\nb', new Map());
    expect(out).toContain('&nbsp;');
  });
});
