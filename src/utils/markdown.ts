import type { Project } from '../types';
import { CATEGORIES } from '../data/projects';
import { universityById } from '../data/universities';

export function projectToMarkdown(p: Project): string {
  const cat = CATEGORIES[p.category];
  const unis = p.uniIds
    .map((id) => {
      const u = universityById(id);
      return u ? `- ${u.name} (${u.city})` : null;
    })
    .filter(Boolean)
    .join('\n');

  const milestones = p.milestones
    .map((m) => `### ${m.phase}\n${m.tasks.map((t) => `- [ ] ${t}`).join('\n')}`)
    .join('\n\n');

  return `# ${p.title} — ${p.titleEn}

> ${p.tagline}

- **프로젝트 코드**: ${p.code}
- **분야**: ${cat.label}
- **난이도**: ${p.level}
- **기간**: ${p.weeks}주
- **타깃**: 독일 자동차 임베디드 석사 지원 포트폴리오

## 프로젝트 개요

${p.description}

## 목표

${p.goals.map((g) => `- [ ] ${g}`).join('\n')}

## 하드웨어

${p.mcu.map((h) => `- ${h}`).join('\n')}

## 소프트웨어 스택

${p.sw.map((s) => `- ${s}`).join('\n')}

## 주차별 로드맵

${milestones}

## 산출물 (포트폴리오 등재)

${p.deliverables.map((d) => `- [ ] ${d}`).join('\n')}

## 핵심 기술

${p.skills.map((s) => `- ${s}`).join('\n')}

## 예상 면접 질문

${p.interviewQs.map((q) => `- ${q}`).join('\n')}

## 연계 가능한 대학

${unis}

## 팁

${p.tip}
`;
}

export function portfolioToMarkdown(projects: Project[]): string {
  const header = `# 🇩🇪 독일 자동차 임베디드 대학원 — 포트폴리오 정리

> AutoEmbed LAB 프로젝트 생성기로 선정한 프로젝트 목록
> 생성일: ${new Date().toISOString().slice(0, 10)} · 총 ${projects.length}개 프로젝트

## 프로젝트 개요

| 코드 | 프로젝트 | 분야 | 난이도 | 기간 |
| ---- | -------- | ---- | ------ | ---- |
${projects
  .map(
    (p) =>
      `| ${p.code} | ${p.title} | ${CATEGORIES[p.category].label} | ${p.level} | ${p.weeks}주 |`
  )
  .join('\n')}

---

`;
  return header + projects.map((p) => projectToMarkdown(p)).join('\n\n---\n\n');
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
