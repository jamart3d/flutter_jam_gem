import React, { useState, useCallback, useRef } from 'react';
import { FileTree } from './components/FileTree';
import { CodeEditor } from './components/CodeEditor';
import { ChatWindow } from './components/ChatWindow';
import { ConfirmationModal } from './components/ConfirmationModal';
import { InfoModal } from './components/InfoModal';
import { FileNode, ChatMessage, FileUpdate } from './types';
import { initialFileTree, initialFileContents } from './constants';
import { UploadIcon, SyncIcon, FileIcon, DownloadIcon } from './components/Icons';
import { sendMessageToGemini, DEFAULT_PERSONA } from './services/geminiService';
import { GenerateContentResponse, FunctionCall } from '@google/genai';
import { StatusBar } from './components/StatusBar';
import JSZip from 'jszip';


const App: React.FC = () => {
  const [fileTree, setFileTree] = useState<FileNode>(initialFileTree);
  const [fileContents, setFileContents] = useState<Map<string, string>>(initialFileContents);
  const [fileVersions, setFileVersions] = useState<Map<string, number>>(() => new Map(Array.from(initialFileContents.keys()).map(key => [key, 1])));
  const [fileTimestamps, setFileTimestamps] = useState<Map<string, number>>(() => new Map(Array.from(initialFileContents.keys()).map(key => [key, Date.now()])));
  const [selectedFile, setSelectedFile] = useState<string | null>('lib/main.dart');
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  const [breathingFiles, setBreathingFiles] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pathToDelete, setPathToDelete] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'model',
      parts: [{ text: "Hello! I'm your Flutter development assistant. To start, add lib folder, add pubspec.yaml, add a more descriptive persona file by clicking on the persona label, and selecting a persona.md, then sync files. Then ask me anything about your code." }],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isPersonaLoaded, setIsPersonaLoaded] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isCodeEditorCollapsed, setIsCodeEditorCollapsed] = useState(true);
  
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [codePanelBasis, setCodePanelBasis] = useState(60);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const agentFileInputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const stopGenerationRef = useRef(false);
  
  const handleSidebarResize = useCallback((e: MouseEvent) => {
    const newWidth = Math.max(200, Math.min(e.clientX, 600));
    setSidebarWidth(newWidth);
  }, []);

  const stopSidebarResize = useCallback(() => {
    window.removeEventListener('mousemove', handleSidebarResize);
    window.removeEventListener('mouseup', stopSidebarResize);
  }, [handleSidebarResize]);

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.addEventListener('mousemove', handleSidebarResize);
    window.addEventListener('mouseup', stopSidebarResize);
  }, [handleSidebarResize, stopSidebarResize]);

  const startPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    const mainEl = mainContentRef.current;
    if (!mainEl) return;
    
    const handleMove = (e: MouseEvent) => {
        const rect = mainEl.getBoundingClientRect();
        const newHeight = e.clientY - rect.top;
        const newBasis = (newHeight / rect.height) * 100;
        
        setCodePanelBasis(Math.max(15, Math.min(newBasis, 85)));
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);


  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleDeleteRequest = (path: string) => {
    setPathToDelete(path);
  };

  const handleCancelDelete = () => {
    setPathToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (!pathToDelete) return;

    const deleteNodeRecursive = (node: FileNode, pathToDelete: string): FileNode | null => {
        if (node.path === pathToDelete) {
            return null; // This node should be deleted
        }
    
        if (!node.children) {
            return node; // Not the node to delete, and it has no children, so return as is
        }
    
        let hasChanged = false;
        // Recursively process children
        const newChildren = node.children
            .map(child => {
                const newChild = deleteNodeRecursive(child, pathToDelete);
                if (newChild !== child) {
                    hasChanged = true; // A descendant was deleted
                }
                return newChild;
            })
            .filter((child): child is FileNode => child !== null); // Filter out the deleted node
    
        // If nothing changed in the children, return the original node to maintain object reference
        if (!hasChanged) {
            return node;
        }
        
        // If children have changed, return a new node object with the updated children
        return { ...node, children: newChildren };
    };
  
    setFileTree(currentTree => {
        const newTree = deleteNodeRecursive(currentTree, pathToDelete);
        // If the root was deleted, return a default empty state
        return newTree || { name: 'root', type: 'folder', path: '', children: [] };
    });
  
    const shouldKeep = (key: string) => !(key === pathToDelete || key.startsWith(pathToDelete + '/'));
  
    setFileContents(currentContents => {
        const newContents = new Map<string, string>();
        for (const [key, value] of currentContents.entries()) {
            if (shouldKeep(key)) {
                newContents.set(key, value);
            }
        }
        return newContents;
    });

    setFileVersions(currentVersions => {
        const newVersions = new Map<string, number>();
        for (const [key, value] of currentVersions.entries()) {
            if (shouldKeep(key)) {
                newVersions.set(key, value);
            }
        }
        return newVersions;
    });

    setFileTimestamps(currentTimestamps => {
        const newTimestamps = new Map<string, number>();
        for (const [key, value] of currentTimestamps.entries()) {
            if (shouldKeep(key)) {
                newTimestamps.set(key, value);
            }
        }
        return newTimestamps;
    });
  
    setStagedFiles(currentStaged => new Set(Array.from(currentStaged).filter(shouldKeep)));
    setModifiedFiles(currentModified => new Set(Array.from(currentModified).filter(shouldKeep)));
    setBreathingFiles(currentBreathing => new Set(Array.from(currentBreathing).filter(shouldKeep)));
  
    setSelectedFile(currentSelected => {
        if (currentSelected && !shouldKeep(currentSelected)) {
            return null; // Deselect if the selected file was deleted
        }
        return currentSelected;
    });

    setPathToDelete(null); // Close the modal
  };


const findNodeByPath = (node: FileNode, path: string): FileNode | null => {
    if (node.path === path) {
        return node;
    }
    if (node.children) {
        for (const child of node.children) {
            const found = findNodeByPath(child, path);
            if (found) return found;
        }
    }
    return null;
};

  const handleApplyFileChanges = (updates: FileUpdate[]) => {
    let finalTree = JSON.parse(JSON.stringify(fileTree));

    const deleteNode = (node: FileNode, path: string): FileNode | null => {
        if (node.path === path) return null;
        if (!node.children) return node;
        let hasChanged = false;
        const newChildren = node.children
          .map(child => {
              const newChild = deleteNode(child, path);
              if (newChild !== child) hasChanged = true;
              return newChild;
          })
          .filter((child): child is FileNode => child !== null);
        if (!hasChanged) return node;
        return { ...node, children: newChildren };
    };

    updates.forEach(update => {
        if (update.newContent === null || update.newContent === undefined) {
          finalTree = deleteNode(finalTree, update.filePath) || finalTree;
        }
    });

    updates
        .filter(u => u.newContent !== null && u.newContent !== undefined)
        .forEach(update => {
            const path = update.filePath;
            if (!findNodeByPath(finalTree, path)) {
                const parts = path.split('/');
                let currentNode = finalTree;

                parts.forEach((part, index) => {
                    if (!currentNode.children) {
                        currentNode.children = [];
                    }
                    let childNode = currentNode.children.find((child: FileNode) => child.name === part);
                    if (!childNode) {
                        const isLast = index === parts.length - 1;
                        const newPath = parts.slice(0, index + 1).join('/');
                        childNode = {
                            name: part,
                            type: isLast ? 'file' : 'folder',
                            path: newPath,
                            children: isLast ? undefined : [],
                        };
                        currentNode.children.push(childNode);
                    }
                    currentNode = childNode;
                });
            }
        });
    
    setFileTree(finalTree);

    setFileContents(prevContents => {
        const newContents = new Map<string, string>(prevContents);
        updates.forEach(update => {
            if (update.newContent === null || update.newContent === undefined) {
                for (const key of newContents.keys()) {
                    if (key === update.filePath || key.startsWith(update.filePath + '/')) {
                        newContents.delete(key);
                    }
                }
            } else {
                newContents.set(update.filePath, update.newContent);
            }
        });
        return newContents;
    });

    setFileVersions(prevVersions => {
        const newVersions = new Map<string, number>(prevVersions);
        updates.forEach(update => {
            if (update.newContent !== null && update.newContent !== undefined) {
                const currentVersion = newVersions.get(update.filePath) || 0;
                newVersions.set(update.filePath, currentVersion + 1);
            } else {
                for (const key of newVersions.keys()) {
                    if (key === update.filePath || key.startsWith(update.filePath + '/')) {
                        newVersions.delete(key);
                    }
                }
            }
        });
        return newVersions;
    });

    setFileTimestamps(prevTimestamps => {
        const newTimestamps = new Map<string, number>(prevTimestamps);
        updates.forEach(update => {
            if (update.newContent !== null && update.newContent !== undefined) {
                newTimestamps.set(update.filePath, Date.now());
            } else {
                for (const key of newTimestamps.keys()) {
                    if (key === update.filePath || key.startsWith(update.filePath + '/')) {
                        newTimestamps.delete(key);
                    }
                }
            }
        });
        return newTimestamps;
    });

    const updatedFilePaths = new Set(updates.filter(u => u.newContent !== null && u.newContent !== undefined).map(u => u.filePath));

    setModifiedFiles(prevModified => {
      const newModified = new Set(prevModified);
      updatedFilePaths.forEach(path => newModified.add(path));
      return newModified;
    });

    setBreathingFiles(prevBreathing => {
        const newBreathing = new Set(prevBreathing);
        updatedFilePaths.forEach(path => newBreathing.add(path));
        return newBreathing;
    });
};


  const selectedFileContent = selectedFile ? fileContents.get(selectedFile) || '' : '';

  const getFileTreeString = useCallback((node: FileNode, prefix = ''): string => {
    let treeString = `${prefix}${node.name}\n`;
    if (node.children) {
      node.children.forEach((child, index) => {
        const isLast = index === node.children.length - 1;
        treeString += getFileTreeString(child, `${prefix}${isLast ? '└── ' : '├── '}`);
      });
    }
    return treeString;
  }, []);

  const handleAddFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleAddFolderClick = () => {
    folderInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
  
    const newFileContents = new Map<string, string>();
    const newStagedFiles = new Set<string>();
  
    const fileReadPromises = Array.from(files).map((file: File) => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          // The `webkitRelativePath` attribute is present for folder uploads.
          // For single file uploads, it's undefined, so we fall back to `file.name`.
          const path = (file as any).webkitRelativePath || file.name;
          newFileContents.set(path, content);
          newStagedFiles.add(path);
          resolve();
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    });
  
    await Promise.all(fileReadPromises);
  
    setFileContents(prev => {
      const newMap = new Map(prev);
      newFileContents.forEach((value, key) => {
        newMap.set(key, value);
      });
      return newMap;
    });

    setFileVersions(prev => {
        const newMap = new Map(prev);
        newStagedFiles.forEach(path => {
            newMap.set(path, 1);
        });
        return newMap;
    });

    setFileTimestamps(prev => {
        const newMap = new Map(prev);
        newStagedFiles.forEach(path => {
            newMap.set(path, Date.now());
        });
        return newMap;
    });

    setStagedFiles(prev => new Set([...prev, ...newStagedFiles]));
  
    setFileTree(prevTree => {
      const newTree = JSON.parse(JSON.stringify(prevTree)); 
      newStagedFiles.forEach(path => {
        const parts = path.split('/');
        let currentNode = newTree;
  
        parts.forEach((part, index) => {
          if (!currentNode.children) {
            currentNode.children = [];
          }
  
          let childNode = currentNode.children.find((child: FileNode) => child.name === part);
  
          if (!childNode) {
            const isLast = index === parts.length - 1;
            const newPath = parts.slice(0, index + 1).join('/');
            childNode = {
              name: part,
              type: isLast ? 'file' : 'folder',
              path: newPath,
              children: isLast ? undefined : [],
            };
            currentNode.children.push(childNode);
          }
          currentNode = childNode;
        });
      });
      return newTree;
    });

    if (event.target) {
        event.target.value = '';
    }
  };

  const handleSyncWithGemini = async () => {
    if (stagedFiles.size === 0 || isSyncing || isLoading) return;
  
    setIsSyncing(true);
    
    let newFilesContext = "Please review and acknowledge the following new files and their content. You must remember this information for our ongoing conversation:\n\n";
    for (const path of stagedFiles) {
        const content = fileContents.get(path);
        newFilesContext += `File Path: \`${path}\`\n\`\`\`\n${content}\n\`\`\`\n\n`;
    }
    
    try {
        // Send the file context to Gemini through the normal chat flow.
        // This ensures the AI's memory is actually updated.
        await handleSendMessage(newFilesContext);
        setStagedFiles(new Set()); 
    } catch (error) {
        console.error("Error during file sync:", error);
        // The error message will be displayed in the chat via handleSendMessage.
    } finally {
        setIsSyncing(false);
    }
  };
  
  const handleSendMessage = async (message: string, isFromAgent: boolean = false) => {
    if (!message.trim() || isLoading) return;

    if (!isFromAgent) {
      const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
      setChatHistory((prev) => [...prev, newUserMessage]);
    }
    
    setModifiedFiles(new Set());
    setIsCompleting(false);
    stopGenerationRef.current = false;
    setIsLoading(true);

    try {
      const stream = await sendMessageToGemini(
        message,
        getFileTreeString(fileTree),
        selectedFile,
        selectedFileContent
      );
      
      let modelResponseText = '';
      let functionCalls: FunctionCall[] = [];
      
      setChatHistory((prev) => [...prev, { role: 'model', parts: [{ text: '' }] }]);

      for await (const chunk of stream) {
        if (stopGenerationRef.current) {
            modelResponseText += '\n[Generation stopped by user]';
            setChatHistory((prev) => {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1] = { role: 'model', parts: [{ text: modelResponseText }] };
                return newHistory;
            });
            break; 
        }

        const chunkResponse = chunk as GenerateContentResponse;
        
        const text = chunkResponse.text;
        if (text) {
          modelResponseText += text;
          setChatHistory((prev) => {
              const newHistory = [...prev];
              newHistory[newHistory.length - 1] = { role: 'model', parts: [{ text: modelResponseText }] };
              return newHistory;
          });
        }
        
        const calls = chunkResponse.functionCalls;
        if (calls && calls.length > 0) {
            functionCalls.push(...calls);
        }
      }

      if (functionCalls.length > 0) {
        for (const fc of functionCalls) {
          if (fc.name === 'updateFiles' && fc.args) {
            const updates = fc.args.updates as FileUpdate[];
            if (updates && updates.length > 0) {
              handleApplyFileChanges(updates);
              
              const filePaths = updates.map((u: FileUpdate) => `\`${u.filePath}\``).join(', ');
              const confirmationText = `I have updated the following file(s): ${filePaths}. Please review the changes.`;

              if (modelResponseText.trim().length <= 1) {
                setChatHistory(prev => {
                  const newHistory = [...prev];
                  newHistory[newHistory.length - 1] = { role: 'model', parts: [{ text: confirmationText }] };
                  return newHistory;
                });
              } else {
                setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: confirmationText }] }]);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        role: 'model',
        parts: [{ text: 'Sorry, I encountered an error. Please try again.' }],
      };
      setChatHistory((prev) => {
        const newHistory = [...prev];
        if (newHistory[newHistory.length-1].role === 'model' && newHistory[newHistory.length-1].parts[0].text === '') {
            newHistory[newHistory.length - 1] = errorMessage;
            return newHistory;
        }
        return [...newHistory, errorMessage];
      });
    } finally {
      setIsLoading(false);
      setIsCompleting(true);
      stopGenerationRef.current = false;
    }
  };

  const handleStopGeneration = () => {
    stopGenerationRef.current = true;
  };

  const handleFixTypos = () => {
    if (!selectedFile || isLoading) return;
    
    const message = `Please check the file \`${selectedFile}\` for any typos or minor semantic errors. Correct them using the 'updateFiles' tool. If there are no errors, simply respond with "No errors found."`;
    handleSendMessage(message, false);
  };

  const handleRefactor = () => {
    if (!selectedFile || isLoading) return;
    
    const message = `Please refactor the file \`${selectedFile}\` to improve its structure, readability, and performance. Apply the changes using the 'updateFiles' tool.`;
    handleSendMessage(message, false);
  };

  const handleRemoveComments = () => {
    if (!selectedFile || isLoading) return;
    
    const message = `Please remove all comments from the file \`${selectedFile}\` and update it using the 'updateFiles' tool. The code logic must remain identical.`;
    handleSendMessage(message, false);
  };

  const handleFailedCommand = () => {
    handleSendMessage("you failed, did not execute", false);
  };

  const handleLoadPersonaClick = () => {
    if (isPersonaLoaded || isLoading) return;
    agentFileInputRef.current?.click();
  };

  const handleAgentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (event.target) event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const personaContent = e.target?.result as string;
      if (personaContent) {
        const primingPrompt = `Please adopt the following persona and instructions for the rest of our conversation. Read these instructions carefully and acknowledge that you have understood them. This is a meta-instruction for you.\n\n---BEGIN INSTRUCTIONS---\n\n${personaContent}\n\n---END INSTRUCTIONS---`;

        setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: `Loading agent persona from ${file.name}...` }] }]);
        await handleSendMessage(primingPrompt, true);
        setIsPersonaLoaded(true);
      }
    };
    reader.readAsText(file);

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleOpenPersonaModal = () => setIsPersonaModalOpen(true);
  const handleClosePersonaModal = () => setIsPersonaModalOpen(false);

  const handleFileCopied = (path: string) => {
    setBreathingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
    });
  };

  const handleDownloadZip = async () => {
    if (isLoading || isSyncing) return;

    const zip = new JSZip();

    fileContents.forEach((content, path) => {
      zip.file(path, content);
    });

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'flutter_project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Failed to generate zip file:", error);
    }
  };


  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden">
      <InfoModal
        isOpen={isPersonaModalOpen}
        onClose={handleClosePersonaModal}
        title="Default Agent Persona"
        content={DEFAULT_PERSONA}
      />
      <ConfirmationModal
        isOpen={pathToDelete !== null}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        itemName={pathToDelete}
      />
      <div 
        className="flex-shrink-0 bg-gray-50 border-r border-gray-200 relative"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="p-4 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-bold text-blue-600">Flutter Project</h1>
              <button
                onClick={handleDownloadZip}
                disabled={isLoading || isSyncing}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-200 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download project as ZIP"
              >
                <DownloadIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto">
            <FileTree
                node={fileTree}
                selectedFile={selectedFile}
                onSelectFile={handleFileSelect}
                stagedFiles={stagedFiles}
                modifiedFiles={modifiedFiles}
                breathingFiles={breathingFiles}
                fileContents={fileContents}
                fileVersions={fileVersions}
                fileTimestamps={fileTimestamps}
                onDeleteRequest={handleDeleteRequest}
                onFileCopied={handleFileCopied}
            />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    className="hidden"
                />
                <input 
                    type="file" 
                    ref={folderInputRef} 
                    onChange={handleFileChange}
                    className="hidden" 
                    multiple 
                    // @ts-ignore
                    webkitdirectory="true"
                    directory="true"
                />
                <input
                    type="file"
                    ref={agentFileInputRef}
                    onChange={handleAgentFileChange}
                    className="hidden"
                    accept=".md,.txt"
                />
                <div className="flex gap-2">
                    <button 
                        onClick={handleAddFileClick}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileIcon className="w-4 h-4" />
                        Add File
                    </button>
                    <button 
                        onClick={handleAddFolderClick}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UploadIcon className="w-4 h-4" />
                        Add Folder
                    </button>
                </div>


                {stagedFiles.size > 0 && (
                    <button
                        onClick={handleSyncWithGemini}
                        disabled={isSyncing || isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait transition-colors"
                    >
                    <SyncIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : `Sync ${stagedFiles.size} File(s)`}
                    </button>
                )}
            </div>
        </div>

        {(isLoading || isCompleting) && (
            <div
                className={`absolute top-0 right-0 bottom-0 w-2 ${
                    isLoading 
                        ? 'animate-rgb-up bg-gradient-to-b from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500' 
                        : 'animate-fill-green bg-green-500'
                }`}
                style={isLoading ? { backgroundSize: '100% 400%' } : {}}
            />
        )}
      </div>
      
      <div
          onMouseDown={startSidebarResize}
          className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-blue-600 transition-colors flex-shrink-0"
      />
      
      <div className="flex-grow flex flex-col min-w-0">
        <div ref={mainContentRef} className="flex-grow flex flex-col min-h-0">
          <div 
            className="w-full flex flex-col transition-all duration-300 ease-in-out"
            style={{ 
              flex: isCodeEditorCollapsed ? '0 0 auto' : `1 1 ${codePanelBasis}%`,
              overflow: 'hidden' 
            }}
          >
            <CodeEditor
              content={selectedFileContent}
              path={selectedFile}
              isCollapsed={isCodeEditorCollapsed}
              onToggleCollapse={() => setIsCodeEditorCollapsed(p => !p)}
              isLoading={isLoading}
              onFixTypos={handleFixTypos}
              onRefactor={handleRefactor}
              onRemoveComments={handleRemoveComments}
            />
          </div>
          
          {!isCodeEditorCollapsed && (
            <div
                onMouseDown={startPanelResize}
                className="w-full h-1.5 cursor-row-resize bg-gray-200 hover:bg-blue-600 transition-colors flex-shrink-0"
            />
          )}

          <div 
            className="w-full flex flex-col min-h-0"
            style={{ 
              flex: isCodeEditorCollapsed ? '1 1 auto' : `1 1 ${100 - codePanelBasis}%`
            }}
          >
            <ChatWindow
              chatHistory={chatHistory}
              isLoading={isLoading}
              onSendMessage={(msg) => handleSendMessage(msg, false)}
              onFailed={handleFailedCommand}
              onStopGeneration={handleStopGeneration}
            />
          </div>
        </div>
        <StatusBar 
          isLoading={isLoading}
          isSyncing={isSyncing}
          isPersonaLoaded={isPersonaLoaded}
          onLoadPersona={handleLoadPersonaClick}
          onShowPersona={handleOpenPersonaModal}
        />
      </div>
    </div>
  );
};

export default App;