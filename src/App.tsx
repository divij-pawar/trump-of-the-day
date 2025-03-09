import React from "react";

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard';
import NewsContent from './components/NewsContent';
import ProtectedRoute from './components/ProtectedRoute';

const AppContent: React.FC = () => {
  const { setUser } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage setUser={setUser} />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/auth/callback" element={<AuthCallback setUser={setUser} />} />
      <Route
        path="/dashboard"
        element={<ProtectedRoute element={<Dashboard />} />}
      />
      <Route path="/" element={<NewsContent/>}/>
      <Route path="/home" element={<NewsContent/>}/>
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;