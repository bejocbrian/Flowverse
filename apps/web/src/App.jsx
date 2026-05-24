
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import MainLayout from '@/components/MainLayout.jsx';
import AdminLayout from '@/components/AdminLayout.jsx';

import HomePage from '@/pages/HomePage.jsx';
import DashboardPage from '@/pages/DashboardPage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import SignupPage from '@/pages/SignupPage.jsx';
import PasswordResetPage from '@/pages/PasswordResetPage.jsx';
import OnboardingPage from '@/pages/OnboardingPage.jsx';
import GeneratePage from '@/pages/GeneratePage.jsx';
import LibraryPage from '@/pages/LibraryPage.jsx';
import VideoDetailPage from '@/pages/VideoDetailPage.jsx';
import WalletPage from '@/pages/WalletPage.jsx';
import SettingsPage from '@/pages/SettingsPage.jsx';
import WalletSuccessPage from '@/pages/WalletSuccessPage.jsx';
import WalletCancelPage from '@/pages/WalletCancelPage.jsx';
import PublicVideoPage from '@/pages/PublicVideoPage.jsx';

// Admin Pages
import AdminDashboard from '@/pages/AdminDashboard.jsx';
import AdminProvidersPage from '@/pages/AdminProvidersPage.jsx';
import AdminUsersPage from '@/pages/AdminUsersPage.jsx';
import AdminSettingsPage from '@/pages/AdminSettingsPage.jsx';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset" element={<PasswordResetPage />} />
          <Route path="/videos/public/:shareToken" element={<PublicVideoPage />} />

          {/* Onboarding */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requiredRole="consumer">
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Protected App Routes (Consumers) */}
          <Route
            path="/app/dashboard"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <DashboardPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/generate"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <GeneratePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/library"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <LibraryPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/library/:id"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <VideoDetailPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/wallet"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <WalletPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/wallet/success"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <WalletSuccessPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/wallet/cancel"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <WalletCancelPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/settings"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <SettingsPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/providers"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <AdminProvidersPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <AdminUsersPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <AdminSettingsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-[hsl(var(--canvas))] flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold mb-2">404</h1>
                  <p className="text-[hsl(var(--text-secondary))] mb-6">Page not found</p>
                  <Link to="/" className="text-[hsl(var(--accent-primary))] hover:underline">
                    Back to home
                  </Link>
                </div>
              </div>
            }
          />
        </Routes>
        <Toaster position="bottom-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
