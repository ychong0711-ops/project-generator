export type Level = '입문' | '중급' | '심화';

export type CategoryId =
  | 'basic'
  | 'comm'
  | 'rtos'
  | 'motor'
  | 'sensor'
  | 'power'
  | 'diag'
  | 'linux'
  | 'adas'
  | 'autosar'
  | 'control'
  | 'wireless';

export interface Category {
  id: CategoryId;
  label: string;
  badge: string; // badge 클래스
  dot: string; // 점 색
  bar: string; // 진행바 색
}

export interface Milestone {
  phase: string;
  tasks: string[];
}

export interface Project {
  id: string;
  code: string;
  title: string;
  titleEn: string;
  tagline: string;
  category: CategoryId;
  level: Level;
  weeks: number;
  mcu: string[];
  sw: string[];
  description: string;
  goals: string[];
  milestones: Milestone[];
  deliverables: string[];
  skills: string[];
  uniIds: string[];
  interviewQs: string[];
  tip: string;
}

export interface UniProgram {
  name: string;
  lang: '영어' | '독일어' | '영어/독일어';
  note?: string;
}

export interface University {
  id: string;
  name: string;
  short: string;
  city: string;
  programs: UniProgram[];
  focus: string[];
  industry: string;
  pros: string;
}

export type TabId = 'home' | 'generator' | 'universities' | 'roadmap' | 'portfolio' | 'compete' | 'guide' | 'labs';
