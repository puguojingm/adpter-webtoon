import React, { useRef, useEffect } from 'react';
import { Send, User, Bot, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Message, AgentType } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (msg: string) => void;
  isProcessing: boolean;
  activeAgent: AgentType | null;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isProcessing, activeAgent }) => {
  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input);
      setInput('');
    }
  };

  const getAgentColor = (agent?: AgentType) => {
    switch (agent) {
      case AgentType.MAIN: return 'bg-indigo-600';
      case AgentType.BREAKDOWN_ALIGNER: return 'bg-purple-600';
      case AgentType.WEBTOON_ALIGNER: return 'bg-emerald-600';
      default: return 'bg-gray-600';
    }
  };

  const getAgentIcon = (agent?: AgentType) => {
    switch (agent) {
      case AgentType.BREAKDOWN_ALIGNER: return <AlertCircle className="w-4 h-4 text-white" />;
      case AgentType.WEBTOON_ALIGNER: return <CheckCircle className="w-4 h-4 text-white" />;
      default: return <Bot className="w-4 h-4 text-white" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header / Active Agent Status */}
      {isProcessing && activeAgent && (
        <div className="absolute top-0 left-0 right-0 bg-indigo-50 border-b border-indigo-100 p-2 flex items-center justify-center z-10 transition-all">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 mr-2" />
          <span className="text-xs font-semibold text-indigo-700">
            {activeAgent} 正在工作中...
          </span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pt-8">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-gray-200' : getAgentColor(msg.agent)
                }`}
              >
                {msg.role === 'user' ? <User className="w-5 h-5 text-gray-500" /> : getAgentIcon(msg.agent)}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                 {msg.agent && msg.role !== 'user' && (
                    <span className="text-xs font-bold text-gray-400 mb-1 ml-1">{msg.agent}</span>
                 )}
                <div
                  className={`px-4 py-3 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : msg.content.includes('FAIL') 
                        ? 'bg-red-50 text-red-900 border border-red-200 rounded-tl-none'
                        : msg.content.includes('PASS')
                            ? 'bg-green-50 text-green-900 border border-green-200 rounded-tl-none'
                            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-300 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder={isProcessing ? "Agent正在思考中..." : "输入指令..."}
            className="flex-1 bg-gray-50 text-gray-900 placeholder-gray-400 text-sm rounded-full border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-5 py-3 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
