import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendGeminiChatMessage, type ToolCallInfo } from '../../lib/geminiApi';
import FormattedMessage from '../../components/FormattedMessage/FormattedMessage';
import { ThoughtProcess, ReasoningProcess } from '../../components/FormattedMessage/ThoughtProcess';
import ChatLayout, { type ChatSession } from '../../components/ChatLayout/ChatLayout';
import { getStoredUserSettings, saveUserModel, AVAILABLE_MODELS } from '../Settings/Settings';
import { filterCommands, type SlashCommand } from './slashCommands';
import '../Settings/Settings.css';
import './Chat.css';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  eyebrow?: string;
  toolCalls?: ToolCallInfo[];
  reasoning?: string;
}

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Recreating Claude.ai website in HTML',
    messages: [
      {
        id: 'm1',
        sender: 'user',
        content: "Let's create a static html that clearly shows a perfect copy of claude.ai website",
      },
      {
        id: 'm2',
        sender: 'assistant',
        eyebrow: 'Weighed intellectual property concerns against alternative design solutions',
        content: `I can't create an exact replica of claude.ai — copying a company's specific branded design, logo, and interface that closely isn't something I can do, partly for IP reasons and partly because a pixel-perfect clone of a live product's UI could be misused (e.g., for phishing or impersonation).

What I **can** do instead:
1. **A chat-UI inspired by claude.ai's general style** — clean minimalist layout, sidebar with conversation history, message bubbles, similar color palette/spacing — built as an original design, not a literal copy of Anthropic's trademarked assets (logo, exact fonts/branding).
2. **A generic AI chat interface template** you can customize and reuse for your own projects.`,
      },
    ],
  },
  {
    id: 'session-2',
    title: 'Video chunking cho search engine',
    messages: [
      {
        id: 'm3',
        sender: 'user',
        content: 'Làm thế nào để cắt nhỏ (chunking) video hiệu quả để đưa vào cơ sở dữ liệu tìm kiếm vector?',
      },
      {
        id: 'm4',
        sender: 'assistant',
        content: `Cắt nhỏ video cho hệ thống tìm kiếm vector (như RAG đa phương tiện) có thể thực hiện theo một số cách chính:

1. **Chunking theo thời gian cố định (Fixed-time sliding window)**: Cắt video mỗi 15-30 giây. Đơn giản nhất nhưng dễ mất ngữ cảnh ở giữa các phân đoạn.
2. **Scene Detection (Phát hiện cảnh chuyển)**: Sử dụng các thư viện như \`PySceneDetect\` để cắt tại các điểm chuyển giao camera tự nhiên. Mỗi cảnh sẽ đại diện cho một hành động/chủ đề cụ thể.
3. **Chunking dựa trên Transcripts (Văn bản thuyết minh)**: Đồng bộ phụ đề (SRT/VTT) và cắt video dựa trên ranh giới các đoạn hội thoại hoặc đoạn văn sau khi phân tích ngữ nghĩa bằng các LLM/NLU.

Cách tiếp cận tối ưu là kết hợp **Scene Detection** cùng với việc trích xuất **Keyframes** và chạy mô hình **Vision-Language** (như CLIP hoặc Whisper cho âm thanh) để tạo embedding cho từng phân đoạn cảnh đó.`,
      },
    ],
  },
  {
    id: 'session-3',
    title: 'Function calling và MCP cho AI agents',
    messages: [
      {
        id: 'm5',
        sender: 'user',
        content: 'Sự khác biệt lớn nhất giữa Function Calling truyền thống và Model Context Protocol (MCP) là gì?',
      },
      {
        id: 'm6',
        sender: 'assistant',
        content: `Sự khác biệt lớn nhất nằm ở **Kiến trúc và Tính chuẩn hóa**:

- **Function Calling**: Mỗi hệ thống hoặc API định nghĩa schema JSON riêng và truyền trực tiếp vào LLM. AI Agent phải tự định dạng payload, gọi hàm cục bộ hoặc qua HTTP, sau đó trả kết quả về cho mô hình. Mỗi agent/project thường có cách triển khai độc quyền.
- **Model Context Protocol (MCP)**: Là một giao thức client-server chuẩn hóa do Anthropic đề xuất. MCP tách biệt vai trò rõ ràng:
  - **MCP Servers**: Cung cấp tài nguyên (files, DB), công cụ (tools) và prompt template qua một API đồng nhất.
  - **MCP Clients (như Claude Desktop, Antigravity)**: Kết nối với nhiều máy chủ MCP một cách dễ dàng mà không cần phải viết code wrapper riêng biệt cho từng API.

MCP giúp việc tích hợp các công cụ bên ngoài trở nên cắm-là-chạy (plug-and-play) giống như giao thức LSP (Language Server Protocol) trong phát triển IDE.`,
      },
    ],
  },
];

const formatModelLabel = (modelKey?: string) => {
  if (!modelKey) return 'Gemini 3.5 Flash Lite';
  const labels: Record<string, string> = {
    'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
    'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
    'gemini-3.6-flash': 'Gemini 3.6 Flash',
    'gemini-3.5-flash': 'Gemini 3.5 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemma-4-31b-it': 'Gemma 4 31B',
    'gemma-4-26b-a4b-it': 'Gemma 4 26B',
  };
  return labels[modelKey] || modelKey;
};

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [inputMessage, setInputMessage] = useState('');
  const [activeCommand, setActiveCommand] = useState<SlashCommand | null>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [menuHighlight, setMenuHighlight] = useState(0);
  const [isResponding, setIsResponding] = useState(false);
  const [activeToolStatus, setActiveToolStatus] = useState<string | null>(null);
  const [streamingBotMsgId, setStreamingBotMsgId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => getStoredUserSettings()?.model || 'gemini-3.5-flash-lite'
  );
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const filteredCommands = filterCommands(commandFilter);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const handleNewChat = () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      title: `New chat ${sessions.length + 1}`,
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      if (updated.length === 0) {
        const newId = `session-${Date.now()}`;
        setActiveSessionId(newId);
        return [{ id: newId, title: 'New chat', messages: [] }];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(updated[0].id);
      }
      return updated;
    });
  };

  const handleRenameSession = (sessionId: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
  };

  useEffect(() => {
    if (location.state?.createNewChat) {
      handleNewChat();
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (location.state?.prefillMessage) {
      setInputMessage(location.state.prefillMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [activeSession?.messages, isResponding, activeToolStatus]);

  useEffect(() => {
    if (!showModelMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showModelMenu]);

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds > 0]);

  const handleSelectModel = (modelValue: string) => {
    setSelectedModel(modelValue);
    saveUserModel(modelValue);
    setShowModelMenu(false);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isResponding || rateLimitSeconds > 0) return;

    const userMsgText = inputMessage.trim();
    const messageToSend = activeCommand
      ? activeCommand.buildMessage(userMsgText)
      : userMsgText;
    setInputMessage('');
    setActiveCommand(null);
    setShowCommandMenu(false);

    const savedSettings = getStoredUserSettings();
    const modelDisplayName = formatModelLabel(savedSettings?.model);

    const userMsg: Message = {
      id: `m-user-${Date.now()}`,
      sender: 'user',
      content: userMsgText,
    };

    const botMsgId = `m-bot-${Date.now()}`;
    const initialBotMsg: Message = {
      id: botMsgId,
      sender: 'assistant',
      eyebrow: modelDisplayName,
      content: '',
    };

    const currentHistory = activeSession ? activeSession.messages : [];

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === activeSessionId) {
          const updatedTitle =
            session.title === 'New Chat' || session.title.startsWith('New chat')
              ? userMsgText.slice(0, 30) + (userMsgText.length > 30 ? '...' : '')
              : session.title;
          return {
            ...session,
            title: updatedTitle,
            messages: [...session.messages, userMsg, initialBotMsg],
          };
        }
        return session;
      })
    );

    setIsResponding(true);
    setActiveToolStatus(null);
    setStreamingBotMsgId(botMsgId);

    try {
      const userToken = await getToken();

      const result = await sendGeminiChatMessage({
        historyMessages: currentHistory.map((m) => ({ sender: m.sender, content: m.content })),
        newMessageText: messageToSend,
        userToken,
        onChunk: (accumulatedText) => {
          setSessions((prev) =>
            prev.map((session) => {
              if (session.id === activeSessionId) {
                return {
                  ...session,
                  messages: session.messages.map((m) =>
                    m.id === botMsgId ? { ...m, content: accumulatedText } : m
                  ),
                };
              }
              return session;
            })
          );
        },
        onReasoningChunk: (accumulatedReasoning) => {
          setSessions((prev) =>
            prev.map((session) => {
              if (session.id === activeSessionId) {
                return {
                  ...session,
                  messages: session.messages.map((m) =>
                    m.id === botMsgId ? { ...m, reasoning: accumulatedReasoning } : m
                  ),
                };
              }
              return session;
            })
          );
        },
        onToolCallStart: (toolName) => {
          setActiveToolStatus(`Đang thực thi công cụ MCP: ${toolName}...`);
        },
        onToolCallEnd: () => {
          setActiveToolStatus('Đang xử lý kết quả MCP...');
        },
      });

      const responseText = typeof result === 'string' ? result : result.text;
      const toolCalls = typeof result === 'string' ? [] : result.toolCalls;
      const reasoningText = typeof result === 'string' ? undefined : result.reasoningText;

      if (typeof result !== 'string' && result.rateLimited) {
        setRateLimitSeconds(result.retryAfterSeconds || 30);
      }
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === activeSessionId) {
            return {
              ...session,
              messages: session.messages.map((m) => {
                if (m.id === botMsgId) {
                  const trimmedResponse =
                    typeof responseText === 'string' ? responseText.trim() : '';
                  const finalContent =
                    trimmedResponse && responseText !== 'Không có phản hồi từ Gemini AI.'
                      ? responseText
                      : m.content;
                  return {
                    ...m,
                    content: finalContent,
                    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
                    reasoning: reasoningText || m.reasoning,
                  };
                }
                return m;
              }),
            };
          }
          return session;
        })
      );
    } catch (err) {
      console.error('Error generating Gemini response:', err);
    } finally {
      setIsResponding(false);
      setActiveToolStatus(null);
      setStreamingBotMsgId(null);
    }
  };

  const selectCommand = (cmd: SlashCommand) => {
    setActiveCommand(cmd);
    setShowCommandMenu(false);
    setCommandFilter('');
    setInputMessage('');
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputMessage(value);

    // Only trigger the command menu when no command is active yet and the
    // input starts with '/'. Once a command is picked, '/' is just text.
    if (!activeCommand && value.startsWith('/')) {
      setShowCommandMenu(true);
      setCommandFilter(value.slice(1));
      setMenuHighlight(0);
    } else {
      setShowCommandMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuHighlight((h) => (h + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuHighlight((h) => (h - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[menuHighlight]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandMenu(false);
        return;
      }
    }

    // Backspace at the very start of an empty query clears the active command pill.
    if (activeCommand && e.key === 'Backspace' && inputMessage === '') {
      e.preventDefault();
      setActiveCommand(null);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentModelLabel = formatModelLabel(selectedModel);

  return (
    <ChatLayout
      activeNav="chat"
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={setActiveSessionId}
      onNewChat={handleNewChat}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
    >
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">
            {activeSession ? activeSession.title : 'Chat'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <button className="share-btn" onClick={() => alert('Sharing is not supported in this mock interface.')}>Share</button>
      </div>

      <div className="chat-area" ref={chatAreaRef}>
        <div className="chat-inner">
          {activeSession && activeSession.messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-secondary)' }}>
              <h2>Start a new conversation</h2>
              <p style={{ marginTop: '10px' }}>Type a message below to begin chatting with the AI.</p>
            </div>
          ) : (
            activeSession?.messages.map((msg: Message) => {
              if (msg.sender === 'user') {
                return (
                  <div key={msg.id} className="user-bubble">
                    {msg.content}
                  </div>
                );
              }
              const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
              return (
                <div key={msg.id} className="assistant-block">
                  {msg.eyebrow && <div className="eyebrow">{msg.eyebrow}</div>}
                  <ReasoningProcess reasoning={msg.reasoning} />
                  {hasToolCalls && <ThoughtProcess toolCalls={msg.toolCalls!} />}
                  <FormattedMessage content={msg.content} />
                </div>
              );
            })
          )}

          {isResponding && (
            <div className="assistant-block" style={{ opacity: 0.85 }}>
              <div className="eyebrow">
                {activeToolStatus ? activeToolStatus : 'Thinking...'}
              </div>
              {(() => {
                const liveMsg = activeSession?.messages.find((m: Message) => m.id === streamingBotMsgId);
                const liveReasoning = liveMsg?.reasoning;
                if (liveReasoning && liveReasoning.trim()) {
                  return (
                    <div className="claude-reasoning-body claude-live-reasoning">
                      <FormattedMessage content={liveReasoning} />
                    </div>
                  );
                }
                return null;
              })()}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ animation: 'pulse 1s infinite alternate', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)' }}></span>
                <span style={{ animation: 'pulse 1s infinite alternate 0.2s', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)' }}></span>
                <span style={{ animation: 'pulse 1s infinite alternate 0.4s', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)' }}></span>
              </div>
              <style>{`
                @keyframes pulse {
                  from { opacity: 0.3; transform: scale(0.8); }
                  to { opacity: 1; transform: scale(1.2); }
                }
              `}</style>
            </div>
          )}
        </div>
      </div>

      <div className="composer-wrap">
        {rateLimitSeconds > 0 && (
          <div className="rate-limit-banner" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              Bạn đã đạt giới hạn yêu cầu (rate limit). Vui lòng thử lại sau{' '}
              <strong>{rateLimitSeconds}s</strong>.
            </span>
          </div>
        )}
        <div className="composer">
          {showCommandMenu && filteredCommands.length > 0 && (
            <div className="slash-menu">
              {filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.id}
                  className={`slash-menu-item${idx === menuHighlight ? ' active' : ''}`}
                  onMouseEnter={() => setMenuHighlight(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCommand(cmd);
                  }}
                >
                  <span className="slash-menu-name">{cmd.name}</span>
                  <span className="slash-menu-desc">{cmd.description}</span>
                </div>
              ))}
            </div>
          )}
          <div className="composer-input-row">
            {activeCommand && (
              <span className="command-pill">
                {activeCommand.name}
                <button
                  type="button"
                  className="command-pill-x"
                  onClick={() => {
                    setActiveCommand(null);
                    inputRef.current?.focus();
                  }}
                  aria-label="Remove command"
                >
                  ×
                </button>
              </span>
            )}
            <textarea
              ref={inputRef}
              className="composer-input"
              rows={1}
              placeholder={
                rateLimitSeconds > 0
                  ? `Đã đạt giới hạn — thử lại sau ${rateLimitSeconds}s...`
                  : activeCommand
                    ? activeCommand.queryPlaceholder
                    : 'Write a message... (type / for commands)'
              }
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isResponding || rateLimitSeconds > 0}
            />
          </div>
          <div className="composer-controls">
            <button
              className="attach-btn"
              onClick={() => alert('Attachments are not supported in this mock interface.')}
              aria-label="Attach file"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <div className="right-controls">
              <div className="model-selector" ref={modelMenuRef}>
                {showModelMenu && (
                  <div className="model-menu">
                    {AVAILABLE_MODELS.map((m) => (
                      <div
                        key={m.value}
                        className={`model-menu-item${m.value === selectedModel ? ' active' : ''}`}
                        onClick={() => handleSelectModel(m.value)}
                      >
                        {m.label}
                        {m.value === selectedModel && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="model-pill"
                  onClick={() => setShowModelMenu((v) => !v)}
                >
                  {currentModelLabel} &nbsp;
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer' }}>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: rateLimitSeconds > 0 || isResponding ? 'not-allowed' : 'pointer', opacity: rateLimitSeconds > 0 ? 0.4 : 1 }} onClick={handleSendMessage}>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </ChatLayout>
  );
};

export default Chat;
