export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
}

export interface ChatPart {
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

export interface FileUpdate {
  filePath: string;
  newContent: string | null;
}
