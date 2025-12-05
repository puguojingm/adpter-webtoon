
import React, { useState } from 'react';
import { ExecutionLog, LogEntry } from '../types';
import { X, ChevronDown, ChevronRight, Clock, User, Bot, AlertTriangle, Activity, CheckCircle, Maximize2, Minimize2 } from 'lucide-react';

interface LogViewerProps {
  logs: ExecutionLog[];
  title: string;
  onClose: () => void;
}

const CollapsibleText: React.FC<{ content: string; label: string; defaultExpanded?: boolean }> = ({ content, label, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Simple heuristic to decide if content is "long" (e.g., > 300 chars or > 5 lines)
  const isLong = content.length > 300 || content.split('\n').length > 5;

  if (!isLong) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm font-mono whitespace-pre-wrap text-gray-800 leading-relaxed overflow-x-auto">
            {content}
        </div>
      );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-bold text-gray-600 border-b border-gray-100"
      >
        <span>{label} ({content.length} chars)</span>
        {isExpanded ? <Minimize2 className="w-3 h-3"/> : <Maximize2 className="w-3 h-3"/>}
      </button>
      {isExpanded ? (
        <div className="p-3 text-sm font-mono whitespace-pre-wrap text-gray-800 leading-relaxed overflow-x-auto">
          {content}
        </div>
      ) : (
        <div className="p-3 text-sm font-mono text-gray-400 italic truncate cursor-pointer hover:text-gray-600" onClick={() => setIsExpanded(true)}>
          {content.slice(0, 100).replace(/\n/g, ' ')}... (点击展开)
        </div>
      )}
    </div>
  );
};

export const LogViewer: React.FC<LogViewerProps> = ({ logs, title, onClose }) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Calculate Statistics
  const totalExecutions = logs.length;
  // Failures that are NOT API errors (Pure Quality Check Failures)
  const qualityFailures = logs.filter(l => l.status === 'FAIL' && !l.isApiError).length;
  const passCount = logs.filter(l => l.status === 'PASS').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex flex-col">
             <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800">{title} - 执行日志</h2>
             </div>
             
             {/* Stats Bar */}
             <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="flex items-center text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                   <Activity className="w-3 h-3 mr-1.5 text-blue-500" />
                   执行次数: <span className="font-bold ml-1">{totalExecutions}</span>
                </span>
                <span className="flex items-center text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100">
                   <AlertTriangle className="w-3 h-3 mr-1.5" />
                   质检失败: <span className="font-bold ml-1">{qualityFailures}</span>
                </span>
                <span className="flex items-center text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100">
                   <CheckCircle className="w-3 h-3 mr-1.5" />
                   通过: <span className="font-bold ml-1">{passCount}</span>
                </span>
             </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 space-y-4">
           {logs.length === 0 && (
             <div className="text-center py-20 text-gray-400">
                暂无执行记录
             </div>
           )}
           {logs.map((log, index) => {
             // For breakdown logs, we want to show "Batch X" where X is 1-based index
             let displayTitle = '';
             if (log.type === 'breakdown') {
                const batchNum = parseInt(log.referenceId) + 1; // 0-based to 1-based
                displayTitle = `剧情拆解 (第 ${batchNum} 批次)`;
             } else {
                displayTitle = `剧本生成 (第 ${log.referenceId} 集)`;
             }
             
             const attemptLabel = `执行 #${logs.length - index}`;

             // Group entries by attempt
             const attempts = log.entries.reduce<Record<number, LogEntry[]>>((acc, entry) => {
                 const attemptNum = entry.attempt || 1;
                 if (!acc[attemptNum]) acc[attemptNum] = [];
                 acc[attemptNum].push(entry);
                 return acc;
             }, {});
             const attemptKeys = Object.keys(attempts).map(Number).sort((a,b) => a - b);

             return (
             <div key={log.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
               <button 
                 onClick={() => toggleLog(log.id)}
                 className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
               >
                 <div className="flex items-center gap-4">
                    {expandedLogId === log.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className={`px-2 py-1 rounded text-xs font-bold w-16 text-center ${log.status === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.status}
                    </div>
                    <div className="flex flex-col items-start">
                        <div className="text-sm font-medium text-gray-800">
                           {displayTitle}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2">
                           <span>{attemptLabel}</span>
                           <span>• 循环尝试: {attemptKeys.length} 次</span>
                           {log.isApiError && <span className="text-orange-500 font-bold bg-orange-50 px-1 rounded">API Error</span>}
                        </div>
                    </div>
                 </div>
                 <div className="flex items-center text-xs text-gray-400">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(log.timestamp).toLocaleString()}
                 </div>
               </button>

               {/* Log Details (Grouped by Attempt) */}
               {expandedLogId === log.id && (
                 <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-6">
                    {attemptKeys.map((attemptNum) => (
                        <div key={attemptNum} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                            <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-700">第 {attemptNum} 次尝试</span>
                                <span className="text-[10px] text-gray-400">
                                    {new Date(attempts[attemptNum][0].timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="p-4 space-y-6">
                                {attempts[attemptNum].map((entry, idx) => (
                                    <div key={idx} className="flex gap-4">
                                        <div className="flex-shrink-0 mt-1">
                                            {entry.role === 'model' ? (
                                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                                                    <Bot className="w-4 h-4" />
                                                </div>
                                            ) : entry.role === 'user' ? (
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                    <User className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                                                    <AlertTriangle className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-gray-700">{entry.agentName}</span>
                                            </div>
                                            <CollapsibleText 
                                                content={entry.content} 
                                                label={entry.role === 'user' ? '提示词 (Prompt)' : '生成内容 (Response)'} 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Final Result / Report Summary */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">最终结果</h4>
                        {log.report && (
                            <div className="mb-2 p-3 bg-yellow-50 text-yellow-800 border border-yellow-100 rounded text-sm whitespace-pre-wrap">
                                <div className="font-bold mb-1">质检报告:</div>
                                {log.report}
                            </div>
                        )}
                        <CollapsibleText content={log.result || "无结果输出"} label="最终输出内容" defaultExpanded={true} />
                    </div>
                 </div>
               )}
             </div>
           )})}
        </div>
      </div>
    </div>
  );
};
