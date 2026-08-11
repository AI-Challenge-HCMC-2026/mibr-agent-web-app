import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendGeminiChatMessage, type ToolCallInfo } from '../../lib/geminiApi';
import FormattedMessage from '../../components/FormattedMessage/FormattedMessage';
import { ThoughtProcess, ReasoningProcess } from '../../components/FormattedMessage/ThoughtProcess';
import ChatLayout, { type ChatSession } from '../../components/ChatLayout/ChatLayout';
import { getStoredUserSettings, saveUserModel, AVAILABLE_MODELS } from '../Settings/Settings';
import { filterCommands, type SlashCommand } from './slashCommands';
import {
  fetchChatSessions,
  fetchSessionMessages,
  saveChatMessage,
  deleteChatSession,
  deleteAllChatHistory,
  newSessionId,
} from '../../lib/chatHistoryApi';
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

const DEFAULT_CONTEXT_LIMIT = 256_000;
const GEMMA_CONTEXT_LIMIT = 16_000;

const getContextLimit = (modelKey?: string) =>
  modelKey && modelKey.startsWith('gemma-') ? GEMMA_CONTEXT_LIMIT : DEFAULT_CONTEXT_LIMIT;

// Rough token estimate: ~4 characters per token.
const estimateTokens = (messages: { content: string; reasoning?: string }[]) =>
  Math.ceil(
    messages.reduce((sum, m) => sum + (m.content?.length || 0) + (m.reasoning?.length || 0), 0) / 4
  );

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
  const { user, getToken } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
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

  const createLocalSession = (): ChatSession => ({
    id: newSessionId(),
    title: 'New chat',
    messages: [],
    loaded: true,
  });

  const handleNewChat = () => {
    const newSession = createLocalSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  // Load the user's chat sessions from the history API once on mount / login.
  useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
      if (!user?.id) {
        // Not logged in yet — start with a single empty local session.
        const fresh = createLocalSession();
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
        setIsLoadingHistory(false);
        return;
      }
      setIsLoadingHistory(true);
      try {
        const token = await getToken();
        const remote = await fetchChatSessions(user.id, token);
        if (cancelled) return;
        const mapped: ChatSession[] = remote.map((s) => ({
          id: s.session_id,
          title: s.title || 'Untitled chat',
          messages: [],
          loaded: false,
        }));
        if (mapped.length === 0) {
          const fresh = createLocalSession();
          setSessions([fresh]);
          setActiveSessionId(fresh.id);
        } else {
          setSessions(mapped);
          setActiveSessionId(mapped[0].id);
        }
      } catch (err) {
        console.error('[Chat] Failed to load chat sessions:', err);
        if (!cancelled) {
          const fresh = createLocalSession();
          setSessions([fresh]);
          setActiveSessionId(fresh.id);
        }
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };
    loadSessions();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user?.id) {
      getToken()
        .then((token) => deleteChatSession(sessionId, user.id, token))
        .catch((err) => console.error('[Chat] Failed to delete session:', err));
    }
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      if (updated.length === 0) {
        const fresh = createLocalSession();
        setActiveSessionId(fresh.id);
        return [fresh];
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

  const handleClearAllHistory = async () => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      await deleteAllChatHistory(user.id, token);
    } catch (err) {
      console.error('[Chat] Failed to clear chat history:', err);
    }
    const fresh = createLocalSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  };

  // Lazily fetch the message history of whichever session is currently open.
  const activeSessionLoaded = sessions.find((s) => s.id === activeSessionId)?.loaded;
  useEffect(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || session.loaded || !user?.id) return;

    let cancelled = false;
    const loadMessages = async () => {
      try {
        const token = await getToken();
        const remote = await fetchSessionMessages(session.id, user.id, token);
        if (cancelled) return;
        const messages: Message[] = remote.map((m) => ({
          id: String(m.message_id),
          sender: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          eyebrow: m.role === 'user' ? undefined : (m.metadata?.model as string | undefined),
          toolCalls: (m.metadata?.toolCalls as ToolCallInfo[] | undefined) || undefined,
          reasoning: (m.metadata?.reasoning as string | undefined) || undefined,
        }));
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, messages, loaded: true } : s))
        );
      } catch (err) {
        console.error('[Chat] Failed to load session messages:', err);
        if (!cancelled) {
          setSessions((prev) =>
            prev.map((s) => (s.id === session.id ? { ...s, loaded: true } : s))
          );
        }
      }
    };
    loadMessages();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, user?.id, activeSessionLoaded]);

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
    const isNewSession =
      !activeSession ||
      activeSession.title === 'New chat' ||
      activeSession.title.startsWith('New chat');
    const sessionTitleForSave = isNewSession
      ? userMsgText.slice(0, 60)
      : activeSession?.title;

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

    // Persist the user's message immediately (auto-creates the session server-side).
    if (user?.id) {
      getToken()
        .then((token) =>
          saveChatMessage(
            {
              session_id: activeSessionId,
              user_id: user.id,
              role: 'user',
              content: userMsgText,
              title: sessionTitleForSave,
            },
            token
          )
        )
        .catch((err) => console.error('[Chat] Failed to persist user message:', err));
    }

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
      const totalTokenCount = typeof result === 'string' ? undefined : result.totalTokenCount;

      if (typeof result !== 'string' && result.rateLimited) {
        setRateLimitSeconds(result.retryAfterSeconds || 30);
      }
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === activeSessionId) {
            return {
              ...session,
              tokenCount:
                typeof totalTokenCount === 'number' ? totalTokenCount : session.tokenCount,
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

      const persistedContent =
        typeof responseText === 'string' && responseText.trim() ? responseText : '';
      if (user?.id && persistedContent) {
        try {
          const token = await getToken();
          await saveChatMessage(
            {
              session_id: activeSessionId,
              user_id: user.id,
              role: 'assistant',
              content: persistedContent,
              metadata: {
                model: modelDisplayName,
                reasoning: reasoningText,
                toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
                totalTokenCount,
              },
              title: sessionTitleForSave,
            },
            token
          );
        } catch (persistErr) {
          console.error('[Chat] Failed to persist assistant message:', persistErr);
        }
      }
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
  const contextLimit = getContextLimit(selectedModel);
  const hasServerTokenCount = typeof activeSession?.tokenCount === 'number';
  const usedTokens = hasServerTokenCount
    ? activeSession!.tokenCount!
    : estimateTokens(activeSession?.messages || []);
  const contextPercent = Math.min(100, (usedTokens / contextLimit) * 100);

  return (
    <ChatLayout
      activeNav="chat"
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={setActiveSessionId}
      onNewChat={handleNewChat}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
      onClearAllHistory={user?.id ? handleClearAllHistory : undefined}
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
          {isLoadingHistory ? (
            <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-secondary)' }}>
              <p>Đang tải lịch sử trò chuyện…</p>
            </div>
          ) : activeSession && activeSession.messages.length === 0 ? (
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
              <div
                className="context-meter"
                title={`Context: ${usedTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens (${Math.round(contextPercent)}%)${hasServerTokenCount ? '' : ' — ước lượng'}`}
              >
                <svg width="14" height="14" viewBox="0 0 36 36" className="context-ring">
                  <circle
                    className="context-ring-bg"
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="4"
                  />
                  <circle
                    className={`context-ring-fill${contextPercent >= 90 ? ' danger' : contextPercent >= 70 ? ' warn' : ''}`}
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(contextPercent / 100) * 2 * Math.PI * 15.5} ${2 * Math.PI * 15.5}`}
                    transform="rotate(-90 18 18)"
                  />
                </svg>
                <span className="context-meter-label">{Math.round(contextPercent)}%</span>
              </div>
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
