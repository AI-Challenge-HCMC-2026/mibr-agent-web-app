import { GoogleGenAI } from '@google/genai';
import { getStoredGeminiApiKey, getStoredUserSettings } from '../pages/Settings/Settings';
import {
  fetchMcpTools,
  callMcpTool,
  convertMcpToolsToGemini,
  DEFAULT_MCP_SERVER_URL,
} from './mcpClient';

export interface ChatMessageContext {
  sender: 'user' | 'assistant';
  content: string;
}

export interface ToolCallInfo {
  name: string;
  args: Record<string, any>;
  result?: any;
  status: 'running' | 'completed' | 'failed';
}

export interface SendGeminiChatOptions {
  historyMessages: ChatMessageContext[];
  newMessageText: string;
  overrideApiKey?: string;
  userToken?: string | null;
  mcpServerUrl?: string;
  enableMcp?: boolean;
  onToolCallStart?: (toolName: string, args: Record<string, any>) => void;
  onToolCallEnd?: (toolName: string, result: any, isError?: boolean) => void;
}

export interface GeminiChatResponse {
  text: string;
  toolCalls: ToolCallInfo[];
}

export async function sendGeminiChatMessage(
  optionsOrHistory: ChatMessageContext[] | SendGeminiChatOptions,
  newMessageTextArg?: string,
  overrideApiKeyArg?: string
): Promise<GeminiChatResponse | string> {
  let historyMessages: ChatMessageContext[] = [];
  let newMessageText = '';
  let overrideApiKey: string | undefined;
  let userToken: string | null | undefined;
  let mcpServerUrl = DEFAULT_MCP_SERVER_URL;
  let enableMcp = true;
  let onToolCallStart: ((toolName: string, args: Record<string, any>) => void) | undefined;
  let onToolCallEnd: ((toolName: string, result: any, isError?: boolean) => void) | undefined;
  let isOptionsObject = false;

  if (Array.isArray(optionsOrHistory)) {
    historyMessages = optionsOrHistory;
    newMessageText = newMessageTextArg || '';
    overrideApiKey = overrideApiKeyArg;
  } else {
    isOptionsObject = true;
    historyMessages = optionsOrHistory.historyMessages || [];
    newMessageText = optionsOrHistory.newMessageText || '';
    overrideApiKey = optionsOrHistory.overrideApiKey;
    userToken = optionsOrHistory.userToken;
    mcpServerUrl = optionsOrHistory.mcpServerUrl || DEFAULT_MCP_SERVER_URL;
    enableMcp = optionsOrHistory.enableMcp ?? true;
    onToolCallStart = optionsOrHistory.onToolCallStart;
    onToolCallEnd = optionsOrHistory.onToolCallEnd;
  }

  const userSettings = getStoredUserSettings();
  const apiKey =
    overrideApiKey?.trim() ||
    userSettings?.apikey?.trim() ||
    getStoredGeminiApiKey().trim() ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    '';

  if (!apiKey) {
    const errorMsg = 'Chưa có Gemini API Key. Vui lòng vào trang "Settings" ở thanh điều hướng bên trái để nhập và lưu API Key của bạn.';
    return isOptionsObject ? { text: errorMsg, toolCalls: [] } : errorMsg;
  }

  const mcpUrlToUse = userSettings?.mcpServerUrl?.trim() || mcpServerUrl || DEFAULT_MCP_SERVER_URL;
  const mcpEnabled = userSettings?.enableMcp !== undefined ? userSettings.enableMcp : enableMcp;

  // Model selection
  let selectedModel = (userSettings?.model || '').trim();
  if (!selectedModel || !selectedModel.toLowerCase().startsWith('gemini-')) {
    selectedModel = 'gemini-3.5-flash-lite';
  }

  const executedToolCalls: ToolCallInfo[] = [];

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Discover tools if MCP is enabled
    let toolsConfig: any[] = [];
    if (mcpEnabled) {
      try {
        const mcpTools = await fetchMcpTools(mcpUrlToUse, userToken);
        if (mcpTools && mcpTools.length > 0) {
          toolsConfig = convertMcpToolsToGemini(mcpTools);
        }
      } catch (mcpErr) {
        console.warn('[Gemini] MCP tool discovery failed, continuing without tools:', mcpErr);
      }
    }

    // Convert history messages into Gemini role format
    const history = historyMessages
      .filter((m) => m.content && m.content.trim() !== '')
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = mcpEnabled
      ? `Bạn là MIBR AI Assistant - Trợ lý AI tích hợp giao thức Model Context Protocol (MCP) Tool Calls.
Bạn ĐÃ ĐƯỢC KẾT NỐI VÀ TRANG BỊ các công cụ MCP trực tiếp từ máy chủ MCP nội bộ (${mcpUrlToUse}).
Khi người dùng hỏi về khả năng MCP, các công cụ hiện có, hoặc yêu cầu thực hiện truy vấn/tác vụ, hãy tự tin khẳng định bạn đã kết nối với MCP Server nội bộ và chủ động thực thi công cụ MCP phù hợp.`
      : undefined;

    const chatOptions: any = {
      model: selectedModel,
      history,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(toolsConfig.length > 0 ? { tools: toolsConfig } : {}),
      },
    };

    const chat = ai.chats.create(chatOptions);

    let response = await chat.sendMessage({
      message: newMessageText,
    });

    // Multi-turn Tool Calling Loop
    const MAX_TURNS = 10;
    let turnCount = 0;

    while (turnCount < MAX_TURNS) {
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Extract function calls from response
      const functionCalls: Array<{ name: string; args: any }> = [];
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const fc of response.functionCalls) {
          if (fc.name) {
            functionCalls.push({ name: fc.name, args: fc.args || {} });
          }
        }
      } else {
        for (const part of parts) {
          if (part.functionCall && part.functionCall.name) {
            functionCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
          }
        }
      }

      if (functionCalls.length === 0) {
        break;
      }

      turnCount++;

      // Execute function calls via MCP Client
      const functionResponses: any[] = [];
      for (const call of functionCalls) {
        const toolName = call.name;
        const toolArgs = call.args || {};

        onToolCallStart?.(toolName, toolArgs);

        const toolResult = await callMcpTool(mcpUrlToUse, userToken, toolName, toolArgs);
        const isError = Boolean(toolResult?.isError);

        onToolCallEnd?.(toolName, toolResult, isError);

        executedToolCalls.push({
          name: toolName,
          args: toolArgs,
          result: toolResult,
          status: isError ? 'failed' : 'completed',
        });

        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { result: toolResult },
          },
        });
      }

      // Send tool outputs back to Gemini model
      response = await chat.sendMessage({
        message: functionResponses as any,
      });
    }

    const finalText = response.text || 'Không có phản hồi từ Gemini AI.';

    if (isOptionsObject) {
      return {
        text: finalText,
        toolCalls: executedToolCalls,
      };
    }

    return finalText;
  } catch (error: unknown) {
    console.error('Gemini Chat API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullErr = `Lỗi kết nối Gemini AI: ${errorMessage}`;
    return isOptionsObject ? { text: fullErr, toolCalls: executedToolCalls } : fullErr;
  }
}
