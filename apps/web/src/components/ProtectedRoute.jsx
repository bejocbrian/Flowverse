
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, currentUser, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Handle role-based routing
  if (requiredRole === 'admin' && role !== 'admin') {
    return <Navigate to="/app/generate" replace />;
  }

  if (requiredRole === 'consumer' && role === 'admin') {
    // Prevent admins from accidentally ending up in consumer loops, 
    // although they might need both. If strict separation is needed:
    return <Navigate to="/admin" replace />;
  }

  if (currentUser && !currentUser.onboarding_completed && location.pathname !== '/onboarding' && role !== 'admin') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;
