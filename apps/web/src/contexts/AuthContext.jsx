
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
      // The cached authStore record can be stale (e.g. credits_balance after an
      // admin adjustment) and is missing server-derived fields like is_paid
      // (which gates paid models). Re-fetch the canonical record once on entry
      // so balance + paid-tier are always accurate. Best-effort: ignore errors.
      refreshUser().catch(() => {});
    }
    setInitialLoading(false);
  }, []);

  const signup = async (email, password, name, turnstileToken) => {
    try {
      const response = await apiServerClient.fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, turnstileToken })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      }

      const data = await response.json();

      // Use the token our API returned so we don't fire a second
      // PocketBase auth call (which would also bypass our /auth/login
      // captcha + rate limits).
      pb.authStore.save(data.token, data.user);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setRole(data.user.role || 'consumer');

      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password, turnstileToken) => {
    try {
      // Login goes through our API so it can enforce captcha + rate limits
      // before passing through to PocketBase. The API returns a token we
      // then load into the local PocketBase authStore so subsequent
      // PB calls work.
      const response = await apiServerClient.fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Login failed');
      }

      const data = await response.json();

      // Push token into PocketBase client so existing PB-based code works.
      pb.authStore.save(data.token, data.user);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setRole(data.user.role || 'consumer');
      // The login payload omits server-derived fields like is_paid (paid-model
      // gating) and may carry a slightly stale balance. Hydrate the canonical
      // record so paid users get paid access right away. Best-effort.
      refreshUser().catch(() => {});
      return data;
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
      // Route writes through our API (never talk to PocketBase directly
      // from the browser). The API whitelists the allowed fields.
      const response = await apiServerClient.fetch('/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update profile');
      }
      const { user: updated } = await response.json();
      // Keep the local PocketBase authStore in sync so any PB-based reads
      // and a hard reload reflect the new values.
      if (pb.authStore.token) {
        pb.authStore.save(pb.authStore.token, { ...pb.authStore.model, ...updated });
      }
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
      const response = await apiServerClient.fetch('/users/me');
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to refresh user');
      }
      const { user: updated } = await response.json();
      if (pb.authStore.token) {
        pb.authStore.save(pb.authStore.token, { ...pb.authStore.model, ...updated });
      }
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
