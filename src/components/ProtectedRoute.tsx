import React from "react";
import { useAuth } from './AuthContext';
import { Navigate} from 'react-router-dom';


// Protected route component
const ProtectedRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
    const { user, loading } = useAuth();
  
    if (loading) {
      return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }
  
    return user ? element : <Navigate to="/login" />;
  };

export default ProtectedRoute;