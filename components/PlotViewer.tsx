

import React, { useState } from 'react';
import { PlotBatch } from '../types';
import { CheckCircle, AlertTriangle, PlayCircle, Layers, StopCircle, Infinity, RefreshCw, FileText, RotateCcw } from 'lucide-react';

interface PlotViewerProps {
  batches: PlotBatch[];
  onGenerateNext: (loopCount?: number) => void;
  onStopLoop: () => void;
  isProcessing: boolean;
  processingAction?: 'breakdown' | 'script' | null;
  onViewLogs: (batchIndex: number) => void;
  onRetryBatch?: (batchIndex: number) => void;
}

export const PlotViewer: React.FC<PlotViewerProps> = ({ batches, onGenerateNext, onStopLoop, isProcessing, processingAction, onViewLogs, onRetryBatch }) => {
  const isBreakdownProcessing = isProcessing && processingAction === 'breakdown';
  const [loopCount, setLoopCount] = useState(3);

  const handleStartLoop = () => {
    onGenerateNext(loopCount);
  };

  const handleStartAll = () => {
    onGenerateNext(999); // Treat as "All"
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header Toolbar */}
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
             <Layers className="w-5 h-5 text-primary-600" />
             剧情拆解 (Plot Breakdown)
           </h2>
           <p className="text-xs text-gray-500 mt-1">AI 自动提取冲突点与情绪钩子</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {isBreakdownProcessing ? (
             <button
               onClick={onStopLoop}
               className="flex items-center px-6 h-10 rounded-lg text-sm font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all shadow-sm animate-pulse"
             >
               <StopCircle className="w-4 h-4 mr-2" />
               停止拆解
             </button>
          ) : (
            <>
              {/* Styled Loop Control */}
              <div className="flex items-center h-10 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
                <div className="relative h-full">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={loopCount}
                    onChange={(e) => setLoopCount(parseInt(e.target.value) || 1)}
                    className="w-12 h-full text-center text-sm font-bold text-gray-800 bg-gray-50 border-r border-gray-200 focus:outline-none focus:bg-white transition-colors appearance-none"
                    placeholder="N"
                  />
                </div>
                <button
                  onClick={handleStartLoop}
                  className="px-4 h-full text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-primary-600 transition-colors flex items-center whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  循环拆解
                </button>
              </div>

              <button
                onClick={handleStartAll}
                className="flex items-center px-4 h-10 rounded-lg text-sm font-bold bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                title="自动拆解剩余所有章节"
              >
                <Infinity className="w-4 h-4 mr-2" />
                全部拆解
              </button>

              <button
                onClick={() => onGenerateNext(1)}
                className="flex items-center px-5 h-10 rounded-lg text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg transition-all"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                拆解下一批
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {batches.map((batch) => (
          <div key={batch.index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <span className="font-bold text-gray-900 text-sm">第 {batch.index + 1} 批次</span>
                 <span className="text-xs text-gray-500 font-mono">({batch.chapterRange}章)</span>
              </div>
              <div className="flex items-center gap-2">
                 {batch.status === 'approved' ? (
                   <span className="flex items-center text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                     <CheckCircle className="w-3 h-3 mr-1" /> 通过 (PASS)
                   </span>
                 ) : (
                   <span className="flex items-center text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                     <AlertTriangle className="w-3 h-3 mr-1" /> 质检失败
                   </span>
                 )}
                 
                 {/* Re-breakdown Button (Available for any batch state to allow regeneration) */}
                 {onRetryBatch && (
                    <button
                      onClick={() => onRetryBatch(batch.index)}
                      disabled={isProcessing}
                      className="flex items-center px-2 py-1 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 transition-colors shadow-sm disabled:opacity-50 ml-2"
                      title="重新生成该批次剧情"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> 重新拆解
                    </button>
                 )}

                 <button 
                   onClick={() => onViewLogs(batch.index)}
                   className="flex items-center px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs rounded transition-colors ml-2"
                 >
                   <FileText className="w-3 h-3 mr-1" /> 查看日志
                 </button>
              </div>
            </div>

            {/* Table Layout */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2 font-medium w-20">序号</th>
                    <th className="px-4 py-2 font-medium w-20">集数</th>
                    <th className="px-4 py-2 font-medium">完整剧情内容</th>
                    <th className="px-4 py-2 font-medium w-24 text-right">状态</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-50">
                  {batch.points.map((point) => (
                    <tr key={point.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-bold rounded">
                          {/* We extract the number from the ID if possible for display, or just index */}
                          {point.content.match(/【剧情(\d+)】/)?.[1] || point.id}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">第 {point.episode} 集</td>
                      <td className="px-4 py-3 text-gray-800">
                        {point.content}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                          point.status === 'used' ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'
                        }`}>
                          {point.status === 'used' ? '已使用' : '未用'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {batch.points.length === 0 && (
                <div className="p-6 text-sm text-gray-500 font-mono whitespace-pre-wrap bg-gray-50 border-t border-gray-100">
                   {batch.content} 
                </div>
            )}
            
            {/* Report Footer */}
            {batch.report && (
                <div className="bg-gray-50 p-4 border-t border-gray-200 text-xs">
                    <div className="font-bold text-gray-700 mb-1 flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1 text-yellow-500" /> 质量检查报告:
                    </div>
                    <div className="text-gray-600 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-yellow-200">
                      {batch.report}
                    </div>
                </div>
            )}
          </div>
        ))}

        {batches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Layers className="w-12 h-12 mb-3 text-gray-200" />
            <p>暂无拆解内容</p>
            <p className="text-xs mt-1">请点击上方按钮开始拆解</p>
          </div>
        )}
      </div>
    </div>
  );
};