import { GoogleGenAI } from '@google/genai';

export interface ChatMessageContext {
  sender: 'user' | 'assistant';
  content: string;
}

export async function sendGeminiChatMessage(
  historyMessages: ChatMessageContext[],
  newMessageText: string
): Promise<string> {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';

  if (!apiKey) {
    return 'Chưa cấu hình VITE_GEMINI_API_KEY. Vui lòng thêm VITE_GEMINI_API_KEY vào file .env để bắt đầu trò chuyện với Gemini AI.';
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Convert history messages into Gemini role format
    const history = historyMessages
      .filter((m) => m.content && m.content.trim() !== '')
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history,
    });

    const response = await chat.sendMessage({
      message: newMessageText,
    });

    return response.text || 'Không có phản hồi từ Gemini AI.';
  } catch (error: unknown) {
    console.error('Gemini Chat API Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Lỗi kết nối Gemini AI: ${errorMessage}`;
  }
}
