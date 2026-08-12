import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getChatHistoryApiHost } from '../../lib/chatHistoryApi';
import './ApiDocuments.css';

interface ApiDocumentsProps {
  onBackToChat?: () => void;
}

interface EndpointItem {
  key: string;
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
  tags: string[];
}

interface SchemaDetailsProps {
  schema: any;
  root: any;
  compact?: boolean;
}

const API_HOST = getChatHistoryApiHost();
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

const resolveRef = (refStr: string | undefined, rootObj: any): any => {
  if (!refStr || typeof refStr !== 'string' || !refStr.startsWith('#/')) return null;
  return refStr
    .replace(/^#\//, '')
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((current, part) => (current && typeof current === 'object' ? current[part] : null), rootObj);
};

const resolveObject = (value: any, rootObj: any): any => {
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) return resolveRef(value.$ref, rootObj) || value;
  return value;
};

const schemaType = (schema: any, rootObj: any): string => {
  const resolved = resolveObject(schema, rootObj) || {};
  if (resolved.$ref) return resolved.$ref.split('/').pop() || 'object';
  if (resolved.enum) return `${resolved.type || 'string'} (enum)`;
  if (resolved.anyOf) return resolved.anyOf.map((item: any) => schemaType(item, rootObj)).join(' | ');
  if (resolved.type === 'array') return `${schemaType(resolved.items, rootObj)}[]`;
  return [resolved.type, resolved.format].filter(Boolean).join(' / ') || 'object';
};

const exampleForSchema = (schema: any, rootObj: any): any => {
  const resolved = resolveObject(schema, rootObj) || {};
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.type === 'object' || resolved.properties) {
    return Object.fromEntries(
      Object.entries(resolved.properties || {}).map(([name, property]) => [name, exampleForSchema(property, rootObj)])
    );
  }
  if (resolved.type === 'array') return [exampleForSchema(resolved.items, rootObj)];
  if (resolved.type === 'integer' || resolved.type === 'number') return 0;
  if (resolved.type === 'boolean') return true;
  return resolved.type ? '' : undefined;
};

const SchemaDetails: React.FC<SchemaDetailsProps> = ({ schema, root, compact = false }) => {
  const resolved = resolveObject(schema, root) || {};
  const required = resolved.required || [];
  const properties = Object.entries(resolved.properties || {}) as [string, any][];
  const example = resolved.example !== undefined ? resolved.example : undefined;

  return (
    <div className={`schema-details ${compact ? 'compact' : ''}`}>
      {resolved.description && <p className="schema-description">{resolved.description}</p>}
      <div className="schema-signature">
        <span className="schema-type">{schemaType(resolved, root)}</span>
        {resolved.nullable && <span className="schema-flag">nullable</span>}
      </div>
      {properties.length > 0 && (
        <div className="model-properties">
          {properties.map(([name, property]) => {
            const propertySchema = resolveObject(property, root) || {};
            return (
              <div className="model-property" key={name}>
                <div className="model-property-head">
                  <code>{name}</code>
                  {required.includes(name) && <span className="required-marker">required</span>}
                  <span className="model-property-type">{schemaType(propertySchema, root)}</span>
                </div>
                {propertySchema.description && <p>{propertySchema.description}</p>}
                <div className="schema-metadata">
                  {propertySchema.default !== undefined && <span>default: <code>{String(propertySchema.default)}</code></span>}
                  {propertySchema.enum && <span>enum: <code>{propertySchema.enum.join(', ')}</code></span>}
                  {propertySchema.example !== undefined && <span>example: <code>{String(propertySchema.example)}</code></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {example !== undefined && <pre className="example-code">{JSON.stringify(example, null, 2)}</pre>}
    </div>
  );
};

export const ApiDocuments: React.FC<ApiDocumentsProps> = () => {
  const { getToken, token: contextToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(contextToken);
  const [showToken, setShowToken] = useState(false);
  const [viewMode, setViewMode] = useState<'explorer' | 'schemas' | 'json'>('explorer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const documentUrl = `${API_HOST}/api/v1/openapi.json`;
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const token = await getToken();
      setActiveToken(token);
      const response = await fetch(documentUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/openapi+json, application/json, */*',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const responseText = await response.text();
      let parsedData: any;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        parsedData = responseText;
      }
      setData(parsedData);
      if (response.ok) setStatusMessage(`OpenAPI document loaded (${response.status} OK)`);
      else setError(typeof parsedData === 'object' && parsedData?.detail ? JSON.stringify(parsedData.detail) : `HTTP ${response.status}: ${response.statusText}`);
    } catch (err: any) {
      setError(err?.message || 'Unable to load the OpenAPI document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const openApiInfo = useMemo(() => ({
    title: data?.info?.title || 'AI Challenge Search Engine API',
    version: data?.info?.version || '1.0.0',
    description: data?.info?.description || 'Chat History & Agent Operations API',
    openapi: data?.openapi || '3.1.0',
  }), [data]);

  const serverUrl = data?.servers?.[0]?.url || API_HOST;
  const serverLabel = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const endpointsList = useMemo<EndpointItem[]>(() => {
    if (!data?.paths || typeof data.paths !== 'object') return [];
    const list: EndpointItem[] = [];
    Object.entries(data.paths).forEach(([path, pathObj]: [string, any]) => {
      HTTP_METHODS.forEach((method) => {
        const details = pathObj?.[method];
        if (!details) return;
        const operationId = details.operationId || `${method}-${path}`;
        const pathParams = Array.isArray(pathObj.parameters) ? pathObj.parameters : [];
        const operationParams = Array.isArray(details.parameters) ? details.parameters : [];
        const params = [...pathParams, ...operationParams].map((param: any) => resolveObject(param, data));
        list.push({
          key: `${method}-${path}-${operationId}`,
          path,
          method: method.toUpperCase(),
          operationId,
          summary: details.summary || `${method.toUpperCase()} ${path}`,
          description: details.description || '',
          parameters: params,
          requestBody: details.requestBody,
          responses: details.responses || {},
          tags: details.tags?.length ? details.tags : ['General'],
        });
      });
    });
    return list;
  }, [data]);

  const tagsList = useMemo(() => Array.from(new Set(endpointsList.flatMap((item) => item.tags))).sort(), [endpointsList]);

  const filteredEndpoints = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return endpointsList.filter((item) => {
      const matchesMethod = selectedMethod === 'ALL' || item.method === selectedMethod;
      const matchesTag = selectedTag === 'ALL' || item.tags.includes(selectedTag);
      const searchable = [item.path, item.operationId, item.summary, item.description, ...item.parameters.map((p) => `${p.name} ${p.description || ''}`)].join(' ').toLowerCase();
      return matchesMethod && matchesTag && (!query || searchable.includes(query));
    });
  }, [endpointsList, selectedMethod, selectedTag, searchQuery]);

  const endpointGroups = useMemo(() => {
    const groups = new Map<string, EndpointItem[]>();
    filteredEndpoints.forEach((endpoint) => endpoint.tags.forEach((tag) => groups.set(tag, [...(groups.get(tag) || []), endpoint])));
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEndpoints]);

  const schemasList = useMemo(() => data?.components?.schemas || data?.definitions || {}, [data]);

  const getContent = (content: any) => content?.['application/json'] || Object.values(content || {})[0] as any;
  const getSchema = (schema: any) => resolveObject(schema, data);
  const getResponseExample = (response: any) => {
    const content = getContent(response?.content);
    if (content?.example !== undefined) return content.example;
    return exampleForSchema(content?.schema, data);
  };

  return (
    <div className="api-docs-container">
      <header className="api-docs-header">
        <div className="api-definition">
          <span className="api-badge">OAS {openApiInfo.openapi}</span>
          <div>
            <h1 className="api-docs-title">{openApiInfo.title}</h1>
            <p className="api-docs-subtitle">{openApiInfo.description}</p>
            <div className="server-line"><span>Server</span><code>{serverLabel}</code><span className="api-version">v{openApiInfo.version}</span></div>
          </div>
        </div>
        <button className="api-btn secondary" onClick={fetchData} disabled={loading} title="Reload OpenAPI document">
          <svg className={loading ? 'spin-icon' : ''} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      <div className="token-status-banner">
        <div className="token-info">
          <div className="token-status-indicator"><span className={`status-dot ${activeToken ? 'active' : 'inactive'}`} /><span className="status-text">{activeToken ? 'Authorized' : 'No authorization token'}</span></div>
          {activeToken && <div className="token-preview-box"><span className="token-label">Bearer</span><code className="token-code">{showToken ? activeToken : `${activeToken.slice(0, 18)}...${activeToken.slice(-10)}`}</code><button className="icon-action-btn" onClick={() => setShowToken(!showToken)} title={showToken ? 'Hide token' : 'Show token'}>{showToken ? 'Hide' : 'Show'}</button></div>}
        </div>
        {activeToken && <button className="api-btn sub-btn" onClick={() => handleCopy(`Bearer ${activeToken}`, 'bearer-token')}>{copiedIndex === 'bearer-token' ? 'Copied authorization header' : 'Copy authorization header'}</button>}
      </div>

      <div className="api-controls-bar">
        <div className="view-mode-tabs">
          <button className={`tab-btn ${viewMode === 'explorer' ? 'active' : ''}`} onClick={() => setViewMode('explorer')}>Operations <span>{endpointsList.length}</span></button>
          <button className={`tab-btn ${viewMode === 'schemas' ? 'active' : ''}`} onClick={() => setViewMode('schemas')}>Models <span>{Object.keys(schemasList).length}</span></button>
          <button className={`tab-btn ${viewMode === 'json' ? 'active' : ''}`} onClick={() => setViewMode('json')}>OpenAPI JSON</button>
        </div>
        {viewMode === 'explorer' && <div className="search-filter-wrap"><label className="search-input-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg><span className="sr-only">Search operations</span><input type="search" placeholder="Filter operations..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />{searchQuery && <button className="clear-search" onClick={() => setSearchQuery('')} aria-label="Clear search">×</button>}</label><div className="method-filters">{['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <button key={method} className={`method-filter-chip ${method.toLowerCase()} ${selectedMethod === method ? 'active' : ''}`} onClick={() => setSelectedMethod(method)}>{method}</button>)}</div></div>}
      </div>

      {viewMode === 'explorer' && tagsList.length > 0 && <div className="tag-filter-bar"><span className="filter-label">Tags</span><button className={`tag-chip ${selectedTag === 'ALL' ? 'active' : ''}`} onClick={() => setSelectedTag('ALL')}>All operations</button>{tagsList.map((tag) => <button key={tag} className={`tag-chip ${selectedTag === tag ? 'active' : ''}`} onClick={() => setSelectedTag(tag)}>{tag}</button>)}</div>}

      {error && <div className="api-error-card"><div className="error-icon">!</div><div className="error-details"><h3>Unable to load API definition</h3><p>{error}</p><span className="error-hint">The API accepts a Bearer token or an explicit user_id for chat history access.</span></div><button className="api-btn secondary" onClick={fetchData}>Try again</button></div>}
      {statusMessage && !error && <div className="api-status-card">{statusMessage}</div>}

      {loading ? <div className="api-loading-state"><div className="spinner" /><p>Loading OpenAPI definition...</p></div> : viewMode === 'json' ? <div className="json-view-container"><div className="json-header"><span>Raw OpenAPI definition</span><button className="api-btn sub-btn" onClick={() => handleCopy(JSON.stringify(data, null, 2), 'raw-json')}>{copiedIndex === 'raw-json' ? 'Copied' : 'Copy JSON'}</button></div><pre className="json-code-block">{JSON.stringify(data, null, 2)}</pre></div> : viewMode === 'schemas' ? <div className="schemas-view-container"><div className="section-header"><h2>Models</h2><p className="section-desc">Reusable request and response schemas defined by this API.</p></div><div className="models-list">{Object.entries(schemasList).map(([schemaName, schema]) => <details className="model-card" key={schemaName}><summary><code>{schemaName}</code><span>{schemaType(schema, data)}</span></summary><SchemaDetails schema={schema} root={data} /></details>)}</div>{Object.keys(schemasList).length === 0 && <div className="empty-endpoints">No reusable models are defined in this document.</div>}</div> : <div className="explorer-view-container"><div className="api-meta-card"><div className="meta-row"><span className="meta-title">{openApiInfo.title}</span><span className="meta-version">OpenAPI {openApiInfo.openapi}</span></div><p className="meta-description">{openApiInfo.description}</p><div className="meta-tags"><span className="meta-chip">Server: {serverLabel}</span><span className="meta-chip">Operations: {endpointsList.length}</span><span className="meta-chip">Tags: {tagsList.length}</span></div></div><div className="endpoints-section"><div className="section-header"><h2>Operations <span className="result-count">{filteredEndpoints.length} of {endpointsList.length}</span></h2></div>{filteredEndpoints.length === 0 ? <div className="empty-endpoints">No operations match the current filters.</div> : <div className="endpoint-groups">{endpointGroups.map(([tag, endpoints]) => <section className="endpoint-group" key={tag}><div className="tag-heading"><div><h3>{tag}</h3>{data?.tags?.find((item: any) => item.name === tag)?.description && <p>{data.tags.find((item: any) => item.name === tag).description}</p>}</div><span>{endpoints.length} operation{endpoints.length === 1 ? '' : 's'}</span></div><div className="endpoint-list">{endpoints.map((endpoint) => { const isExpanded = expandedPath === endpoint.key; const curlCommand = `curl -X ${endpoint.method} "${serverUrl}${endpoint.path}" \\\n  -H "Authorization: Bearer ${activeToken || '<YOUR_TOKEN>'}" \\\n  -H "Accept: application/json"`; return <article className={`endpoint-card ${endpoint.method.toLowerCase()} ${isExpanded ? 'expanded' : ''}`} key={endpoint.key}><button className="endpoint-header-row" onClick={() => setExpandedPath(isExpanded ? null : endpoint.key)} aria-expanded={isExpanded}><span className={`method-badge ${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><span className="endpoint-path">{endpoint.path}</span><span className="endpoint-summary">{endpoint.summary}</span><span className="expand-icon">{isExpanded ? '−' : '+'}</span></button>{isExpanded && <div className="endpoint-body">{endpoint.operationId && <div className="operation-id">{endpoint.operationId}</div>}{endpoint.description && <p className="ep-desc">{endpoint.description}</p>}<div className="ep-subsection"><div className="subsection-header-row"><h4>Parameters</h4><span className="param-count-hint">{endpoint.parameters.length} parameter{endpoint.parameters.length === 1 ? '' : 's'}</span></div>{endpoint.parameters.length > 0 ? <div className="params-table-wrap"><table className="params-table"><thead><tr><th>Name</th><th>In</th><th>Schema</th><th>Description</th></tr></thead><tbody>{endpoint.parameters.map((param: any, index) => <tr key={`${param.name || 'parameter'}-${index}`}><td className="param-name"><code>{param.name || `parameter-${index}`}</code>{param.required && <span className="required-marker">required</span>}</td><td><span className={`in-badge ${param.in || 'query'}`}>{param.in || 'query'}</span></td><td><code className="type-code">{schemaType(param.schema || param, data)}</code>{param.schema?.nullable && <span className="schema-flag">nullable</span>}</td><td className="param-desc">{param.description || param.schema?.description || '—'}{param.schema?.default !== undefined && <div className="param-default">default: <code>{String(param.schema.default)}</code></div>}{param.schema?.enum && <div className="param-default">enum: <code>{param.schema.enum.join(', ')}</code></div>}</td></tr>)}</tbody></table></div> : <p className="no-params-text">No parameters</p>}</div>{endpoint.requestBody && <div className="ep-subsection"><h4>Request body {endpoint.requestBody.required && <span className="required-marker">required</span>}</h4>{Object.entries(endpoint.requestBody.content || {}).map(([contentType, media]: [string, any]) => { const bodySchema = getSchema(media.schema); const example = media.example ?? (media.examples ? Object.values(media.examples)[0] as any : undefined); return <div className="contract-box" key={contentType}><div className="contract-heading"><span>{contentType}</span><code>{schemaType(bodySchema, data)}</code></div><SchemaDetails schema={bodySchema} root={data} compact />{example !== undefined && <pre className="example-code">{JSON.stringify(example, null, 2)}</pre>}</div>; })}</div>}{<div className="ep-subsection"><h4>Responses</h4><div className="responses-list">{Object.entries(endpoint.responses).map(([code, response]: [string, any]) => { const resolvedResponse = resolveObject(response, data) || {}; const content = getContent(resolvedResponse.content); const responseSchema = getSchema(content?.schema); const responseExample = getResponseExample(resolvedResponse); return <div className="response-row" key={code}><div className={`status-badge s-${code.slice(0, 1)}xx`}>{code}</div><div className="response-content"><strong>{resolvedResponse.description || 'Response'}</strong>{content && <div className="response-contract"><span>{Object.keys(resolvedResponse.content || {})[0] || 'application/json'}</span><code>{schemaType(responseSchema, data)}</code></div>}{responseExample !== undefined && <pre className="example-code">{JSON.stringify(responseExample, null, 2)}</pre>}</div></div>; })}</div></div>}<div className="ep-subsection"><div className="curl-header"><h4>Request sample</h4><button className="api-btn sub-btn" onClick={(event) => { event.stopPropagation(); handleCopy(curlCommand, endpoint.key); }}>{copiedIndex === endpoint.key ? 'Copied cURL' : 'Copy cURL'}</button></div><pre className="curl-code-block">{curlCommand}</pre></div></div>}</article>; })}</div></section>)}</div>}</div></div>}
    </div>
  );
};

export default ApiDocuments;
