
import React, { useState } from 'react';
import { ScriptFile } from '../types';
import { RefreshCw, Plus, StopCircle, RotateCcw, ThumbsUp, XCircle, CheckCircle, Save, Infinity, FileText } from 'lucide-react';

interface ScriptsViewerProps {
  scripts: ScriptFile[];
  activeEpisodeIdx: number;
  onSelectEpisode: (idx: number) => void;
  isProcessing: boolean;
  onStopLoop: () => void;
  onStartLoop: (count: number) => void;
  onGenerateNext: () => void;
  onRetry: (episode: number) => void;
  onUpdateContent: (content: string) => void;
  onUpdateStatus: (status: 'approved' | 'rejected' | 'draft') => void;
  onViewLogs: (episode: number) => void;
}

export const ScriptsViewer: React.FC<ScriptsViewerProps> = ({
  scripts,
  activeEpisodeIdx,
  onSelectEpisode,
  isProcessing,
  onStopLoop,
  onStartLoop,
  onGenerateNext,
  onRetry,
  onUpdateContent,
  onUpdateStatus,
  onViewLogs
}) => {
  const [scriptLoopCount, setScriptLoopCount] = useState(3);
  const activeScript = scripts[activeEpisodeIdx];

  const handleStartAll = () => {
      onStartLoop(999);
  };

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
           <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">剧本生成控制</h3>
           
           {isProcessing ? (
             <button 
               onClick={onStopLoop}
               className="w-full flex items-center justify-center px-4 h-10 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-bold transition-all shadow-sm animate-pulse"
             >
               <StopCircle className="w-4 h-4 mr-2" /> 停止生成
             </button>
           ) : (
             <div className="space-y-3">
                {/* Primary Action */}
               <button 
                 onClick={onGenerateNext}
                 className="w-full flex items-center justify-center px-4 h-10 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-bold transition-all shadow-md hover:shadow-lg"
                 title="生成当前批次的所有剧本"
               >
                 <Plus className="w-4 h-4 mr-2" />
                 生成剧本
               </button>

               {/* Secondary Action: All */}
               <button 
                 onClick={handleStartAll}
                 className="w-full flex items-center justify-center px-4 h-10 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 text-sm font-bold transition-all shadow-sm"
               >
                 <Infinity className="w-4 h-4 mr-2" /> 全部生成
               </button>

               {/* Tertiary Action: Loop */}
               <div className="flex items-center h-10 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
                  <div className="relative h-full">
                    <input 
                      type="number"
                      min="1"
                      max="99"
                      value={scriptLoopCount}
                      onChange={(e) => setScriptLoopCount(parseInt(e.target.value) || 1)} 
                      className="w-12 h-full text-center text-sm font-bold text-gray-800 bg-gray-50 border-r border-gray-200 focus:outline-none focus:bg-white transition-colors appearance-none"
                    />
                  </div>
                  <button 
                     onClick={() => onStartLoop(scriptLoopCount)}
                     className="flex-1 flex items-center justify-center h-full bg-white text-gray-600 text-xs font-bold hover:bg-gray-50 hover:text-primary-600 transition-colors whitespace-nowrap px-3"
                  >
                     <RefreshCw className="w-3.5 h-3.5 mr-2" /> 循环生成(批次)
                  </button>
               </div>
             </div>
           )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {scripts.length === 0 && (
             <div className="p-8 text-center text-gray-400 text-xs">
                暂无剧本，请点击上方按钮生成
             </div>
          )}
          {scripts.map((script, idx) => (
            <button
              key={script.episode}
              onClick={() => onSelectEpisode(idx)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
                idx === activeEpisodeIdx ? 'bg-primary-50 border-l-4 border-l-primary-600' : ''
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`font-bold ${idx === activeEpisodeIdx ? 'text-primary-900' : 'text-gray-800'}`}>
                    第 {script.episode} 集
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  script.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {script.status.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-gray-500 truncate group-hover:text-gray-700">{script.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      {activeScript ? (
        <div className="flex-1 flex h-full min-w-0">
          <div className="flex-1 flex flex-col bg-white">
             <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-gray-800 text-lg">第 {activeScript.episode} 集</h3>
                    <div className="flex gap-2">
                         {/* Manual Status Controls */}
                         {activeScript.status === 'rejected' && (
                            <button 
                              onClick={() => onRetry(activeScript.episode)}
                              className="flex items-center px-3 py-1 bg-yellow-50 text-yellow-700 rounded-md text-xs font-bold hover:bg-yellow-100 border border-yellow-200 shadow-sm transition-all"
                              title="重试生成该集所属的整个批次"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> 重试批次
                            </button>
                         )}
                         
                         <div className="h-6 w-px bg-gray-200 mx-2"></div>

                         <button 
                            onClick={() => onUpdateStatus('approved')}
                            className={`p-1.5 rounded transition-colors ${activeScript.status === 'approved' ? 'text-green-600 bg-green-50 ring-1 ring-green-200' : 'text-gray-400 hover:bg-gray-100 hover:text-green-600'}`}
                            title="强制标记为通过"
                         >
                            <ThumbsUp className="w-4 h-4" />
                         </button>
                         <button 
                            onClick={() => onUpdateStatus('rejected')}
                            className={`p-1.5 rounded transition-colors ${activeScript.status === 'rejected' ? 'text-red-600 bg-red-50 ring-1 ring-red-200' : 'text-gray-400 hover:bg-gray-100 hover:text-red-600'}`}
                            title="标记为失败"
                         >
                            <XCircle className="w-4 h-4" />
                         </button>
                         
                         <div className="h-6 w-px bg-gray-200 mx-2"></div>
                         
                         <button 
                           onClick={() => onViewLogs(activeScript.episode)}
                           className="flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold hover:bg-gray-200 transition-all"
                         >
                           <FileText className="w-3 h-3 mr-1" /> 查看日志
                         </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-sm ${
                         activeScript.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                        {activeScript.status === 'approved' ? <CheckCircle className="w-3 h-3 mr-1"/> : <XCircle className="w-3 h-3 mr-1"/>} 
                        {activeScript.status === 'approved' ? '已通过' : '未通过'}
                    </span>
                </div>
             </div>
             <textarea
                value={activeScript.content}
                onChange={(e) => onUpdateContent(e.target.value)}
                className="flex-1 p-8 font-mono text-sm leading-relaxed resize-none focus:outline-none text-gray-800 bg-white"
                placeholder="剧本内容..."
             />
             <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between font-mono">
                <span>字数: {activeScript.content.length}</span>
                <span className="flex items-center text-primary-600 font-medium"><Save className="w-3 h-3 mr-1"/> 修改自动保存到本地</span>
             </div>
          </div>
          
          {/* Report Panel */}
          {activeScript.alignerReport && (
             <div className="w-80 bg-gray-50 border-l border-gray-200 overflow-y-auto p-4 flex-shrink-0">
                <div className="font-bold text-sm text-gray-900 mb-4 pb-2 border-b flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-primary-600" />
                    质量检查报告
                </div>
                <div className="text-xs whitespace-pre-wrap text-gray-600 leading-relaxed font-mono">
                    {activeScript.alignerReport}
                </div>
             </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400">
            请点击左侧"生成下一批剧本"开始创作
        </div>
      )}
    </div>
  );
};
