import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { NewConversationPage } from './pages/NewConversationPage';
import { ConversationDetailPage } from './pages/ConversationDetailPage';
import { JournalPage } from './pages/JournalPage';
import { JournalDetailPage } from './pages/JournalDetailPage';
import { IntegrityVaultPage } from './pages/IntegrityVaultPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />

          {/* Protected — require Firebase auth */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/conversations" element={<ConversationsPage />} />
            <Route path="/conversations/new" element={<NewConversationPage />} />
            <Route path="/conversations/:id" element={<ConversationDetailPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/:id" element={<JournalDetailPage />} />
            <Route path="/integrity" element={<IntegrityVaultPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
