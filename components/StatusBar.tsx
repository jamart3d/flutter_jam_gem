
import React from 'react';

interface StatusBarProps {
  isLoading: boolean;
  isSyncing: boolean;
  isPersonaLoaded: boolean;
  onLoadPersona: () => void;
  onShowPersona: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ isLoading, isSyncing, isPersonaLoaded, onLoadPersona, onShowPersona }) => {
  const getStatusText = () => {
    if (isLoading) return 'Generating Response...';
    if (isSyncing) return 'Syncing Files...';
    return 'Ready';
  };

  return (
    <footer className="flex items-center justify-between px-4 py-1.5 bg-gray-100 border-t border-gray-200 text-xs text-gray-500">
      <div className="flex items-center gap-4">
        <span>
          Status: <span className="font-semibold text-gray-600">{getStatusText()}</span>
        </span>
        <span className="h-4 border-l border-gray-300"></span>
        <span>
          Model: <span className="font-semibold text-gray-600">gemini-2.5-pro</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={onLoadPersona}
            disabled={isLoading || isPersonaLoaded}
            className="text-gray-500 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Persona:
          </button>
          {isPersonaLoaded ? (
            <span className="font-semibold text-indigo-600">Loaded</span>
          ) : (
            <button
              onClick={onShowPersona}
              disabled={isLoading}
              className="font-semibold text-gray-600 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Default
            </button>
          )}
        </div>
        <span className="h-4 border-l border-gray-300"></span>
        <span>
            Tools: <span className="font-semibold text-gray-600">Enabled</span>
        </span>
      </div>
    </footer>
  );
};