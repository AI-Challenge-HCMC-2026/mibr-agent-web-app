import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendGeminiChatMessage, type ToolCallInfo } from '../../lib/geminiApi';
import ApiDocuments from '../../components/ApiDocuments/ApiDocuments';
import McpTools from '../../components/McpTools/McpTools';
import FormattedMessage from '../../components/FormattedMessage/FormattedMessage';
import { getStoredUserSettings, SettingsContent } from '../Settings/Settings';
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

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

interface ChatProps {
  initialTab?: 'chat' | 'mcp-tools' | 'api-docs' | 'settings';
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

export const Chat: React.FC<ChatProps> = ({ initialTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut: authSignOut, getToken } = useAuth();
  const userEmail = user?.email || '';
  const userName = user?.name || (userEmail ? userEmail.split('@')[0] : 'User');
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [activeTab, setActiveTab] = useState<'chat' | 'mcp-tools' | 'api-docs' | 'settings'>(
    initialTab || (location.pathname === '/settings' ? 'settings' : 'chat')
  );
  const [inputMessage, setInputMessage] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [activeToolStatus, setActiveToolStatus] = useState<string | null>(null);
  const [openToolTraces, setOpenToolTraces] = useState<Record<string, boolean>>({});
  const [openReasoningTraces, setOpenReasoningTraces] = useState<Record<string, boolean>>({});
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      if (updated.length === 0) {
        const newId = `session-${Date.now()}`;
        const fallbackSession: ChatSession = {
          id: newId,
          title: 'New chat',
          messages: [],
        };
        setActiveSessionId(newId);
        return [fallbackSession];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(updated[0].id);
      }
      return updated;
    });
  };

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim()) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: editingTitle.trim() } : s))
      );
    }
    setEditingSessionId(null);
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    if (location.state?.createNewChat) {
      handleNewChat();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Sync user settings from API on initial login/mount
  useEffect(() => {
    const syncUserSettingsOnMount = async () => {
      if (!user?.id) return;
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(
          `https://ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech/mibr/rest/v1/user_settings?user_id=eq.${user.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const config = data[0];
            const parsed = typeof config.settings === 'string' ? JSON.parse(config.settings) : config.settings || {};
            localStorage.setItem('mibr_user_gemini_api_key', config.apikey || '');
            localStorage.setItem(
              'mibr_user_settings',
              JSON.stringify({
                provider: config.provider || 'gemini',
                apikey: config.apikey || '',
                model: parsed.model || 'gemini-3.5-flash-lite',
                mcpServerUrl: parsed.mcpServerUrl || 'https://ai-challenge-search-engine.onrender.com/mcp',
                enableMcp: parsed.enableMcp !== undefined ? Boolean(parsed.enableMcp) : true,
              })
            );
          }
        }
      } catch (err) {
        console.warn('Failed to sync user settings on mount:', err);
      }
    };

    syncUserSettingsOnMount();
  }, [user?.id, getToken]);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [activeSession?.messages, isResponding, activeToolStatus]);

  const toggleToolTrace = (msgId: string) => {
    setOpenToolTraces((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const toggleReasoningTrace = (msgId: string) => {
    setOpenReasoningTraces((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isResponding) return;

    const userMsgText = inputMessage.trim();
    setInputMessage('');

    const savedSettings = getStoredUserSettings();
    const modelDisplayName = formatModelLabel(savedSettings?.model);

    // Add user message & initial empty bot message placeholder to active session
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

    try {
      // Get fresh session token from AuthContext / Neon Auth
      const userToken = await getToken();

      const result = await sendGeminiChatMessage({
        historyMessages: currentHistory.map((m) => ({ sender: m.sender, content: m.content })),
        newMessageText: userMsgText,
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
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === activeSessionId) {
            return {
              ...session,
              messages: session.messages.map((m) => {
                if (m.id === botMsgId) {
                  const validText =
                    responseText && responseText !== 'Không có phản hồi từ Gemini AI.'
                      ? responseText
                      : (m.content || responseText);
                  return {
                    ...m,
                    content: validText,
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
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      title: `New chat ${sessions.length + 1}`,
      messages: [],
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    setActiveTab('chat');
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  const formatModelLabel = (modelKey?: string) => {
    if (!modelKey) return 'Gemini 3.5 Flash Lite';
    if (modelKey === 'gemini-3.5-flash-lite') return 'Gemini 3.5 Flash Lite';
    if (modelKey === 'gemini-3.1-flash-lite') return 'Gemini 3.1 Flash Lite';
    return modelKey;
  };

  const savedSettings = getStoredUserSettings();
  const currentModelLabel = formatModelLabel(savedSettings?.model);

  return (
    <div className="page-chat-wrapper">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className="brand">
          {!isSidebarCollapsed && (
            <div className="brand-logo-wrap">
              <div className="brand-badge">M</div>
              <div className="brand-name">MIBR AI</div>
            </div>
          )}
          <button className="sidebar-toggle-btn" onClick={toggleSidebar} title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {/* Navigation items */}
        <div className="sidebar-nav">
          <div
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={handleNewChat}
            title="Cuộc trò chuyện mới"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
            </svg>
            {!isSidebarCollapsed && <span>Chats</span>}
          </div>

          <div
            className={`nav-item ${activeTab === 'mcp-tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('mcp-tools')}
            title="MCP Tools"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            {!isSidebarCollapsed && <span>MCP Tools</span>}
          </div>

          <div
            className={`nav-item ${activeTab === 'api-docs' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-docs')}
            title="API Documents"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {!isSidebarCollapsed && <span>API Documents</span>}
          </div>

          <div
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {!isSidebarCollapsed && <span>Settings</span>}
          </div>
        </div>

        {/* Recents list */}
        {!isSidebarCollapsed && (
          <div className="recents-container">
            <div className="recents-header">
              <span>Recent chats</span>
              <span className="recents-count">{sessions.length}</span>
            </div>

            <div className="recent-list">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`recent-item ${activeSessionId === session.id && activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setActiveTab('chat');
                  }}
                  title={session.title}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="recent-item-icon">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                  </svg>

                  {editingSessionId === session.id ? (
                    <input
                      className="recent-item-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveRename(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(session.id);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="recent-item-title">{session.title}</span>
                  )}

                  <div className="recent-actions">
                    <button
                      className="recent-action-btn"
                      title="Rename"
                      onClick={(e) => handleStartRename(session, e)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button
                      className="recent-action-btn delete"
                      title="Delete"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-profile" title={isSidebarCollapsed ? userName : undefined}>
            {user?.image ? (
              <img src={user.image} alt={userName} className="user-avatar" />
            ) : (
              <div className="user-avatar text-avatar">
                {getInitials(userEmail || 'User')}
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="footer-text">
                <div className="name" title={userName}>
                  {userName}
                </div>
                <div className="plan">Free Plan</div>
              </div>
            )}
          </div>

          {!isSidebarCollapsed && (
            <div className="footer-actions">
              <button
                className="footer-icon-btn"
                title="Log out"
                onClick={async () => {
                  await authSignOut();
                  navigate('/');
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="main">
        {activeTab === 'mcp-tools' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, position: 'relative' }}>
            {isSidebarCollapsed && (
              <div style={{ position: 'absolute', top: 18, left: 18, zIndex: 10 }}>
                <button className="toggle-sidebar-btn" title="Expand sidebar" onClick={toggleSidebar}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              </div>
            )}
            <McpTools
              onSelectTool={(toolName) => {
                setActiveTab('chat');
                setInputMessage(`Hãy sử dụng công cụ MCP "${toolName}" để hỗ trợ tôi.`);
              }}
              onNavigateToSettings={() => setActiveTab('settings')}
            />
          </div>
        ) : activeTab === 'api-docs' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, position: 'relative' }}>
            {isSidebarCollapsed && (
              <div style={{ position: 'absolute', top: 18, left: 18, zIndex: 10 }}>
                <button className="toggle-sidebar-btn" title="Expand sidebar" onClick={toggleSidebar}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              </div>
            )}
            <ApiDocuments />
          </div>
        ) : activeTab === 'settings' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, position: 'relative', overflowY: 'auto' }}>
            {isSidebarCollapsed && (
              <div style={{ position: 'absolute', top: 18, left: 18, zIndex: 10 }}>
                <button className="toggle-sidebar-btn" title="Expand sidebar" onClick={toggleSidebar}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              </div>
            )}
            <SettingsContent />
          </div>
        ) : (
          <>
            <div className="topbar">
              <div className="topbar-left">
                {isSidebarCollapsed && (
                  <button className="toggle-sidebar-btn" title="Expand sidebar" onClick={toggleSidebar}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                  </button>
                )}
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
                  activeSession?.messages.map((msg) => {
                    if (msg.sender === 'user') {
                      return (
                        <div key={msg.id} className="user-bubble">
                          {msg.content}
                        </div>
                      );
                    } else {
                      const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
                      const isOpenTrace = Boolean(openToolTraces[msg.id]);
                      const hasReasoning = Boolean(msg.reasoning);
                      const isOpenReasoning = openReasoningTraces[msg.id] !== undefined ? Boolean(openReasoningTraces[msg.id]) : true;

                      return (
                        <div key={msg.id} className="assistant-block">
                          {msg.eyebrow && <div className="eyebrow">{msg.eyebrow}</div>}

                          {/* Claude-Style Reasoning Thought Process UI */}
                          {hasReasoning && (
                            <div className="claude-reasoning-container">
                              <div
                                className="claude-reasoning-header"
                                onClick={() => toggleReasoningTrace(msg.id)}
                                title={isOpenReasoning ? 'Thu gọn quá trình suy luận' : 'Xem chi tiết quá trình suy luận'}
                              >
                                <div className="claude-reasoning-title">
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className={`claude-chevron ${isOpenReasoning ? 'open' : ''}`}
                                  >
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                  <span>Quá trình suy luận</span>
                                </div>
                              </div>

                              {isOpenReasoning && (
                                <div className="claude-reasoning-body">
                                  <div className="claude-reasoning-text">
                                    {msg.reasoning}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* MCP Tool Calls Trace Card */}
                          {hasToolCalls && (
                            <div
                              style={{
                                marginBottom: '12px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                fontSize: '0.85rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  color: 'var(--accent-teal, #92EFFD)',
                                }}
                                onClick={() => toggleToolTrace(msg.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>🔧 Đã sử dụng {msg.toolCalls?.length} công cụ MCP Tool Call</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                  {isOpenTrace ? '▲ Thu gọn' : '▼ Chi tiết'}
                                </span>
                              </div>

                              {isOpenTrace && (
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {msg.toolCalls?.map((t, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.8rem',
                                        color: '#e0e0e0',
                                      }}
                                    >
                                      <div style={{ color: '#7dd3fc', fontWeight: 'bold' }}>
                                        ➔ {t.name}({JSON.stringify(t.args)})
                                      </div>
                                      {t.result && (
                                        <div style={{ marginTop: '4px', opacity: 0.85, whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
                                          {typeof t.result === 'string' ? t.result : JSON.stringify(t.result, null, 2)}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <FormattedMessage content={msg.content} />
                        </div>
                      );
                    }
                  })
                )}

                {isResponding && (
                  <div className="assistant-block" style={{ opacity: 0.85 }}>
                    <div className="eyebrow">
                      {activeToolStatus ? activeToolStatus : 'Thinking...'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
              <div className="composer">
                <textarea
                  className="composer-input"
                  rows={1}
                  placeholder="Write a message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isResponding}
                />
                <div className="composer-controls">
                  <button
                    className="plus-btn"
                    onClick={() => alert('Attachments are not supported in this mock interface.')}
                  >
                    +
                  </button>
                  <div className="right-controls">
                    <div className="model-pill">
                      {currentModelLabel} &nbsp;
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer' }}>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                    </svg>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer' }} onClick={handleSendMessage}>
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const ChatPage: React.FC<ChatProps> = (props) => {
  return <Chat {...props} />;
};

export default ChatPage;
