import { useCallback, useState } from 'react';
import type { TabId } from './types';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Generator from './components/Generator';
import Universities from './components/Universities';
import Roadmap from './components/Roadmap';
import Portfolio from './components/Portfolio';
import Competitiveness from './components/Competitiveness';
import Dashboard from './components/Dashboard';
import GuideTab from './components/GuideTab';
import LabExercises from './components/LabExercises';
import Footer from './components/Footer';
import { useSavedProjects } from './hooks/useSavedProjects';
import { projectById } from './data/projects';

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const { savedIds, toggle, remove, clear } = useSavedProjects();

  const changeTab = useCallback((t: TabId) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: 'auto' });
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

      <main>
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
      </main>

      <Footer />
    </div>
  );
}
