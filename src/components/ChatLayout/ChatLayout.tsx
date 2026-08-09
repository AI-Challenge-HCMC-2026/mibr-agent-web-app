import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../pages/Chat/Chat.css';

export interface ChatSession {
  id: string;
  title: string;
  messages: any[];
}

interface ChatLayoutProps {
  /** Which top-level nav item is active */
  activeNav: 'chat' | 'mcp-tools' | 'api-docs' | 'settings';
  /** Chat sessions for the recents list (only shown/used on the chat route) */
  sessions?: ChatSession[];
  activeSessionId?: string;
  onSelectSession?: (id: string) => void;
  onNewChat?: () => void;
  onDeleteSession?: (id: string, e: React.MouseEvent) => void;
  onRenameSession?: (id: string, title: string) => void;
  children: React.ReactNode;
}

const getInitials = (email: string) => email.slice(0, 2).toUpperCase();

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  activeNav,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  children,
}) => {
  const navigate = useNavigate();
  const { user, signOut: authSignOut, getToken } = useAuth();
  const userEmail = user?.email || '';
  const userName = user?.name || (userEmail ? userEmail.split('@')[0] : 'User');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  // Sync user settings from API on initial login/mount
  useEffect(() => {
    const syncUserSettingsOnMount = async () => {
      if (!user?.id) return;
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(
          `https://ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech/mibr/rest/v1/user_settings?user_id=eq.${user.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
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
                enableReasoning: parsed.enableReasoning !== undefined ? Boolean(parsed.enableReasoning) : true,
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

  const handleChatNav = () => {
    if (onNewChat) onNewChat();
    navigate('/chat');
  };

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim() && onRenameSession) {
      onRenameSession(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

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
            className={`nav-item ${activeNav === 'chat' ? 'active' : ''}`}
            onClick={handleChatNav}
            title="Chats"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
            </svg>
            {!isSidebarCollapsed && <span>Chats</span>}
          </div>

          <div
            className={`nav-item ${activeNav === 'mcp-tools' ? 'active' : ''}`}
            onClick={() => navigate('/mcp-tools')}
            title="MCP Tools"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            {!isSidebarCollapsed && <span>MCP Tools</span>}
          </div>

          <div
            className={`nav-item ${activeNav === 'api-docs' ? 'active' : ''}`}
            onClick={() => navigate('/api-docs')}
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
            className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {!isSidebarCollapsed && <span>Settings</span>}
          </div>
        </div>

        {/* Recents list — only relevant on the chat route */}
        {!isSidebarCollapsed && activeNav === 'chat' && sessions.length > 0 && (
          <div className="recents-container">
            <div className="recents-header">
              <span>Recent chats</span>
              <span className="recents-count">{sessions.length}</span>
            </div>

            <div className="recent-list">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`recent-item ${activeSessionId === session.id ? 'active' : ''}`}
                  onClick={() => onSelectSession?.(session.id)}
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
                      onClick={(e) => onDeleteSession?.(session.id, e)}
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
        {children}
      </div>
    </div>
  );
};

export default ChatLayout;
