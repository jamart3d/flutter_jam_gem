
import React, { useState } from 'react';
import { FileNode } from '../types';
import { FolderIcon, FileIcon, ClipboardIcon, CheckIcon, TrashIcon, DownloadIcon } from './Icons';

interface FileTreeProps {
  node: FileNode;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  stagedFiles: Set<string>;
  modifiedFiles: Set<string>;
  breathingFiles: Set<string>;
  fileContents: Map<string, string>;
  fileVersions: Map<string, number>;
  fileTimestamps: Map<string, number>;
  onDeleteRequest: (path: string) => void;
  onFileCopied: (path: string) => void;
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ 
  node, 
  selectedFile, 
  onSelectFile, 
  stagedFiles, 
  modifiedFiles, 
  breathingFiles,
  fileContents, 
  fileVersions, 
  fileTimestamps, 
  onDeleteRequest,
  onFileCopied,
  level = 0 
}) => {
  const isSelected = node.type === 'file' && selectedFile === node.path;
  const isStaged = node.type === 'file' && stagedFiles.has(node.path);
  const isModified = node.type === 'file' && modifiedFiles.has(node.path);
  const isBreathing = node.type === 'file' && breathingFiles.has(node.path);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = fileContents.get(node.path);
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        setIsCopied(true);
        onFileCopied(node.path);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDeleteRequest(node.path);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const content = fileContents.get(node.path);
    if (typeof content !== 'string') return;

    const filename = node.name;
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleSelectFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectFile(node.path);
  };

  const getFileClasses = () => {
    if (isSelected) return 'bg-blue-500 text-white font-semibold';
    if (isModified) return 'bg-purple-200 hover:bg-purple-300 text-purple-800';
    if (isStaged) return 'bg-yellow-200 hover:bg-yellow-300 text-yellow-800';
    return 'hover:bg-gray-200 text-gray-700';
  }

  if (node.type === 'file') {
    const version = fileVersions.get(node.path) || 1;
    const timestamp = fileTimestamps.get(node.path);

    const formatTimestamp = (ts: number | undefined) => {
      if (!ts) return '';
      const date = new Date(ts);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    };
    
    const formattedTimestamp = formatTimestamp(timestamp);

    return (
      <div
        onClick={handleSelectFile}
        className={`group flex items-center pr-2 cursor-pointer rounded-md transition-colors duration-200 ${getFileClasses()} ${isBreathing ? 'animate-breathe-green' : ''}`}
        style={{ paddingLeft: `${level * 1}rem` }}
      >
        <button
            onClick={handleCopy}
            title={`Copy content of ${node.name}`}
            className={`z-10 p-1 rounded-md mr-1 invisible group-hover:visible ${
                isSelected ? 'hover:bg-blue-600' : 'hover:bg-gray-300'
            }`}
        >
            {isCopied ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
            ) : (
                <ClipboardIcon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
            )}
        </button>
        <FileIcon className="w-4 h-4 mr-2 flex-shrink-0" />
        <span className="truncate flex-grow">{node.name}</span>
        <span className={`text-xs font-mono ml-2 text-right select-none flex-shrink-0 ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
          {formattedTimestamp} v{version}
        </span>
        <button
            onClick={handleDownload}
            title={`Download ${node.name}`}
            className={`z-10 p-1 rounded-md ml-2 flex-shrink-0 invisible group-hover:visible ${ isSelected ? 'hover:bg-blue-600' : 'hover:bg-gray-300' }`}
        >
            <DownloadIcon className={`w-4 h-4 ${ isSelected ? 'text-white' : 'text-gray-500'}`} />
        </button>
        <button
            onClick={handleDelete}
            title={`Delete ${node.name}`}
            className={`z-10 p-1 rounded-md ml-1 flex-shrink-0 invisible group-hover:visible ${ isSelected ? 'hover:bg-blue-600' : 'hover:bg-gray-300' }`}
        >
            <TrashIcon className={`w-4 h-4 ${ isSelected ? 'text-white' : 'text-red-500'}`} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div 
        className={`group flex items-center justify-between py-1 font-medium pr-2 rounded-md transition-colors duration-200 text-gray-500`}
        style={{ paddingLeft: `${level * 1}rem` }}
      >
        <div className="flex items-center truncate">
            <FolderIcon className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
        </div>
        <button
            onClick={handleDelete}
            title={`Delete folder ${node.name}`}
            className="z-10 p-1 rounded-md hover:bg-gray-200 flex-shrink-0 invisible group-hover:visible"
        >
            <TrashIcon className={`w-4 h-4 text-red-500`} />
        </button>
      </div>
      <div>
        {node.children
          ?.slice() // Create a shallow copy to avoid mutating the original state
          .sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') {
              return -1; // a (folder) comes before b (file)
            }
            if (a.type === 'file' && b.type === 'folder') {
              return 1; // b (folder) comes before a (file)
            }
            // Both are same type, sort alphabetically
            return a.name.localeCompare(b.name);
          })
          .map((child) => (
          <FileTree
            key={child.path}
            node={child}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            stagedFiles={stagedFiles}
            modifiedFiles={modifiedFiles}
            breathingFiles={breathingFiles}
            fileContents={fileContents}
            fileVersions={fileVersions}
            fileTimestamps={fileTimestamps}
            onDeleteRequest={onDeleteRequest}
            onFileCopied={onFileCopied}
            level={level + 1}
          />
        ))}
      </div>
    </div>
  );
};
