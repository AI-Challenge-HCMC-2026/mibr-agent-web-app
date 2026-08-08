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

export const AVAILABLE_MODELS: { value: string; label: string }[] = [
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];

export const saveUserModel = (model: string): void => {
  const existing = getStoredUserSettings();
  const updated: UserSettingsData = {
    provider: existing?.provider || 'gemini',
    apikey: existing?.apikey || '',
    ...existing,
    model,
  };
  localStorage.setItem(SETTINGS_FULL_LOCAL_STORAGE_KEY, JSON.stringify(updated));
};

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
        <h1>Cài đặt</h1>
        <p>Quản lý API key, mô hình và tích hợp MCP.</p>
      </div>

      {isLoading ? (
        <div className="settings-loading">
          <span>Đang tải cấu hình…</span>
        </div>
      ) : (
        <>
          {message && (
            <div className={`settings-alert ${message.type}`}>
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="settings-sections-container">
            {/* Section 1: API Key & Model */}
            <div className="settings-section">
              <div className="section-header">
                <h2>API &amp; Mô hình</h2>
                <span className="section-desc">Kết nối tới Google Gemini.</span>
              </div>

              <div className="section-body">
                <div className="form-group">
                  <div className="label-with-link">
                    <label htmlFor="apikey">API Key</label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="helper-link"
                    >
                      Lấy key tại Google AI Studio
                    </a>
                  </div>
                  <div className="input-with-action">
                    <input
                      id="apikey"
                      type={showApiKey ? 'text' : 'password'}
                      className="form-control"
                      placeholder="AIzaSy…"
                      value={apikey}
                      onChange={(e) => setApikey(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="eye-toggle-btn"
                      onClick={() => setShowApiKey(!showApiKey)}
                      title={showApiKey ? 'Ẩn' : 'Hiện'}
                    >
                      {showApiKey ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  <div className="field-hint">
                    {apikey ? (
                      <span className="badge-saved">Đã lưu API key</span>
                    ) : (
                      <span className="badge-missing">Chưa nhập API key</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="model">Mô hình</label>
                  <select
                    id="model"
                    className="form-control"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite — khuyên dùng</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                    <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  </select>
                </div>

                <div className="toggle-switch-row">
                  <div className="toggle-info">
                    <span className="toggle-title">Hiển thị suy luận</span>
                    <span className="toggle-subtext">
                      {enableReasoning
                        ? 'Đang bật — hiển thị các bước suy luận của mô hình.'
                        : 'Đang tắt — ẩn các bước suy luận trung gian.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableReasoning}
                    className={`toggle-switch-btn ${enableReasoning ? 'on' : 'off'}`}
                    onClick={() => setEnableReasoning(!enableReasoning)}
                  >
                    <span className="toggle-switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: MCP */}
            <div className="settings-section">
              <div className="section-header">
                <h2>MCP Tools</h2>
                <span className="section-desc">Kết nối công cụ tra cứu nội bộ.</span>
              </div>

              <div className="section-body">
                <div className="form-group">
                  <label htmlFor="mcpurl">Địa chỉ máy chủ MCP</label>
                  <input
                    id="mcpurl"
                    type="text"
                    className="form-control"
                    placeholder={DEFAULT_MCP_SERVER_URL}
                    value={mcpServerUrl}
                    onChange={(e) => setMcpServerUrl(e.target.value)}
                  />
                </div>

                <div className="toggle-switch-row">
                  <div className="toggle-info">
                    <span className="toggle-title">Bật MCP Tools</span>
                    <span className="toggle-subtext">
                      {enableMcp
                        ? 'Đang bật — mô hình có thể gọi công cụ MCP.'
                        : 'Đang tắt — chỉ trả lời dựa trên dữ liệu sẵn có.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableMcp}
                    className={`toggle-switch-btn ${enableMcp ? 'on' : 'off'}`}
                    onClick={() => setEnableMcp(!enableMcp)}
                  >
                    <span className="toggle-switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-actions-bar">
              <button type="submit" className="save-btn" disabled={isSaving}>
                {isSaving ? 'Đang lưu…' : 'Lưu cấu hình'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
