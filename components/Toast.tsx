import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X, XCircle } from 'lucide-react';
import { Notification } from '../types';

interface ToastProps {
  notification: Notification;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 4000);

    return () => clearTimeout(timer);
  }, [notification, onClose]);

  const getStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-white border-l-4 border-green-500 text-gray-800 shadow-lg ring-1 ring-black/5';
      case 'error':
        return 'bg-white border-l-4 border-red-500 text-gray-800 shadow-lg ring-1 ring-black/5';
      case 'warning':
        return 'bg-white border-l-4 border-yellow-500 text-gray-800 shadow-lg ring-1 ring-black/5';
      default:
        return 'bg-white border-l-4 border-blue-500 text-gray-800 shadow-lg ring-1 ring-black/5';
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className={`flex items-start w-80 p-4 rounded-r-lg mb-3 transform transition-all duration-300 animate-fade-in ${getStyles()}`}>
      <div className="flex-shrink-0 pt-0.5">
        {getIcon()}
      </div>
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium">{notification.message}</p>
      </div>
      <button
        onClick={() => onClose(notification.id)}
        className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500 focus:outline-none"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<{ notifications: Notification[]; onClose: (id: string) => void }> = ({ notifications, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      <div className="pointer-events-auto">
        {notifications.map((notification) => (
          <Toast key={notification.id} notification={notification} onClose={onClose} />
        ))}
      </div>
    </div>
  );
};
