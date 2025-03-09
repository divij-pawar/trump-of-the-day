// AuthCallback.tsx - React component to handle OAuth callbacks

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthCallbackProps {
  setUser: (user: any) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ setUser }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Get token from URL
      const query = new URLSearchParams(window.location.search);
      const token = query.get('token');

      if (!token) {
        navigate('/login?error=no_token');
        return;
      }

      try {
        // Store token
        localStorage.setItem('auth_token', token);

        // Fetch user data
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();
        setUser(data.user);
        
        // Redirect to dashboard
        navigate('/dashboard');
      } catch (error) {
        console.error('Auth callback error:', error);
        localStorage.removeItem('auth_token');
        navigate('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Completing authentication...</h2>
        <p className="text-gray-600">Please wait while we log you in</p>
      </div>
    </div>
  );
};

export default AuthCallback;