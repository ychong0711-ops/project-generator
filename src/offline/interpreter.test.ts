import { describe, it, expect } from "vitest";
import { runC } from "./interpreter";

function okOutput(src: string): string {
  const r = runC(src);
  expect(r.ok, `실행 실패: ${r.error?.message} (line ${r.error?.line})\n소스:\n${src}`).toBe(true);
  return r.output;
}

describe("runC — 산술 / 리터럴 / 우선순위", () => {
  it("정수·실수 산술과 연산자 우선순위", () => {
    const out = okOutput(`
int main(void) {
    printf("%d\\n", 2 + 3 * 4);
    printf("%d\\n", (2 + 3) * 4);
    printf("%d\\n", 10 / 3);
    printf("%d\\n", 7 % 3);
    printf("%.2f\\n", 7.0 / 2.0);
    printf("%.2f\\n", 2.0 + 3.0 * 4.0);
    return 0;
}`);
    expect(out).toBe("14\n20\n3\n1\n3.50\n14.00\n");
  });

  it("16진수 리터럴(0x/0X) 파싱", () => {
    const out = okOutput(`
int main(void) {
    printf("%d %d %d\\n", 0x1F, 0xFF, 0X10);
    printf("%d\\n", 0x0);
    return 0;
}`);
    expect(out).toBe("31 255 16\n0\n");
  });

  it("비트 연산 / 시프트 / 논리", () => {
    const out = okOutput(`
int main(void) {
    printf("%d\\n", 5 & 3);
    printf("%d\\n", 5 | 3);
    printf("%d\\n", 5 ^ 3);
    printf("%d\\n", 1 << 4);
    printf("%d\\n", 256 >> 4);
    printf("%d\\n", 0 && 1);
    printf("%d\\n", 1 || 0);
    return 0;
}`);
    expect(out).toBe("1\n7\n6\n16\n16\n0\n1\n");
  });
});

describe("runC — printf 서식", () => {
  it("기본 서식 지정자 %d %u %x %X %f %.2f %e %g %c %s", () => {
    const out = okOutput(`
int main(void) {
    printf("%d|%u|%x|%X|%f|%.2f|%e|%g|%c|%s\\n",
           -42, 4294967295u, 255, 255, 3.14159, 3.14159, 12345.678, 0.000123, 65, "hi");
    return 0;
}`);
    expect(out).toBe("-42|4294967295|ff|FF|3.141590|3.14|1.234568e+4|0.000123|A|hi\n");
  });

  it("폭 / 0 패딩 / 좌측 정렬 / %%", () => {
    const out = okOutput(`
int main(void) {
    printf("%5d|%-5d|%05d|%%\\n", 42, 42, 42);
    printf("%8s|%-8s|\\n", "ab", "ab");
    printf("%08.2f\\n", 3.14);
    return 0;
}`);
    expect(out).toBe("   42|42   |00042|%\n      ab|ab      |\n00003.14\n");
  });
});

describe("runC — 제어문", () => {
  it("if / else", () => {
    const out = okOutput(`
int main(void) {
    int n;
    if (1) n = 1; else n = 99;
    printf("%d\\n", n);
    if (0) n = 2; else n = 3;
    printf("%d\\n", n);
    if (n == 3) n = 100;
    printf("%d\\n", n);
    return 0;
}`);
    expect(out).toBe("1\n3\n100\n");
  });

  it("while", () => {
    const out = okOutput(`
int main(void) {
    int sum = 0;
    int i = 0;
    while (i < 5) { sum += i; i++; }
    printf("%d\\n", sum);
    return 0;
}`);
    expect(out).toBe("10\n");
  });

  it("for (선언/증감 포함)", () => {
    const out = okOutput(`
int main(void) {
    int sum = 0;
    for (int j = 1; j <= 4; j++) sum += j;
    printf("%d\\n", sum);
    return 0;
}`);
    expect(out).toBe("10\n");
  });

  it("do-while", () => {
    const out = okOutput(`
int main(void) {
    int k = 0;
    do { k++; } while (k < 3);
    printf("%d\\n", k);
    return 0;
}`);
    expect(out).toBe("3\n");
  });

  it("switch (+break) / default", () => {
    const out = okOutput(`
int main(void) {
    int m = 0;
    switch (2) {
    case 1: m = 10; break;
    case 2: m = 20; break;
    default: m = 30;
    }
    printf("%d\\n", m);
    switch (99) {
    case 1: m = 1; break;
    default: m = 77;
    }
    printf("%d\\n", m);
    return 0;
}`);
    expect(out).toBe("20\n77\n");
  });

  it("break / continue", () => {
    const out = okOutput(`
int main(void) {
    int c = 0;
    for (int t = 0; t < 10; t++) {
        if (t == 2) continue;
        if (t == 5) break;
        c += t;
    }
    printf("%d\\n", c);
    return 0;
}`);
    expect(out).toBe("8\n");
  });
});

describe("runC — 배열", () => {
  it("초기화 리스트 / 인덱싱 / 대입", () => {
    const out = okOutput(`
int main(void) {
    int arr[4] = { 10, 20, 30, 40 };
    printf("%d %d\\n", arr[0], arr[3]);
    arr[2] = 99;
    printf("%d\\n", arr[2]);
    int fib[6] = { 0, 1, 0, 0, 0, 0 };
    for (int i = 2; i < 6; i++) fib[i] = fib[i-1] + fib[i-2];
    printf("%d\\n", fib[5]);
    return 0;
}`);
    expect(out).toBe("10 40\n99\n5\n");
  });

  it("sizeof(arr)/sizeof(arr[0]) 패턴", () => {
    const out = okOutput(`
int main(void) {
    int a[5] = { 1, 2, 3, 4, 5 };
    int n = sizeof(a) / sizeof(a[0]);
    printf("%d\\n", n);
    int total = 0;
    for (int i = 0; i < n; i++) total += a[i];
    printf("%d\\n", total);
    return 0;
}`);
    expect(out).toBe("5\n15\n");
  });
});

describe("runC — 포인터", () => {
  it("& / * / 포인터 인자 (값 교환)", () => {
    const out = okOutput(`
void swap(int *a, int *b) {
    int t = *a;
    *a = *b;
    *b = t;
}
int main(void) {
    int x = 10, y = 20;
    swap(&x, &y);
    printf("%d %d\\n", x, y);
    return 0;
}`);
    expect(out).toBe("20 10\n");
  });

  it("배열 decay + 포인터 산술 (배열 + 정수)", () => {
    const out = okOutput(`
int main(void) {
    int arr[5] = { 1, 2, 3, 4, 5 };
    int *p = arr;
    printf("%d\\n", *p);
    printf("%d\\n", *(p + 2));
    printf("%d\\n", p[3]);
    *(p + 1) = 99;
    printf("%d\\n", arr[1]);
    return 0;
}`);
    expect(out).toBe("1\n3\n4\n99\n");
  });

  it("문자열 리터럴을 char* 로 / char 리터럴", () => {
    const out = okOutput(`
int main(void) {
    char *msg = "hello";
    printf("%s\\n", msg);
    printf("%c %d\\n", msg[1], 'Z');
    return 0;
}`);
    expect(out).toBe("hello\ne 90\n");
  });
});

describe("runC — 함수", () => {
  it("값/포인터 인자 전달 + 재귀(factorial)", () => {
    const out = okOutput(`
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
int add(int a, int b) { return a + b; }
int main(void) {
    printf("%d\\n", factorial(5));
    printf("%d\\n", add(3, 4));
    int v = 5;
    int *q = &v;
    *q = 8;
    printf("%d\\n", v);
    return 0;
}`);
    expect(out).toBe("120\n7\n8\n");
  });

  it("중첩 스코프 (블록 내 선언)", () => {
    const out = okOutput(`
int main(void) {
    int v = 5;
    {
        int v = 100;
        printf("%d\\n", v);
    }
    printf("%d\\n", v);
    return 0;
}`);
    expect(out).toBe("100\n5\n");
  });
});

describe("runC — 내장 함수", () => {
  it("strlen / strcmp", () => {
    const out = okOutput(`
int main(void) {
    printf("%d\\n", strlen("hello"));
    printf("%d %d %d\\n", strcmp("abc", "abc"), strcmp("abc", "abd"), strcmp("b", "a"));
    return 0;
}`);
    expect(out).toBe("5\n0 -1 1\n");
  });

  it("memcpy / memset", () => {
    const out = okOutput(`
int main(void) {
    char buf[16];
    memcpy(buf, "abc", 4);
    printf("%s\\n", buf);
    memset(buf, 'x', 3);
    printf("%s\\n", buf);
    printf("%d\\n", buf[3]);
    return 0;
}`);
    expect(out).toBe("abc\nxxx\n0\n");
  });

  it("rand / srand", () => {
    const out = okOutput(`
int main(void) {
    srand(42);
    int a = rand();
    int b = rand();
    printf("%d %d\\n", a > 0 ? 1 : 0, b > 0 ? 1 : 0);
    srand(42);
    printf("%d\\n", rand() == a ? 1 : 0);
    return 0;
}`);
    expect(out).toBe("1 1\n1\n");
  });

  it("수학 함수 (sqrt/pow/abs/floor 등)", () => {
    const out = okOutput(`
int main(void) {
    printf("%.1f %.2f\\n", sqrt(16.0), pow(2.0, 10.0));
    printf("%d %d %d\\n", abs(-7), floor(3.7), ceil(3.2));
    printf("%.3f %.3f %.3f\\n", fabs(-2.5), fmod(10.5, 3.0), exp(0.0));
    return 0;
}`);
    expect(out).toBe("4.0 1024.00\n7 3 4\n2.500 1.500 1.000\n");
  });
});

describe("runC — typedef enum / #define / 주석", () => {
  it("typedef enum + #define 매크로 치환 + // 와 /* */ 주석", () => {
    const out = okOutput(`
#define LEN 3
#define MSG "hi"

typedef enum { RED = 2, GREEN, BLUE } color_t;

// 한 줄 주석
/* 블록 주석 */
int main(void) {
    /* 여러 줄
       블록 주석 */
    color_t c = GREEN;
    printf("%d\\n", c);
    printf("%d\\n", RED);
    printf("%d\\n", BLUE);
    int arr[LEN] = { 1, 2, 3 };
    printf("%d\\n", arr[LEN - 1]);
    printf("%s\\n", MSG);
    return 0;
}`);
    expect(out).toBe("3\n2\n4\n3\nhi\n");
  });

  it("typedef enum 의 명시적 값 / auto-increment", () => {
    const out = okOutput(`
typedef enum { A = 10, B, C = 20, D } st_t;
int main(void) {
    printf("%d %d %d %d\\n", A, B, C, D);
    st_t s = D;
    printf("%d\\n", s);
    return 0;
}`);
    expect(out).toBe("10 11 20 21\n21\n");
  });
});

describe("runC — 문자열 리터럴 배열", () => {
  it("char buf[] = \"abc\" 및 nul 종료 동작", () => {
    const out = okOutput(`
int main(void) {
    char buf[] = "abc";
    printf("%s\\n", buf);
    printf("%d\\n", strlen(buf));
    buf[1] = 'X';
    printf("%s\\n", buf);
    printf("%d %d %d\\n", buf[0], buf[3], buf[4]);
    return 0;
}`);
    expect(out).toBe("abc\n3\naXc\n97 0 0\n");
  });
});

describe("runC — 오류 케이스", () => {
  it("정의되지 않은 변수: ok=false, error.line>0", () => {
    const r = runC(`
int main(void) {
    printf("%d\\n", missing_var);
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
    expect(r.error!.line).toBeGreaterThan(0);
    expect(r.error!.message).toContain("정의되지 않은 변수");
  });

  it("main() 없음", () => {
    const r = runC(`
int foo(void) { return 1; }`);
    expect(r.ok).toBe(false);
    expect(r.error!.message).toContain("main");
  });

  it("struct 지원 테스트", () => {
    const out = okOutput(`
struct frame { int id; };
int main(void) {
    struct frame s;
    s.id = 42;
    printf("%d\\n", s.id);
    return 0;
}`);
    expect(out).toBe("42\n");
  });

  it("typedef enum 지원 테스트", () => {
    const out = okOutput(`
typedef enum { RED, GREEN, BLUE } color_t;
int main(void) {
    color_t c = GREEN;
    printf("%d\\n", c);
    return 0;
}`);
    expect(out).toBe("1\n");
  });

  it("union 지원 테스트", () => {
    const out = okOutput(`
union u { int a; char b; };
int main(void) {
    union u v;
    v.a = 10;
    printf("%d\\n", v.a);
    return 0;
}`);
    expect(out).toBe("10\n");
  });

  it("typedef struct 지원 테스트", () => {
    const out = okOutput(`
typedef struct { int id; int len; } Frame;
int main(void) {
    Frame f;
    f.id = 3;
    f.len = 8;
    printf("%d %d\\n", f.id, f.len);
    return 0;
}`);
    expect(out).toBe("3 8\n");
  });

  it("구조체 포인터(->) 접근", () => {
    const out = okOutput(`
struct P { int x; int y; };
int main(void) {
    struct P a;
    a.x = 1; a.y = 2;
    struct P *p = &a;
    p->x = 10;
    printf("%d %d\\n", a.x, p->y);
    return 0;
}`);
    expect(out).toBe("10 2\n");
  });

  it("구조체 배열 멤버 / 구조체 배열", () => {
    const out = okOutput(`
struct S { int arr[3]; };
struct Node { int v; };
int main(void) {
    struct S s;
    for (int i = 0; i < 3; i++) s.arr[i] = i * i;
    struct Node ns[3];
    ns[0].v = 7;
    ns[2].v = 9;
    printf("%d %d %d %d %d\\n", s.arr[0], s.arr[1], s.arr[2], ns[0].v, ns[2].v);
    return 0;
}`);
    expect(out).toBe("0 1 4 7 9\n");
  });

  it("구조체 값 대입은 깊은 복사", () => {
    const out = okOutput(`
struct P { int x; };
int main(void) {
    struct P a;
    a.x = 5;
    struct P b;
    b = a;
    b.x = 9;
    printf("%d %d\\n", a.x, b.x);
    return 0;
}`);
    expect(out).toBe("5 9\n");
  });

  it("union 멤버는 저장소를 공유한다", () => {
    const out = okOutput(`
union U { int a; char b; };
int main(void) {
    union U v;
    v.a = 65;
    printf("%d %d\\n", v.a, v.b);
    return 0;
}`);
    expect(out).toBe("65 65\n");
  });

  it("|= 와 &= 복합 대입", () => {
    const out = okOutput(`
int main(void) {
    int x = 0;
    x |= 5;
    x &= 6;
    printf("%d\\n", x);
    return 0;
}`);
    expect(out).toBe("4\n");
  });

  it("구조체가 아닌 값에 멤버 접근하면 오류", () => {
    const r = runC(`
int main(void) {
    int x = 1;
    printf("%d\\n", x.y);
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error!.line).toBeGreaterThan(0);
  });

  it("정의되지 않은 멤버 접근하면 오류", () => {
    const r = runC(`
struct P { int x; };
int main(void) {
    struct P a;
    a.zzz = 1;
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error!.message).toContain("zzz");
  });

  it("2차원 배열 거부", () => {
    const r = runC(`
int main(void) {
    int m[2][3];
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error!.line).toBeGreaterThan(0);
    expect(r.error!.message).toContain("2차원 배열");
  });

  it("배열 인덱스 범위 초과 대입: ok=false, error.line 포함", () => {
    const r = runC(`
int main(void) {
    int a[3];
    a[5] = 1;
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
    expect(r.error!.line).toBeGreaterThan(0);
    expect(r.error!.message).toContain("배열 인덱스 범위 초과");
  });

  it("배열 음수 인덱스 대입: 오류 발생", () => {
    const r = runC(`
int main(void) {
    int a[3];
    a[-1] = 1;
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error!.line).toBeGreaterThan(0);
    expect(r.error!.message).toContain("배열 인덱스 범위 초과");
  });

  it("복합 대입(+=-)의 범위 초과: 오류 발생", () => {
    const r = runC(`
int main(void) {
    int a[3];
    a[10] += 5;
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error!.line).toBeGreaterThan(0);
    expect(r.error!.message).toContain("배열 인덱스 범위 초과");
  });

  it("증감(++)의 범위 초과: 오류 발생", () => {
    const r = runC(`
int main(void) {
    int a[3];
    a[10]++;
    return 0;
}`);
    expect(r.ok).toBe(false);
    expect(r.error!.line).toBeGreaterThan(0);
    expect(r.error!.message).toContain("배열 인덱스 범위 초과");
  });

  it("goto 거부", () => {
    const r = runC(`
int main(void) { return 0; }
goto cleanup;`);
    expect(r.ok).toBe(false);
    expect(r.error!.message).toContain("goto");
    expect(r.error!.message).toContain("지원하지 않습니다");
  });

  it("무한 루프 step 제한(300만) 트리거", () => {
    const r = runC(`
int main(void) {
    for (;;);
}`);
    expect(r.ok).toBe(false);
    expect(r.error!.message).toContain("한도 초과");
    expect(r.steps).toBeGreaterThan(3000000);
  });
});
