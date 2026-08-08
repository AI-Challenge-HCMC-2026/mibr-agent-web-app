import React from 'react';
import ChatLayout from '../../components/ChatLayout/ChatLayout';
import ApiDocuments from '../../components/ApiDocuments/ApiDocuments';

export const ApiDocsPage: React.FC = () => {
  return (
    <ChatLayout activeNav="api-docs">
      <ApiDocuments />
    </ChatLayout>
  );
};

export default ApiDocsPage;
