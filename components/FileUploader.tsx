import React, { useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  onUpload: (files: { content: string; fileName: string }[]) => void;
  onNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUpload, onNotification }) => {
  const [isReading, setIsReading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 1000) {
      onNotification('error', "一次最多只能上传 1000 个文件，请分批上传。");
      return;
    }

    setIsReading(true);

    try {
      const promises = Array.from(files).map(async (file: File) => ({
        content: await file.text(),
        fileName: file.name
      }));

      const results = await Promise.all(promises);
      onUpload(results);
      onNotification('success', `成功导入 ${results.length} 个章节文件`);
    } catch (error) {
      console.error("Failed to read files:", error);
      onNotification('error', "文件读取失败，请检查文件格式后重试。");
    } finally {
      setIsReading(false);
      // Reset input so the same files can be uploaded again if needed
      event.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-primary-50 hover:border-primary-300 transition-colors ${isReading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isReading ? (
            <Loader2 className="w-8 h-8 mb-2 text-primary-500 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 mb-2 text-primary-400" />
          )}
          <p className="mb-1 text-xs text-gray-600 font-medium">
            {isReading ? '正在读取文件...' : '点击上传小说章节 (支持批量)'}
          </p>
          <p className="text-[10px] text-gray-400">支持 .txt 文件，单次最多 1000 章</p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept=".txt" 
          multiple 
          onChange={handleFileChange} 
          disabled={isReading}
        />
      </label>
    </div>
  );
};