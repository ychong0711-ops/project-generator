/* ============================================================
 *  GCC 에러 지식베이스 — 컴파일 에러를 가르침으로 변환
 * ============================================================ */

export interface GccHelp {
  title: string;
  cause: string;
  fix: string;
  learn: string;
}

interface GccHelpRule {
  re: RegExp;
  help: GccHelp;
}

export const GCC_HELP: GccHelpRule[] = [
  {
    re: /was not declared in this scope|undeclared \(first use|use of undeclared identifier/i,
    help: {
      title: '미선언 식별자 (변수/함수 이름 오류)',
      cause: '사용한 변수나 함수가 그 시점에 선언되지 않았습니다. 헤더 미포함, 선언 전 사용, 오타가 흔한 원인입니다.',
      fix: '① 해당 헤더(#include)가 있는지 확인 ② 변수가 사용 위치보다 위에 선언됐는지 확인 ③ 함수 이름의 철자를 확인하세요.',
      learn: 'C는 위에서 아래로 읽습니다. "선언 후 사용"이 컴파일 통과의 기본 규칙이며, 이 에러는 거의 항상 오타나 헤더 누락입니다.',
    },
  },
  {
    re: /implicit declaration of function/i,
    help: {
      title: '함수 암시적 선언 경고',
      cause: '함수를 호출했지만 선언(프로토타입)을 아직 보지 못했습니다. 해당 함수의 헤더가 포함되지 않았거나 함수가 아래에 정의되어 있습니다.',
      fix: '함수가 있는 헤더를 포함하거나, 파일 상단에 `반환형 함수명(인자);` 형태의 프로토타입을 추가하세요.',
      learn: '임베디드 코드에서 이 경고를 무시하면 인자/반환형 불일치로 하드폴트가 날 수 있습니다. 반드시 고치고 넘어가세요.',
    },
  },
  {
    re: /expected ['`;?]|expected.*token/i,
    help: {
      title: '구문 오류 — 세미콜론/괄호/중괄호',
      cause: '문장 끝 세미콜론(;) 누락, 괄호 짝 불일치, 중괄호 닫힘 누락이 대부분입니다. 에러 라인은 실제 누락 위치보다 "뒤"를 가리키는 경우가 많습니다.',
      fix: '에러 라인뿐 아니라 그 직전 2~3줄의 세미콜론과 괄호 짝을 확인하세요. 에디터의 중괄호 불균형 검사(멘토 패널)를 참고하세요.',
      learn: 'C 컴파일러는 어디서 "어긋났는지"를 알려 주지, "어디서 틀렸는지"를 알려 주지 않습니다. 앞줄부터 거꾸로 읽는 습관이 디버깅의 시작입니다.',
    },
  },
  {
    re: /conflicting types for|redefinition of/i,
    help: {
      title: '중복 정의 / 타입 충돌',
      cause: '같은 이름의 함수나 변수가 두 번 정의되었거나, 선언과 정의의 타입이 서로 다릅니다.',
      fix: '이름을 바꾸거나, 선언(프로토타입)과 정의의 반환형·인자를 정확히 일치시키세요. 헤더에 정의가 두 번 들어간 경우 #ifndef 가드를 확인하세요.',
      learn: '실무에서 함수명은 "동사+대상" 규칙(예: crc_calc, uart_send)을 지키면 충돌이 사라집니다.',
    },
  },
  {
    re: /undefined reference/i,
    help: {
      title: '링커 오류 — 함수를 찾을 수 없음',
      cause: '호출은 했지만 실제 구현이 어디에도 없습니다. 정의가 다른 파일에 있거나, 해당 소스가 빌드에 포함되지 않았습니다.',
      fix: '함수 본문이 존재하는지 확인하고, Makefile의 SRCS에 해당 .c 파일이 들어 있는지 확인하세요.',
      learn: '"컴파일 통과 ≠ 링크 통과"입니다. undefined reference는 "호출과 구현의 연결 실패"라는, 임베디드 프로젝트에서 매우 흔한 오류입니다.',
    },
  },
  {
    re: /no such file or directory|fatal error:.*\.h/i,
    help: {
      title: '헤더 파일을 찾을 수 없음',
      cause: '#include에 쓴 경로가 잘못되었거나, 해당 라이브러리/드라이버가 프로젝트에 없습니다.',
      fix: '파일명 철자 확인 → 헤더 위치 확인 → 컴파일 플래그에 -I 경로 추가 순서로 점검하세요.',
      learn: '온라인 컴파일에서는 <stdio.h> 같은 표준 헤더만 포함 가능합니다. 보드 전용 헤더(stm32f4xx_hal.h)는 로컬 빌드에서만 해결됩니다.',
    },
  },
  {
    re: /incompatible (types|integer|pointer)|passing argument/i,
    help: {
      title: '타입 불일치 (포인터/정수 등)',
      cause: '함수가 기대하는 타입과 전달한 타입이 다릅니다. 예: int를 기대하는데 char*를 넘김, 배열과 포인터 혼동.',
      fix: '함수 시그니처를 확인하고 명시적 캐스트((int), (uint8_t*))를 사용하거나 변수 타입을 맞추세요.',
      learn: '임베디드에서 타입 불일치는 "컴파일은 되지만 값이 깨지는" 원인 1위입니다. 경고도 무시하지 마세요.',
    },
  },
  {
    re: /too (few|many) arguments/i,
    help: {
      title: '함수 인자 개수 불일치',
      cause: '호출 시 넘긴 인자 수가 함수 정의의 매개변수 수와 다릅니다.',
      fix: '함수 정의의 매개변수 목록과 호출부의 인자 개수를 세어 일치시키세요.',
      learn: '인자 수가 맞지 않으면 스택이 깨질 수 있습니다. 특히 포인터를 인자로 받는 함수에서 치명적입니다.',
    },
  },
  {
    re: /lvalue required|not assignable/i,
    help: {
      title: '대입 불가능한 대상 (lvalue 오류)',
      cause: '상수나 계산 결과에 값을 넣으려 했습니다. 예: `10 = x;`, `(a + b) = c;`',
      fix: '대입의 왼쪽은 반드시 변수 또는 배열 요소(수정 가능한 메모리 위치)여야 합니다.',
      learn: 'lvalue = "메모리상에 주소를 가진 값". 이 개념을 알면 C의 포인터와 배열이 한층 명확해집니다.',
    },
  },
  {
    re: /dereferencing pointer|invalid type argument|request for member/i,
    help: {
      title: '잘못된 포인터/구조체 연산',
      cause: '포인터가 아닌 값에 * 연산을 하거나, 배열/구조체가 아닌 값에 [] 또는 . 연산을 사용했습니다.',
      fix: '해당 변수가 실제로 어떤 타입인지 선언부부터 추적하세요. 포인터를 원한다면 & 연산자로 주소를 얻어야 합니다.',
      learn: '포인터 관련 에러는 "타입을 정확히 말할 수 있는가"를 시험합니다. int*와 int의 차이를 문장으로 설명해 보세요.',
    },
  },
  {
    re: /unused variable|unused-variable/i,
    help: {
      title: '사용하지 않는 변수 (경고)',
      cause: '선언만 하고 사용되지 않은 변수입니다. 대개 리팩토링의 잔재입니다.',
      fix: '변수를 제거하거나, 의도적으로 남길 경우 (void)변수; 를 추가해 경고를 명시적으로 억제하세요.',
      learn: '-Wall 플래그의 경고를 0으로 만드는 것이 깨끗한 코드의 기준입니다. 경고가 쌓인 코드는 면접에서 감점 요인입니다.',
    },
  },
  {
    re: /control reaches end of non-void function/i,
    help: {
      title: '반환값이 없는 경로 존재',
      cause: '반환형이 void가 아닌 함수의 어떤 분기에서 return을 만나지 못하고 함수 끝에 도달합니다.',
      fix: '모든 경로가 return을 만나도록 하거나, 함수 끝에 기본 반환값을 추가하세요.',
      learn: '미정의 동작(UB)의 대표 사례입니다. "모든 분기에서 반환"은 함수를 설계할 때 가장 먼저 따지는 습관입니다.',
    },
  },
  {
    re: /makes integer from pointer|makes pointer from integer/i,
    help: {
      title: '포인터↔정수 변환 경고',
      cause: 'int 변수에 포인터를 넣거나, 포인터에 정수를 넣었습니다. 의도치 않은 타입 혼용입니다.',
      fix: '타입을 통일하거나, 진짜로 주소 값을 원한다면 (uintptr_t)로 명시적 캐스트하세요.',
      learn: 'MCU에서 레지스터 주소를 다룰 때만 허용되는 패턴입니다. 일반 변수에서 이 경고가 나오면 거의 버그입니다.',
    },
  },
];

/** 에러 텍스트에서 매칭되는 지식 항목 반환 (최대 2개) */
export function findGccHelp(text: string): GccHelp[] {
  const out: GccHelp[] = [];
  for (const rule of GCC_HELP) {
    if (rule.re.test(text) && !out.some((h) => h.title === rule.help.title)) {
      out.push(rule.help);
    }
    if (out.length >= 2) break;
  }
  return out;
}
