import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScaffoldDialog from './ScaffoldDialog';
import { projectById } from '../data/projects';
import { makeProject } from '../test/fixtures';

const supported = projectById('can-uds-scanner')!;
const unsupported = makeProject(); // overlay 없는 프로젝트 → 문서 스타터팩

describe('ScaffoldDialog — Phase C 미리보기 UI', () => {
  it('열리지 않으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(
      <ScaffoldDialog project={supported} open={false} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('지원 프로젝트: 파일트리 + 코드뷰어 + 문서가 함께 보인다', () => {
    render(<ScaffoldDialog project={supported} open onClose={() => {}} />);
    expect(screen.getByText('빌드 가능 스캐폴드')).toBeInTheDocument();
    // 파일트리(제목=경로)
    expect(screen.getByTitle('Makefile')).toBeInTheDocument();
    expect(screen.getByTitle('src/main.c')).toBeInTheDocument();
    expect(screen.getByTitle('docs/plan.md')).toBeInTheDocument();
    expect(screen.getByTitle('docs/technische-dokumentation.md')).toBeInTheDocument();
    // 코드뷰어 헤더에 선택 경로 표시
    expect(screen.getByText('CMakeLists.txt')).toBeInTheDocument();
  });

  it('빌드시스템 토글이 파일셋에 반영된다', async () => {
    const user = userEvent.setup();
    render(<ScaffoldDialog project={supported} open onClose={() => {}} />);
    expect(screen.getByTitle('CMakeLists.txt')).toBeInTheDocument();

    await user.click(screen.getByTestId('bs-cmake'));
    expect(screen.queryByTitle('CMakeLists.txt')).not.toBeInTheDocument();
    expect(screen.getByTitle('Makefile')).toBeInTheDocument();
  });

  it('미지원 프로젝트는 문서 스타터팩으로 표시한다', () => {
    render(<ScaffoldDialog project={unsupported} open onClose={() => {}} />);
    expect(screen.getByText('문서 스타터팩')).toBeInTheDocument();
    expect(screen.queryByTestId('bs-make')).not.toBeInTheDocument();
    expect(screen.getByTitle('docs/plan.md')).toBeInTheDocument();
  });

  it('닫기 버튼이 onClose 를 호출한다', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ScaffoldDialog project={supported} open onClose={onClose} />);
    await user.click(screen.getByTestId('scaffold-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
