
import React, { useState } from 'react';
import { SavedModel, LLMConfig, LLMProvider } from '../types';
import { X, Plus, Trash2, Edit2, Save, Key, Globe, Cpu, Check } from 'lucide-react';

interface ModelManagerProps {
  models: SavedModel[];
  onUpdateModels: (models: SavedModel[]) => void;
  onClose: () => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({ models, onUpdateModels, onClose }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SavedModel | null>(null);

  const handleAddNew = () => {
    const newModel: SavedModel = {
      id: `model-${Date.now()}`,
      name: 'New Model',
      config: {
        provider: 'gemini',
        apiKey: '',
        modelName: 'gemini-3-pro-preview',
        baseUrl: ''
      }
    };
    setEditForm(newModel);
    setEditingId(newModel.id);
  };

  const handleEdit = (model: SavedModel) => {
    setEditForm({ ...model });
    setEditingId(model.id);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个模型配置吗?')) {
      onUpdateModels(models.filter(m => m.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditForm(null);
      }
    }
  };

  const handleSave = () => {
    if (!editForm) return;
    if (!editForm.name.trim()) return alert('请输入模型名称');
    if (!editForm.config.apiKey.trim()) return alert('请输入 API Key');

    const existingIndex = models.findIndex(m => m.id === editForm.id);
    let newModels = [...models];
    
    if (existingIndex >= 0) {
      newModels[existingIndex] = editForm;
    } else {
      newModels.push(editForm);
    }
    
    onUpdateModels(newModels);
    setEditingId(null);
    setEditForm(null);
  };

  const getBaseUrlPlaceholder = (provider: string) => {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'gemini': return 'https://generativelanguage.googleapis.com';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      default: return 'https://...';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 p-2 rounded-lg">
                <Cpu className="w-5 h-5 text-primary-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-900">全局模型管理</h2>
                <p className="text-xs text-gray-500">配置一次，所有项目通用</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar List */}
          <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {models.map(model => (
                <div 
                  key={model.id}
                  onClick={() => handleEdit(model)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                    editingId === model.id 
                      ? 'bg-primary-50 border-primary-500 shadow-sm' 
                      : 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className={`font-bold text-sm ${editingId === model.id ? 'text-primary-900' : 'text-gray-800'}`}>
                          {model.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                        <span className={`uppercase px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            editingId === model.id ? 'bg-primary-200 text-primary-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                            {model.config.provider}
                        </span>
                        <span className="truncate max-w-[90px] text-gray-400">{model.config.modelName}</span>
                      </div>
                    </div>
                    {editingId !== model.id && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(model.id); }}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={handleAddNew}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center gap-2 text-sm font-bold mt-2"
              >
                <Plus className="w-4 h-4" /> 添加新模型
              </button>
            </div>
          </div>

          {/* Edit Panel */}
          <div className="flex-1 bg-white p-8 overflow-y-auto">
            {editForm ? (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b border-gray-100 pb-5">
                  <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {models.some(m => m.id === editForm.id) ? '编辑模型' : '新建模型'}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">配置 LLM 服务商及密钥</p>
                  </div>
                  <div className="flex gap-3">
                     {models.some(m => m.id === editForm.id) && (
                        <button 
                          onClick={() => handleDelete(editForm.id)}
                          className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-bold flex items-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" /> 删除
                        </button>
                     )}
                     <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-bold flex items-center shadow-md hover:shadow-lg transition-all"
                     >
                        <Save className="w-4 h-4 mr-1.5" /> 保存配置
                     </button>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">配置名称</label>
                    <input 
                      type="text" 
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-gray-900 placeholder-gray-400 appearance-none shadow-sm"
                      placeholder="例如: Paid GPT-4 API"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">服务商</label>
                        <div className="relative">
                            <select 
                                value={editForm.config.provider}
                                onChange={(e) => setEditForm({ 
                                    ...editForm, 
                                    config: { ...editForm.config, provider: e.target.value as LLMProvider } 
                                })}
                                className="w-full pl-4 pr-8 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-gray-900 appearance-none font-medium shadow-sm"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI Compatible</option>
                                <option value="anthropic">Anthropic (via Proxy)</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">模型名称</label>
                        <input 
                            type="text" 
                            value={editForm.config.modelName}
                            onChange={(e) => setEditForm({ 
                                ...editForm, 
                                config: { ...editForm.config, modelName: e.target.value } 
                            })}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm text-gray-900 placeholder-gray-400 appearance-none shadow-sm"
                            placeholder={editForm.config.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4-turbo'}
                        />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-gray-500"/> API Key
                    </label>
                    <input 
                      type="password" 
                      value={editForm.config.apiKey}
                      onChange={(e) => setEditForm({ 
                          ...editForm, 
                          config: { ...editForm.config, apiKey: e.target.value } 
                      })}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm text-gray-900 placeholder-gray-400 appearance-none shadow-sm"
                      placeholder="sk-..."
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-gray-500"/> Base URL
                    </label>
                    <input 
                    type="text" 
                    value={editForm.config.baseUrl || ''}
                    onChange={(e) => setEditForm({ 
                        ...editForm, 
                        config: { ...editForm.config, baseUrl: e.target.value } 
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm text-gray-900 placeholder-gray-400 appearance-none shadow-sm"
                    placeholder={getBaseUrlPlaceholder(editForm.config.provider)}
                    />
                    <p className="text-xs text-gray-500 mt-2 ml-1">留空则使用官方默认地址。如使用代理或第三方中转，请在此填写完整 URL。</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                   <Cpu className="w-10 h-10 text-gray-300" />
                </div>
                <p className="font-medium text-lg text-gray-500">选择左侧模型进行编辑</p>
                <p className="text-sm mt-2">或点击 "添加新模型" 创建配置</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
