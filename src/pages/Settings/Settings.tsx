import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_MCP_SERVER_URL } from '../../lib/mcpClient';
import './Settings.css';

export interface UserSettingsData {
  provider: string;
  apikey: string;
  model: string;
  mcpServerUrl?: string;
  enableMcp?: boolean;
  enableReasoning?: boolean;
}

const SETTINGS_LOCAL_STORAGE_KEY = 'mibr_user_gemini_api_key';
const SETTINGS_FULL_LOCAL_STORAGE_KEY = 'mibr_user_settings';

export const getStoredGeminiApiKey = (): string => {
  return localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY) || '';
};

export const getStoredUserSettings = (): UserSettingsData | null => {
  try {
    const data = localStorage.getItem(SETTINGS_FULL_LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const GeminiSparkleLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2C12 7.52285 16.4771 12 22 12C16.4771 12 12 16.4771 12 22C12 16.4771 7.52285 12 2 12C7.52285 12 12 7.52285 12 2Z"
      fill="url(#gemini_sparkle_grad)"
    />
    <defs>
      <linearGradient id="gemini_sparkle_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1A73E8" />
        <stop offset="35%" stopColor="#6E85E8" />
        <stop offset="70%" stopColor="#A855F7" />
        <stop offset="100%" stopColor="#F43F5E" />
      </linearGradient>
    </defs>
  </svg>
);

export const SettingsContent: React.FC = () => {
  const { user, getToken } = useAuth();
  const [apikey, setApikey] = useState<string>('');
  const [model, setModel] = useState<string>('gemini-3.5-flash-lite');
  const [mcpServerUrl, setMcpServerUrl] = useState<string>(DEFAULT_MCP_SERVER_URL);
  const [enableMcp, setEnableMcp] = useState<boolean>(true);
  const [enableReasoning, setEnableReasoning] = useState<boolean>(true);

  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiBaseUrl = 'https://ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech/mibr/rest/v1';

  // Load existing settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      // Check local storage first for quick display
      const stored = getStoredUserSettings();
      if (stored) {
        if (stored.apikey) setApikey(stored.apikey);
        if (stored.model) setModel(stored.model);
        if (stored.mcpServerUrl) setMcpServerUrl(stored.mcpServerUrl);
        if (stored.enableMcp !== undefined) setEnableMcp(stored.enableMcp);
        if (stored.enableReasoning !== undefined) setEnableReasoning(stored.enableReasoning);
      }

      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setMessage(null);

      try {
        const token = await getToken();
        const response = await fetch(`${apiBaseUrl}/user_settings?user_id=eq.${user.id}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const userConfig = data[0];
            if (userConfig.apikey) {
              setApikey(userConfig.apikey);
              localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, userConfig.apikey);
            }
            if (userConfig.settings) {
              const parsedSettings =
                typeof userConfig.settings === 'string'
                  ? JSON.parse(userConfig.settings)
                  : userConfig.settings;

              const loadedModel =
                parsedSettings.model && parsedSettings.model.startsWith('gemini-')
                  ? parsedSettings.model
                  : 'gemini-3.5-flash-lite';

              const loadedMcpUrl = parsedSettings.mcpServerUrl || DEFAULT_MCP_SERVER_URL;
              const loadedEnableMcp = parsedSettings.enableMcp !== undefined ? Boolean(parsedSettings.enableMcp) : true;
              const loadedEnableReasoning = parsedSettings.enableReasoning !== undefined ? Boolean(parsedSettings.enableReasoning) : true;

              setModel(loadedModel);
              setMcpServerUrl(loadedMcpUrl);
              setEnableMcp(loadedEnableMcp);
              setEnableReasoning(loadedEnableReasoning);

              localStorage.setItem(
                SETTINGS_FULL_LOCAL_STORAGE_KEY,
                JSON.stringify({
                  provider: 'gemini',
                  apikey: userConfig.apikey || '',
                  model: loadedModel,
                  mcpServerUrl: loadedMcpUrl,
                  enableMcp: loadedEnableMcp,
                  enableReasoning: loadedEnableReasoning,
                })
              );
            }
          }
        }
      } catch (err) {
        console.error('[SettingsPage] Error loading user settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [user?.id, getToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const token = await getToken();
      const payload = {
        p_user_id: user.id,
        p_provider: 'gemini',
        p_apikey: apikey.trim(),
        p_settings: {
          model: model,
          mcpServerUrl: mcpServerUrl.trim() || DEFAULT_MCP_SERVER_URL,
          enableMcp: enableMcp,
          enableReasoning: enableReasoning,
        },
      };

      const response = await fetch(`${apiBaseUrl}/rpc/update_user_settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, apikey.trim());
        localStorage.setItem(
          SETTINGS_FULL_LOCAL_STORAGE_KEY,
          JSON.stringify({
            provider: 'gemini',
            apikey: apikey.trim(),
            model,
            mcpServerUrl: mcpServerUrl.trim() || DEFAULT_MCP_SERVER_URL,
            enableMcp,
            enableReasoning,
          })
        );

        setMessage({
          type: 'success',
          text: 'Đã lưu cấu hình Gemini API & MCP Server thành công!',
        });
      } else {
        const errorText = await response.text();
        setMessage({
          type: 'error',
          text: `Lưu thất bại: ${errorText || response.statusText}`,
        });
      }
    } catch (err) {
      console.error('[SettingsPage] Save error:', err);
      setMessage({
        type: 'error',
        text: `Lỗi kết nối khi lưu cài đặt: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-main-content">
      <div className="settings-page-header">
        <h1>Cài Đặt Hệ Thống</h1>
        <p>Quản lý Google Gemini API Key, Mô hình AI và tích hợp MCP Tool Calls nội bộ.</p>
      </div>

      {isLoading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 0',
            color: 'var(--text-secondary)',
            gap: '12px',
          }}
        >
          <div className="btn-spinner" style={{ width: 28, height: 28 }}></div>
          <span>Đang tải cấu hình người dùng...</span>
        </div>
      ) : (
        <>
          {message && (
            <div className={`settings-alert ${message.type}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {message.type === 'success' ? (
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </>
                )}
              </svg>
              <span>{message.text}</span>
            </div>
          )}

          {/* Multi-Section Settings Layout */}
          <form onSubmit={handleSave} className="settings-sections-container">
            {/* Section 1: Gemini API Key & Model */}
            <div className="settings-section">
              <div className="section-header">
                <div className="gemini-logo-wrapper">
                  <GeminiSparkleLogo size={24} />
                </div>
                <div className="section-title-wrap">
                  <h2>
                    Google Gemini API & AI Model
                    <span className="gemini-badge">API Config</span>
                  </h2>
                </div>
              </div>

              <div className="section-body">
                <div className="form-group">
                  <div className="label-with-link">
                    <label htmlFor="apikey">Google Gemini API Key</label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="helper-link"
                    >
                      Lấy API Key miễn phí tại Google AI Studio ↗
                    </a>
                  </div>
                  <div className="input-with-action">
                    <input
                      id="apikey"
                      type={showApiKey ? 'text' : 'password'}
                      className="form-control"
                      placeholder="AIzaSy..."
                      value={apikey}
                      onChange={(e) => setApikey(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="eye-toggle-btn"
                      onClick={() => setShowApiKey(!showApiKey)}
                      title={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showApiKey ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                  <div className="field-hint">
                    {apikey ? (
                      <span className="badge-saved">✓ Đã có API Key</span>
                    ) : (
                      <span className="badge-missing">⚠ Chưa nhập API Key</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="model">Mô hình AI (Model)</label>
                  <select
                    id="model"
                    className="form-control"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Khuyên dùng - Nhanh & Tối ưu nhất)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                  </select>
                </div>

                {/* Toggle Switch for AI Reasoning */}
                <div className="toggle-switch-row" style={{ marginTop: '4px' }}>
                  <div className="toggle-info">
                    <span className="toggle-title">Hiển thị suy luận AI (Reasoning Process)</span>
                    <span className="toggle-subtext">
                      {enableReasoning
                        ? 'Đang bật — Hiển thị tiến trình phân tích & tư duy từng bước của AI khi phản hồi.'
                        : 'Đang tắt — Ẩn các bước suy luận trung gian.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableReasoning}
                    className={`toggle-switch-btn ${enableReasoning ? 'on' : 'off'}`}
                    onClick={() => setEnableReasoning(!enableReasoning)}
                    title={enableReasoning ? 'Click để tắt hiển thị suy luận' : 'Click để bật hiển thị suy luận'}
                  >
                    <span className="toggle-switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: MCP Tools Integration */}
            <div className="settings-section">
              <div className="section-header">
                <div className="mcp-icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <div className="section-title-wrap">
                  <h2>
                    Model Context Protocol (MCP) Tools
                    <span className="mcp-badge">Integration</span>
                  </h2>
                </div>
              </div>

              <div className="section-body">
                {/* Toggle Switch Button (Instead of Checkbox) */}
                <div className="toggle-switch-row">
                  <div className="toggle-info">
                    <span className="toggle-title">Bật tích hợp MCP Tools</span>
                    <span className="toggle-subtext">
                      {enableMcp
                        ? 'Đang bật — AI có thể gọi các công cụ tra cứu MCP nội bộ.'
                        : 'Đang tắt — AI sẽ chỉ trả lời dựa trên dữ liệu học có sẵn.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableMcp}
                    className={`toggle-switch-btn ${enableMcp ? 'on' : 'off'}`}
                    onClick={() => setEnableMcp(!enableMcp)}
                    title={enableMcp ? 'Click để tắt MCP Tools' : 'Click để bật MCP Tools'}
                  >
                    <span className="toggle-switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="settings-actions-bar">
              <button type="submit" className="save-btn" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <span className="btn-spinner"></span> Đang lưu...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Lưu Cấu Hình
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  return <SettingsContent />;
};

export default SettingsPage;
