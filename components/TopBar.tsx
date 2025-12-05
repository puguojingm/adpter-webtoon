
import React from 'react';
import { UserInfo } from '../types';
import { Bell, Search, User as UserIcon, LogOut, Settings } from 'lucide-react';

interface TopBarProps {
  user: UserInfo;
  onLogout: () => void;
  title?: string;
  onOpenModelManager: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onLogout, title, onOpenModelManager }) => {
  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Left Area (Title or Breadcrumbs) */}
      <div className="flex items-center">
         {title && <h2 className="text-lg font-bold text-gray-800 tracking-tight">{title}</h2>}
      </div>

      {/* Right Area (User Profile) */}
      <div className="flex items-center gap-6">
        <div className="relative hidden md:block">
           <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
           <input 
             type="text" 
             placeholder="搜索..." 
             className="pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-48 transition-all"
           />
        </div>

        <button 
            onClick={onOpenModelManager}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 hover:text-gray-800 transition-colors text-xs font-bold"
            title="全局模型管理"
        >
            <Settings className="w-3.5 h-3.5" />
            <span>模型配置</span>
        </button>

        <button className="relative text-gray-400 hover:text-gray-600 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <div className="flex items-center gap-3 group cursor-pointer relative">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-gray-800 leading-tight">{user.username}</div>
            <div className="text-[10px] text-gray-500">余额: {user.balance}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary-100 border-2 border-white shadow-sm overflow-hidden p-0.5">
             <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          </div>

          {/* Dropdown (Simplified hover for demo) */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
             <div className="px-4 py-3 border-b border-gray-50">
               <p className="text-xs text-gray-500">登录账号</p>
               <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
             </div>
             <button 
               onClick={onOpenModelManager}
               className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center"
             >
               <Settings className="w-4 h-4 mr-2" /> 模型设置
             </button>
             <button 
               onClick={onLogout}
               className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
             >
               <LogOut className="w-4 h-4 mr-2" /> 退出登录
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
