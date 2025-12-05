
import React, { useState, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { FileUploader } from './components/FileUploader';
import { SourceViewer } from './components/SourceViewer';
import { PlotViewer } from './components/PlotViewer';
import { ProjectList } from './components/ProjectList';
import { ScriptsViewer } from './components/ScriptsViewer';
import { Auth } from './components/Auth';
import { TopBar } from './components/TopBar';
import { ToastContainer } from './components/Toast';
import { LogViewer } from './components/LogViewer';
import { ProjectState, NovelType, ScriptFile, NovelChapter, PlotBatch, UserInfo, Notification, ExecutionLog } from './types';
import * as GeminiService from './services/geminiService';
import { ChevronRight, Loader2 } from 'lucide-react';

// Mock User Data
const MOCK_USER: UserInfo = {
  username: "Writer_001",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  phone: "138****0000",
  email: "writer@example.com",
  balance: 1200,
  registerDate: "2023-10-01",
  lastLogin: "2023-10-27 10:30"
};

const App: React.FC = () => {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo>(MOCK_USER);

  // --- Global State ---
  const [projects, setProjects] = useState<ProjectState[]>([]);
  
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Log Viewer State
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<{ type: 'breakdown' | 'script', referenceId: string } | null>(null);

  // Loop Control
  const stopLoopRef = useRef(false);

  // Derived active project
  const project = projects.find(p => p.id === activeProjectId);

  // --- Handlers ---

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

  const handleCreateProject = () => {
      const newProject: ProjectState = {
          id: `proj-${Date.now()}`,
          title: '未命名项目',
          type: NovelType.FANTASY,
          description: '',
          batchSize: 6, // Default batch size
          maxRetries: 3, // Default max retries
          chapters: [],
          plotBatches: [],
          scripts: [],
          logs: [],
          userInfo: currentUser,
          currentView: 'settings',
          isProcessing: false,
          processingStatus: '',
          activeAgent: undefined
      };
      setProjects([...projects, newProject]);
      setActiveProjectId(newProject.id);
      addNotification('success', '新项目已创建');
  };

  const handleUpdateProject = (updates: Partial<ProjectState>) => {
    if (!activeProjectId) return;
    
    setProjects(prev => prev.map(p => {
        if (p.id === activeProjectId) {
            return { ...p, ...updates };
        }
        return p;
    }));
  };

  const handleFileUpload = (files: { content: string, fileName: string }[]) => {
    if (!project) return;
    
    const newChapters: NovelChapter[] = files.map((file, index) => {
        // Attempt to parse chapter number for sorting
        let order = 9999;
        const match = file.fileName.match(/(\d+)/);
        if (match) order = parseInt(match[1]);

        return {
          id: `chap-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.fileName.replace(/\.txt$/i, ''),
          content: file.content,
          order: order,
          isProcessed: false
        };
    });

    // Sort chapters
    const updatedChapters = [...project.chapters, ...newChapters].sort((a, b) => a.order - b.order);
    handleUpdateProject({ chapters: updatedChapters });
  };

  // --- AI Operations Helpers ---

  // Helper to stop any running loop
  const handleStopLoop = () => {
    stopLoopRef.current = true;
    addNotification('info', '正在停止任务...');
  };

  // --- Breakdown Logic ---

  const processBreakdownBatch = async (currentProject: ProjectState, retryBatchIndex?: number): Promise<{ status: 'SUCCESS' | 'FAIL' | 'DONE' | 'ABORTED', report?: string }> => {
      const BATCH_SIZE = currentProject.batchSize || 6;
      const MAX_RETRIES = currentProject.maxRetries || 3;
      
      const batchIndex = retryBatchIndex !== undefined ? retryBatchIndex : currentProject.plotBatches.length;
      
      // Calculate chapters for this batch
      const startIdx = batchIndex * BATCH_SIZE;
      const nextChapters = currentProject.chapters.slice(startIdx, startIdx + BATCH_SIZE);

      if (nextChapters.length === 0) return { status: 'DONE' };

      // --- Calculate Context for Continuity ---
      let lastEpisode = 0;
      let lastPlotNumber = 0;

      // Iterate previous batches to sum up plot points and find last episode
      for (let i = 0; i < batchIndex; i++) {
         const prevBatch = currentProject.plotBatches[i];
         if (prevBatch && prevBatch.points.length > 0) {
             lastPlotNumber += prevBatch.points.length;
             lastEpisode = prevBatch.points[prevBatch.points.length - 1].episode;
         }
      }

      // --- Bridging Context (If regenerating a middle batch) ---
      let nextBatchStartEpisode: number | undefined = undefined;
      if (retryBatchIndex !== undefined && batchIndex < currentProject.plotBatches.length - 1) {
          const nextBatch = currentProject.plotBatches[batchIndex + 1];
          if (nextBatch && nextBatch.points.length > 0) {
              nextBatchStartEpisode = nextBatch.points[0].episode;
          }
      }

      handleUpdateProject({ 
        isProcessing: true, 
        processingAction: 'breakdown',
        processingStatus: `正在拆解第 ${nextChapters[0].order}-${nextChapters[nextChapters.length-1].order} 章 (接续第 ${lastEpisode} 集)...` 
      });

      try {
          const result = await GeminiService.generateBreakdownBatch(
            nextChapters, 
            currentProject.type,
            lastEpisode,
            lastPlotNumber,
            MAX_RETRIES,
            (status) => handleUpdateProject({ processingStatus: status }),
            currentProject.description,
            BATCH_SIZE,
            nextBatchStartEpisode,
            () => stopLoopRef.current // Check stop callback
          );

          // Create Log Entry
          const newLog: ExecutionLog = {
              id: `log-${Date.now()}`,
              type: 'breakdown',
              referenceId: batchIndex.toString(),
              status: result.status,
              timestamp: Date.now(),
              result: result.content,
              report: result.report,
              entries: result.logs
          };

          const points = GeminiService.parsePlotPoints(result.content, batchIndex, lastPlotNumber);
          const startOrder = nextChapters[0].order;
          const endOrder = nextChapters[nextChapters.length - 1].order;

          const newBatch: PlotBatch = {
            index: batchIndex,
            chapterRange: `${startOrder}-${endOrder}`,
            content: result.content,
            points: points,
            status: result.status === 'PASS' ? 'approved' : 'rejected',
            report: result.report
          };

          const updatedChapters = currentProject.chapters.map(c => {
              if (nextChapters.find(nc => nc.id === c.id)) {
                  return { ...c, isProcessed: true };
              }
              return c;
          });

          // Update State
          setProjects(prev => prev.map(p => {
             if (p.id === currentProject.id) {
                 const updatedBatches = [...p.plotBatches];
                 updatedBatches[batchIndex] = newBatch; // Update existing or assign new index

                 return {
                     ...p,
                     chapters: updatedChapters,
                     plotBatches: updatedBatches,
                     logs: [...p.logs, newLog]
                 };
             }
             return p;
          }));

          if (result.status === 'FAIL') return { status: 'FAIL', report: result.report };
          return { status: 'SUCCESS', report: result.report };

      } catch (error: any) {
          if (error.message === 'USER_ABORT') {
              return { status: 'ABORTED' };
          }
          console.error("Uncaught error in breakdown:", error);
          return { status: 'FAIL', report: error.message };
      }
  };

  const handleBreakdownLoop = async (loopCount: number = 1) => {
    if (!project) return;
    stopLoopRef.current = false;
    let remaining = loopCount;
    let successCount = 0;

    while (remaining > 0 && !stopLoopRef.current) {
        const currentProject = projects.find(p => p.id === activeProjectId);
        if (!currentProject) break;

        // Check strict sequentiality
        const lastBatch = currentProject.plotBatches[currentProject.plotBatches.length - 1];
        if (lastBatch && lastBatch.status === 'rejected') {
             addNotification('error', `第 ${lastBatch.index + 1} 批次质检失败，请先手动重试该批次，确保通过后再继续。`);
             break;
        }

        const result = await processBreakdownBatch(currentProject);
        
        if (result.status === 'ABORTED') {
            addNotification('info', "任务已停止");
            break;
        }
        if (result.status === 'DONE') {
            addNotification('success', "所有章节已拆解完毕！");
            break;
        }
        if (result.status === 'FAIL') {
            if (result.report?.includes('API ERROR')) {
               addNotification('error', `系统错误: ${result.report}`);
            } else {
               addNotification('error', "质量检查未通过，流程已停止。请查看报告并手动重试。");
            }
            break;
        }
        
        successCount++;
        remaining--;
    }

    if (successCount > 0 && !stopLoopRef.current) {
         addNotification('success', `已完成 ${successCount} 批次拆解任务`);
    }

    handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
  };
  
  const handleRetryBreakdown = async (batchIndex: number) => {
      if (!project) return;
      stopLoopRef.current = false;
      const currentProject = projects.find(p => p.id === activeProjectId)!;
      
      addNotification('info', `正在重试拆解第 ${batchIndex + 1} 批次...`);
      const result = await processBreakdownBatch(currentProject, batchIndex);
      
      handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
      
      if (result.status === 'ABORTED') {
          addNotification('info', "重试已取消");
          return;
      }
      if (result.status === 'SUCCESS') {
          addNotification('success', `第 ${batchIndex + 1} 批次重试成功`);
      } else {
           if (result.report?.includes('API ERROR')) {
               addNotification('error', `系统错误: ${result.report}`);
            } else {
              addNotification('error', `第 ${batchIndex + 1} 批次重试失败`);
            }
      }
  };


  // --- Script Logic ---

  const processScriptEpisode = async (currentProject: ProjectState, episodeNum: number): Promise<{ status: 'SUCCESS' | 'FAIL' | 'NO_DATA' | 'ABORTED', report?: string }> => {
      const MAX_RETRIES = currentProject.maxRetries || 3;
      const BATCH_SIZE = currentProject.batchSize || 6;
      const targetEp = episodeNum;
      
      // Find ALL points for this episode across ALL batches to handle cross-batch context
      // This includes 'used' points if we are regenerating
      const pointsToUse = currentProject.plotBatches
        .flatMap(b => b.points)
        .filter(p => p.episode === targetEp);

      if (pointsToUse.length === 0) {
          return { status: 'NO_DATA' };
      }

      handleUpdateProject({ 
          isProcessing: true, 
          processingAction: 'script',
          processingStatus: `正在生成第 ${targetEp} 集剧本...` 
      });

      // Get context from related chapters by identifying ALL relevant batches
      const uniqueBatchIndices = Array.from(new Set(pointsToUse.map(p => p.batchIndex)));
      let relatedContent = "";
      
      // Sort indices to maintain narrative order
      uniqueBatchIndices.sort((a, b) => a - b).forEach((idx: number) => {
         const batch = currentProject.plotBatches.find(b => b.index === idx);
         if (batch) {
             const [start, end] = batch.chapterRange.split('-').map(Number);
             if (!isNaN(start) && !isNaN(end)) {
                 const chaps = currentProject.chapters.filter(c => c.order >= start && c.order <= end);
                 relatedContent += chaps.map(c => `Chapter ${c.name}:\n${c.content}\n\n`).join("");
             }
         }
      });

      try {
          const result = await GeminiService.generateScriptEpisode(
            targetEp,
            pointsToUse,
            relatedContent,
            MAX_RETRIES,
            (status) => handleUpdateProject({ processingStatus: status }),
            currentProject.type,
            currentProject.description,
            BATCH_SIZE,
            () => stopLoopRef.current // Check stop callback
          );

           // Create Log Entry
           const newLog: ExecutionLog = {
              id: `log-${Date.now()}`,
              type: 'script',
              referenceId: targetEp.toString(),
              status: result.status,
              timestamp: Date.now(),
              result: result.content,
              report: result.report,
              entries: result.logs
          };

          const newScript: ScriptFile = {
            episode: targetEp,
            title: `第 ${targetEp} 集`, 
            content: result.content,
            status: result.status === 'PASS' ? 'approved' : 'rejected',
            alignerReport: result.report
          };

          // Update State
          setProjects(prev => prev.map(p => {
              if (p.id === currentProject.id) {
                  // Mark ALL points for this episode as used (since we just generated the script for them)
                  // IMPORTANT: Using uniqueInternalId comparison here is robust
                  const updatedBatches = p.plotBatches.map(b => ({
                    ...b,
                    points: b.points.map(point => 
                        pointsToUse.find(usedPoint => usedPoint.id === point.id) ? { ...point, status: 'used' as const } : point
                    )
                  }));
                  
                  // Replace existing script or append
                  const existingScriptIndex = p.scripts.findIndex(s => s.episode === targetEp);
                  let updatedScripts = [...p.scripts];
                  if (existingScriptIndex >= 0) {
                      updatedScripts[existingScriptIndex] = newScript;
                  } else {
                      updatedScripts.push(newScript);
                      updatedScripts.sort((a,b) => a.episode - b.episode);
                  }

                  return {
                      ...p,
                      plotBatches: updatedBatches,
                      scripts: updatedScripts,
                      logs: [...p.logs, newLog]
                  };
              }
              return p;
          }));

          // Set Active Episode to the one just generated
          const updatedProj = projects.find(p => p.id === activeProjectId);
          if(updatedProj) {
              const idx = updatedProj.scripts.findIndex(s => s.episode === targetEp);
              if (idx !== -1) setActiveEpisodeIdx(idx);
              else setActiveEpisodeIdx(updatedProj.scripts.length); // fallback
          }

          if (result.status === 'FAIL') return { status: 'FAIL', report: result.report };
          return { status: 'SUCCESS', report: result.report };

      } catch (error: any) {
          if (error.message === 'USER_ABORT') {
             return { status: 'ABORTED' };
          }
          console.error("Uncaught error in script gen:", error);
          return { status: 'FAIL', report: error.message };
      }
  };

  const handleScriptLoop = async (loopCount: number = 1) => {
      if (!project) return;
      stopLoopRef.current = false;
      let remaining = loopCount;
      let successCount = 0;

      while (remaining > 0 && !stopLoopRef.current) {
          const currentProject = projects.find(p => p.id === activeProjectId);
          if (!currentProject) break;

          // Determine next episode number
          // We look for the first episode that has 'unused' points.
          // Or if all used, we check if the last generated script is the last possible one.
          
          let nextEp = 1;
          const lastScript = currentProject.scripts[currentProject.scripts.length - 1];
          if (lastScript) {
             nextEp = lastScript.episode + 1;
          }

          // Check if we have points for this next episode.
          const hasPoints = currentProject.plotBatches.flatMap(b => b.points).some(p => p.episode === nextEp);
          
          if (!hasPoints) {
              const allPoints = currentProject.plotBatches.flatMap(b => b.points);
              const potentialNextEps = allPoints
                .map(p => p.episode)
                .filter(ep => ep > (lastScript?.episode || 0))
                .sort((a,b) => a - b);
                
              if (potentialNextEps.length > 0) {
                  nextEp = potentialNextEps[0];
              } else {
                   addNotification('success', "所有剧情点已使用完毕！");
                   break;
              }
          }

          const result = await processScriptEpisode(currentProject, nextEp);

          if (result.status === 'ABORTED') {
              addNotification('info', "任务已停止");
              break;
          }

          if (result.status === 'FAIL') {
              if (result.report?.includes('API ERROR')) {
                  addNotification('error', `系统错误: ${result.report}`);
              } else {
                  addNotification('error', "剧本质量检查未通过，流程已停止。请手动修改或重试。");
              }
              break;
          }
          successCount++;
          remaining--;
      }

      if (successCount > 0 && !stopLoopRef.current) {
          addNotification('success', `已生成 ${successCount} 集剧本`);
      }
      handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
  };

  const handleManualRetryScript = async (episodeNum: number) => {
      if (!project) return;
      stopLoopRef.current = false;
      const currentProject = projects.find(p => p.id === activeProjectId)!;
      addNotification('info', `正在重试生成第 ${episodeNum} 集...`);
      const result = await processScriptEpisode(currentProject, episodeNum);
      handleUpdateProject({ isProcessing: false, processingAction: null, processingStatus: '' });
      
      if (result.status === 'ABORTED') {
          addNotification('info', "重试已取消");
      }
  };

  // --- Script Edit & Manual Status ---

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
          addNotification('success', `第 ${scripts[activeEpisodeIdx].episode} 集状态已更新`);
      }
  };

  // --- Log Viewer Handlers ---
  const handleOpenLogs = (type: 'breakdown' | 'script', referenceId: string) => {
    setLogFilter({ type, referenceId });
    setIsLogViewerOpen(true);
  };

  const filteredLogs = project ? project.logs.filter(l => 
    (!logFilter || (l.type === logFilter.type && l.referenceId === logFilter.referenceId.toString()))
  ).sort((a,b) => b.timestamp - a.timestamp) : [];

  const logViewerTitle = logFilter ? 
    (logFilter.type === 'breakdown' ? `剧情拆解 (批次 ${parseInt(logFilter.referenceId) + 1})` : `分集剧本 (第 ${logFilter.referenceId} 集)`) 
    : '所有日志';


  // --- Auth Gate ---
  if (!isAuthenticated) {
    return (
        <>
            <Auth onLogin={handleLogin} defaultUser={MOCK_USER} />
            <ToastContainer notifications={notifications} onClose={removeNotification} />
        </>
    );
  }

  // --- View Switching ---

  if (!activeProjectId || !project) {
      return (
        <div className="flex flex-col min-h-screen">
          <TopBar user={currentUser} onLogout={handleLogout} title={project ? undefined : undefined} />
          <ProjectList 
            projects={projects} 
            onSelectProject={(p) => setActiveProjectId(p.id)}
            onCreateProject={handleCreateProject}
          />
          <ToastContainer notifications={notifications} onClose={removeNotification} />
        </div>
      );
  }

  // --- Render Workspace ---

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">项目设置</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">小说名称</label>
          <input 
            type="text" 
            value={project.title}
            onChange={(e) => handleUpdateProject({ title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 bg-white"
            placeholder="请输入小说名称"
          />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">批次集数 (每次拆解章节数)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={project.batchSize || 6}
              onChange={(e) => handleUpdateProject({ batchSize: parseInt(e.target.value) || 6 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">默认每次拆解 6 章内容。</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">最大重试次数 (Max Retries)</label>
            <input
              type="number"
              min="0"
              max="10"
              value={project.maxRetries || 3}
              onChange={(e) => handleUpdateProject({ maxRetries: parseInt(e.target.value) || 3 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 bg-white"
            />
             <p className="text-xs text-gray-500 mt-1">AI 质检失败后的自动重试次数。</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">小说简介</label>
          <textarea 
            value={project.description}
            onChange={(e) => handleUpdateProject({ description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none h-24 resize-none text-gray-900 bg-white"
            placeholder="请输入小说简介（可选）"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">小说类型</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.values(NovelType).map((type) => (
              <button
                key={type}
                onClick={() => handleUpdateProject({ type })}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                  project.type === type 
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-4 flex justify-end">
           <button 
             onClick={() => handleUpdateProject({ currentView: 'source' })}
             className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md transition-all"
           >
             下一步: 上传小说 <ChevronRight className="w-4 h-4 ml-1" />
           </button>
        </div>
      </div>
    </div>
  );

  const renderSource = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
         <h2 className="text-lg font-bold text-gray-800">小说原稿</h2>
         <div className="w-64">
             <FileUploader onUpload={handleFileUpload} onNotification={addNotification} />
         </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <SourceViewer chapters={project.chapters} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar 
        project={project} 
        onViewChange={(view) => handleUpdateProject({ currentView: view })}
        onBackToProjects={() => setActiveProjectId(null)}
        currentView={project.currentView}
      />
      
      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
        <TopBar user={currentUser} onLogout={handleLogout} title={project.title} />

        {project.currentView === 'settings' && renderSettings()}
        {project.currentView === 'source' && renderSource()}
        {project.currentView === 'breakdown' && (
          <PlotViewer 
            batches={project.plotBatches} 
            onGenerateNext={handleBreakdownLoop}
            onStopLoop={handleStopLoop}
            isProcessing={project.isProcessing}
            processingAction={project.processingAction}
            onViewLogs={(batchIdx) => handleOpenLogs('breakdown', batchIdx.toString())}
            onRetryBatch={handleRetryBreakdown}
          />
        )}
        {project.currentView === 'scripts' && (
          <ScriptsViewer
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
             onViewLogs={(episode) => handleOpenLogs('script', episode.toString())}
          />
        )}

        {/* Global Loading Overlay */}
        {project.isProcessing && (
           <div className="absolute bottom-4 right-4 bg-gray-900/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center text-sm z-50 backdrop-blur-sm animate-fade-in">
              <Loader2 className="w-4 h-4 mr-3 animate-spin text-primary-400" />
              <span>{project.processingStatus}</span>
           </div>
        )}
        
        {/* Toast Container */}
        <ToastContainer notifications={notifications} onClose={removeNotification} />

        {/* Log Viewer Modal */}
        {isLogViewerOpen && (
          <LogViewer 
            logs={filteredLogs} 
            title={logViewerTitle}
            onClose={() => setIsLogViewerOpen(false)} 
          />
        )}
      </main>
    </div>
  );
};

export default App;
