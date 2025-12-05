import React from 'react';
import { ProjectState, NovelType } from '../types';
import { Plus, BookOpen, Layers, Feather, Clock, ChevronRight, FileText } from 'lucide-react';

interface ProjectListProps {
  projects: ProjectState[];
  onSelectProject: (project: ProjectState) => void;
  onCreateProject: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, onCreateProject }) => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">漫剧工坊</h1>
            <p className="text-gray-500 mt-1">Webtoon Adaptation Projects</p>
          </div>
          <button
            onClick={onCreateProject}
            className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            新建项目
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
             const processedCount = project.chapters.filter(c => c.isProcessed).length;
             const progressPercent = project.chapters.length > 0 ? Math.round((processedCount / project.chapters.length) * 100) : 0;

             return (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary-100 hover:-translate-y-1 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    project.type === NovelType.FANTASY ? 'bg-purple-100 text-purple-700' : 
                    project.type === NovelType.URBAN ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {project.type}
                  </div>
                  <span className="text-xs text-gray-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date().toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {project.title || '未命名项目'}
                </h3>
                <p className="text-sm text-gray-500 mb-6 line-clamp-2 h-10">
                  {project.description || '暂无描述...'}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center"><BookOpen className="w-4 h-4 mr-2" /> 小说原稿</span>
                    <span className="font-medium text-gray-900">
                      <span className="text-primary-600">{processedCount}</span> / {project.chapters.length} 章
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-primary-500 rounded-full" 
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-500 flex items-center"><Layers className="w-4 h-4 mr-2" /> 剧情拆解</span>
                    <span className="font-medium text-gray-900">{project.plotBatches.length} 批</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center"><Feather className="w-4 h-4 mr-2" /> 分集剧本</span>
                    <span className="font-medium text-gray-900">{project.scripts.length} 集</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 flex justify-end">
                   <span className="text-sm text-primary-600 font-medium flex items-center group-hover:translate-x-1 transition-transform">
                     进入项目 <ChevronRight className="w-4 h-4 ml-1" />
                   </span>
                </div>
              </div>
             );
          })}

          {/* Empty State Create Button */}
          {projects.length === 0 && (
            <button 
              onClick={onCreateProject}
              className="flex flex-col items-center justify-center h-[360px] border-2 border-dashed border-gray-300 rounded-2xl hover:border-primary-400 hover:bg-primary-50/30 transition-all text-gray-400 hover:text-primary-600"
            >
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors">
                <Plus className="w-8 h-8" />
              </div>
              <span className="font-medium">创建一个新项目</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};