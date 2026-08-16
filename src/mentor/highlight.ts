/** ============================================================
 *  경량 C 문법 하이라이터 (에디터 오버레이용)
 *  — HTML 이스케이프 + 정규식 토큰 컬러링
 * ============================================================ */

// &<>만 이스케이프 — highlightLine의 스태시 단계에서 사용한다.
// 문자열/주석/지시문의 따옴표를 리터럴로 남겨 스태시 정규식이 매치되게 한다.
function escapeHtmlTag(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(s: string): string {
  return escapeHtmlTag(s)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const KEYWORDS =
  /\b(int|void|return|if|else|for|while|do|static|const|struct|typedef|enum|switch|case|break|continue|double|float|char|unsigned|signed|long|short|sizeof|volatile|extern|inline|union|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t|bool|true|false|NULL)\b/g;

const NUMBER =
  /\b(0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[uUlLfF]*)\b/g;

const PREPROC =
  /^(\s*#\s*(?:include|define|ifdef|ifndef|endif|else|pragma|undef|if)\b[^\n]*)/;

/** 한 줄 하이라이트 (주석/문자열/지시문은 플레이스홀더로 보호 후 복원) */
export function highlightLine(line: string): string {
  const holders: string[] = [];

  // 플레이스홀더는 `\u0000x{index}y\u0000` 형식: 숫자 양옆의 `x`/`y`(워드 문자) 덕분에
  // NUMBER의 `\b\d+\b`가 인덱스 숫자에 매치하지 않는다(워드 경계 없음). KEYWORDS/PREPROC도 매치 불가.
  const stash = (re: RegExp, cls: string) => {
    line = line.replace(re, (m) => {
      // 스태시된 내용은 &<>만 이스케이프한다 — 따옴표를 리터럴로 남겨 문자열/주석 원문을 보존한다.
      holders.push(`<span class="${cls}">${escapeHtmlTag(m)}</span>`);
      return `\u0000x${holders.length - 1}y\u0000`;
    });
  };

  stash(/\/\*.*?\*\//g, 'text-slate-500 italic');
  stash(/\/\/.*$/g, 'text-slate-500 italic');
  stash(/("(?:\\.|[^"\\])*")/g, 'text-amber-300');
  stash(/('(?:\\.|[^'\\])*')/g, 'text-amber-300');
  // 지시문도 스태시: NUMBER/KEYWORDS가 생성된 클래스명(예: text-fuchsia-400의 "400")을 훼손하지 못하게 한다.
  stash(PREPROC, 'text-fuchsia-400');
  // 남은 코드(및 플레이스홀더)에 전체 이스케이프(&<>"') 적용 — 플레이스홀더는 \u0000xN y\u0000라 안전.
  let s = escapeHtml(line);
  s = s.replace(NUMBER, '<span class="text-sky-300">$1</span>');
  s = s.replace(KEYWORDS, '<span class="text-violet-300">$1</span>');
  // 지시문 안의 문자열/주석(중첩 플레이스홀더)까지 재귀적으로 복원
  const resolve = (t: string): string =>
    t.replace(/\u0000x(\d+)y\u0000/g, (_, i: string) => resolve(holders[Number(i)] ?? ''));
  return resolve(s);
}

/** 에디터 전체 HTML: 컴파일 오류/경고 라인 배경 표시 포함 */
export function editorHtml(code: string, errorMap: Map<number, 'error' | 'warning'>): string {
  return code
    .split('\n')
    .map((line, i) => {
      const n = i + 1;
      const mark = errorMap.get(n);
      const cls = mark === 'error' ? 'bg-red-500/15' : mark === 'warning' ? 'bg-amber-400/10' : '';
      return `<div class="${cls}">${highlightLine(line) || '&nbsp;'}</div>`;
    })
    .join('');
}
