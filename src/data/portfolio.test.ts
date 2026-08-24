import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDemoVideos, demoStore, generateDemoScript, DEMO_VIDEOS_KEY } from './portfolio';
import type { DemoVideo } from './portfolio';

const sampleAdd = {
  title: 'CAN 스캐너 데모',
  url: 'https://youtu.be/demo-can',
  projectIds: ['can-uds-scanner'],
  notes: '실차 OBD-II 연결 장면 포함',
};

const demoVideo: DemoVideo = {
  id: 'demo-test-1',
  title: 'CAN 버스 분석기 시연',
  url: 'https://youtu.be/x',
  projectIds: ['can-uds-scanner'],
  notes: '',
  createdAt: 0,
};

describe('useDemoVideos — Portfolio Demo Studio', () => {
  // 모듈 레벨 스토어 + localStorage 동시 초기화 (테스트 격리)
  beforeEach(() => {
    demoStore.clear();
  });

  it('초기 상태는 빈 배열이다', () => {
    const { result } = renderHook(() => useDemoVideos());
    expect(result.current.videos).toEqual([]);
  });

  it('add 함수가 비디오 수를 증가시키고 id/createdAt를 채운다', () => {
    const { result } = renderHook(() => useDemoVideos());
    act(() => result.current.add(sampleAdd));

    expect(result.current.videos.length).toBe(1);
    const [v] = result.current.videos;
    expect(v.title).toBe('CAN 스캐너 데모');
    expect(v.url).toBe('https://youtu.be/demo-can');
    expect(v.id).toBeTruthy();
    expect(typeof v.createdAt).toBe('number');
  });

  it('remove 함수가 해당 id의 비디오 수를 감소시킨다', () => {
    const { result } = renderHook(() => useDemoVideos());
    let firstId = '';
    act(() => {
      firstId = demoStore.add(sampleAdd).id;
    });
    act(() => result.current.add({ ...sampleAdd, title: '두 번째 데모' }));
    expect(result.current.videos.length).toBe(2);

    act(() => result.current.remove(firstId));
    expect(result.current.videos.length).toBe(1);
    expect(result.current.videos[0].title).toBe('두 번째 데모');
  });

  it('clear 함수가 모든 비디오를 비운다', () => {
    const { result } = renderHook(() => useDemoVideos());
    act(() => {
      result.current.add(sampleAdd);
      result.current.add({ ...sampleAdd, title: '두 번째 데모' });
    });
    expect(result.current.videos.length).toBe(2);

    act(() => result.current.clear());
    expect(result.current.videos).toEqual([]);
    expect(localStorage.getItem(DEMO_VIDEOS_KEY)).toBeNull();
  });

  it('localStorage(autoembed-demo-studio)에 저장된다', () => {
    const { result } = renderHook(() => useDemoVideos());
    act(() => result.current.add(sampleAdd));

    const stored: unknown = JSON.parse(localStorage.getItem(DEMO_VIDEOS_KEY)!);
    expect(Array.isArray(stored)).toBe(true);
    const arr = stored as DemoVideo[];
    expect(arr.length).toBe(1);
    expect(arr[0].title).toBe('CAN 스캐너 데모');
  });
});

describe('generateDemoScript — 데모 스크립트 초안', () => {
  it('영상 제목과 연결 프로젝트(code/titleEn) 기반 스크립트를 생성한다', () => {
    const script = generateDemoScript(demoVideo);
    expect(script).toContain('"CAN 버스 분석기 시연"');
    expect(script).toContain('[DE-EMB-1001]');
    expect(script).toContain('CAN Bus Analyzer & UDS Diagnostic Scanner');
    // mcu/sw 첫 항목 기반 스택 표기
    expect(script).toContain('STM32F103/F407');
  });

  it('연결된 프로젝트가 없어도 빈 문자열 없이 안전하게 생성한다', () => {
    const script = generateDemoScript({ ...demoVideo, projectIds: ['ghost-project'] });
    expect(script.length).toBeGreaterThan(0);
    expect(script).toContain('"CAN 버스 분석기 시연"');
    expect(script).not.toContain('undefined');
  });

  it('notes가 있으면 스크립트에 포함된다', () => {
    const script = generateDemoScript({ ...demoVideo, notes: '마지막에 실차 주행 장면 추가' });
    expect(script).toContain('마지막에 실차 주행 장면 추가');
  });
});
