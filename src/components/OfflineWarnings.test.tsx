import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineWarnings from './OfflineWarnings';

describe('OfflineWarnings', () => {
  it('warnings 가 없으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<OfflineWarnings />);
    expect(container).toBeEmptyDOMElement();
  });

  it('빈 배열이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<OfflineWarnings warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('경고마다 role="alert" 항목을 렌더링한다', () => {
    render(<OfflineWarnings warnings={['union 근사 구현 경고', 'float 정밀도 근사 경고']} />);

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent('⚠️ union 근사 구현 경고');
    expect(alerts[1]).toHaveTextContent('⚠️ float 정밀도 근사 경고');
    expect(screen.getByTestId('offline-warnings')).toBeInTheDocument();
  });
});
