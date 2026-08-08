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
        <h1 className="mcp-tools-title">MCP Tools</h1>
        <p className="mcp-tools-subtitle">
          Công cụ Model Context Protocol từ <code>{serverUrl}</code>
        </p>
      </div>

      {/* Search & Counter Toolbar */}
      <div className="mcp-tools-toolbar">
        <input
          className="mcp-search-input"
          placeholder="Tìm công cụ…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="mcp-toolbar-right">
          <span className="mcp-tools-count">
            {filteredTools.length} / {tools.length}
          </span>
          <button className="mcp-btn mcp-btn-secondary" onClick={loadTools} disabled={loading}>
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Body: Loading, Error, or Tools List */}
      {loading ? (
        <div className="mcp-empty-state">
          <p>Đang tải danh sách công cụ…</p>
        </div>
      ) : error ? (
        <div className="mcp-empty-state">
          <p className="mcp-error-text">{error}</p>
          <p className="mcp-error-hint">Kiểm tra lại kết nối mạng hoặc URL MCP Server trong Cài đặt.</p>
          <div className="mcp-empty-actions">
            <button className="mcp-btn mcp-btn-primary" onClick={loadTools}>
              Thử lại
            </button>
            {onNavigateToSettings && (
              <button className="mcp-btn mcp-btn-secondary" onClick={onNavigateToSettings}>
                Cài đặt MCP
              </button>
            )}
          </div>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="mcp-empty-state">
          <p>Không có công cụ nào phù hợp.</p>
        </div>
      ) : (
        <div className="mcp-tools-list">
          {filteredTools.map((tool) => {
            const props = tool.inputSchema?.properties || {};
            const requiredProps = tool.inputSchema?.required || [];
            const propKeys = Object.keys(props);

            return (
              <div key={tool.name} className="mcp-tool-card">
                <div className="mcp-tool-card-header">
                  <div className="mcp-tool-name">{tool.name}</div>
                  {onSelectTool && (
                    <button
                      className="mcp-btn mcp-btn-ghost"
                      onClick={() => onSelectTool(tool.name)}
                    >
                      Dùng
                    </button>
                  )}
                </div>

                <div className="mcp-tool-desc">
                  {tool.description || 'Chưa có mô tả.'}
                </div>

                {propKeys.length > 0 && (
                  <div className="mcp-params-section">
                    <div className="mcp-params-title">Tham số ({propKeys.length})</div>
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default McpTools;
