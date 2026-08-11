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
  onChunk?: (accumulatedText: string, chunkText: string) => void;
  onReasoningChunk?: (accumulatedReasoning: string) => void;
  onToolCallStart?: (toolName: string, args: Record<string, any>) => void;
  onToolCallEnd?: (toolName: string, result: any, isError?: boolean) => void;
}

export interface GeminiChatResponse {
  text: string;
  toolCalls: ToolCallInfo[];
  reasoningText?: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  totalTokenCount?: number;
}

// Extracts rate-limit info from a Gemini 429 (RESOURCE_EXHAUSTED) error.
// Returns null if the error is not a rate-limit error.
export function parseRateLimitError(error: unknown): { retryAfterSeconds: number } | null {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const anyErr = error as any;
  const code = anyErr?.status ?? anyErr?.code ?? anyErr?.error?.code;

  const isRateLimit =
    code === 429 ||
    code === 'RESOURCE_EXHAUSTED' ||
    /RESOURCE_EXHAUSTED|"code"\s*:\s*429|exceeded your current quota|rate limit/i.test(raw);

  if (!isRateLimit) return null;

  // retryDelay comes back like "13s" or "13.26s"; fall back to a JSON-embedded value.
  let seconds = 0;
  const delayMatch = raw.match(/retry(?:Delay|\s*in)["\s:]*([\d.]+)\s*s/i);
  if (delayMatch) {
    seconds = parseFloat(delayMatch[1]);
  } else {
    const structured = anyErr?.error?.details?.find?.(
      (d: any) => typeof d?.retryDelay === 'string'
    );
    if (structured) {
      seconds = parseFloat(String(structured.retryDelay));
    }
  }

  return { retryAfterSeconds: Math.max(1, Math.ceil(seconds || 30)) };
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
  let onChunk: ((accumulatedText: string, chunkText: string) => void) | undefined;
  let onReasoningChunk: ((accumulatedReasoning: string) => void) | undefined;
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
    onChunk = optionsOrHistory.onChunk;
    onReasoningChunk = optionsOrHistory.onReasoningChunk;
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

  let selectedModel = (userSettings?.model || '').trim();
  if (!selectedModel) {
    selectedModel = 'gemini-3.5-flash-lite';
  }

  const executedToolCalls: ToolCallInfo[] = [];
  let rateLimitInfo: { retryAfterSeconds: number } | null = null;

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

    const enableReasoning = userSettings?.enableReasoning ?? true;

    const createChatSession = (modelId: string, withReasoning: boolean) => {
      const configObj: any = {};
      if (systemInstruction) configObj.systemInstruction = systemInstruction;
      if (toolsConfig.length > 0) configObj.tools = toolsConfig;
      if (withReasoning) {
        // includeThoughts is required for the API to actually emit thought-summary
        // parts (part.thought === true); without it the model thinks silently.
        configObj.thinkingConfig = { thinkingBudget: 2048, includeThoughts: true };
      }

      return ai.chats.create({
        model: modelId,
        history,
        config: configObj,
      });
    };

    let chat: any;
    try {
      chat = createChatSession(selectedModel, enableReasoning);
    } catch (err) {
      console.warn(`[Gemini] Initial chat creation failed for model ${selectedModel}, retrying without reasoning config:`, err);
      chat = createChatSession(selectedModel, false);
    }

    let accumulatedReasoning = '';

    const collectReasoning = (resObj: any) => {
      const candidate = resObj?.candidates?.[0];
      const parts = candidate?.content?.parts || resObj?.parts;
      if (Array.isArray(parts)) {
        let chunkDelta = '';
        for (const part of parts) {
          const pAny = part as any;
          if (pAny.thought === true || (pAny.thought && typeof pAny.thought !== 'object')) {
            if (typeof pAny.text === 'string') {
              chunkDelta += pAny.text;
            }
          } else if (typeof pAny.thought === 'string') {
            chunkDelta += pAny.thought;
          } else if (pAny.executableCode?.code) {
            chunkDelta += `\n\`\`\`python\n${pAny.executableCode.code}\n\`\`\`\n`;
          }
        }
        if (chunkDelta) {
          accumulatedReasoning += chunkDelta;
          onReasoningChunk?.(accumulatedReasoning);
        }
      }
    };

    const getChunkText = (chunkObj: any): string => {
      if (!chunkObj) return '';

      const candidate = chunkObj.candidates?.[0];
      const parts = candidate?.content?.parts || chunkObj.parts;
      if (Array.isArray(parts)) {
        let regularText = '';
        for (const part of parts) {
          const pAny = part as any;
          // Strictly exclude thought process parts and function calls
          const isThoughtPart = Boolean(pAny.thought);
          if (typeof pAny.text === 'string' && !pAny.functionCall && !isThoughtPart) {
            regularText += pAny.text;
          }
        }
        return regularText;
      }

      return '';
    };

    let accumulatedText = '';
    let totalTokenCount: number | undefined;

    // usageMetadata arrives on stream chunks (cumulative); the last one that
    // carries it is authoritative for the turn.
    const collectUsage = (chunkObj: any) => {
      const total = chunkObj?.usageMetadata?.totalTokenCount;
      if (typeof total === 'number') totalTokenCount = total;
    };

    // Function calls can be split across streaming chunks — the last chunk is
    // NOT guaranteed to carry them. Collect them from every chunk so a trailing
    // text/empty chunk never drops the tool call.
    const collectFunctionCalls = (chunkObj: any): Array<{ name: string; args: any }> => {
      const collected: Array<{ name: string; args: any }> = [];
      if (!chunkObj) return collected;

      if (Array.isArray(chunkObj.functionCalls)) {
        for (const fc of chunkObj.functionCalls) {
          if (fc?.name) collected.push({ name: fc.name, args: fc.args || {} });
        }
      }

      const parts = chunkObj.candidates?.[0]?.content?.parts || chunkObj.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const fc = (part as any)?.functionCall;
          if (fc?.name) collected.push({ name: fc.name, args: fc.args || {} });
        }
      }

      return collected;
    };

    const processStream = async (msgPayload: any) => {
      let lastChunk: any = null;
      const streamedFunctionCalls: Array<{ name: string; args: any }> = [];
      // The SDK expects { message: <string | Part[]> }. A raw string is a plain
      // user turn; an array is a set of functionResponse parts to send back.
      const sendParam =
        typeof msgPayload === 'string'
          ? { message: msgPayload }
          : Array.isArray(msgPayload)
            ? { message: msgPayload }
            : msgPayload;

      try {
        const stream = await chat.sendMessageStream(sendParam as any);
        for await (const chunk of stream) {
          lastChunk = chunk;
          collectReasoning(chunk);
          collectUsage(chunk);
          streamedFunctionCalls.push(...collectFunctionCalls(chunk));
          const cText = getChunkText(chunk);
          if (cText) {
            accumulatedText += cText;
            onChunk?.(accumulatedText, cText);
          }
        }
      } catch (streamErr) {
        const streamRateLimit = parseRateLimitError(streamErr);
        if (streamRateLimit) {
          rateLimitInfo = streamRateLimit;
          throw streamErr;
        }
        console.warn('[Gemini Stream] Stream failed, falling back to standard response:', streamErr);
        try {
          const singleRes = await chat.sendMessage(sendParam as any);
          lastChunk = singleRes;
          collectReasoning(singleRes);
          collectUsage(singleRes);
          streamedFunctionCalls.push(...collectFunctionCalls(singleRes));
          const sText = getChunkText(singleRes);
          if (sText) {
            accumulatedText = sText;
            onChunk?.(accumulatedText, sText);
          }
        } catch (fallbackErr) {
          const fallbackRateLimit = parseRateLimitError(fallbackErr);
          if (fallbackRateLimit) {
            rateLimitInfo = fallbackRateLimit;
            throw fallbackErr;
          }
          console.error('[Gemini sendMessage] Both stream and standard call failed:', fallbackErr);
        }
      }
      return { lastChunk, functionCalls: streamedFunctionCalls };
    };

    let streamResult = await processStream(newMessageText);
    let response = streamResult.lastChunk;

    // Multi-turn Tool Calling Loop
    const MAX_TURNS = 10;
    let turnCount = 0;

    while (turnCount < MAX_TURNS) {
      // Function calls gathered across the whole stream (see collectFunctionCalls) —
      // more reliable than reading only the final chunk.
      const functionCalls = streamResult.functionCalls;

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

      // Reset accumulated text for final answer after tool call turn
      const prevText = accumulatedText;
      accumulatedText = '';
      streamResult = await processStream(functionResponses as any);
      response = streamResult.lastChunk;

      // If no new text was produced after tool execution, restore previous text
      if (!accumulatedText.trim() && prevText.trim()) {
        accumulatedText = prevText;
      }
    }

    let finalText = accumulatedText.trim();
    if (!finalText && getChunkText(response)) {
      finalText = getChunkText(response);
    }

    const extractedReasoning = accumulatedReasoning.trim();

    // If regular response text is empty, but we have reasoning or tool calls, treat as valid!
    if (!finalText) {
      if (executedToolCalls.length > 0 || extractedReasoning.length > 0) {
        finalText = '';
      } else {
        finalText = 'Không có phản hồi từ Gemini AI.';
      }
    }

    if (isOptionsObject) {
      return {
        text: finalText,
        toolCalls: executedToolCalls,
        reasoningText: extractedReasoning || undefined,
        totalTokenCount,
      };
    }

    return finalText;
  } catch (error: unknown) {
    console.error('Gemini Chat API Error:', error);
    const rateLimit = rateLimitInfo || parseRateLimitError(error);
    if (rateLimit) {
      const rlMsg = `Bạn đã đạt giới hạn số lượng yêu cầu (rate limit). Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.`;
      return isOptionsObject
        ? {
            text: rlMsg,
            toolCalls: executedToolCalls,
            rateLimited: true,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          }
        : rlMsg;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullErr = `Lỗi kết nối Gemini AI: ${errorMessage}`;
    return isOptionsObject ? { text: fullErr, toolCalls: executedToolCalls } : fullErr;
  }
}
