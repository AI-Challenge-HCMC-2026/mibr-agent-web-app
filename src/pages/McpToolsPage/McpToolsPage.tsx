import React from 'react';
import { useNavigate } from 'react-router-dom';
import ChatLayout from '../../components/ChatLayout/ChatLayout';
import McpTools from '../../components/McpTools/McpTools';

export const McpToolsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ChatLayout activeNav="mcp-tools">
      <McpTools
        onSelectTool={(toolName) => {
          navigate('/chat', {
            state: { prefillMessage: `Hãy sử dụng công cụ MCP "${toolName}" để hỗ trợ tôi.` },
          });
        }}
        onNavigateToSettings={() => navigate('/settings')}
      />
    </ChatLayout>
  );
};

export default McpToolsPage;
