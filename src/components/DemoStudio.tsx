import { useState, useMemo } from 'react';
import { useDemoVideos, generateDemoScript, type DemoVideo } from '../data/portfolio';
import { PROJECTS } from '../data/projects';
import type { Project } from '../types';
import { CopyIcon, PlayIcon, TrashIcon, CheckIcon } from './icons';
import { cn } from '../utils/cn';

interface DemoStudioProps {
  project?: Project;
}

export default function DemoStudio({ project }: DemoStudioProps) {
  const { videos, add, remove } = useDemoVideos();

  // Filter videos by project if project prop is provided
  const filteredVideos = useMemo(() => {
    if (!project) return videos;
    return videos.filter(v => v.projectIds.includes(project.id));
  }, [videos, project]);

  // Form state
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(project?.id ?? PROJECTS[0]?.id ?? '');

  // Script state
  const [activeScriptVideoId, setActiveScriptVideoId] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState('');
  const [copied, setCopied] = useState(false);

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;

    add({
      url: url.trim(),
      title: title.trim(),
      projectIds: selectedProjectId ? [selectedProjectId] : [],
      notes: '',
    });

    // Reset form
    setUrl('');
    setTitle('');
  };

  const handleGenerateScript = (video: DemoVideo) => {
    setActiveScriptVideoId(video.id);
    setGeneratedScript(generateDemoScript(video));
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Demo Studio</h1>
          <p className="text-slate-400">Manage your demo videos and generate scripts for your projects.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Video Form */}
          <div className="lg:col-span-1 bg-[#0b0f16] border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <PlayIcon className="w-5 h-5 text-amber-400" />
              Add New Video
            </h2>
            
            <form onSubmit={handleAddVideo} className="space-y-4">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Video URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#1e2430] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Project Demo Title"
                  className="w-full bg-[#1e2430] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="project" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Associated Project
                </label>
                <select
                  id="project"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-[#1e2430] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-colors appearance-none"
                >
                  <option value="">None</option>
                  {PROJECTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className={cn(
                  "w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 mt-4",
                  "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20",
                  "active:scale-[0.98]"
                )}
              >
                Add Video
              </button>
            </form>
          </div>

          {/* Video List & Scripts */}
          <div className="lg:col-span-2 space-y-6">
            {videos.length === 0 ? (
              <div className="bg-[#0b0f16] border border-dashed border-white/20 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                <PlayIcon className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-xl font-medium text-slate-400">No demos yet</h3>
                <p className="text-slate-500 mt-1">Add your first demo video using the form on the left.</p>
              </div>
            ) : (
              filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-[#0b0f16] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                        {video.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {video.projectIds.map((id) => {
                          const proj = PROJECTS.find(p => p.id === id);
                          return proj ? (
                            <span key={id} className="bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-md px-2 py-0.5 text-xs font-medium">
                              {proj.code}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(video.id)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                      title="Delete video"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-slate-300 hover:text-amber-400 mb-4 transition-colors"
                  >
                    <PlayIcon className="w-4 h-4 mr-2" />
                    Watch Video
                  </a>

                  <div className="mt-4 pt-4 border-t border-white/5">
                    <button
                      onClick={() => handleGenerateScript(video)}
                      className={cn(
                        "text-sm font-medium px-4 py-2 rounded-lg transition-all mb-4",
                        activeScriptVideoId === video.id && generatedScript
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10 border border-transparent hover:border-white/10"
                      )}
                    >
                      {activeScriptVideoId === video.id && generatedScript ? 'Script Generated' : 'Generate Script'}
                    </button>

                    {activeScriptVideoId === video.id && generatedScript && (
                      <div className="relative mt-2 animate-fade-in">
                        <div className="bg-[#1e2430] rounded-xl p-4 border border-white/5 font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {generatedScript}
                        </div>
                        <button
                          onClick={handleCopy}
                          className={cn(
                            "absolute top-3 right-3 p-2 rounded-lg transition-all",
                            copied
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/10 text-slate-300 hover:bg-white/20"
                          )}
                          title="Copy to clipboard"
                        >
                          {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
