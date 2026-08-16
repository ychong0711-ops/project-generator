import type { Project } from '../types';

/* ============================================================
 *  AI 멘토 정적 분석 엔진
 *  — 사용자가 작성한 C 코드를 실시간 리뷰하고 어시스트
 * ============================================================ */

export type IncludeFixId = 'add-stdio' | 'add-stdint' | 'add-math' | 'add-string';

export const INCLUDE_FIXES: Record<IncludeFixId, string> = {
  'add-stdio': '#include <stdio.h>',
  'add-stdint': '#include <stdint.h>',
  'add-math': '#include <math.h>',
  'add-string': '#include <string.h>',
};

export interface CodeIssue {
  id: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  fixId?: IncludeFixId;
}

export interface CheckResult {
  label: string;
  hint: string;
  found: boolean;
}

export interface QualityIssue {
  rule: string;
  message: string;
  severity: 'warning' | 'info';
}

export interface CodeAnalysis {
  score: number;
  qualityScore: number;
  issues: CodeIssue[];
  qualityIssues: QualityIssue[];
  coverage: number;
  checkResults: CheckResult[];
  stats: { lines: number; functions: number; todos: number; commentPct: number };
}

/* ---------- 프로젝트별 핵심 구현 요소 체크리스트 ---------- */
interface CheckDef {
  label: string;
  hint: string;
  regex: RegExp;
}

const CHECKLISTS: Record<string, CheckDef[]> = {
  'can-uds-scanner': [
    { label: 'CRC 다항식 상수', hint: 'ISO 11898 CRC-15: 0x4599', regex: /0x4599/ },
    { label: '8회 반복 비트 루프', hint: 'CRC 비트 연산: for(...< 8)', regex: /for\s*\([^)]*<\s*8\b/ },
    { label: 'UDS 서비스 ID', hint: '$10 / $22 / $3E / $2E 상수 정의', regex: /0x10|0x22|0x3E|0x2E|SID_/ },
    { label: 'NRC 응답 처리', hint: '부정 응답 0x7F + NRC 코드', regex: /0x7F|NRC_/ },
  ],
  'freertos-ecu': [
    { label: '우선순위 정의', hint: 'task priority 상수(1~3)', regex: /PRIO|priority|prio/ },
    { label: '뮤텍스 로직', hint: '공유 자원 잠금/해제', regex: /mutex|뮤텍스|MUTEX/i },
    { label: '우선순위 상속', hint: 'inheritance 반영 로직', regex: /inheri|상속|eff_prio/ },
    { label: '워치독 카운터', hint: '주기 갱신 카운터', regex: /watchdog|wdg|워치독|kick/i },
  ],
  'lin-window': [
    { label: '체크섬 계산', hint: 'classic/enhanced checksum 분기', regex: /checksum|체크섬/i },
    { label: 'PID 패리티', hint: 'P0/P1 패리티 비트 계산', regex: /P0|P1|parity|lin_pid/i },
    { label: '상태머신 구조', hint: 'enum 상태 + switch 전이', regex: /enum\s+\w+\s*\{[\s\S]*?switch|typedef\s+enum/ },
    { label: '안티핀치 로직', hint: '전류 스파이크 → 역회전', regex: /pinch|PINCH|역회전|ANTI/i },
  ],
  'bldc-foc': [
    { label: 'Clarke 변환', hint: 'abc → αβ 변환 함수', regex: /clarke/i },
    { label: 'Park 변환', hint: 'αβ → dq 변환 함수 (cos/sin)', regex: /park/i },
    { label: 'SVPWM 듀티', hint: '섹터 판별 + T1/T2/T0', regex: /svpwm|SVPWM|sector|T1/i },
    { label: 'PI 제어기', hint: 'Kp/Ki + 적분 항', regex: /kp|ki|integral|PI_/i },
  ],
  'sensor-fusion-ekf': [
    { label: '칼만 예측/보정', hint: 'predict + update 단계 분리', regex: /predict|kalman|kf_/i },
    { label: '공분산 갱신', hint: 'P(공분산) 행렬 업데이트', regex: /p11|p12|p21|p22|cov/ },
    { label: '쿼터니언/자이로 적분', hint: 'quat 갱신 루프', regex: /quat|quaternion|gyro/i },
    { label: '측정 보정 항', hint: '가속도/중력 벡터 보정', regex: /accel|correction|가속/i },
  ],
  'bms-soc': [
    { label: 'SoC 상태 변수', hint: 'SoC(%) 상태와 갱신식', regex: /soc|SoC|SOC/i },
    { label: '전류 적분(쿨롱)', hint: 'I·dt/C 수식', regex: /delta_ah|적분|coulomb|3600/i },
    { label: 'OCV 테이블', hint: 'OCV-SoC 커브 데이터', regex: /ocv|OCV|TABLE/i },
    { label: '히스테리시스 보정', hint: '충/방전 히스테리시스 항', regex: /hysteresis|히스테리/i },
  ],
  'uds-bootloader': [
    { label: 'CRC32 테이블/다항식', hint: 'poly 0xEDB88320', regex: /0xEDB88320|crc32/i },
    { label: '섹터 지우기', hint: 'erase → 0xFF 채움', regex: /erase|0xFF|ERASED/i },
    { label: '프로그램 검증', hint: '쓰기 후 CRC 비교', regex: /verify|검증|verif/i },
    { label: '롤백 로직', hint: '실패 시 A/B 뱅크 복귀', regex: /rollback|롤백|BANK_A|BANK_B/i },
  ],
  'linux-cluster': [
    { label: 'DBC 스케일/오프셋', hint: 'factor/offset 물리값 변환', regex: /factor|offset|scale/i },
    { label: '비트 추출', hint: 'start bit + length 시프트', regex: /start_bit|extract_bits|>>\s*\(/ },
    { label: 'EMA 평활', hint: '지수이동평균 alpha', regex: /ema|alpha/i },
    { label: '슬루레이트 리미터', hint: '최대 변화율 클램프', regex: /slew|rate_limit|최대 변화/i },
  ],
  'adas-lane': [
    { label: '다항식 피팅', hint: '최소자승법/정규방정식', regex: /polyfit|least|정규방정식|피팅/i },
    { label: '곡률 반경', hint: 'R = (1+y\'²)^1.5/|y\'\'|', regex: /curvature|곡률|radius/i },
    { label: '그래디언트 검출', hint: '에지 강도 계산', regex: /gradient|grad|에지|edge/i },
    { label: '임계값/히스토그램', hint: '차선 후보 픽셀 판정', regex: /threshold|hist|임계/i },
  ],
  someip: [
    { label: '서비스/메서드 ID', hint: 'ServiceID << 16 | MethodID', regex: /service_id|msg_id|<<\s*16/i },
    { label: 'SD 상태머신', hint: 'INITIAL_WAIT/REPEAT/MAIN', regex: /INITIAL_WAIT|REPEAT|SD_MAIN|sd_state/i },
    { label: '요청/응답 타입', hint: 'msg_type 구분 (0x00/0x80)', regex: /msg_type|REQUEST|RESPONSE/i },
    { label: '엔디언 인코딩', hint: '빅엔디언 바이트 시프트', regex: />>\s*24|>>\s*16|>>\s*8/i },
  ],
  'abs-sim': [
    { label: '슬립 계산식', hint: 'slip = (v - w·r)/v', regex: /slip/i },
    { label: 'PID 제어기', hint: 'Kp/Ki/Kd + 오차 적분', regex: /pid|kp|ki|kd/i },
    { label: '안티와인드업', hint: '적분 클램프/한계 처리', regex: /windup|clamp|와인드업|out_min/i },
    { label: '엔코더 속도 측정', hint: '카운트 → RPM 변환', regex: /rpm|RPM|encoder|PPR/i },
  ],
  'state-machine-intro': [
    { label: '상태 enum 정의', hint: 'IGN_OFF/ACC/ON... enum', regex: /typedef\s+enum|IGN_OFF|IGN_ACC/i },
    { label: 'switch 전이 로직', hint: '이벤트별 상태 전이', regex: /switch\s*\(|case\s+EV_/ },
    { label: '디바운스 카운터', hint: '안정 틱 카운트', regex: /debounce|디바운스|stable_ticks|DEBOUNCE/i },
    { label: '가드 조건 처리', hint: '전이 조건(브레이크 등)', regex: /brake|가드|guard|조건/i },
  ],
  'autosar-swc': [
    { label: 'RTE 포트 API', hint: 'write/read 포트 함수', regex: /rte_|RTE|write_port|read_port/i },
    { label: '이벤트 큐/트리거', hint: 'DATA_RECEIVED 이벤트', regex: /event|EVENT|raise|트리거/i },
    { label: 'SWC 분리 구조', hint: '컴포넌트별 함수 분리', regex: /swc_|SWC_|swc_a|swc_b/i },
    { label: '모드 관리', hint: 'STARTUP/RUN/SLEEP 상태', regex: /STARTUP|POST_RUN|SLEEP|BswM|EcuM/i },
  ],
  tpms: [
    { label: 'CRC8 계산', hint: 'poly 0x07 패킷 무결성', regex: /crc8|CRC8|0x07/ },
    { label: '센서 ID 패킹', hint: 'ID 필드 시프트 패킹', regex: /sensor_id|>>\s*24|pack/i },
    { label: '슬립/듀티사이클', hint: 'active/sleep 구간 계산', regex: /sleep|duty|period|듀티/i },
    { label: '배터리 수명 추정', hint: '평균전류 → 수명 환산', regex: /battery|배터리|mAh|capacity/i },
  ],
};

const INCLUDES = ['#include <stdio.h>', '#include <stdint.h>', '#include <math.h>', '#include <string.h>'];

export function analyzeCode(code: string, projectId: string): CodeAnalysis {
  const issues: CodeIssue[] = [];
  const lines = code.split('\n');
  const text = code;
  const hasInclude = (re: RegExp) => re.test(text);
  const lineOf = (re: RegExp): number => {
    const m = text.match(re);
    if (!m || m.index === undefined) return 1;
    return text.slice(0, m.index).split('\n').length;
  };

  const push = (
    line: number,
    severity: CodeIssue['severity'],
    title: string,
    detail: string,
    fixId?: IncludeFixId
  ) => issues.push({ id: `is${issues.length}`, line, severity, title, detail, fixId });

  /* 1) 누락 헤더 */
  if (/\b(printf|scanf|puts|sprintf|snprintf|fprintf)\s*\(/.test(text) && !hasInclude(/<stdio\.h>/))
    push(lineOf(/\b(printf|scanf|puts|sprintf|snprintf|fprintf)\s*\(/), 'error', 'stdio.h 누락', 'printf 계열 함수를 사용하려면 <stdio.h>가 필요합니다.', 'add-stdio');
  if (/\b(u?int(8|16|32|64)_t)\b/.test(text) && !hasInclude(/<stdint\.h>/))
    push(lineOf(/\bu?int(8|16|32|64)_t\b/), 'error', 'stdint.h 누락', '고정폭 정수형(uint8_t 등)은 <stdint.h>에서 제공됩니다.', 'add-stdint');
  if (/\b(sin|cos|tan|sqrt|atan2|fabs|pow|exp|log|fmod)\s*\(/.test(text) && !hasInclude(/<math\.h>/))
    push(lineOf(/\b(sin|cos|tan|sqrt|atan2|fabs|pow|exp|log|fmod)\s*\(/), 'warning', 'math.h 누락', '수학 함수는 <math.h>가 필요하며, gcc로 링크할 때 -lm 플래그를 추가하세요.', 'add-math');
  if (/\b(memset|memcpy|strlen|strcpy|strcat|strcmp|memcmp|strncpy|strncmp)\s*\(/.test(text) && !hasInclude(/<string\.h>/))
    push(lineOf(/\b(memset|memcpy|strlen|strcpy|strcat|strcmp|memcmp|strncpy|strncmp)\s*\(/), 'warning', 'string.h 누락', '메모리/문자열 함수는 <string.h>에 선언되어 있습니다.', 'add-string');

  /* 2) 안전하지 않은 함수 */
  if (/\bgets\s*\(/.test(text))
    push(lineOf(/\bgets\s*\(/), 'error', '금지 함수 gets()', 'gets()는 버퍼 오버플로가 불가피해 C11에서 제거되었습니다. fgets(buf, size, stdin)를 사용하세요.');
  if (/\b(strcpy|strcat)\s*\(/.test(text))
    push(lineOf(/\b(strcpy|strcat)\s*\(/), 'warning', '버퍼 크기 미검증 복사', 'strcpy/strcat는 오버플로 위험이 있습니다. snprintf 또는 strncpy + 널 종료 처리를 사용하세요.');

  /* 3) main / 반환값 */
  if (!/int\s+main\s*\(/.test(text))
    push(1, 'error', 'main() 함수 없음', '독립 실행 파일(테스트 코드)이라면 int main(void) 진입점이 필요합니다.');
  else if (!/return\s+/.test(text))
    push(lines.length, 'info', 'main의 반환문 없음', 'return 0;으로 정상 종료를 명시하면 빌드 도구와 CI가 결과를 검증하기 쉽습니다.');

  /* 4) 중괄호 균형 */
  {
    let bal = 0;
    for (const ch of text) {
      if (ch === '{') bal++;
      else if (ch === '}') bal--;
    }
    if (bal !== 0)
      push(lines.length, 'error', `중괄호 불균형 (${bal > 0 ? '닫는 } 부족' : '여는 { 부족'})`, '함수/블록의 중괄호 짝을 확인하세요. 불균형하면 컴파일이 실패합니다.');
  }

  /* 5) 0 나눗셈 리터럴 */
  if (/\/\s*0(?![xX\d.])/.test(text))
    push(lineOf(/\/\s*0(?![xX\d.])/), 'error', '0으로 나누는 식', '상수 0으로 나누는 코드는 런타임 오류/UB(미정의 동작)입니다. 분모 검사를 추가하세요.');

  /* 6) 초기화되지 않은 선언 */
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || ln.includes('=') || ln.includes('(')) return;
    const m = ln.match(/^\s*(?!static\b|extern\b|const\b|typedef\b)(?:u?int(?:8|16|32|64)?_t|int|double|float|char|short|long|unsigned)\s+([A-Za-z_]\w*)(\s*\[[^\]]*\])?\s*;?\s*$/);
    if (m)
      push(i + 1, 'warning', `변수 "${m[1]}" 초기화 확인`, '선언 즉시 초기화하거나, 의도적으로 나중에 값을 채우는 경우에는 memset 등으로 안전하게 초기화하세요.');
  });

  /* 7) 매직 넘버 */
  {
    const nums = text.match(/\b\d{2,}\b/g) ?? [];
    if (nums.length > 5)
      push(lines.length, 'info', `매직 넘버 ${nums.length}개 사용`, '의미 있는 상수는 #define 또는 enum으로 이름을 붙이면 가독성과 유지보수가 좋아집니다.');
  }

  /* 8) 무한 루프 */
  if (/while\s*\(\s*1\s*\)|for\s*\(\s*;\s*;\s*\)/.test(text))
    push(lineOf(/while\s*\(\s*1\s*\)|for\s*\(\s*;\s*;\s*\)/), 'info', '무한 루프 사용', 'MCU 메인 루프로 의도된 경우 주석으로 명시하고, 테스트 코드에서는 종료 조건이 있는지 확인하세요.');

  /* 9) 문서화 비율 */
  const codeChars = text.length;
  const commentMatch = text.match(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g);
  const commentChars = (commentMatch ?? []).reduce((a, c) => a + c.length, 0);
  const commentPct = codeChars ? Math.round((commentChars / codeChars) * 100) : 0;
  if (lines.length > 20 && commentPct < 3)
    push(lines.length, 'info', '주석/문서화 부족', '면접에서 "검증된 과정"을 설명하려면 코드에 주석이 필요합니다. 함수 헤더 주석을 추가해 보세요.');

  /* 통계 */
  const functions = (text.match(/^\s*(?:static\s+)?(?:inline\s+)?(?:void|int|double|float|char|unsigned|long|short|u?int\d*_t|bool)\s+\*?\s*[A-Za-z_]\w*\s*\(/gm) ?? []).length;
  const todos = (text.match(/\b(TODO|FIXME)\b/gi) ?? []).length;

  /* 체크리스트 */
  const checkResults: CheckResult[] = (CHECKLISTS[projectId] ?? []).map((c) => ({
    label: c.label,
    hint: c.hint,
    found: c.regex.test(text),
  }));
  const coverage = checkResults.length ? Math.round((checkResults.filter((c) => c.found).length / checkResults.length) * 100) : 0;

  /* 점수 */
  const errs = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warning').length;
  const infos = Math.min(issues.filter((i) => i.severity === 'info').length, 8);
  const score = Math.max(0, Math.min(100, 100 - errs * 18 - warns * 6 - infos * 2));

  /* MISRA-C 기반 코드 품질 (독립 평가) */
  const { qualityScore, qualityIssues } = analyzeQuality(code);

  return {
    score,
    qualityScore,
    issues: issues.sort((a, b) => {
      const w = { error: 0, warning: 1, info: 2 } as const;
      return w[a.severity] - w[b.severity] || a.line - b.line;
    }),
    qualityIssues,
    coverage,
    checkResults,
    stats: { lines: lines.length, functions, todos, commentPct },
  };
}

/* ============================================================
 * MISRA-C 기반 코드 품질 분석
 * — 핵심 정적 검사(score)와 별개로 유지보수성/안전성 규칙을 평가
 * ============================================================ */
export function analyzeQuality(code: string): { qualityScore: number; qualityIssues: QualityIssue[] } {
  const qualityIssues: QualityIssue[] = [];
  let q = 100;
  const lines = code.split('\n');
  const text = code;

  const deduct = (rule: string, pts: number, message: string, severity: QualityIssue['severity'] = 'warning') => {
    q -= pts;
    qualityIssues.push({ rule, message, severity });
  };

  /* 1) 매직 넘버 — 0/1/-1을 제외한 2자리 이상 숫자 리터럴 */
  const magicNums = (text.match(/\b\d{2,}\b/g) ?? []).filter((n) => n !== '0' && n !== '1' && n !== '-1');
  if (magicNums.length > 3) {
    const uniq = [...new Set(magicNums)];
    deduct('magic-number', 2, `매직 넘버 ${magicNums.length}개 (${uniq.slice(0, 6).join(', ')}${uniq.length > 6 ? '…' : ''}) — 의미 있는 상수는 #define/const로 추출하세요.`);
  }

  /* 2) 함수 길이 — 40줄 초과 함수 탐지 (중괄호 균형 기반) */
  {
    let depth = 0;
    let fnStart = -1;
    let fnName = '';
    let fnStartLine = 0;
    const longFns: string[] = [];
    lines.forEach((ln, i) => {
      const dOpen = (ln.match(/{/g) ?? []).length;
      const dClose = (ln.match(/}/g) ?? []).length;
      if (fnStart === -1 && dOpen > 0) {
        const m = ln.match(/^\s*(?:static\s+|inline\s+)?(?:void|int|double|float|char|unsigned|long|short|u?int\d*_t|bool)\s+\*?\s*([A-Za-z_]\w*)\s*\(/);
        fnName = m?.[1] ?? '?';
        fnStart = i;
        fnStartLine = i;
      }
      depth += dOpen - dClose;
      if (fnStart !== -1 && depth <= 0 && i > fnStart) {
        if (i - fnStartLine > 40) longFns.push(fnName);
        fnStart = -1;
      }
    });
    if (longFns.length > 0) {
      deduct('function-length', 3, `함수 ${longFns.join(', ')}이(가) 40줄을 초과합니다. 작은 함수로 분리하세요.`);
    }
  }

  /* 3) 중첩 깊이 — 3단 이상의 블록 중첩 */
  {
    let depth = 0;
    let maxDepth = 0;
    for (const ln of lines) {
      const dOpen = (ln.match(/{/g) ?? []).length;
      const dClose = (ln.match(/}/g) ?? []).length;
      depth += dOpen - dClose;
      maxDepth = Math.max(maxDepth, depth);
    }
    if (maxDepth >= 3) {
      deduct('nesting-depth', 5, `블록 중첩 깊이가 ${maxDepth}단계입니다. 3단계 이하로 유지하세요.`);
    }
  }

  /* 4) goto 사용 */
  if (/\bgoto\s+\w+/.test(text)) {
    deduct('goto', 10, 'goto 문은 제어 흐름을 이해하기 어렵게 만듭니다. 구조적 흐름 제어로 대체하세요.');
  }

  /* 5) 반복 블록 — 3줄 이상 동일한 연속 라인 블록 2회 이상 */
  {
    const seen = new Map<string, number>();
    for (let i = 0; i + 2 < lines.length; i++) {
      const block = lines.slice(i, i + 3).map((l) => l.trim()).join('\n');
      if (!block || block.startsWith('//')) continue;
      seen.set(block, (seen.get(block) ?? 0) + 1);
    }
    const dupCount = [...seen.values()].filter((c) => c >= 2).length;
    if (dupCount > 0) {
      deduct('duplication', 3, `동일한 3줄 블록이 ${dupCount}곳에서 반복됩니다. 헬퍼 함수로 추출하세요.`);
    }
  }

  return {
    qualityScore: Math.max(0, Math.min(100, q)),
    qualityIssues: qualityIssues.sort((a, b) => a.message.localeCompare(b.message)),
  };
}

/* ---------- 멘토 요약 리포트 ---------- */
export function mentorSummary(a: CodeAnalysis, p: Project, nextTask?: string | null): string {
  const parts: string[] = [];
  parts.push('안녕하세요, 멘토입니다 👋 작성하신 코드를 실시간으로 분석했어요.');

  const scoreTxt =
    a.score >= 85
      ? '매우 좋아요! 구조가 탄탄해서 컴파일러도 통과할 가능성이 높습니다.'
      : a.score >= 65
      ? '좋은 흐름이에요. 몇 가지만 다듬으면 완벽합니다.'
      : a.score >= 45
      ? '괜찮아요 — 아래 지적 항목부터 함께 고쳐볼까요?'
      : '아직 걸음마 단계지만 괜찮아요. 하나씩 고치면 금방 늘어요.';
  parts.push(`📊 코드 품질 점수: ${a.score}/100 — ${scoreTxt}`);

  const errs = a.issues.filter((i) => i.severity === 'error');
  const warns = a.issues.filter((i) => i.severity === 'warning');
  if (errs.length)
    parts.push(`⛔ 오류 ${errs.length}건 — 가장 먼저 "${errs[0].title}"(L${errs[0].line})부터 해결하세요.`);
  else if (warns.length)
    parts.push(`⚠️ 경고 ${warns.length}건 — "${warns[0].title}"부터 개선해 보세요.`);
  else
    parts.push('✅ 정적 검사에서 오류·경고가 없어요. 그대로 빌드에 도전하세요!');

  if (a.coverage >= 75)
    parts.push(`✅ 핵심 요소 커버리지 ${a.coverage}% — 이 프로젝트의 알고리즘 구조를 잘 잡고 있어요.`);
  else if (a.coverage > 0)
    parts.push(`🔧 핵심 요소가 ${a.coverage}% 반영됐어요. 아래 체크리스트의 남은 항목을 참고해 구현을 확장해 보세요.`);
  else
    parts.push('📝 아직 핵심 요소가 보이지 않아요. 아래 체크리스트를 보고 알고리즘 골격부터 잡아 보세요.');

  parts.push(`💡 멘토 팁: ${p.tip.length > 110 ? p.tip.slice(0, 110) + '…' : p.tip}`);

  if (nextTask) parts.push(`🎯 다음 단계: ${nextTask} — 코드 작업과 진행 트래커를 함께 진행하세요!`);
  else parts.push('🎉 이 프로젝트의 체크 항목을 모두 완료했어요. 빌드 성공 후 포트폴리오에 반영하세요!');

  return parts.join('\n\n');
}

export { INCLUDES };
