import React, { useCallback, useState, Suspense, lazy, Component } from 'react';
import type { TabId } from './types';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { LanguageSwitcher } from './components/LanguageSwitcher';
// ✅ 추가: 누락된 import
import { useTranslation } from 'react-i18next';
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

function TabFallback() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-[300px] place-items-center p-8" role="status" aria-live="polite">
      <p className="text-sm text-slate-500">{t('loading')}</p>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const { savedIds, toggle, remove, clear } = useSavedProjects();

  const changeTab = useCallback((t: TabId) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: 'auto' });
    // 포커스 관리: 새로운 탭의 콘텐츠로 포커스 이동 (키보드 네비게이션 지원)
    // lazy 탭이 마운트된 뒤에 포커스를 옮겨야 하므로 다음 프레임에서 수행한다.
    requestAnimationFrame(() => {
      const targetH2 = document.querySelector<HTMLElement>('main h2');
      if (!targetH2) return;
      // h2는 기본적으로 포커스 대상이 아니므로 tabIndex를 부여한다.
      if (!targetH2.hasAttribute('tabindex')) targetH2.setAttribute('tabindex', '-1');
      targetH2.focus();
    });
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
        {/* 탭이 바뀌면 ErrorBoundary를 리셋해 이전 탭의 오류가 남지 않게 한다 */}
        <ErrorBoundary key={tab}>
          <Suspense fallback={<TabFallback />}>
            {tab === 'home' && (
              <Dashboard savedProjects={savedProjects} onNavigate={changeTab} onView={handleViewProject} />
            )}
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
            {tab === 'universities' && <Universities savedProjects={savedProjects} />}
            {tab === 'roadmap' && <Roadmap />}
            {tab === 'portfolio' && (
              <Portfolio
                savedProjects={savedProjects}
                onView={handleViewProject}
                onRemove={remove}
                onClear={clear}
                onGoGenerate={() => changeTab('generator')}
              />
            )}
            {tab === 'compete' && <Competitiveness savedProjects={savedProjects} />}
            {tab === 'labs' && <LabExercises savedProjects={savedProjects} />}
            {tab === 'guide' && <GuideTab savedProjects={savedProjects} />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  );
}