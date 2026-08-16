import type { Project } from '../types';

/* ============================================================
 *  아키텍처 블록 다이어그램 자동 생성기 (SVG)
 *  — 프로젝트 분야별 주변장치 템플릿으로 README용 도식 생성
 * ============================================================ */

interface Periph {
  left: string[];
  right: string[];
  bus: string;
  leftLinks: string[];
  rightLinks: string[];
}

const PERIPHS: Record<string, Periph> = {
  basic: {
    left: ['버튼 / 스위치', '브레이크 입력'],
    right: ['LED / 부저', '상태 표시'],
    bus: 'GPIO / UART',
    leftLinks: ['GPIO', 'GPIO INT'],
    rightLinks: ['GPIO', 'UART'],
  },
  comm: {
    left: ['TJA1050 트랜시버', 'OBD-II 커넥터'],
    right: ['PC GUI (PyQt)', '로거'],
    bus: 'CAN 500kbps',
    leftLinks: ['CAN RX/TX', 'CAN H/L'],
    rightLinks: ['USB-UART', '로그'],
  },
  rtos: {
    left: ['버튼 / 스위치', 'LED / 부저'],
    right: ['모터 드라이버', '디버그 UART'],
    bus: 'GPIO / UART',
    leftLinks: ['GPIO INT', 'GPIO'],
    rightLinks: ['PWM', 'UART'],
  },
  motor: {
    left: ['BLDC 모터', '엔코더', '전류 센서 INA240'],
    right: ['3상 인버터 DRV8302', '브레이크 부하'],
    bus: 'PWM / ADC / QEI',
    leftLinks: ['3상', 'QEI', 'ADC'],
    rightLinks: ['PWM 6ch', '부하'],
  },
  sensor: {
    left: ['IMU (ICM-42688)', 'GNSS (NEO-M8N)'],
    right: ['SD 카드 로거', '시각화 툴'],
    bus: 'SPI / I2C / UART',
    leftLinks: ['SPI', 'UART'],
    rightLinks: ['SDIO/SPI', 'USB'],
  },
  power: {
    left: ['배터리 팩 (2-4S)', 'AFE (BQ769x2)', '션트 + INA240'],
    right: ['충전/부하 회로', '상태 표시'],
    bus: 'I2C / ADC',
    leftLinks: ['전압 탭', 'I2C', 'ADC'],
    rightLinks: ['릴레이', 'GPIO'],
  },
  diag: {
    left: ['호스트 PC', 'USB-CAN 어댑터'],
    right: ['플래시 메모리', '디버그 UART'],
    bus: 'CAN / UART',
    leftLinks: ['USB', 'CAN'],
    rightLinks: ['내부 버스', 'UART'],
  },
  linux: {
    left: ['MCP2515 HAT', 'TFT 디스플레이'],
    right: ['Qt/QML 렌더러', 'systemd 서비스'],
    bus: 'SocketCAN / SPI',
    leftLinks: ['SPI', 'MIPI/HDMI'],
    rightLinks: ['Framebuffer', '서비스'],
  },
  adas: {
    left: ['카메라 (USB)', '주행 데이터셋'],
    right: ['조향 서보', '오버레이 디스플레이'],
    bus: 'USB / 비디오',
    leftLinks: ['USB 2.0', '데이터'],
    rightLinks: ['PWM', '오버레이'],
  },
  autosar: {
    left: ['RTE 포트 입력', '호스트 도구'],
    right: ['SWC 출력', '이벤트 트리거'],
    bus: 'RTE / BSW 인터페이스',
    leftLinks: ['포트', '설정'],
    rightLinks: ['포트', '이벤트'],
  },
  control: {
    left: ['엔코더 모터', '관성 플라이휠'],
    right: ['브레이크 PWM', '시리얼 플로터'],
    bus: 'PWM / ENC',
    leftLinks: ['ENC', '부하'],
    rightLinks: ['PWM', 'UART'],
  },
  wireless: {
    left: ['압력 센서 BMP280', '배터리 (CR2032)'],
    right: ['RF 수신기 NRF24L01', 'PC 앱'],
    bus: 'SPI / RF 2.4GHz',
    leftLinks: ['I2C/SPI', '전원'],
    rightLinks: ['RF 링크', 'USB'],
  },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function block(x: number, y: number, w: number, h: number, title: string, sub: string, accent = false): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#111827" stroke="${accent ? '#f59e0b' : '#334155'}" stroke-width="1.5"/><text x="${x + w / 2}" y="${y + h / 2 - 1}" text-anchor="middle" fill="#e2e8f0" font-size="11.5" font-weight="700" font-family="sans-serif">${esc(title)}</text><text x="${x + w / 2}" y="${y + h / 2 + 13}" text-anchor="middle" fill="#64748b" font-size="8.5" font-family="sans-serif">${esc(sub)}</text>`;
}

function line(x1: number, y1: number, x2: number, y2: number, label: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#475569" stroke-width="1.2"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" text-anchor="middle" fill="#64748b" font-size="8" font-family="monospace">${esc(label)}</text>`;
}

export function genArchitectureSvg(p: Project): string {
  const per = PERIPHS[p.category] ?? PERIPHS.basic;
  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#0b0f16;border-radius:12px">`
  );
  parts.push(
    `<text x="380" y="44" text-anchor="middle" fill="#fbbf24" font-size="14" font-weight="800" font-family="sans-serif">${esc(p.code)} — ${esc(p.title)}</text>`
  );
  parts.push(`<text x="380" y="60" text-anchor="middle" fill="#64748b" font-size="9" font-family="monospace">${esc(p.titleEn)}</text>`);

  /* 전원 */
  parts.push(block(320, 76, 120, 26, '전원 3.3V / 5V', 'PWR'));
  /* MCU */
  parts.push(block(300, 132, 160, 96, p.mcu[0] ?? 'MCU', 'MCU · HAL 펌웨어', true));
  parts.push(line(380, 102, 380, 132, 'VDD'));

  /* 좌측 입력 */
  const ys = [104, 178, 252];
  per.left.slice(0, 3).forEach((t, i) => {
    const y = ys[i];
    parts.push(block(30, y, 150, 52, t, '입력'));
    parts.push(line(180, y + 26, 300, 180, per.leftLinks[i % per.leftLinks.length] ?? '신호'));
  });

  /* 우측 출력 */
  per.right.slice(0, 3).forEach((t, i) => {
    const y = ys[i];
    parts.push(block(580, y, 150, 52, t, '출력'));
    parts.push(line(460, 180, 580, y + 26, per.rightLinks[i % per.rightLinks.length] ?? '제어'));
  });

  /* 버스 */
  parts.push(line(40, 322, 720, 322, ''));
  parts.push(`<text x="380" y="338" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace">버스: ${esc(per.bus)}</text>`);
  parts.push(`</svg>`);
  return parts.join('\n');
}
