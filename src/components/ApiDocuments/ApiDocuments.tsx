import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import './ApiDocuments.css';

interface ApiDocumentsProps {
  onBackToChat?: () => void;
}

interface EndpointItem {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  tags?: string[];
}

// Helper to resolve OpenAPI $ref pointers (e.g. #/components/parameters/rowFilter.account.id)
const resolveRef = (refStr: string, rootObj: any): any => {
  if (!refStr || typeof refStr !== 'string' || !refStr.startsWith('#/')) return null;
  const parts = refStr.replace(/^#\//, '').split('/');
  let current = rootObj;
  for (const p of parts) {
    if (current && typeof current === 'object' && p in current) {
      current = current[p];
    } else {
      return null;
    }
  }
  return current;
};

// Helper to resolve a parameter object (whether inline or $ref)
const resolveParam = (paramObj: any, rootObj: any): any => {
  if (!paramObj) return paramObj;
  if (paramObj['$ref']) {
    const resolved = resolveRef(paramObj['$ref'], rootObj);
    if (resolved) {
      const fallbackName = paramObj['$ref'].split('/').pop();
      return {
        ...resolved,
        name: resolved.name || fallbackName,
        refPath: paramObj['$ref'],
      };
    }
  }
  return paramObj;
};

export const ApiDocuments: React.FC<ApiDocumentsProps> = () => {
  const { getToken, token: contextToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(contextToken);
  const [showToken, setShowToken] = useState<boolean>(false);

  const [viewMode, setViewMode] = useState<'explorer' | 'schemas' | 'json'>('explorer');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const documentUrl = 'https://ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech/mibr/rest/v1/openapi.json';
  const apiBaseUrl = 'https://ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech/mibr/rest/v1';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const token = await getToken();
      setActiveToken(token);

      console.log('[ApiDocuments] Starting fetch to:', documentUrl, '| Token present:', !!token);

      const candidateUrls = [
        documentUrl,
        'https://ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech/mibr/rest/v1/',
      ];

      let lastError: string | null = null;
      let lastData: any = null;
      let success = false;

      for (const targetUrl of candidateUrls) {
        try {
          const reqHeaders: Record<string, string> = {
            'Accept': 'application/openapi+json, application/json, */*',
          };

          if (token) {
            reqHeaders['Authorization'] = `Bearer ${token}`;
          }

          console.log('[ApiDocuments] Executing fetch request to:', targetUrl);

          const response = await fetch(targetUrl, {
            method: 'GET',
            headers: reqHeaders,
          });

          const responseText = await response.text();
          let parsedData: any;
          try {
            parsedData = JSON.parse(responseText);
          } catch {
            parsedData = responseText;
          }

          if (response.ok) {
            setData(parsedData);
            setStatusMessage(`Tải dữ liệu API Documents thành công (${response.status} OK)`);
            success = true;
            break;
          } else {
            const errorMsg =
              typeof parsedData === 'object' && parsedData?.message
                ? parsedData.message
                : `HTTP ${response.status}: ${response.statusText}`;

            lastError = errorMsg;
            lastData = parsedData;

            if (typeof errorMsg === 'string' && (errorMsg.includes("Could not find the table") || response.status === 404)) {
              continue;
            } else {
              break;
            }
          }
        } catch (fetchErr: any) {
          console.error('[ApiDocuments] Network fetch error:', fetchErr);
          lastError = fetchErr?.message || 'Lỗi kết nối';
        }
      }

      if (!success) {
        setError(lastError || 'Lỗi khi gọi API Documents');
        if (lastData) setData(lastData);
      }
    } catch (err: any) {
      console.error('Error fetching API Documents:', err);
      setError(err?.message || 'Lỗi kết nối khi gọi API Documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // OpenAPI Info Meta
  const openApiInfo = useMemo(() => {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return {
        title: data.info?.title || 'MIBR Neon Database & REST API',
        version: data.info?.version || 'v1',
        description: data.info?.description || 'Tài liệu OpenAPI v3 đầy đủ của hệ thống Neon Data API & PostgREST',
        host: 'ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech',
        basePath: '/mibr/rest/v1',
      };
    }
    return {
      title: 'MIBR REST API',
      version: 'v1',
      description: 'Tài liệu API từ endpoint PostgREST',
      host: 'ep-divine-union-azkd67d3.apirest.c-3.ap-southeast-1.aws.neon.tech',
      basePath: '/mibr/rest/v1',
    };
  }, [data]);

  // Extract endpoints/paths and resolve parameters
  const endpointsList = useMemo<EndpointItem[]>(() => {
    if (!data || typeof data !== 'object') return [];

    if (data.paths && typeof data.paths === 'object') {
      const list: EndpointItem[] = [];

      Object.entries(data.paths).forEach(([pathKey, pathObj]: [string, any]) => {
        if (typeof pathObj === 'object' && pathObj !== null) {
          const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
          methods.forEach((m) => {
            if (pathObj[m]) {
              const details = pathObj[m];
              const rawParams = details.parameters || [];
              const resolvedParams = rawParams.map((p: any) => resolveParam(p, data));

              // Tag name based on path e.g. /account -> account
              const pathTag = pathKey.replace(/^\//, '').split('/')[0] || 'general';

              list.push({
                path: pathKey,
                method: m.toUpperCase(),
                summary: details.summary || details.description || `${m.toUpperCase()} ${pathKey}`,
                description: details.description || '',
                parameters: resolvedParams,
                requestBody: details.requestBody,
                responses: details.responses || {},
                tags: details.tags && details.tags.length > 0 ? details.tags : [pathTag],
              });
            }
          });
        }
      });
      return list;
    }

    return [];
  }, [data]);

  // Unique tags list for filter
  const tagsList = useMemo(() => {
    const tagSet = new Set<string>();
    endpointsList.forEach((ep) => {
      if (ep.tags) ep.tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [endpointsList]);

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    return endpointsList.filter((item) => {
      const matchesMethod = selectedMethod === 'ALL' || item.method === selectedMethod;
      const matchesTag = selectedTag === 'ALL' || (item.tags && item.tags.includes(selectedTag));

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.path.toLowerCase().includes(q) ||
        (item.summary && item.summary.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.parameters &&
          item.parameters.some(
            (p: any) =>
              (p.name && p.name.toLowerCase().includes(q)) ||
              (p.description && p.description.toLowerCase().includes(q))
          ));

      return matchesMethod && matchesTag && matchesQuery;
    });
  }, [endpointsList, selectedMethod, selectedTag, searchQuery]);

  // Extract schemas/definitions
  const schemasList = useMemo(() => {
    if (!data || typeof data !== 'object') return {};
    return data.components?.schemas || data.definitions || {};
  }, [data]);

  return (
    <div className="api-docs-container">
      {/* Top Bar Header */}
      <div className="api-docs-header">
        <div className="api-docs-title-wrap">
          <div className="api-badge">OPENAPI 3.0</div>
          <div>
            <h1 className="api-docs-title">{openApiInfo.title}</h1>
            <p className="api-docs-subtitle">{documentUrl}</p>
          </div>
        </div>

        <div className="api-docs-header-actions">
          <button className="api-btn secondary" onClick={fetchData} disabled={loading} title="Tải lại dữ liệu">
            <svg
              className={loading ? 'spin-icon' : ''}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Auth Token Banner */}
      <div className="token-status-banner">
        <div className="token-info">
          <div className="token-status-indicator">
            <span className={`status-dot ${activeToken ? 'active' : 'inactive'}`}></span>
            <span className="status-text">
              {activeToken ? 'Session Bearer Token Active' : 'Chưa có Session Token'}
            </span>
          </div>

          {activeToken && (
            <div className="token-preview-box">
              <span className="token-label">Token:</span>
              <code className="token-code">
                {showToken ? activeToken : `${activeToken.slice(0, 18)}...${activeToken.slice(-10)}`}
              </code>
              <button
                className="icon-action-btn"
                onClick={() => setShowToken(!showToken)}
                title={showToken ? 'Ẩn token' : 'Hiện đầy đủ token'}
              >
                {showToken ? '👁️' : '🔒'}
              </button>
            </div>
          )}
        </div>

        {activeToken && (
          <button
            className="api-btn sub-btn"
            onClick={() => handleCopy(`Bearer ${activeToken}`, 'bearer-token')}
          >
            {copiedIndex === 'bearer-token' ? '✓ Đã sao chép Bearer Header' : '📋 Copy Bearer Header'}
          </button>
        )}
      </div>

      {/* View Switcher & Search Bar */}
      <div className="api-controls-bar">
        <div className="view-mode-tabs">
          <button
            className={`tab-btn ${viewMode === 'explorer' ? 'active' : ''}`}
            onClick={() => setViewMode('explorer')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            API Endpoints ({endpointsList.length})
          </button>
          <button
            className={`tab-btn ${viewMode === 'schemas' ? 'active' : ''}`}
            onClick={() => setViewMode('schemas')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            Database Tables ({Object.keys(schemasList).length})
          </button>
          <button
            className={`tab-btn ${viewMode === 'json' ? 'active' : ''}`}
            onClick={() => setViewMode('json')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Raw OpenAPI JSON
          </button>
        </div>

        {viewMode === 'explorer' && (
          <div className="search-filter-wrap">
            <div className="search-input-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm path, parameter (id, email, select...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  ×
                </button>
              )}
            </div>

            <div className="method-filters">
              {['ALL', 'GET', 'POST', 'PATCH', 'DELETE'].map((m) => (
                <button
                  key={m}
                  className={`method-filter-chip ${m.toLowerCase()} ${selectedMethod === m ? 'active' : ''}`}
                  onClick={() => setSelectedMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table Filter Chips Bar */}
      {viewMode === 'explorer' && tagsList.length > 0 && (
        <div className="table-filter-bar">
          <span className="filter-label">Filter Table:</span>
          <button
            className={`tag-chip ${selectedTag === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedTag('ALL')}
          >
            All Tables
          </button>
          {tagsList.map((tag) => (
            <button
              key={tag}
              className={`tag-chip ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="api-error-card">
          <div className="error-icon">⚠️</div>
          <div className="error-details">
            <h3>Lỗi truy xuất dữ liệu API</h3>
            <p>{error}</p>
            <span className="error-hint">
              Đảm bảo Bearer Token có quyền truy cập vào endpoint Rest v1 của Neon.
            </span>
          </div>
          <button className="api-btn secondary" onClick={fetchData}>
            Thử lại
          </button>
        </div>
      )}

      {/* Status Card */}
      {statusMessage && !error && (
        <div className="api-status-card">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Content Body */}
      {loading ? (
        <div className="api-loading-state">
          <div className="spinner"></div>
          <p>Đang tải tài liệu OpenAPI v3 với Bearer Token...</p>
        </div>
      ) : viewMode === 'json' ? (
        <div className="json-view-container">
          <div className="json-header">
            <span>Raw OpenAPI JSON Output</span>
            <button
              className="api-btn sub-btn"
              onClick={() => handleCopy(JSON.stringify(data, null, 2), 'raw-json')}
            >
              {copiedIndex === 'raw-json' ? '✓ Copied' : '📋 Copy JSON'}
            </button>
          </div>
          <pre className="json-code-block">{JSON.stringify(data, null, 2)}</pre>
        </div>
      ) : viewMode === 'schemas' ? (
        <div className="schemas-view-container">
          <div className="section-header">
            <h2>Database Models & Schemas ({Object.keys(schemasList).length})</h2>
            <p className="section-desc">Cấu trúc chi tiết các bảng trong cơ sở dữ liệu PostgreSQL của Neon.</p>
          </div>

          <div className="schemas-grid">
            {Object.entries(schemasList).map(([schemaName, schemaObj]: [string, any]) => {
              const properties = schemaObj.properties || {};
              const requiredFields = schemaObj.required || [];

              return (
                <div key={schemaName} className="schema-card">
                  <div className="schema-header">
                    <span className="schema-title">{schemaName}</span>
                    <span className="schema-type-badge">{schemaObj.type || 'object'}</span>
                  </div>

                  <div className="schema-props-table-wrap">
                    <table className="params-table">
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Type / Format</th>
                          <th>Key / Constraint</th>
                          <th>Default Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(properties).map(([propName, propDetails]: [string, any]) => {
                          const isRequired = requiredFields.includes(propName);
                          const desc = propDetails.description || '';
                          const isPK = desc.includes('Primary Key');
                          const isFK = desc.includes('Foreign Key');

                          return (
                            <tr key={propName}>
                              <td className="param-name">
                                {propName}
                                {isRequired && <span className="req-yes" title="Required">*</span>}
                              </td>
                              <td>
                                <code>{propDetails.type || 'string'}</code>
                                {propDetails.format && <span className="format-tag"> ({propDetails.format})</span>}
                              </td>
                              <td>
                                {isPK && <span className="key-badge pk">🔑 Primary Key</span>}
                                {isFK && <span className="key-badge fk">🔗 Foreign Key</span>}
                                {!isPK && !isFK && <span className="key-badge norm">Column</span>}
                              </td>
                              <td className="param-desc">
                                {propDetails.default ? <code>{propDetails.default}</code> : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="explorer-view-container">
          {/* API Meta Summary Card */}
          <div className="api-meta-card">
            <div className="meta-row">
              <span className="meta-title">{openApiInfo.title}</span>
              <span className="meta-version">OpenAPI {data?.openapi || '3.0.0'}</span>
            </div>
            <p className="meta-description">{openApiInfo.description}</p>
            <div className="meta-tags">
              <span className="meta-chip">Host: {openApiInfo.host}</span>
              <span className="meta-chip">Base Path: {openApiInfo.basePath}</span>
              <span className="meta-chip">Total Endpoints: {endpointsList.length}</span>
              <span className="meta-chip">Tables: {Object.keys(schemasList).length}</span>
            </div>
          </div>

          {/* Endpoints Section */}
          <div className="endpoints-section">
            <div className="section-header">
              <h2>Endpoints ({filteredEndpoints.length})</h2>
            </div>

            {filteredEndpoints.length === 0 ? (
              <div className="empty-endpoints">
                <p>Không tìm thấy endpoint nào phù hợp với bộ lọc.</p>
              </div>
            ) : (
              <div className="endpoint-list">
                {filteredEndpoints.map((ep, idx) => {
                  const epKey = `${ep.method}-${ep.path}-${idx}`;
                  const isExpanded = expandedPath === epKey;
                  const curlCommand = `curl -X ${ep.method} "${apiBaseUrl}${ep.path.startsWith('/') ? '' : '/'}${ep.path}" \\\n  -H "Authorization: Bearer ${activeToken || '<YOUR_TOKEN>'}" \\\n  -H "Accept: application/json"`;

                  // Resolve requestBody schema if present
                  let requestBodySchemaName = '';
                  let requestBodySchemaObj: any = null;
                  if (ep.requestBody?.content) {
                    const contentObj = ep.requestBody.content;
                    const jsonContent = contentObj['application/json; charset=utf-8'] || contentObj['application/json'];
                    if (jsonContent?.schema) {
                      if (jsonContent.schema.$ref) {
                        requestBodySchemaName = jsonContent.schema.$ref.split('/').pop() || '';
                        requestBodySchemaObj = resolveRef(jsonContent.schema.$ref, data);
                      } else if (jsonContent.schema.properties) {
                        requestBodySchemaName = 'Payload Object';
                        requestBodySchemaObj = jsonContent.schema;
                      }
                    }
                  }

                  return (
                    <div
                      key={epKey}
                      className={`endpoint-card ${ep.method.toLowerCase()} ${isExpanded ? 'expanded' : ''}`}
                    >
                      <div
                        className="endpoint-header-row"
                        onClick={() => setExpandedPath(isExpanded ? null : epKey)}
                      >
                        <span className={`method-badge ${ep.method.toLowerCase()}`}>{ep.method}</span>
                        <span className="endpoint-path">{ep.path}</span>
                        {ep.tags && ep.tags[0] && (
                          <span className="endpoint-tag-pill">{ep.tags[0]}</span>
                        )}
                        <span className="endpoint-summary">{ep.summary}</span>
                        <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {isExpanded && (
                        <div className="endpoint-body">
                          {ep.description && <p className="ep-desc">{ep.description}</p>}

                          {/* Parameters Table (Fully Resolved) */}
                          <div className="ep-subsection">
                            <div className="subsection-header-row">
                              <h4>Parameters ({ep.parameters ? ep.parameters.length : 0})</h4>
                              <span className="param-count-hint">Query, Header & Path filters</span>
                            </div>

                            {ep.parameters && ep.parameters.length > 0 ? (
                              <div className="params-table-wrap">
                                <table className="params-table">
                                  <thead>
                                    <tr>
                                      <th>Parameter Name</th>
                                      <th>In</th>
                                      <th>Type</th>
                                      <th>Required</th>
                                      <th>Description / Details</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ep.parameters.map((param: any, pIdx: number) => {
                                      const paramName = param.name || (param.refPath ? param.refPath.split('/').pop() : `param-${pIdx}`);
                                      const paramIn = param.in || 'query';
                                      const paramType = param.schema?.type || param.type || 'string';
                                      const paramDefault = param.schema?.default !== undefined ? param.schema.default : param.default;
                                      const paramDesc = param.description || (param.schema?.description ? param.schema.description : '-');

                                      return (
                                        <tr key={pIdx}>
                                          <td className="param-name">
                                            <code>{paramName}</code>
                                          </td>
                                          <td>
                                            <span className={`in-badge ${paramIn}`}>{paramIn}</span>
                                          </td>
                                          <td>
                                            <code className="type-code">{paramType}</code>
                                          </td>
                                          <td>
                                            {param.required ? (
                                              <span className="req-yes">Required</span>
                                            ) : (
                                              <span className="req-no">Optional</span>
                                            )}
                                          </td>
                                          <td className="param-desc">
                                            <div>{paramDesc}</div>
                                            {paramDefault !== undefined && (
                                              <div className="param-default">
                                                Default: <code>{String(paramDefault)}</code>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="no-params-text">No parameters specified for this operation.</p>
                            )}
                          </div>

                          {/* Request Body Schema if present */}
                          {requestBodySchemaObj && (
                            <div className="ep-subsection">
                              <h4>Request Body Payload ({requestBodySchemaName})</h4>
                              <div className="req-body-box">
                                <span className="req-body-label">Schema model: <code>{requestBodySchemaName}</code></span>
                                <pre className="json-code-block payload">
                                  {JSON.stringify(requestBodySchemaObj.properties || requestBodySchemaObj, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* Pre-formatted cURL Code Block */}
                          <div className="ep-subsection">
                            <div className="curl-header">
                              <h4>Sample cURL Request</h4>
                              <button
                                className="api-btn sub-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(curlCommand, epKey);
                                }}
                              >
                                {copiedIndex === epKey ? '✓ Copied cURL' : '📋 Copy cURL'}
                              </button>
                            </div>
                            <pre className="curl-code-block">{curlCommand}</pre>
                          </div>

                          {/* Responses */}
                          {ep.responses && Object.keys(ep.responses).length > 0 && (
                            <div className="ep-subsection">
                              <h4>Responses</h4>
                              <div className="responses-list">
                                {Object.entries(ep.responses).map(([code, resp]: [string, any]) => (
                                  <div key={code} className="response-row">
                                    <span className={`status-badge s-${code.slice(0, 1)}xx`}>{code}</span>
                                    <span className="resp-desc">{resp.description || 'Response'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiDocuments;
