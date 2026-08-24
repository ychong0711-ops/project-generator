// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { genArchitectureSvg } from './diagram';
import type { CategoryId } from '../types';
import { makeProject } from '../test/fixtures';

describe('genArchitectureSvg — 아키텍처 다이어그램 생성', () => {
  it('완결된 SVG 문서이고 제목/코드/영문 제목을 포함한다', () => {
    const p = makeProject({ code: 'P-CAN', title: 'CAN 스캐너', titleEn: 'CAN Scanner' });
    const svg = genArchitectureSvg(p);

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('P-CAN — CAN 스캐너');
    expect(svg).toContain('CAN Scanner');
  });

  it('카테고리별 주변장치 템플릿(버스 라벨)을 반영한다', () => {
    const comm = genArchitectureSvg(makeProject({ category: 'comm' }));
    expect(comm).toContain('버스: CAN 500kbps');

    const motor = genArchitectureSvg(makeProject({ category: 'motor' }));
    expect(motor).toContain('PWM / ADC / QEI');

    const linux = genArchitectureSvg(makeProject({ category: 'linux' }));
    expect(linux).toContain('SocketCAN / SPI');
  });

  it('알 수 없는 카테고리는 basic 템플릿으로 폴백한다 (경계)', () => {
    const svg = genArchitectureSvg(makeProject({ category: 'no-such-cat' as CategoryId }));
    expect(svg).toContain('버스: GPIO / UART');
  });

  it('MCU 블록에 첫 MCU 이름과 강조 색상을 쓴다', () => {
    const svg = genArchitectureSvg(makeProject({ mcu: ['STM32F411', 'STM32H7'] }));
    expect(svg).toContain('STM32F411');
    expect(svg).toContain('#f59e0b'); // accent stroke
  });

  it('MCU 목록이 비면 기본 라벨(MCU)로 폴백한다', () => {
    const svg = genArchitectureSvg(makeProject({ mcu: [] }));
    expect(svg).toContain('>MCU<');
  });

  it('XML 특수문자를 이스케이프한다 (< > &)', () => {
    const p = makeProject({
      code: 'A&B<C>',
      title: '테스트 <제목> & 부제',
      titleEn: 'Title <v1> & co',
    });
    const svg = genArchitectureSvg(p);

    expect(svg).toContain('A&amp;B&lt;C&gt;');
    expect(svg).toContain('테스트 &lt;제목&gt; &amp; 부제');
    expect(svg).not.toContain('A&B<C>');
  });

  it('좌우 주변장치 블록과 연결선 라벨을 포함한다', () => {
    const svg = genArchitectureSvg(makeProject({ category: 'comm' }));
    expect(svg).toContain('TJA1050 트랜시버'); // 좌측 입력
    expect(svg).toContain('PC GUI (PyQt)'); // 우측 출력
    expect(svg).toContain('CAN RX/TX'); // leftLinks
    expect(svg).toContain('USB-UART'); // rightLinks
    expect(svg).toContain('<line x1=');
  });
});
