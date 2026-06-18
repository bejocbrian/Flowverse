
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import MainLayout from '@/components/MainLayout.jsx';
import AdminLayout from '@/components/AdminLayout.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import PageSkeleton from '@/components/common/PageSkeleton.jsx';

// Public pages
const HomePage = lazy(() => import('@/pages/HomePage.jsx'));
const LoginPage = lazy(() => import('@/pages/LoginPage.jsx'));
const SignupPage = lazy(() => import('@/pages/SignupPage.jsx'));
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage.jsx'));
const PublicVideoPage = lazy(() => import('@/pages/PublicVideoPage.jsx'));

// Protected app pages
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage.jsx'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage.jsx'));
const GeneratePage = lazy(() => import('@/pages/GeneratePage.jsx'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage.jsx'));
const VideoDetailPage = lazy(() => import('@/pages/VideoDetailPage.jsx'));
const WalletPage = lazy(() => import('@/pages/WalletPage.jsx'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage.jsx'));
const WalletSuccessPage = lazy(() => import('@/pages/WalletSuccessPage.jsx'));
const WalletCancelPage = lazy(() => import('@/pages/WalletCancelPage.jsx'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage.jsx'));
const QueuePage = lazy(() => import('@/pages/QueuePage.jsx'));

// Admin Pages
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard.jsx'));
const AdminProvidersPage = lazy(() => import('@/pages/AdminProvidersPage.jsx'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage.jsx'));
const AdminSettingsPage = lazy(() => import('@/pages/AdminSettingsPage.jsx'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<PageSkeleton />}>
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
                  <ErrorBoundary title="Onboarding Error" message="Something went wrong during onboarding. Please try again.">
                    <OnboardingPage />
                  </ErrorBoundary>
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
                  <ErrorBoundary title="Wallet Error" message="Something went wrong loading your wallet. Please try again.">
                    <MainLayout>
                      <WalletPage />
                    </MainLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/wallet/success"
              element={
                <ProtectedRoute requiredRole="consumer">
                  <ErrorBoundary title="Payment Error" message="Something went wrong with your payment. Please try again.">
                    <MainLayout>
                      <WalletSuccessPage />
                    </MainLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/wallet/cancel"
              element={
                <ProtectedRoute requiredRole="consumer">
                  <ErrorBoundary title="Payment Cancelled" message="Your payment was cancelled. You can try again from the wallet page.">
                    <MainLayout>
                      <WalletCancelPage />
                    </MainLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/analytics"
              element={
                <ProtectedRoute requiredRole="consumer">
                  <ErrorBoundary title="Analytics Error" message="Something went wrong loading analytics. Please try again.">
                    <MainLayout>
                      <AnalyticsPage />
                    </MainLayout>
                  </ErrorBoundary>
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
                  <ErrorBoundary title="Settings Error" message="Something went wrong loading settings. Please try again.">
                    <MainLayout>
                      <SettingsPage />
                    </MainLayout>
                  </ErrorBoundary>
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
        </Suspense>
        <Toaster position="bottom-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
