import { GoogleGenAI, Chat, FunctionDeclaration, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const updateFilesFunctionDeclaration: FunctionDeclaration = {
  name: 'updateFiles',
  description: "Updates, creates, or deletes one or more files in the user's project. Use this to apply code changes directly.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      updates: {
        type: Type.ARRAY,
        description: 'A list of file operations to perform.',
        items: {
          type: Type.OBJECT,
          properties: {
            filePath: {
              type: Type.STRING,
              description: "The full path of the file to be updated or deleted. For example, 'lib/main.dart'."
            },
            newContent: {
              type: Type.STRING,
              description: "The complete new content for the file. Provide `null` or omit this field to delete the file."
            }
          },
          required: ['filePath']
        }
      }
    },
    required: ['updates']
  }
};

export const DEFAULT_PERSONA = `You are an expert Flutter/Dart developer. Your role is to provide clear, concise, and accurate assistance to the user regarding their Flutter code. Analyze the provided file context and user questions to offer solutions, explanations, and best practices. When you provide code changes that should be applied to the project, you must use the 'updateFiles' tool to apply them directly. This includes updating existing files, creating new files, and deleting files by passing null as the newContent.`;

const chat: Chat = ai.chats.create({
    model: 'gemini-2.5-pro',
    config: {
        systemInstruction: DEFAULT_PERSONA,
        tools: [{ functionDeclarations: [updateFilesFunctionDeclaration] }],
    },
});

export const sendMessageToGemini = async (
    message: string,
    fileTree: string,
    filePath: string | null,
    fileContent: string | null
) => {
    let context = "This is the user's current project structure:\n```\n" + fileTree + "\n```\n\n";

    if (filePath && fileContent) {
        context += `The user is currently viewing the file: \`${filePath}\`\nHere is its content:\n\`\`\`dart\n${fileContent}\n\`\`\`\n\n`;
    }
    
    const fullPrompt = context + "User's instruction: " + message;

    try {
        const stream = await chat.sendMessageStream({ message: fullPrompt });
        return stream;
    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        throw error;
    }
};