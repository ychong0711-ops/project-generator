import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 각 테스트 후 DOM을 정리해 테스트 간 상태 누수를 막는다.
afterEach(() => {
  cleanup();
});
