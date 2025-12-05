import React, { useState } from 'react';
import { NovelChapter } from '../types';
import { FileText, CheckCircle2 } from 'lucide-react';

interface SourceViewerProps {
  chapters: NovelChapter[];
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ chapters }) => {
  const [selectedId, setSelectedId] = useState<string | null>(chapters.length > 0 ? chapters[0].id : null);

  const selectedChapter = chapters.find(c => c.id === selectedId);

  return (
    <div className="flex h-full bg-white border-t border-gray-200">
      {/* Chapter List */}
      <div className="w-72 border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200 font-bold text-gray-700 bg-gray-100 flex justify-between items-center">
          <span>章节列表 ({chapters.length})</span>
          <span className="text-xs font-normal text-gray-500">
             {chapters.filter(c => c.isProcessed).length} 已拆解
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chapters.map(chapter => (
            <button
              key={chapter.id}
              onClick={() => setSelectedId(chapter.id)}
              className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 hover:bg-gray-100 transition-colors flex items-center justify-between group ${
                selectedId === chapter.id ? 'bg-primary-50 text-primary-700 border-l-4 border-l-primary-600' : 'text-gray-600'
              }`}
            >
              <div className="flex items-center min-w-0">
                <FileText className={`w-4 h-4 mr-2 flex-shrink-0 ${chapter.isProcessed ? 'text-green-500' : 'text-gray-400'}`} />
                <span className="truncate font-medium">{chapter.name}</span>
              </div>
              {chapter.isProcessed && (
                <div className="ml-2" title="已拆解">
                   <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                </div>
              )}
            </button>
          ))}
          {chapters.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-xs">
              暂无章节，请点击右上角上传
            </div>
          )}
        </div>
      </div>

      {/* Content Viewer */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedChapter ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">{selectedChapter.name}</h2>
              {selectedChapter.isProcessed ? (
                 <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md font-medium">已拆解</span>
              ) : (
                 <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-md font-medium">未拆解</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="max-w-3xl mx-auto whitespace-pre-wrap font-serif text-lg leading-loose text-gray-800">
                {selectedChapter.content}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            请选择章节查看内容
          </div>
        )}
      </div>
    </div>
  );
};