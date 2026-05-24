
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('consumer');
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.model) {
      setCurrentUser(pb.authStore.model);
      setIsAuthenticated(true);
      setRole(pb.authStore.model.role || 'consumer');
    }
    setInitialLoading(false);
  }, []);

  const signup = async (email, password, name) => {
    try {
      const response = await apiServerClient.fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      }

      const data = await response.json();
      
      await pb.collection('users').authWithPassword(email, password, { $autoCancel: false });
      
      setCurrentUser(pb.authStore.model);
      setIsAuthenticated(true);
      setRole(pb.authStore.model.role || 'consumer');
      
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password, { $autoCancel: false });
      setCurrentUser(authData.record);
      setIsAuthenticated(true);
      setRole(authData.record.role || 'consumer');
      return authData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithOAuth = (provider) => {
    pb.collection('users').authWithOAuth2({ provider })
      .then((authData) => {
        setCurrentUser(authData.record);
        setIsAuthenticated(true);
        setRole(authData.record.role || 'consumer');
        
        if (!authData.record.onboarding_completed) {
          navigate('/onboarding');
        } else {
          navigate('/app/dashboard');
        }
      })
      .catch((error) => {
        console.error('OAuth login error:', error);
        throw error;
      });
  };

  const logout = async () => {
    try {
      await apiServerClient.fetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout API error:', error);
    }
    
    pb.authStore.clear();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setRole('consumer');
    navigate('/');
  };

  const requestPasswordReset = async (email) => {
    try {
      const response = await apiServerClient.fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Password reset failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates) => {
    try {
      const updated = await pb.collection('users').update(currentUser.id, updates, { $autoCancel: false });
      setCurrentUser(updated);
      setRole(updated.role || 'consumer');
      return updated;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const updated = await pb.collection('users').getOne(currentUser.id, { $autoCancel: false });
      setCurrentUser(updated);
      setRole(updated.role || 'consumer');
      return updated;
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    role,
    signup,
    login,
    loginWithOAuth,
    logout,
    requestPasswordReset,
    updateProfile,
    refreshUser
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--canvas))]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[hsl(var(--text-secondary))]">Loading...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
