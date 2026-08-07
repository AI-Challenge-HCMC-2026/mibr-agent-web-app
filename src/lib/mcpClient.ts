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

export const DEFAULT_MCP_SERVER_URL = 'https://ai-challenge-search-engine.onrender.com/mcp/';

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
 */
function parseMcpResponseText(rawText: string): any {
  if (!rawText || rawText.trim() === '') return null;
  try {
    return JSON.parse(rawText);
  } catch {
    const dataMatch = rawText.match(/data:\s*(\{.*\})/);
    if (dataMatch && dataMatch[1]) {
      try {
        return JSON.parse(dataMatch[1]);
      } catch (err) {
        console.warn('[MCP] Failed to parse SSE JSON data:', err);
      }
    }
  }
  return null;
}

/**
 * Fetch available tools directly from the MCP Server using Model Context Protocol (JSON-RPC / SSE)
 */
export async function fetchMcpTools(
  serverUrl: string = DEFAULT_MCP_SERVER_URL,
  userToken?: string | null
): Promise<McpTool[]> {
  const { postUrl, sseUrl } = resolveMcpEndpoints(serverUrl);
  const headers = getAuthHeaders(userToken);

  const targets = [postUrl];
  if (sseUrl !== postUrl) {
    targets.push(sseUrl);
  }

  for (const target of targets) {
    try {
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

      if (response.ok) {
        const rawText = await response.text();
        const data = parseMcpResponseText(rawText);

        let tools: McpTool[] = [];
        if (data && data.result && Array.isArray(data.result.tools)) {
          tools = data.result.tools as McpTool[];
        } else if (data && Array.isArray(data.tools)) {
          tools = data.tools as McpTool[];
        }

        if (tools.length > 0) {
          return tools;
        }
      }
    } catch (error) {
      console.warn(`[MCP] JSON-RPC tools/list error on ${target}:`, error);
    }
  }

  return [];
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
