import JSZip from 'jszip';
import type { Project } from '../types';
import { CATEGORIES } from '../data/projects';
import { samplesFor } from '../data/samples';
import { genArchitectureSvg } from './diagram';
import { projectToMarkdown } from './markdown';

/** 독일어 기술 문서에 사용하는 핵심 용어 (Glossar 테이블로 출력됨) */
const DE_TERMS: Record<string, string> = {
  '임베디드 시스템': 'Eingebettetes System',
  '마이크로컨트롤러': 'Mikrocontroller',
  '실시간 OS': 'Echtzeitbetriebssystem',
  'CAN': 'CAN-Bus',
  '센서': 'Sensor',
  '진단': 'Diagnose',
  '전력 관리': 'Energiemanagement',
  '모터 제어': 'Motorsteuerung',
  '부트로더': 'Bootloader',
  '통신': 'Kommunikation',
};

/** ============================================================
 *  스타터 코드 생성기
 *  — 프로젝트별로 실제 빌드 가능한 스타터팩(.zip)을 생성합니다.
 *  구성: README.md / src/main.c / Makefile / docs/plan.md / docs/interview-prep.md
 * ============================================================ */

export function genMainC(p: Project): string {
  const cat = CATEGORIES[p.category];

  const phases = p.milestones
    .map((m, i) => {
      const todos = m.tasks.map((t) => ` * [ ] ${t}`).join('\n');
      return `/* ----------------------------------------------------------------------
 * Phase ${i + 1} — ${m.phase}
 * ----------------------------------------------------------------------
${todos}
 * ---------------------------------------------------------------------- */
void phase_${i + 1}(void)
{
    /* TODO: ${m.tasks[0]} */
    /* 예상 완료 시점 — ${m.phase} */
}`;
    })
    .join('\n\n');

  const calls = p.milestones
    .map((_, i) => `        // phase_${i + 1}();   // ${p.milestones[i].phase}`)
    .join('\n');

  return `/**
 * =====================================================================
 *  ${p.title}
 *  ${p.titleEn}
 * ---------------------------------------------------------------------
 *  Code       : ${p.code}
 *  Category   : ${cat.label}
 *  Level      : ${p.level}   |   기간: ${p.weeks}주
 *  Target     : 독일 자동차 임베디드 석사 지원 포트폴리오 프로젝트
 * ---------------------------------------------------------------------
 *  Hardware   : ${p.mcu.join('  |  ')}
 *  Software   : ${p.sw.join('  |  ')}
 * =====================================================================
 *
 *  빌드   : make          (arm-none-eabi 툴체인 필요)
 *  플래시 : make flash    (ST-Link / OpenOCD 환경에 맞게 수정)
 */

/* ---- 사용하는 보드에 맞는 HAL 헤더로 교체하세요 ---- */
#include "stm32f4xx_hal.h"
#include <stdint.h>
#include <stdio.h>

/* ---- CubeMX에서 생성된 UART 핸들 (printf 리다이렉트 예시) ---- */
extern UART_HandleTypeDef huart2;

int _write(int file, char *ptr, int len)
{
    (void)file;
    HAL_UART_Transmit(&huart2, (uint8_t *)ptr, (uint16_t)len, 100);
    return len;
}

/* ---- 시스템 클럭 설정 (CubeMX 생성 코드를 여기에 붙여넣으세요) ---- */
static void SystemClock_Config(void)
{
    /* TODO: STM32CubeMX에서 생성한 SystemClock_Config 본문을 복사 */
}

${phases}

/* ---- 오류 처리 ---- */
static void Error_Handler(void)
{
    __disable_irq();
    while (1)
    {
        /* TODO: 오류 표시 LED 점멸 등 */
    }
}

/* =====================================================================
 *  main
 * ===================================================================== */
int main(void)
{
    HAL_Init();
    SystemClock_Config();

    /* TODO: GPIO / 타이머 / 통신 인터페이스 초기화 (CubeMX 생성 코드 참조) */

    printf("[${p.code}] %s start\\r\\n", __FILE__);

    while (1)
    {
        /* ---- 주차별 로드맵: 완성한 Phase부터 주석을 풀어 순서대로 연결 ---- */
${calls}
    }
}
`;
}

export function genMakefile(p: Project): string {
  const lines = [
    `# ${p.id} — ${p.title}`,
    `# 독일 자동차 임베디드 석사 지원 포트폴리오 프로젝트`,
    ``,
    `TARGET      = ${p.id}`,
    `BUILD_DIR   = build`,
    ``,
    `# ---- 툴체인 (arm-none-eabi-gcc 설치 필요) ----`,
    `PREFIX      = arm-none-eabi-`,
    `CC          = $(PREFIX)gcc`,
    `OBJCOPY     = $(PREFIX)objcopy`,
    `SIZE        = $(PREFIX)size`,
    ``,
    `# ---- 사용하는 MCU 코어에 맞게 수정 ----`,
    `#  STM32F0/F1: cortex-m0/m3 | STM32F4/G4/L4: cortex-m4 | STM32F7/H7: cortex-m7`,
    `MCU         = -mcpu=cortex-m4`,
    `CFLAGS      = $(MCU) -mthumb -std=gnu11 -O1 -Wall -Wextra -ffunction-sections -fdata-sections`,
    `LDFLAGS     = $(MCU) -mthumb -Wl,--gc-sections`,
    ``,
    `SRCS        = $(wildcard src/*.c)`,
    `OBJS        = $(SRCS:src/%.c=$(BUILD_DIR)/%.o)`,
    ``,
    `all: $(BUILD_DIR)/$(TARGET).elf`,
    ``,
    `$(BUILD_DIR)/%.o: src/%.c`,
    `\tmkdir -p $(BUILD_DIR)`,
    `\t$(CC) $(CFLAGS) -c $< -o $@`,
    ``,
    `$(BUILD_DIR)/$(TARGET).elf: $(OBJS)`,
    `\t$(CC) $(LDFLAGS) $^ -o $@`,
    `\t$(OBJCOPY) -O ihex $@ $(BUILD_DIR)/$(TARGET).hex`,
    `\t$(OBJCOPY) -O binary $@ $(BUILD_DIR)/$(TARGET).bin`,
    `\t$(SIZE) $@`,
    ``,
    `# ST-Link 연결 후 플래시 (없으면 OpenOCD 명령으로 대체)`,
    `flash:`,
    `\tst-flash write $(BUILD_DIR)/$(TARGET).bin 0x8000000`,
    ``,
    `clean:`,
    `\trm -rf $(BUILD_DIR)`,
    ``,
    `.PHONY: all flash clean`,
    ``,
  ];
  return lines.join('\n');
}

export function genPlan(p: Project): string {
  const milestones = p.milestones
    .map((m) => `### ${m.phase}\n${m.tasks.map((t) => `- [ ] ${t}`).join('\n')}`)
    .join('\n\n');
  return `# ${p.title} — 진행 플랜 (${p.weeks}주)

> ${p.code} · ${CATEGORIES[p.category].label} · ${p.level}

## 프로젝트 목표
${p.goals.map((g) => `- [ ] ${g}`).join('\n')}

## 주차별 태스크
${milestones}

## 산출물
${p.deliverables.map((d) => `- [ ] ${d}`).join('\n')}

## 소프트웨어 스택
${p.sw.map((s) => `- ${s}`).join('\n')}
`;
}

export function genInterview(p: Project): string {
  return `# ${p.title} — 예상 면접 질문 대비

${p.interviewQs.map((q, i) => `### Q${i + 1}. ${q}

**답변 정리:**
- 
- 
`).join('\n')}
## 5분 발표 스크립트 준비

1. 프로젝트 개요 (30초): 무엇을 만들었는가
2. 아키텍처 설명 (2분): 하드웨어/소프트웨어 구성 + 다이어그램
3. 핵심 도전 과제 (1분): 가장 어려웠던 문제와 해결 과정
4. 측정 결과 (1분): 그래프·수치로 증명
5. 배운 점 + 다음 계획 (30초)
`;
}

export function genReadme(p: Project): string {
  return `${projectToMarkdown(p)}

---

## 📦 스타터팩 파일 구성

| 파일 | 설명 |
| ---- | ---- |
| \`src/main.c\` | 주차별 Phase가 주석으로 구조화된 메인 스켈레톤 |
| \`Makefile\` | arm-none-eabi-gcc 빌드/플래시 스크립트 |
| \`docs/plan.md\` | 진행 체크용 주차별 플랜 (이 앱의 진행률과 동기화해서 사용) |
| \`docs/interview-prep.md\` | 면접 답변 정리 시트 |

> 이 스타터팩은 AutoEmbed LAB 프로젝트 생성기에서 자동 생성되었습니다.
`;
}

export function genAlgoReadme(p: Project): string {
  const samples = samplesFor(p.id);
  const files = samples.map((s) => `- \`${s.id}.c\` — ${s.desc}`).join('\n');
  return `# 알고리즘 검증용 C 코드 (브라우저 빌드와 동일한 코드)

> ${p.title} — 핵심 알고리즘을 순수 C99로 구현한 테스트 코드입니다.
> AutoEmbed LAB의 코드 랩에서 실제로 컴파일·빌드한 것과 동일한 소스입니다.

## 포함된 파일

${files}

## 로컬에서 실행하기 (x86 PC)

\`\`\`bash
gcc -O0 -g -o test algo/<file>.c && ./test
\`\`\`

## ARM 타깃 빌드 확인하기

\`\`\`bash
# arm-none-eabi-gcc 설치 후 (ARM GNU Toolchain)
arm-none-eabi-gcc -O1 -Wall -mcpu=cortex-m4 -mthumb -S algo/<file>.c -o algo/<file>.s
\`\`\`

각 파일은 \`main()\` 진입점이 포함된 독립 실행 코드이므로 파일 단위로 컴파일할 수 있습니다.
`;
}

/** 독일어 기술 문서(Technische Dokumentation) 생성 */
export function genGermanDoc(p: Project): string {
  const glossary = Object.entries(DE_TERMS)
    .map(([ko, de]) => `| ${ko} | ${de} |`)
    .join('\n');

  const goals = p.goals.map((g, i) => `${i + 1}. ${g}`).join('\n');

  const archRows = [
    ...p.mcu.map((m) => `| Hardware (MCU) | ${m} |`),
    ...p.sw.map((s) => `| Software | ${s} |`),
  ].join('\n');

  const plan = p.milestones
    .map((m, i) => `### Phase ${i + 1} — ${m.phase}\n\n${m.tasks.map((t) => `- [ ] ${t}`).join('\n')}`)
    .join('\n\n');

  const mess = p.deliverables.map((d) => `- ${d}`).join('\n');

  const fazit = p.skills.join(', ');

  return `# Technische Dokumentation — ${p.titleEn}

> ${p.tagline}

## Zusammenfassung

${p.description}

## Technische Anforderungen

${goals}

## Systemarchitektur

| Bereich | Technologie |
| ------- | ----------- |
${archRows}

## Implementierungsplan

${plan}

## Messergebnisse

${mess}

> Messdaten hier einfügen (Oszilloskop, Logging)

## Fazit

${fazit}

## Glossar

| Koreanisch | Deutsch |
| ---------- | ------- |
${glossary}
`;
}

/** 독일어 실측 측정 템플릿(Messvorlage) 생성 */
export function genMeasurementTemplate(p: Project): string {
  const protocol = p.milestones
    .map((m, i) => `| Phase ${i + 1} — ${m.phase} | | | | |`)
    .join('\n');

  const results = p.milestones
    .map((m, i) => `### Phase ${i + 1} — ${m.phase}\n\n- Messung 1: \n- Messung 2: \n- Messung 3: `)
    .join('\n\n');

  return `# Messvorlage — ${p.titleEn}

## 1. Testumgebung

| Gerät (장비) | Modell | Bemerkung |
| ------------ | ------ | --------- |
| | | |
| | | |

## 2. Messprotokoll

| Phase | Parameter | Erwartet | Gemessen | Abweichung |
| ----- | --------- | -------- | -------- | ---------- |
${protocol}

## 3. Ergebnisse

${results}

## 4. Vergleich

| Messpunkt | Simulation | Messung | Differenz | Bewertung |
| --------- | ---------- | ------- | --------- | --------- |
| | | | | |

## 5. Qualitätskontrolle

- [ ] Testabdeckung (테스트 커버리지) überprüfen
- [ ] MISRA-C Konformität prüfen
- [ ] Code-Review durchgeführt
- [ ] Dokumentation aktualisiert
`;
}

/** 스타터팩 zip 생성 및 다운로드 */
export async function downloadStarterZip(p: Project): Promise<void> {
  const zip = new JSZip();
  zip.file('README.md', genReadme(p));
  zip.file('Makefile', genMakefile(p));
  zip.file('src/main.c', genMainC(p));
  zip.file('docs/plan.md', genPlan(p));
  zip.file('docs/interview-prep.md', genInterview(p));
  zip.file('algo/README.md', genAlgoReadme(p));
  zip.file('docs/architecture.svg', genArchitectureSvg(p));
  zip.file('docs/technische-dokumentation.md', genGermanDoc(p));
  zip.file('docs/messvorlage.md', genMeasurementTemplate(p));
  samplesFor(p.id).forEach((s) => zip.file(`algo/${s.id}.c`, s.code));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.id}-starter.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
