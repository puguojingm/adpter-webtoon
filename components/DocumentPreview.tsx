import React from 'react';
import { ProjectState } from '../types';

interface DocumentPreviewProps {
  project: ProjectState;
  activeTab: 'breakdown' | 'script';
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ project, activeTab }) => {
  if (activeTab === 'breakdown') {
    return (
      <div className="h-full bg-gray-50 overflow-y-auto p-8 font-mono text-sm leading-relaxed">
        <div className="max-w-3xl mx-auto bg-white shadow-sm border border-gray-200 min-h-[800px] p-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">Plot Breakdown: {project.title}</h2>
          <div className="whitespace-pre-wrap text-gray-700">
            {project.plotBatches.length > 0 
                ? project.plotBatches.map(b => `### Batch ${b.index + 1} (${b.chapterRange})\n\n${b.content}`).join('\n\n---\n\n')
                : <span className="text-gray-400 italic">暂无剧情拆解内容...</span>}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'script') {
    return (
      <div className="h-full bg-gray-50 overflow-y-auto p-8 font-mono text-sm leading-relaxed">
         <div className="max-w-3xl mx-auto space-y-8">
            {project.scripts.length === 0 && (
                <div className="bg-white shadow-sm border border-gray-200 p-10 text-center text-gray-400">
                    暂无剧本内容...
                </div>
            )}
            {project.scripts.map((script, idx) => (
                <div key={idx} className="bg-white shadow-sm border border-gray-200 p-10">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                         <h2 className="text-xl font-bold text-gray-900">第 {script.episode} 集</h2>
                         <span className={`px-2 py-1 rounded text-xs font-bold ${script.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                             {script.status.toUpperCase()}
                         </span>
                    </div>
                    <div className="whitespace-pre-wrap text-gray-700">
                        {script.content}
                    </div>
                </div>
            ))}
         </div>
      </div>
    );
  }

  return null;
};