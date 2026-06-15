
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import MainLayout from '@/components/MainLayout.jsx';
import AdminLayout from '@/components/AdminLayout.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';

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
import AnalyticsPage from '@/pages/AnalyticsPage.jsx';
import QueuePage from '@/pages/QueuePage.jsx';

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
                <ErrorBoundary title="Dashboard Error" message="Something went wrong loading your dashboard. Please try again.">
                  <MainLayout>
                    <DashboardPage />
                  </MainLayout>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/generate"
            element={
              <ProtectedRoute requiredRole="consumer">
                <ErrorBoundary title="Generation Error" message="Something went wrong on the generation page. Please try again.">
                  <MainLayout>
                    <GeneratePage />
                  </MainLayout>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/library"
            element={
              <ProtectedRoute requiredRole="consumer">
                <ErrorBoundary title="Library Error" message="Something went wrong loading your library. Please try again.">
                  <MainLayout>
                    <LibraryPage />
                  </MainLayout>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/library/:id"
            element={
              <ProtectedRoute requiredRole="consumer">
                <ErrorBoundary title="Video Error" message="Something went wrong loading this video. Please try again.">
                  <MainLayout>
                    <VideoDetailPage />
                  </MainLayout>
                </ErrorBoundary>
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
            path="/app/analytics"
            element={
              <ProtectedRoute requiredRole="consumer">
                <MainLayout>
                  <AnalyticsPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/queue"
            element={
              <ProtectedRoute requiredRole="consumer">
                <ErrorBoundary title="Queue Error" message="Something went wrong loading the queue. Please try again.">
                  <MainLayout>
                    <QueuePage />
                  </MainLayout>
                </ErrorBoundary>
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
              <div className="min-h-screen bg-[hsl(var(--canvas))] gradient-hero flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                  <p className="text-label text-[hsl(var(--accent-primary))] mb-3">404</p>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                    Lost in the void
                  </h1>
                  <p className="text-[hsl(var(--text-secondary))] mb-6">
                    The page you were looking for is not here. It may have moved or never existed.
                  </p>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(var(--accent-primary-container))] text-white font-medium hover:opacity-90 transition-opacity"
                  >
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
