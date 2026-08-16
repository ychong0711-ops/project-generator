import React, { useCallback, useState, Suspense, lazy, Component } from 'react';
import type { TabId } from './types';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { LanguageSwitcher } from './components/LanguageSwitcher';
// ✅ 추가: 누락된 import
import { useSavedProjects } from './hooks/useSavedProjects';
import { projectById } from './data/projects';

// Lazy-loaded tab components for code splitting
const Dashboard = lazy(() => import('./components/Dashboard'));
const Universities = lazy(() => import('./components/Universities'));
const Roadmap = lazy(() => import('./components/Roadmap'));
const Portfolio = lazy(() => import('./components/Portfolio'));
const Competitiveness = lazy(() => import('./components/Competitiveness'));
const LabExercises = lazy(() => import('./components/LabExercises'));
const GuideTab = lazy(() => import('./components/GuideTab'));
const Hero = lazy(() => import('./components/Hero'));
const Generator = lazy(() => import('./components/Generator'));

// ✅ 추가: Error Boundary 컴포넌트 정의
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-[400px] place-items-center p-8 text-center">
          <div>
            <p className="text-4xl">⚠️</p>
            <h2 className="mt-4 text-xl font-bold text-white">렌더링 오류가 발생했습니다</h2>
            <p className="mt-2 text-sm text-slate-400">
              {this.state.error?.message || '알 수 없는 오류'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-black"
            >
              다시 시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const { savedIds, toggle, remove, clear } = useSavedProjects();

  const changeTab = useCallback((t: TabId) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: 'auto' });
    // 포커스 관리: 새로운 탭의 콘텐츠로 포커스 이동 (키보드 네비게이션 지원)
    // 현재 활성화된 탭의 제목을 가진 h2 요소로 포커스 이동
    const targetH2 = document.querySelector('main h2');
    if (targetH2) {
      targetH2.focus();
    }
  }, []);

  const handleViewProject = useCallback((id: string) => {
    setFocusProjectId(id);
    changeTab('generator');
  }, [changeTab]);

  const scrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const savedProjects = savedIds
    .map((id) => projectById(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-200">
      <Navbar active={tab} onChange={changeTab} savedCount={savedIds.length} />

      <div className="absolute top-0 right-0 p-2 z-50">
        <LanguageSwitcher />
      </div>

      <main>
        <ErrorBoundary>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'home' && (
              <Dashboard savedProjects={savedProjects} onNavigate={changeTab} onView={handleViewProject} />
            )}
          </Suspense>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'generator' && (
              <>
                <Hero onGenerate={scrollToGenerator} onUni={() => changeTab('universities')} />
                <Generator
                  focusProjectId={focusProjectId}
                  onConsumeFocus={() => setFocusProjectId(null)}
                  savedIds={savedIds}
                  onToggleSave={toggle}
                />
              </>
            )}
          </Suspense>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'universities' && <Universities savedProjects={savedProjects} />}
          </Suspense>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'roadmap' && <Roadmap />}
          </Suspense>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'portfolio' && (
              <Portfolio
                savedProjects={savedProjects}
                onView={handleViewProject}
                onRemove={remove}
                onClear={clear}
                onGoGenerate={() => changeTab('generator')}
              />
            )}
          </Suspense>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'compete' && <Competitiveness savedProjects={savedProjects} />}
          </Suspense>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'labs' && <LabExercises savedProjects={savedProjects} />}
          </Suspense>
          <Suspense fallback={<div>로딩 중...</div>}>
            {tab === 'guide' && <GuideTab savedProjects={savedProjects} />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  );
}