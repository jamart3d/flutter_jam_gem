import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  ClipboardIcon, 
  CheckIcon, 
  ChevronUpIcon, 
  ChevronDownIcon, 
  SpellCheckIcon, 
  CommentOffIcon, 
  RefactorIcon,
  DownloadIcon
} from './Icons';

// A more robust syntax highlighter for Dart that tokenizes the code.
const highlightSyntax = (code: string): string => {
  if (!code) return '';

  // Utility to escape HTML special characters.
  const escapeHtml = (unsafe: string) => 
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const keywords = ['import', 'export', 'part', 'library', 'as', 'show', 'hide', 'void', 'class', 'extends', 'with', 'implements', 'enum', 'mixin', 'required', 'final', 'const', 'static', 'late', 'var', 'dynamic', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'async', 'await', 'yield', 'true', 'false', 'null'];
  const types = ['Widget', 'StatelessWidget', 'StatefulWidget', 'BuildContext', 'MaterialApp', 'ThemeData', 'Scaffold', 'AppBar', 'Text', 'Center', 'Column', 'Row', 'SizedBox', 'ElevatedButton', 'CustomButton', 'Key', 'Colors', 'EdgeInsets', 'MainAxisAlignment', 'VisualDensity', 'VoidCallback', 'String', 'int', 'double', 'bool', 'List', 'Map', 'Set', 'Object', 'print'];

  // Define regex for each token type. Order matters for the final tokenizer.
  const patterns = {
    comment: /(\/\/.*|\/\*[\s\S]*?\*\/)/,
    string: /('[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*")/,
    keyword: new RegExp(`\\b(${keywords.join('|')})\\b`),
    type: new RegExp(`\\b(${types.join('|')})\\b`),
    annotation: /(@\w+)/,
    number: /\b(\d+(\.\d+)?)\b/,
  };

  const tokenizer = new RegExp(
    Object.values(patterns).map(p => `(${p.source})`).join('|'),
    'g'
  );

  let lastIndex = 0;
  let result = '';

  code.replace(tokenizer, (match, ...args) => {
    const offset = args[args.length - 2];
    
    // Find which capture group was matched
    const groups = args.slice(0, -2);
    let kind: keyof typeof patterns | null = null;
    let kindIndex = -1;
    
    for (let i = 0; i < groups.length; i++) {
        // Because of how the regex is constructed, we need to find the first non-undefined group
        // that is not the full match itself.
        if (groups[i] && i !== kindIndex) {
            let tempIndex = 0;
            for(const k in patterns) {
                if(tempIndex === Math.floor(i/2)) { // Each pattern has its main group and an inner group
                    kind = k as keyof typeof patterns;
                    break;
                }
                tempIndex++;
            }
            break;
        }
    }

    // 1. Append the plain text that came before this match, properly escaped
    result += escapeHtml(code.substring(lastIndex, offset));

    // 2. Append the matched token, wrapped in the correct span
    if (kind === 'comment') {
      result += `<span class="text-green-600">${escapeHtml(match)}</span>`;
    } else if (kind === 'string') {
      result += `<span class="text-amber-600">${escapeHtml(match)}</span>`;
    } else if (kind === 'keyword') {
      result += `<span class="text-blue-600 font-semibold">${match}</span>`;
    } else if (kind === 'type') {
      result += `<span class="text-cyan-600">${match}</span>`;
    } else if (kind === 'annotation') {
      result += `<span class="text-purple-600">${match}</span>`;
    } else if (kind === 'number') {
      result += `<span class="text-red-600">${match}</span>`;
    } else {
      result += escapeHtml(match);
    }
    
    // 3. Update the last index
    lastIndex = offset + match.length;
    
    return match;
  });

  // 4. Append any remaining text after the last match
  if (lastIndex < code.length) {
    result += escapeHtml(code.substring(lastIndex));
  }

  return result;
};


interface CodeEditorProps {
  content: string;
  path: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isLoading: boolean;
  onFixTypos: () => void;
  onRefactor: () => void;
  onRemoveComments: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
  content, 
  path, 
  isCollapsed,
  onToggleCollapse,
  isLoading,
  onFixTypos,
  onRefactor,
  onRemoveComments,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isPathCopied, setIsPathCopied] = useState(false);
  const [isPromptsMenuOpen, setIsPromptsMenuOpen] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const promptsMenuRef = useRef<HTMLDivElement>(null);
  
  const highlightedCode = useMemo(() => highlightSyntax(content), [content]);
  const lineCount = useMemo(() => content.split('\n').length, [content]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (promptsMenuRef.current && !promptsMenuRef.current.contains(event.target as Node)) {
        setIsPromptsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePromptAction = (action: () => void) => {
    action();
    setIsPromptsMenuOpen(false);
  };

  const handleCopy = () => {
    if (path && content) {
      navigator.clipboard.writeText(content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }, (err) => {
        console.error('Failed to copy text: ', err);
      });
    }
  };

  const handleCopyPath = () => {
    if (path) {
      const pathToCopy = path.startsWith('lib/') ? path.substring(4) : path;
      navigator.clipboard.writeText(pathToCopy).then(() => {
        setIsPathCopied(true);
        setTimeout(() => setIsPathCopied(false), 2000);
      }, (err) => {
        console.error('Failed to copy path: ', err);
      });
    }
  };
    
  const handleDownload = () => {
    if (!path || !content) return;

    const filename = path.split('/').pop() || 'downloaded_file';
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 2000);
  };

  return (
    <div className="flex flex-col bg-gray-50 h-full min-h-0">
      <div className="flex justify-between items-center p-2 bg-gray-100 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
            <button 
                onClick={onToggleCollapse} 
                className="p-1 rounded-md hover:bg-gray-200"
                title={isCollapsed ? 'Expand Code Editor' : 'Collapse Code Editor'}
            >
                {isCollapsed ? <ChevronDownIcon className="w-4 h-4 text-gray-600" /> : <ChevronUpIcon className="w-4 h-4 text-gray-600" />}
            </button>
            <span className="text-sm font-mono text-gray-600">{path || 'Code Editor'}</span>
            {path && (
              <>
                <button
                  onClick={handleDownload}
                  className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!content}
                  title={isDownloaded ? "Downloaded!" : "Download this file"}
                >
                  {isDownloaded ? (
                    <CheckIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <DownloadIcon className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                <button
                  onClick={handleCopyPath}
                  className="p-1 rounded-md hover:bg-gray-200"
                  title="Copy file path"
                >
                  {isPathCopied ? (
                    <CheckIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <ClipboardIcon className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                <div className="h-4 border-l border-gray-300"></div>
                <span className="text-xs font-mono text-gray-500 select-none">
                  {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                </span>
              </>
            )}
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && path && (
            <>
              <div className="relative" ref={promptsMenuRef}>
                <button
                    onClick={() => setIsPromptsMenuOpen(prev => !prev)}
                    className="flex items-center gap-2 px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || !path}
                    title={!path ? 'Select a file to enable prompts' : 'Code generation prompts'}
                >
                    Prompts
                    <ChevronDownIcon className="w-4 h-4" />
                </button>
                {isPromptsMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                    <button
                        onClick={() => handlePromptAction(onRefactor)}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        disabled={isLoading || !path}
                        title="Refactor the current file for improvements"
                    >
                        <RefactorIcon className="w-4 h-4" />
                        Refactor
                    </button>
                    <button
                        onClick={() => handlePromptAction(onFixTypos)}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        disabled={isLoading || !path}
                        title="Check for typos and minor errors"
                    >
                        <SpellCheckIcon className="w-4 h-4" />
                        Fix Typos
                    </button>
                    <button
                        onClick={() => handlePromptAction(onRemoveComments)}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        disabled={isLoading || !path}
                        title="Remove all comments from this file"
                    >
                        <CommentOffIcon className="w-4 h-4" />
                        Remove Comments
                    </button>
                    </div>
                )}
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCopied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
                disabled={!content}
              >
                {isCopied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                {isCopied ? 'Copied!' : 'Copy'}
              </button>
            </>
          )}
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex-grow flex h-full overflow-auto">
          {path === null ? (
             <div className="flex-grow bg-white flex items-center justify-center text-gray-400">
                <p>Select a file to view its content</p>
            </div>
          ) : (
            <>
              <div className="text-right pr-4 pt-4 font-mono text-sm text-gray-400 select-none bg-gray-100 border-r border-gray-200">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre className="p-4 font-mono text-sm w-full" style={{ tabSize: 2 }}>
                <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
};