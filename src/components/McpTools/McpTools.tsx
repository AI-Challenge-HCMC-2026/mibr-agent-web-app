import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchMcpTools, DEFAULT_MCP_SERVER_URL, type McpTool } from '../../lib/mcpClient';
import { getStoredUserSettings } from '../../pages/Settings/Settings';
import './McpTools.css';

interface McpToolsProps {
  onSelectTool?: (toolName: string) => void;
  onNavigateToSettings?: () => void;
}

export const McpTools: React.FC<McpToolsProps> = ({ onSelectTool, onNavigateToSettings }) => {
  const { getToken } = useAuth();
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_MCP_SERVER_URL);

  const loadTools = async () => {
    setLoading(true);
    setError(null);

    const savedSettings = getStoredUserSettings();
    const urlToUse = savedSettings?.mcpServerUrl?.trim() || DEFAULT_MCP_SERVER_URL;
    setServerUrl(urlToUse);

    try {
      const token = await getToken();
      const fetchedTools = await fetchMcpTools(urlToUse, token);
      setTools(fetchedTools || []);
    } catch (err: any) {
      console.error('Failed to load MCP tools:', err);
      setError(err?.message || 'Không thể kết nối đến máy chủ MCP Server nội bộ');
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  const filteredTools = tools.filter((tool) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      tool.name.toLowerCase().includes(q) ||
      (tool.description && tool.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mcp-tools-container">
      {/* Header */}
      <div className="mcp-tools-header">
        <div className="mcp-tools-title-row">
          <div className="mcp-tools-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div>
            <h1 className="mcp-tools-title">MCP Tools</h1>
            <p className="mcp-tools-subtitle">
              Danh sách các công cụ Model Context Protocol (MCP) có sẵn từ máy chủ MCP Server nội bộ
            </p>
          </div>
        </div>
      </div>

      {/* Search & Counter Toolbar */}
      <div className="mcp-tools-toolbar">
        <div className="mcp-search-input-wrap">
          <svg className="mcp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="mcp-search-input"
            placeholder="Tìm kiếm công cụ MCP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="mcp-tools-count">
            Đang hiển thị {filteredTools.length} / {tools.length} công cụ
          </div>
          <button className="mcp-btn mcp-btn-secondary" onClick={loadTools} disabled={loading} title="Làm mới danh sách công cụ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Làm mới
          </button>
        </div>
      </div>

      {/* Body: Loading, Error, or Tools Grid */}
      {loading ? (
        <div className="mcp-empty-state">
          <div className="mcp-loading-spinner" />
          <p>Đang tải danh sách công cụ MCP từ máy chủ nội bộ...</p>
        </div>
      ) : error ? (
        <div className="mcp-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" style={{ marginBottom: 12 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ color: '#f87171', fontWeight: 600, marginBottom: 8 }}>{error}</p>
          <p style={{ fontSize: 13, color: '#8c8a83' }}>Vui lòng kiểm tra lại kết nối mạng hoặc URL MCP Server trong phần Cài đặt.</p>
          <button className="mcp-btn mcp-btn-primary" onClick={loadTools} style={{ marginTop: 16 }}>
            Thử lại
          </button>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="mcp-empty-state">
          <p>Không tìm thấy công cụ MCP nào phù hợp.</p>
        </div>
      ) : (
        <div className="mcp-tools-grid">
          {filteredTools.map((tool) => {
            const props = tool.inputSchema?.properties || {};
            const requiredProps = tool.inputSchema?.required || [];
            const propKeys = Object.keys(props);

            return (
              <div key={tool.name} className="mcp-tool-card">
                <div>
                  <div className="mcp-tool-card-header">
                    <div className="mcp-tool-name">{tool.name}</div>
                    <div className="mcp-tool-badge">MCP Tool</div>
                  </div>

                  <div className="mcp-tool-desc">
                    {tool.description || 'Chưa có mô tả cho công cụ này.'}
                  </div>

                  {propKeys.length > 0 && (
                    <div className="mcp-params-section">
                      <div className="mcp-params-title">Tham số đầu vào ({propKeys.length})</div>
                      <div className="mcp-params-list">
                        {propKeys.map((pKey) => {
                          const pObj = props[pKey] || {};
                          const isReq = requiredProps.includes(pKey);
                          return (
                            <div key={pKey} className="mcp-param-item">
                              <div className="mcp-param-header">
                                <span className="mcp-param-name">{pKey}</span>
                                <span className="mcp-param-type">{pObj.type || 'string'}</span>
                                {isReq && <span className="mcp-param-req">bắt buộc</span>}
                              </div>
                              {pObj.description && (
                                <div className="mcp-param-desc">{pObj.description}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mcp-tool-footer">
                  {onSelectTool && (
                    <button
                      className="mcp-btn mcp-btn-primary"
                      onClick={() => onSelectTool(tool.name)}
                    >
                      Dùng công cụ này
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default McpTools;
