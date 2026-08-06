import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Chat.css';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  eyebrow?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
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

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userEmail = (location.state as { email?: string } | null)?.email ?? 'user@example.com';
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [inputMessage, setInputMessage] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [activeSession?.messages, isResponding]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isResponding) return;

    const userMsgText = inputMessage.trim();
    setInputMessage('');

    // Add user message to active session
    const userMsg: Message = {
      id: `m-user-${Date.now()}`,
      sender: 'user',
      content: userMsgText,
    };

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            messages: [...session.messages, userMsg],
          };
        }
        return session;
      })
    );

    setIsResponding(true);

    // Simulate response after a delay
    setTimeout(() => {
      const botMsg: Message = {
        id: `m-bot-${Date.now()}`,
        sender: 'assistant',
        eyebrow: 'Generated response using Gemini',
        content: `I received your message: "${userMsgText}". This is a mock simulation response in React. You can integrate real LLM APIs or backend endpoints here!`,
      };

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === activeSessionId) {
            // Also update session title if it was a new/default chat
            const updatedTitle =
              session.title === 'New Chat' || session.title.startsWith('New chat')
                ? userMsgText.slice(0, 30) + (userMsgText.length > 30 ? '...' : '')
                : session.title;

            return {
              ...session,
              title: updatedTitle,
              messages: [...session.messages, botMsg],
            };
          }
          return session;
        })
      );
      setIsResponding(false);
    }, 1500);
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
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="page-chat-wrapper">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="brand">
          <div className="brand-name">MIBR</div>
          <div className="brand-icons">
            <svg 
              className="icon-btn" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              onClick={handleNewChat}
            >
              <title>New Chat</title>
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <svg className="icon-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </div>
        </div>

        <div className="nav-item" onClick={handleNewChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New chat
        </div>
        <div className="nav-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chats
        </div>
        <div className="nav-item" style={{ opacity: 0.5 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          Code
          <span className="badge">Upgrade</span>
        </div>

        <div className="section-label">Products</div>
        <div className="nav-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9"/>
          </svg>
          Design
        </div>

        <div className="section-label">
          Recents
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="21" y1="10" x2="7" y2="10"/>
            <line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="21" y1="14" x2="3" y2="14"/>
            <line x1="21" y1="18" x2="7" y2="18"/>
          </svg>
        </div>

        <div className="recents">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`recent-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              {session.title || 'Empty chat'}
              <span className="dots">⋮</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="avatar">{getInitials(userEmail)}</div>
          <div className="footer-text">
            <div className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', whiteSpace: 'nowrap' }}>
              {userEmail.split('@')[0]}
            </div>
            <div className="plan">Free plan</div>
          </div>
          <div
            className="footer-icon"
            title="Log out"
            onClick={() => navigate('/')}
          >
            {/* Logout icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">
            {activeSession ? activeSession.title : 'Chat'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
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
                  return (
                    <div key={msg.id} className="assistant-block">
                      {msg.eyebrow && <div className="eyebrow">{msg.eyebrow}</div>}
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>
                    </div>
                  );
                }
              })
            )}

            {isResponding && (
              <div className="assistant-block" style={{ opacity: 0.7 }}>
                <div className="eyebrow">Thinking...</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
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
                  Sonnet 3.5 &nbsp;Medium{' '}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style={{ cursor: 'pointer' }}>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                </svg>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style={{ cursor: 'pointer' }} onClick={handleSendMessage}>
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </div>
            </div>
          </div>
          <div className="footnote">MIBR is AI and can make mistakes. Please double-check responses.</div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
