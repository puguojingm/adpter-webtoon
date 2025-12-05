import React from 'react';
import { Settings, Layers, Feather, FolderOpen, ArrowLeft } from 'lucide-react';
import { ProjectState } from '../types';

interface SidebarProps {
  project: ProjectState;
  onViewChange: (view: 'settings' | 'source' | 'breakdown' | 'scripts') => void;
  onBackToProjects: () => void;
  currentView: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ project, onViewChange, onBackToProjects, currentView }) => {
  const navItemClass = (view: string) => 
    `w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors mb-1 ${
      currentView === view ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`;

  return (
    <div className="w-64 bg-gray-900 text-gray-300 flex flex-col h-full border-r border-gray-800 flex-shrink-0">
      <div className="p-6 border-b border-gray-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/30">
          AI
        </div>
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight">漫剧工坊</h1>
          <p className="text-xs text-gray-500">Webtoon DMS</p>
        </div>
      </div>

      <div className="p-4">
         <button 
           onClick={onBackToProjects}
           className="w-full mb-4 flex items-center justify-center px-3 py-2 bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-white rounded-lg transition-colors"
         >
           <ArrowLeft className="w-3 h-3 mr-1" /> 返回项目列表
         </button>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-500 uppercase font-bold mb-1">当前项目</div>
          <div className="text-sm font-medium text-white truncate" title={project.title}>
            {project.title || '未命名项目'}
          </div>
          <div className="text-xs text-primary-400 mt-1 flex justify-between">
            <span>{project.type || '未定类型'}</span>
            <span>{project.chapters.length} 个文件</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        <button onClick={() => onViewChange('settings')} className={navItemClass('settings')}>
          <Settings className="w-5 h-5 mr-3" />
          项目设置
        </button>
        <button onClick={() => onViewChange('source')} className={navItemClass('source')}>
          <FolderOpen className="w-5 h-5 mr-3" />
          小说原稿
        </button>
        <button onClick={() => onViewChange('breakdown')} className={navItemClass('breakdown')}>
          <Layers className="w-5 h-5 mr-3" />
          剧情拆解 (Plot)
        </button>
        <button onClick={() => onViewChange('scripts')} className={navItemClass('scripts')}>
          <Feather className="w-5 h-5 mr-3" />
          分集剧本 (Scripts)
        </button>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex flex-col gap-2 text-xs text-gray-500">
           <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${project.isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-primary-500'}`}></div>
             <span>{project.isProcessing ? 'AI 处理中...' : '系统就绪'}</span>
           </div>
           {project.isProcessing && (
             <div className="text-primary-400 truncate">{project.processingStatus}</div>
           )}
        </div>
      </div>
    </div>
  );
};