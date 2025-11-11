import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { UserIcon, BotIcon, SendIcon, ClearIcon } from './Icons';

interface ChatWindowProps {
  chatHistory: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onFailed: () => void;
  onStopGeneration: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatHistory,
  isLoading,
  onSendMessage,
  onFailed,
  onStopGeneration,
}) => {
  const [input, setInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  useEffect(() => {
    if (inputRef.current) {
        // Reset height to auto to correctly calculate the new height, especially when deleting lines.
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  const handleClear = () => {
    setInput('');
    inputRef.current?.focus();
  };

  const handlePasteAndSend = async () => {
    if (isLoading) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        onSendMessage(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-2 bg-gray-50 border-b border-gray-200 text-center">
          <h2 className="text-lg font-bold text-blue-600">AI Assistant</h2>
      </div>
      <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-100">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && <BotIcon className="w-8 h-8 flex-shrink-0 text-blue-600 mt-1" />}
            <div className={`p-3 rounded-lg max-w-xl shadow-sm ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'}`}>
                <pre className="text-sm whitespace-pre-wrap font-sans">{msg.parts[0].text}</pre>
            </div>
            {msg.role === 'user' && <UserIcon className="w-8 h-8 flex-shrink-0 text-gray-500 mt-1" />}
          </div>
        ))}
         {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
          <div className="flex items-start gap-3">
             <BotIcon className="w-8 h-8 flex-shrink-0 text-blue-600 mt-1" />
             <div className="p-3 rounded-lg bg-white shadow-sm">
                <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-bounce"></span>
                </div>
             </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-end gap-2 mb-2">
            <button
              onClick={onStopGeneration}
              disabled={!isLoading}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                isLoading 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              title="Stop generating response"
            >
              Stop
            </button>
            <button
                onClick={handlePasteAndSend}
                className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
                title="Paste content from clipboard and send."
            >
                Paste &amp; Send
            </button>
            <button
                onClick={() => onSendMessage('yes')}
                className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
                title="Send 'yes' as a response."
            >
                Yes
            </button>
            <button
                onClick={onFailed}
                className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
                title="Tell the assistant its last response was incorrect and to try again."
            >
                Try Again
            </button>
        </div>

        <div className="flex items-center">
          <div className="flex-grow flex items-end gap-2 bg-gray-100 rounded-lg p-2 border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your code... (Shift + Enter for new line)"
              className="flex-grow bg-transparent focus:outline-none text-gray-800 px-2 resize-none"
              rows={1}
              style={{ maxHeight: '10rem' }}
            />
            {input.length > 0 && !isLoading && (
              <button
                onClick={handleClear}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                title="Clear input"
              >
                <ClearIcon className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-2 rounded-md text-gray-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0">
              <SendIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};