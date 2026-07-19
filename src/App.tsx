import { useState } from 'react';
import Login from './pages/Login/Login';
import Chat from './pages/Chat/Chat';

function App() {
  const [currentView, setCurrentView] = useState<'login' | 'chat'>('login');
  const [userEmail, setUserEmail] = useState('');

  const handleLoginSuccess = (email: string) => {
    setUserEmail(email);
    setCurrentView('chat');
  };

  const handleLogout = () => {
    setUserEmail('');
    setCurrentView('login');
  };

  if (currentView === 'login') {
    return (
      <Login onLoginSuccess={handleLoginSuccess} />
    );
  }

  return <Chat userEmail={userEmail} onLogout={handleLogout} />;
}

export default App;
