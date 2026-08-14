export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export interface McpToolCallResult {
  content?: Array<{
    type: string;
    text?: string;
    data?: any;
    [key: string]: any;
  }>;
  isError?: boolean;
  [key: string]: any;
}

export const DEFAULT_MCP_SERVER_URL =
  (import.meta.env.VITE_MCP_SERVER_URL as string | undefined) || '';

/**
 * Clean up JSON schema to fit Google Gemini API functionDeclarations format
 */
export function sanitizeSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return { type: 'OBJECT', properties: {} };
  }

  const typeMap: Record<string, string> = {
    string: 'STRING',
    number: 'NUMBER',
    integer: 'INTEGER',
    boolean: 'BOOLEAN',
    array: 'ARRAY',
    object: 'OBJECT',
  };

  const rawType = (schema.type || 'object').toString().toLowerCase();
  const type = typeMap[rawType] || 'OBJECT';

  const sanitized: any = { type };

  if (schema.description) {
    sanitized.description = String(schema.description);
  }

  if (type === 'OBJECT') {
    sanitized.properties = {};
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, prop] of Object.entries(schema.properties)) {
        sanitized.properties[key] = sanitizeSchemaForGemini(prop);
      }
    }
    if (Array.isArray(schema.required) && schema.required.length > 0) {
      sanitized.required = schema.required.map(String);
    }
  } else if (type === 'ARRAY' && schema.items) {
    sanitized.items = sanitizeSchemaForGemini(schema.items);
  }

  return sanitized;
}

/**
 * Resolve candidate URLs for MCP server endpoint ensuring proper trailing slash
 */
function resolveMcpEndpoints(serverUrl: string): { postUrl: string; sseUrl: string } {
  let cleanUrl = (serverUrl || DEFAULT_MCP_SERVER_URL).trim();

  // Ensure trailing slash for /mcp/ to prevent HTTP 307 redirect
  if (cleanUrl.endsWith('/mcp')) {
    cleanUrl = `${cleanUrl}/`;
  }

  let postUrl = cleanUrl;
  let sseUrl = cleanUrl.endsWith('/sse') ? cleanUrl : `${cleanUrl.replace(/\/$/, '')}/sse`;

  return { postUrl, sseUrl };
}

/**
 * Helper to build authorization headers with current login session JWT token
 * Accepts both application/json and text/event-stream as required by FastMCP
 */
function getAuthHeaders(userToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (userToken && userToken.trim() !== '') {
    const cleanToken = userToken.trim();
    headers['Authorization'] = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
  }

  return headers;
}

/**
 * Helper to parse raw text response or SSE event stream payload (data: {...})
 * Handles both plain JSON and SSE `event: ...\ndata: {...}` formats.
 */
function parseMcpResponseText(rawText: string): any {
  if (!rawText || rawText.trim() === '') return null;

  // 1. Try direct JSON parse first (plain JSON response)
  try {
    return JSON.parse(rawText);
  } catch {
    // Not plain JSON — continue to SSE extraction
  }

  // 2. Extract all `data: {...}` lines from SSE and try to parse each
  //    Use [\s\S] instead of . to handle any edge-case with \r chars inside
  const sseLines = rawText.split(/\r?\n/);
  for (const line of sseLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data:')) {
      const jsonPart = trimmed.slice(5).trim(); // Remove "data:" prefix
      if (jsonPart.startsWith('{')) {
        try {
          return JSON.parse(jsonPart);
        } catch (err) {
          console.warn('[MCP] Failed to parse SSE JSON data line:', err, 'line:', jsonPart.substring(0, 200));
        }
      }
    }
  }

  // 3. Fallback: regex match for data: {...} anywhere in the text
  const dataMatch = rawText.match(/data:\s*(\{[\s\S]*\})\s*$/m);
  if (dataMatch && dataMatch[1]) {
    try {
      return JSON.parse(dataMatch[1]);
    } catch (err) {
      console.warn('[MCP] Fallback regex parse failed:', err);
    }
  }

  console.warn('[MCP] Could not parse response text:', rawText.substring(0, 300));
  return null;
}

/**
 * Fetch available tools directly from the MCP Server using Model Context Protocol (JSON-RPC / SSE)
 */
export async function fetchMcpTools(
  serverUrl: string = DEFAULT_MCP_SERVER_URL,
  userToken?: string | null
): Promise<McpTool[]> {
  const effectiveUrl = (serverUrl || '').trim();
  if (!effectiveUrl) {
    throw new Error('MCP Server URL chưa được cấu hình. Vui lòng kiểm tra biến môi trường VITE_MCP_SERVER_URL hoặc cài đặt trong Settings.');
  }

  const { postUrl, sseUrl } = resolveMcpEndpoints(effectiveUrl);
  const headers = getAuthHeaders(userToken);

  const targets = [postUrl];
  if (sseUrl !== postUrl) {
    targets.push(sseUrl);
  }

  const errors: string[] = [];

  for (const target of targets) {
    try {
      console.log(`[MCP] Fetching tools from: ${target}`);
      const response = await fetch(target, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        const errMsg = `HTTP ${response.status} ${response.statusText}: ${errBody.substring(0, 200)}`;
        console.warn(`[MCP] tools/list failed on ${target}:`, errMsg);
        errors.push(errMsg);
        continue;
      }

      const rawText = await response.text();
      console.log(`[MCP] Received response (${rawText.length} bytes) from ${target}`);
      const data = parseMcpResponseText(rawText);

      if (!data) {
        const errMsg = `Không thể phân tích phản hồi từ MCP Server (${rawText.length} bytes)`;
        console.warn(`[MCP] ${errMsg}`, rawText.substring(0, 300));
        errors.push(errMsg);
        continue;
      }

      // Check for JSON-RPC error responses
      if (data.error) {
        const errMsg = `MCP Server error: ${data.error.message || JSON.stringify(data.error)}`;
        console.warn(`[MCP] ${errMsg}`);
        errors.push(errMsg);
        continue;
      }

      let tools: McpTool[] = [];
      if (data.result && Array.isArray(data.result.tools)) {
        tools = data.result.tools as McpTool[];
      } else if (Array.isArray(data.tools)) {
        tools = data.tools as McpTool[];
      }

      console.log(`[MCP] Found ${tools.length} tools from ${target}`);
      return tools; // Return even if empty — a successful response with 0 tools is valid
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      console.warn(`[MCP] JSON-RPC tools/list error on ${target}:`, error);
      errors.push(errMsg);
    }
  }

  // All targets failed — throw with accumulated error messages
  throw new Error(errors.join(' | ') || 'Không thể kết nối đến MCP Server');
}

/**
 * Execute a tool call against the MCP Server using Model Context Protocol (tools/call JSON-RPC)
 */
export async function callMcpTool(
  serverUrl: string = DEFAULT_MCP_SERVER_URL,
  userToken: string | null | undefined,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolCallResult | any> {
  const { postUrl, sseUrl } = resolveMcpEndpoints(serverUrl);
  const headers = getAuthHeaders(userToken);

  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args || {},
    },
  };

  const targets = [postUrl];
  if (sseUrl !== postUrl) {
    targets.push(sseUrl);
  }

  for (const target of targets) {
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const rawText = await response.text();
        const data = parseMcpResponseText(rawText);

        if (data && data.result) {
          return data.result;
        }
        if (data) {
          return data;
        }
      } else {
        const errText = await response.text();
        console.warn(`[MCP] Tool call ${toolName} HTTP ${response.status} on ${target}:`, errText);
      }
    } catch (error: any) {
      console.error(`[MCP] Error calling tool ${toolName} on ${target}:`, error);
    }
  }

  return {
    isError: true,
    content: [{ type: 'text', text: `Không thể kết nối hoặc thực thi công cụ ${toolName} tới máy chủ MCP.` }],
  };
}

/**
 * Convert MCP Tools to Gemini functionDeclarations format
 */
export function convertMcpToolsToGemini(tools: McpTool[]) {
  if (!tools || tools.length === 0) return [];

  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description || `MCP tool ${t.name}`,
        parameters: sanitizeSchemaForGemini(t.inputSchema),
      })),
    },
  ];
}
