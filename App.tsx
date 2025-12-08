
import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SourceViewer } from './components/SourceViewer';
import { PlotViewer } from './components/PlotViewer';
import { ProjectList } from './components/ProjectList';
import { ScriptsViewer } from './components/ScriptsViewer';
import { Auth } from './components/Auth';
import { TopBar } from './components/TopBar';
import { ToastContainer } from './components/Toast';
import { LogViewer } from './components/LogViewer';
import { ModelManager } from './components/ModelManager';
import { ProjectState, NovelType, ScriptFile, NovelChapter, PlotBatch, UserInfo, Notification, ExecutionLog, PlotPoint, SavedModel } from './types';
import * as GeminiService from './services/geminiService';
import * as DB from './services/db';
import { ChevronRight, Loader2, Save, Terminal, ChevronDown, ChevronUp, Cpu, Key, Globe, Settings2 } from 'lucide-react';

const MOCK_USER: UserInfo = {
  username: "Writer_001",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  phone: "138****0000",
  email: "writer@example.com",
  balance: 1200,
  registerDate: "2023-10-01",
  lastLogin: "2023-10-27 10:30"
};

const DEFAULT_MODELS: SavedModel[] = [
  {
    id: 'default-gemini',
    name: 'Gemini 2.5 Flash (Default)',
    isDefault: true,
    config: {
      provider: 'gemini',
      apiKey: process.env.API_KEY || '',
      modelName: 'gemini-2.5-flash',
      baseUrl: ''
    }
  },
  {
    id: 'default-gpt4',
    name: 'GPT-4 Turbo (Demo)',
    config: {
      provider: 'openai',
      apiKey: '',
      modelName: 'gpt-4-turbo',
      baseUrl: 'https://api.openai.com/v1'
    }
  }
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo>(MOCK_USER);
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<{ type: 'breakdown' | 'script', referenceId: string } | null>(null);
  
  // Global Model State
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [showModelManager, setShowModelManager] = useState(false);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const stopLoopRef = useRef(false);

  // Streaming State
  const [streamingBreakdown, setStreamingBreakdown] = useState<string>("");
  const [streamingScript, setStreamingScript] = useState<string>("");
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const project = projects.find(p => p.id === activeProjectId);

  // --- IndexedDB Initialization ---
  useEffect(() => {
    const initData = async () => {
      try {
        // Load Projects
        const dbProjects = await DB.loadProjects();
        setProjects(dbProjects);

        // Load Models
        const dbModels = await DB.loadModels();
        if (dbModels.length > 0) {
            setSavedModels(dbModels);
        } else {
            // Initialize Default Models if DB is empty
            await DB.saveAllModels(DEFAULT_MODELS);
            setSavedModels(DEFAULT_MODELS);
        }
        setIsDbLoaded(true);
      } catch (error) {
        console.error("Failed to load data from IndexedDB:", error);
        addNotification('error', "数据加载失败，请检查浏览器存储权限");
      }
    };
    initData();
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (consoleEndRef.current && isConsoleExpanded) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingBreakdown, streamingScript, project?.processingStatus, isConsoleExpanded, project?.currentView]);

  const addNotification = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, type, message }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleLogin = (user: UserInfo) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    addNotification('success', `欢迎回来，${user.username}`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveProjectId(null);
  };

  // --- Project Management with DB Sync ---

  const handleCreateProject = async () => {
      const defaultModelId = savedModels[0]?.id || '';
      const newProject: ProjectState = {
          id: `proj-${Date.now()}`,
          title: '未命名项目',
          type: NovelType.FANTASY,
          description: '',
          batchSize: 6,
          maxRetries: 3,
          chapters: [],
          plotBatches: [],
          scripts: [],
          logs: [],
          userInfo: currentUser,
          currentView: 'settings',
          isProcessing: false,
          processingStatus: '',
          activeAgent: undefined,
          breakdownModelId: defaultModelId,
          scriptModelId: defaultModelId
      };
      
      setProjects(prev => [...prev, newProject]);
      setActiveProjectId(newProject.id);
      
      try {
        await DB.saveProject(newProject);
        addNotification('success', '新项目已创建');
      } catch (e) {
        console.error(e);
        addNotification('error', '项目保存失败');
      }
  };

  const handleUpdateProject = async (updates: Partial<ProjectState>) => {
    if (!activeProjectId) return;
    
    // We construct the new state first to ensure we save exactly what we set in UI
    setProjects(prev => prev.map(p => {
        if (p.id === activeProjectId) {
            const updatedProject = { ...p, ...updates };
            // Fire and forget save to DB to ensure UI doesn't lag
            DB.saveProject(updatedProject).catch(e => {
                console.error("Failed to sync project update to DB", e);
                addNotification('error', '数据保存失败，请检查存储空间');
            });
            return updatedProject;
        }
        return p;
    }));
  };

  const handleSaveSettings = () => {
     if (project) {
         // Explicit save trigger
         DB.saveProject(project).then(() => {
             addNotification('success', '项目设置已保存到数据库');
         }).catch(() => {
             addNotification('error', '保存失败');
         });
     }
  };

  // Model Manager Update Handler
  const handleUpdateModels = async (newModels: SavedModel[]) => {
      // Find deleted models
      const deleted = savedModels.filter(old => !newModels.find(n => n.id === old.id));
      const addedOrUpdated = newModels;

      setSavedModels(newModels);

      try {
          // Sync with DB
          for (const m of deleted) {
              await DB.deleteModel(m.id);
          }
          for (const m of addedOrUpdated) {
              await DB.saveModel(m);
          }
      } catch (e) {
          console.error("Failed to sync models to DB", e);
          addNotification('error', '模型配置保存失败');
      }
  };

  const handleFileUpload = (files: { content: string, fileName: string }[]) => {
    if (!project) return;
    const newChapters: NovelChapter[] = files.map((file, index) => {
        let order = 9999;
        const match = file.fileName.match(/(\d+)/);
        if (match) order = parseInt(match[1]);
        return {
          id: `chap-${Date.now()}-${index}`,
          name: file.fileName.replace(/\.txt$/i, ''),
          content: file.content,
          order: order,
          isProcessed: false
        };
    });
    const updatedChapters = [...project.chapters, ...newChapters].sort((a, b) => a.order - b.order);
    handleUpdateProject({ chapters: updatedChapters });
  };

  const handleStopLoop = () => {
    stopLoopRef.current = true;
    addNotification('info', '正在停止任务...');
  };

  // Helper to resolve model config
  const getModelConfig = (modelId: string) => {
      const model = savedModels.find(m => m.id === modelId);
      if (!model) {
          throw new Error("找不到所选模型配置，请检查全局模型设置。");
      }
      return model.config;
  };

  // --- Breakdown Logic ---
  const processBreakdownBatch = async (currentProject: ProjectState, retryBatchIndex?: number): Promise<{ status: 'SUCCESS' | 'FAIL' | 'DONE' | 'ABORTED', report?: string }> => {
      const BATCH_SIZE = currentProject.batchSize || 6;
      const MAX_RETRIES = currentProject.maxRetries || 3;
      const batchIndex = retryBatchIndex !== undefined ? retryBatchIndex : currentProject.plotBatches.length;
      const startIdx = batchIndex * BATCH_SIZE;
      const nextChapters = currentProject.chapters.slice(startIdx, startIdx + BATCH_SIZE);

      if (nextChapters.length === 0) return { status: 'DONE' };

      let lastEpisode = 0;
      let lastPlotNumber = 0;
      for (let i = 0; i < batchIndex; i++) {
         const prevBatch = currentProject.plotBatches[i];
         if (prevBatch && prevBatch.points.length > 0) {
             lastPlotNumber += prevBatch.points.length;
             lastEpisode = prevBatch.points[prevBatch.points.length - 1].episode;
         }
      }

      let nextBatchStartEpisode: number | undefined = undefined;
      if (retryBatchIndex !== undefined && batchIndex < currentProject.plotBatches.length - 1) {
          const nextBatch = currentProject.plotBatches[batchIndex + 1];
          if (nextBatch && nextBatch.points.length > 0) {
              nextBatchStartEpisode = nextBatch.points[0].episode;
          }
      }

      setStreamingBreakdown(""); // Reset stream buffer
      // Update UI Status only (lightweight, no db save needed yet)
      setProjects(prev => prev.map(p => p.id === currentProject.id ? { 
          ...p, 
          isProcessing: true, 
          processingAction: 'breakdown',
          processingStatus: `正在拆解第 ${nextChapters[0].order}-${nextChapters[nextChapters.length-1].order} 章...`
      } : p));
      
      setIsConsoleExpanded(true); // Open console on start

      try {
          // Resolve config from global state using stored ID
          const config = getModelConfig(currentProject.breakdownModelId);

          const result = await GeminiService.generateBreakdownBatch(
            config,
            nextChapters, 
            currentProject.type,
            lastEpisode,
            lastPlotNumber,
            MAX_RETRIES,
            (status) => {
                 // Lightweight status update, no DB save
                 setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, processingStatus: status } : p));
            },
            (chunk) => setStreamingBreakdown(prev => prev + chunk), // Handle streaming
            currentProject.description,
            BATCH_SIZE,
            nextBatchStartEpisode,
            () => stopLoopRef.current
          );

          const points = GeminiService.parsePlotPoints(result.content, batchIndex, lastPlotNumber);
          const newBatch: PlotBatch = {
            index: batchIndex,
            chapterRange: `${nextChapters[0].order}-${nextChapters[nextChapters.length - 1].order}`,
            content: result.content,
            points: points,
            status: result.status === 'PASS' ? 'approved' : 'rejected',
            report: result.report
          };

          // --- DB Sync: Full Project Update ---
          // 1. Mark chapters as processed
          const updatedChapters = [...currentProject.chapters];
          for(let i=startIdx; i<startIdx+BATCH_SIZE && i<updatedChapters.length; i++) {
              updatedChapters[i] = { ...updatedChapters[i], isProcessed: true };
          }

          // 2. Update Batches
          const updatedBatches = [...currentProject.plotBatches];
          updatedBatches[batchIndex] = newBatch;

          // 3. Construct Complete Project Object
          const updatedProject: ProjectState = {
              ...currentProject,
              chapters: updatedChapters,
              plotBatches: updatedBatches,
              logs: [...currentProject.logs, {
                id: `log-${Date.now()}`,
                type: 'breakdown',
                referenceId: batchIndex.toString(),
                status: result.status,
                timestamp: Date.now(),
                result: result.content,
                report: result.report,
                entries: result.logs,
                isApiError: result.isApiError
              }]
          };
          
          // 4. Critical: Save to DB *before* updating UI to ensure persistence
          await DB.saveProject(updatedProject);

          // 5. Update React State
          setProjects(prev => prev.map(p => p.id === currentProject.id ? updatedProject : p));

          if (result.status === 'FAIL') return { status: 'FAIL', report: result.report };
          return { status: 'SUCCESS', report: result.report };

      } catch (error: any) {
          if (error.message === 'USER_ABORT') return { status: 'ABORTED' };
          return { status: 'FAIL', report: error.message };
      }
  };

  const handleBreakdownLoop = async (loopCount: number = 1) => {
    if (!project) return;
    stopLoopRef.current = false;
    let remaining = loopCount;
    while (remaining > 0 && !stopLoopRef.current) {
        // Always get the latest state from the projects array (in case of async updates)
        // Note: In strict mode or fast updates, relying on state like this in a loop is tricky,
        // but since processBreakdownBatch awaits DB save and state update, 'projects' should satisfy next iteration if we re-fetch.
        // However, standard React state in loop is stale. We need to fetch from the DB or use a ref-like pattern?
        // Actually, since we just updated 'projects' state in processBreakdownBatch, we need to wait for render? 
        // No, 'projects' const inside this function is stale.
        // Best practice: Re-find project from the *latest* state if possible, but we can't easily do that inside a simple loop function without using a ref for 'projects'.
        // Workaround: We will reload the project from DB or assume the loop index logic holds true based on existing array length.
        
        // Let's use a functional finder that grabs from the current 'projects' ref if we had one, but here we can just query the DB or use the updated index logic.
        // Simplified: The logic calculates batchIndex based on currentProject.plotBatches.length.
        // We must ensure 'currentProject' reflects the update from the previous iteration.
        
        // Since we can't get the fresh state easily in a loop without useEffect magic, 
        // we will manually query IDB to get the absolute latest state for the next iteration.
        const freshProjects = await DB.loadProjects();
        const currentProject = freshProjects.find(p => p.id === activeProjectId)!;

        const result = await processBreakdownBatch(currentProject);
        if (result.status !== 'SUCCESS') {
            if (result.status === 'DONE') addNotification('success', "所有章节已拆解完毕！");
            else if (result.status !== 'ABORTED') addNotification('error', `拆解停止: ${result.report}`);
            break;
        }
        remaining--;
    }
    handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
  };

  const handleRetryBreakdown = async (batchIndex: number) => {
      if (!project) return;
      stopLoopRef.current = false;
      const currentProject = projects.find(p => p.id === activeProjectId)!;
      const result = await processBreakdownBatch(currentProject, batchIndex);
      handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
      if (result.status === 'SUCCESS') addNotification('success', `批次 ${batchIndex + 1} 重试成功`);
      else if (result.status !== 'ABORTED') addNotification('error', `重试失败: ${result.report}`);
  };

  // --- Batch Script Logic (Updated) ---
  const processScriptBatch = async (currentProject: ProjectState, batchIndex: number): Promise<{ status: 'SUCCESS' | 'FAIL' | 'NO_DATA' | 'ABORTED', report?: string }> => {
      const MAX_RETRIES = currentProject.maxRetries || 3;
      const BATCH_SIZE = currentProject.batchSize || 6;
      
      const targetBatch = currentProject.plotBatches[batchIndex];
      if (!targetBatch || targetBatch.points.length === 0) return { status: 'NO_DATA' };

      setStreamingScript(""); // Reset Stream
      
      // UI Update only
      setProjects(prev => prev.map(p => p.id === currentProject.id ? { 
          ...p, 
          isProcessing: true, 
          processingAction: 'script',
          processingStatus: `正在生成第 ${batchIndex + 1} 批次的所有剧本...` 
      } : p));
      setIsConsoleExpanded(true);

      // Context: Chapters
      const [startChap, endChap] = targetBatch.chapterRange.split('-').map(Number);
      const chaps = currentProject.chapters.filter(c => c.order >= startChap && c.order <= endChap);
      const relatedContent = chaps.map(c => `Chapter ${c.name}:\n${c.content}\n\n`).join("");

      // Context: Previous Batch Info
      let previousScript = "";
      let previousBatchPointsStr = "";
      if (batchIndex > 0) {
          const prevBatch = currentProject.plotBatches[batchIndex - 1];
          if (prevBatch && prevBatch.points.length > 0) {
              const lastEp = prevBatch.points[prevBatch.points.length - 1].episode;
              const prevScriptFile = currentProject.scripts.find(s => s.episode === lastEp);
              if (prevScriptFile) previousScript = prevScriptFile.content;
              
              previousBatchPointsStr = prevBatch.points.slice(-3).map(p => p.content).join("\n");
          }
      }

      try {
          // Resolve config from global state using stored ID
          const config = getModelConfig(currentProject.scriptModelId);

          const result = await GeminiService.generateBatchScripts(
            config,
            targetBatch.points,
            relatedContent,
            previousScript,
            previousBatchPointsStr,
            MAX_RETRIES,
            (status) => {
                 setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, processingStatus: status } : p));
            },
            (chunk) => setStreamingScript(prev => prev + chunk), // Handle streaming
            currentProject.type,
            currentProject.description,
            BATCH_SIZE,
            () => stopLoopRef.current
          );

          const generatedScripts = GeminiService.parseScripts(result.content);
          
          // --- DB Sync: Full Project Update ---
          const updatedBatches = [...currentProject.plotBatches];
          // Mark plot points as used
          updatedBatches[batchIndex] = {
              ...updatedBatches[batchIndex],
              points: updatedBatches[batchIndex].points.map(pt => ({ ...pt, status: 'used' as const }))
          };

          let updatedScripts = [...currentProject.scripts];
          generatedScripts.forEach(gs => {
              const newScript: ScriptFile = {
                  episode: gs.episode,
                  title: `第 ${gs.episode} 集`,
                  content: gs.content,
                  status: result.status === 'PASS' ? 'approved' : 'rejected',
                  alignerReport: result.report
              };
              
              const idx = updatedScripts.findIndex(s => s.episode === gs.episode);
              if (idx >= 0) updatedScripts[idx] = newScript;
              else updatedScripts.push(newScript);
          });
          updatedScripts.sort((a,b) => a.episode - b.episode);

          const updatedProject: ProjectState = {
              ...currentProject,
              plotBatches: updatedBatches,
              scripts: updatedScripts,
              logs: [...currentProject.logs, {
                  id: `log-${Date.now()}`,
                  type: 'script',
                  referenceId: `batch-${batchIndex}`,
                  status: result.status,
                  timestamp: Date.now(),
                  result: result.content,
                  report: result.report,
                  entries: result.logs,
                  isApiError: result.isApiError
              }]
          };

          // 4. Critical: Save to DB *before* updating UI
          await DB.saveProject(updatedProject);

          // 5. Update React State
          setProjects(prev => prev.map(p => p.id === currentProject.id ? updatedProject : p));

          if (result.status === 'FAIL') return { status: 'FAIL', report: result.report };
          return { status: 'SUCCESS', report: result.report };

      } catch (error: any) {
          if (error.message === 'USER_ABORT') return { status: 'ABORTED' };
          return { status: 'FAIL', report: error.message };
      }
  };

  const handleScriptLoop = async (loopCount: number = 1) => {
      if (!project) return;
      stopLoopRef.current = false;
      let remaining = loopCount;
      
      while (remaining > 0 && !stopLoopRef.current) {
          // Fetch fresh state from DB to ensure loop continuity
          const freshProjects = await DB.loadProjects();
          const currentProject = freshProjects.find(p => p.id === activeProjectId)!;

          const nextBatchIndex = currentProject.plotBatches.findIndex(b => b.points.some(p => p.status === 'unused'));
          
          if (nextBatchIndex === -1) {
              addNotification('success', "所有剧情批次均已生成剧本！");
              break;
          }

          const result = await processScriptBatch(currentProject, nextBatchIndex);
          if (result.status !== 'SUCCESS') {
              if (result.status !== 'ABORTED') addNotification('error', `剧本生成停止: ${result.report}`);
              break;
          }
          remaining--;
      }
      handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
  };

  const handleManualRetryScript = async (episodeNum: number) => {
      if (!project) return;
      const batchIdx = project.plotBatches.findIndex(b => b.points.some(p => p.episode === episodeNum));
      if (batchIdx !== -1) {
          addNotification('info', `正在重试第 ${batchIdx + 1} 批次剧本...`);
          stopLoopRef.current = false;
          // Use current state project
          await processScriptBatch(project, batchIdx);
          handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
      } else {
          addNotification('error', "找不到该集对应的剧情批次");
      }
  };

  const handleScriptContentChange = (content: string) => {
      if (!project) return;
      const scripts = [...project.scripts];
      if (scripts[activeEpisodeIdx]) {
          scripts[activeEpisodeIdx] = { ...scripts[activeEpisodeIdx], content };
          handleUpdateProject({ scripts });
      }
  };

  const handleScriptStatusChange = (status: 'approved' | 'rejected' | 'draft') => {
      if (!project) return;
      const scripts = [...project.scripts];
      if (scripts[activeEpisodeIdx]) {
          scripts[activeEpisodeIdx] = { ...scripts[activeEpisodeIdx], status };
          handleUpdateProject({ scripts });
      }
  };

  const handleOpenLogs = (type: 'breakdown' | 'script', referenceId: string) => {
    setLogFilter({ type, referenceId });
    setIsLogViewerOpen(true);
  };

  const filteredLogs = project ? project.logs.filter(l => 
    (!logFilter || (l.type === logFilter.type && l.referenceId === logFilter.referenceId))
  ).sort((a,b) => b.timestamp - a.timestamp) : [];

  // --- Render Components ---

  // Wait for DB load
  if (!isDbLoaded) return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="flex flex-col items-center">
             <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-4" />
             <p className="text-gray-500 font-medium">Loading projects from database...</p>
          </div>
      </div>
  );

  if (!isAuthenticated) return <><Auth onLogin={handleLogin} defaultUser={MOCK_USER} /><ToastContainer notifications={notifications} onClose={removeNotification} /></>;
  if (!activeProjectId || !project) return <div className="flex flex-col min-h-screen"><TopBar user={currentUser} onLogout={handleLogout} onOpenModelManager={() => setShowModelManager(true)} /><ProjectList projects={projects} onSelectProject={(p) => setActiveProjectId(p.id)} onCreateProject={handleCreateProject} /><ToastContainer notifications={notifications} onClose={removeNotification} />{showModelManager && <ModelManager models={savedModels} onUpdateModels={handleUpdateModels} onClose={() => setShowModelManager(false)} />}</div>;

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto p-8 pb-32">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">项目设置</h2>
        <button 
          onClick={handleSaveSettings}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm transition-all text-sm font-bold"
        >
          <Save className="w-4 h-4 mr-2" /> 保存配置
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
        {/* Basic Info */}
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">基础信息</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">小说名称</label>
              <input 
                type="text" 
                value={project.title} 
                onChange={(e) => handleUpdateProject({ title: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all" 
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">批次集数 (默认6)</label>
                <input 
                    type="number" 
                    min="1" 
                    value={project.batchSize ?? ''} 
                    onChange={(e) => {
                         const val = e.target.value;
                         handleUpdateProject({ batchSize: val === '' ? undefined : parseInt(val) });
                    }} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">最大重试次数 (默认3)</label>
                <input 
                    type="number" 
                    min="0" 
                    value={project.maxRetries ?? ''} 
                    onChange={(e) => {
                         const val = e.target.value;
                         handleUpdateProject({ maxRetries: val === '' ? undefined : parseInt(val) });
                    }} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="3"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">小说简介</label>
              <textarea 
                value={project.description} 
                onChange={(e) => handleUpdateProject({ description: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24 bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">小说类型</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.values(NovelType).map((type) => (
                  <button 
                    key={type} 
                    onClick={() => handleUpdateProject({ type })} 
                    className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                        project.type === type 
                            ? 'bg-primary-600 text-white border-primary-600 ring-2 ring-primary-100 ring-offset-1' 
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
        </div>

        {/* AI Model Selection */}
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Cpu className="w-5 h-5" /> 模型选择
                </h3>
                <button 
                  onClick={() => setShowModelManager(true)}
                  className="text-xs text-primary-600 font-bold hover:underline flex items-center"
                >
                   <Settings2 className="w-3 h-3 mr-1" /> 管理全局模型
                </button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
                {/* Breakdown Model Selector */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">剧情拆解模型 (Breakdown)</h3>
                    <div className="relative">
                        <select 
                            value={project.breakdownModelId}
                            onChange={(e) => handleUpdateProject({ breakdownModelId: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white text-gray-900 text-sm appearance-none font-medium"
                        >
                            {savedModels.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.config.modelName})</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                             <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        负责阅读小说原文，提取冲突点、情绪钩子并进行分集。
                    </p>
                </div>

                {/* Script Model Selector */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">剧本生成模型 (Script)</h3>
                    <div className="relative">
                        <select 
                            value={project.scriptModelId}
                            onChange={(e) => handleUpdateProject({ scriptModelId: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white text-gray-900 text-sm appearance-none font-medium"
                        >
                            {savedModels.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.config.modelName})</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                             <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        负责将剧情点扩写为具体的视觉化剧本，控制节奏和格式。
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      <Sidebar project={project} onViewChange={(view) => handleUpdateProject({ currentView: view })} onBackToProjects={() => setActiveProjectId(null)} currentView={project.currentView} />
      <main className="flex-1 flex flex-col min-w-0 bg-white relative h-full">
        <TopBar user={currentUser} onLogout={handleLogout} title={project.title} onOpenModelManager={() => setShowModelManager(true)} />
        <div className="flex-1 overflow-auto relative">
            {project.currentView === 'settings' && renderSettings()}
            {project.currentView === 'source' && <SourceViewer chapters={project.chapters} onUpload={handleFileUpload} onNotification={addNotification} />}
            {project.currentView === 'breakdown' && <PlotViewer batches={project.plotBatches} onGenerateNext={handleBreakdownLoop} onStopLoop={handleStopLoop} isProcessing={project.isProcessing} processingAction={project.processingAction} onViewLogs={(idx) => handleOpenLogs('breakdown', idx.toString())} onRetryBatch={handleRetryBreakdown} />}
            {project.currentView === 'scripts' && <ScriptsViewer 
                scripts={project.scripts} 
                activeEpisodeIdx={activeEpisodeIdx} 
                onSelectEpisode={setActiveEpisodeIdx} 
                isProcessing={project.isProcessing && project.processingAction === 'script'} 
                onStopLoop={handleStopLoop} 
                onStartLoop={handleScriptLoop} 
                onGenerateNext={() => handleScriptLoop(1)} 
                onRetry={handleManualRetryScript} 
                onUpdateContent={handleScriptContentChange} 
                onUpdateStatus={handleScriptStatusChange} 
                onViewLogs={(ep) => {
                    if (!project) return;
                    const batchIdx = project.plotBatches.findIndex(b => b.points.some(p => p.episode === ep));
                    if (batchIdx !== -1) handleOpenLogs('script', `batch-${batchIdx}`);
                    else addNotification('warning', '未找到该集对应的生成日志');
                }} 
            />}
        </div>

        {/* --- Streaming Console / Floating Status --- */}
        {(() => {
            const isBreakdownView = project.currentView === 'breakdown';
            const isScriptView = project.currentView === 'scripts';
            
            // Determine active stream based on current view
            let activeStreamContent = "";
            let isActiveProcessing = false;
            let statusText = "";
            let borderColorClass = "border-gray-700";
            let textColorClass = "text-gray-300";

            if (isBreakdownView) {
                activeStreamContent = streamingBreakdown;
                isActiveProcessing = project.isProcessing && project.processingAction === 'breakdown';
                // Only show processing status if it matches the current view action
                statusText = isActiveProcessing ? project.processingStatus : (activeStreamContent ? "Generation Output" : "");
                borderColorClass = "border-blue-900/50";
                textColorClass = "text-blue-100";
            } else if (isScriptView) {
                activeStreamContent = streamingScript;
                isActiveProcessing = project.isProcessing && project.processingAction === 'script';
                statusText = isActiveProcessing ? project.processingStatus : (activeStreamContent ? "Generation Output" : "");
                borderColorClass = "border-purple-900/50";
                textColorClass = "text-purple-100";
            }

            // Only show console if there is content or active processing relevant to this view
            if (!isActiveProcessing && !activeStreamContent) return null;

            return (
                <div 
                    className={`fixed bottom-6 right-6 z-50 transition-all duration-300 flex flex-col bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden ${
                        isConsoleExpanded ? 'w-[600px] h-[500px]' : 'w-72 h-12'
                    }`}
                >
                    {/* Header / Minimized State */}
                    <div 
                        className="flex items-center justify-between px-4 py-2 bg-gray-800 cursor-pointer hover:bg-gray-750 transition-colors h-12 flex-shrink-0 border-b border-gray-700"
                        onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            {isActiveProcessing ? <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" /> : <Terminal className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-gray-200 truncate">
                                    {isActiveProcessing ? 'AI Agent Working...' : 'Console Output'}
                                </span>
                                {!isConsoleExpanded && (
                                    <span className="text-[10px] text-gray-400 truncate">
                                        {statusText}
                                    </span>
                                )}
                            </div>
                        </div>
                        {isConsoleExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0"/> : <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0"/>}
                    </div>

                    {/* Expanded Console Content */}
                    {isConsoleExpanded && (
                        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2 bg-gray-950/95 backdrop-blur-sm">
                            {/* Status Line */}
                            {isActiveProcessing && (
                                <div className="pb-2 border-b border-gray-800 mb-2 text-green-400 animate-pulse">
                                    > {statusText}
                                </div>
                            )}

                            <div className={`whitespace-pre-wrap leading-relaxed opacity-90 ${textColorClass}`}>
                                {activeStreamContent}
                            </div>
                            <div ref={consoleEndRef} />
                        </div>
                    )}
                </div>
            );
        })()}

        <ToastContainer notifications={notifications} onClose={removeNotification} />
        {isLogViewerOpen && <LogViewer logs={filteredLogs} title={logFilter?.type === 'breakdown' ? `拆解批次 ${parseInt(logFilter.referenceId) + 1}` : `剧本生成`} onClose={() => setIsLogViewerOpen(false)} />}
        
        {/* Model Manager Modal */}
        {showModelManager && (
            <ModelManager 
                models={savedModels} 
                onUpdateModels={handleUpdateModels} 
                onClose={() => setShowModelManager(false)} 
            />
        )}
      </main>
    </div>
  );
};

export default App;
