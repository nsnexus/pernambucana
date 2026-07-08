import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { AutoGeralProvider } from './context/AutoGeralContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Cadastros from './pages/Cadastros';
import AutoGeral from './pages/AutoGeral';
import Pernambucana from './pages/Pernambucana';

// Protected Route Component to block unauthenticated access
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', color: '#fff' }}>Carregando sessão...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Protected Route specifically for Auto Geral (admin + AltoGeral sector only)
const AutoGeralRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', color: '#fff' }}>Carregando sessão...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  // Only admin or AltoGeral sector users
  if (!currentUser.isAdmin && currentUser.sector !== 'AltoGeral' && !(currentUser.allowedSectors && currentUser.allowedSectors.includes('AltoGeral'))) {
    return <Navigate to="/painel" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AutoGeralProvider>
          <Router>
            <Routes>
              {/* Public route */}
              <Route path="/" element={<Landing />} />
              
              {/* Protected routes */}
              <Route path="/painel" element={<Navigate to="/pernambucana" replace />} />
              <Route path="/cadastros" element={<Navigate to="/pernambucana" replace />} />
              
              <Route 
                path="/pernambucana" 
                element={
                  <ProtectedRoute>
                    <Pernambucana />
                  </ProtectedRoute>
                } 
              />
              
              {/* Auto Geral — módulo dedicado */}
              <Route 
                path="/autogeral" 
                element={
                  <AutoGeralRoute>
                    <AutoGeral />
                  </AutoGeralRoute>
                } 
              />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AutoGeralProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
