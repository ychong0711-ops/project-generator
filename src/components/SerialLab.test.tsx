import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SerialLab from './SerialLab';
import { makeProject } from '../test/fixtures';

const project = makeProject();

/* Web Serial 모의 포트 — 읽기 루프가 즉시 종료되도록 done:true 를 돌려준다. */
function makeMockPort() {
  const reader = {
    read: vi.fn().mockResolvedValue({ value: undefined, done: true }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  return {
    reader,
    readable: { getReader: () => reader },
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getInfo: () => ({ usbProductName: 'TestDevice' }),
  };
}

let mockPort: ReturnType<typeof makeMockPort>;

beforeEach(() => {
  mockPort = makeMockPort();
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    writable: true,
    value: { requestPort: vi.fn().mockResolvedValue(mockPort) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator as object, 'serial');
});

describe('SerialLab', () => {
  it('크래시 없이 렌더링된다', () => {
    const { container } = render(<SerialLab project={project} />);
    expect(container.childNodes.length).toBeGreaterThan(0);
  });

  it('연결 버튼이 노출된다', () => {
    render(<SerialLab project={project} />);
    expect(screen.getAllByRole('button', { name: /시리얼 포트 연결/ }).length).toBeGreaterThan(0);
  });

  it('연결하면 해제 버튼이 나타나고, 해제하면 다시 연결 버튼이 나타난다', async () => {
    const user = userEvent.setup();
    render(<SerialLab project={project} />);

    await user.click(screen.getAllByRole('button', { name: /시리얼 포트 연결/ })[0]);
    expect(navigator.serial!.requestPort).toHaveBeenCalled();
    expect(mockPort.open).toHaveBeenCalled();

    const disconnect = await screen.findAllByRole('button', { name: /연결 해제/ });
    expect(disconnect.length).toBeGreaterThan(0);

    await user.click(disconnect[0]);
    expect(await screen.findAllByRole('button', { name: /시리얼 포트 연결/ })).not.toHaveLength(0);
  });

  it('언마운트 시 cleanup 이 오류 없이 실행된다', () => {
    const { unmount } = render(<SerialLab project={project} />);
    expect(() => unmount()).not.toThrow();
  });
});
