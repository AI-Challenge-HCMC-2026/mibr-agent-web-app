import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import Chat from './pages/Chat/Chat';
import McpToolsPage from './pages/McpToolsPage/McpToolsPage';
import ApiDocsPage from './pages/ApiDocsPage/ApiDocsPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mcp-tools"
            element={
              <ProtectedRoute>
                <McpToolsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-docs"
            element={
              <ProtectedRoute>
                <ApiDocsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
