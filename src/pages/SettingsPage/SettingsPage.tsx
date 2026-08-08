import React from 'react';
import ChatLayout from '../../components/ChatLayout/ChatLayout';
import { SettingsContent } from '../Settings/Settings';

export const SettingsPage: React.FC = () => {
  return (
    <ChatLayout activeNav="settings">
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto' }}>
        <SettingsContent />
      </div>
    </ChatLayout>
  );
};

export default SettingsPage;
