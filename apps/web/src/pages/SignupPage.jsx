
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Chrome, Github } from 'lucide-react';
import { toast } from 'sonner';
import TurnstileWidget from '@/components/TurnstileWidget.jsx';

const TURNSTILE_REQUIRED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

const SignupPage = () => {
  const navigate = useNavigate();
  const { signup, loginWithOAuth } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!acceptTerms) {
      toast('Please accept the terms and conditions');
      return;
    }

    if (TURNSTILE_REQUIRED && !turnstileToken) {
      toast('Please complete the captcha');
      return;
    }

    setLoading(true);

    try {
      await signup(email, password, name, turnstileToken);
      toast('Account created. Check your email to verify and unlock free credits.');
      navigate('/onboarding');
    } catch (error) {
      let errorMessage = 'Signup failed. Please try again.';

      // 1. Extract readable error messages
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      // 2. Handle network errors
      if (
        error.message === 'Failed to fetch' || 
        error.name === 'NetworkError' || 
        errorMessage.includes('Network Error')
      ) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      // 3. Handle validation errors
      if (error.response?.data?.data && typeof error.response.data.data === 'object') {
        const fieldErrors = Object.entries(error.response.data.data)
          .map(([field, msg]) => {
            const msgText = Array.isArray(msg) ? msg.join(', ') : msg;
            return `${field}: ${msgText}`;
          })
          .join(' | ');
        
        if (fieldErrors) {
          errorMessage = errorMessage === 'Bad Request' || errorMessage === 'Validation Error' 
            ? fieldErrors 
            : `${errorMessage} - ${fieldErrors}`;
        }
      }

      // 4 & 5. Ensure clear actionable text instead of [object Object]
      if (errorMessage === '[object Object]') {
        try {
          // Attempt to parse if it's a stringified object that got converted to [object Object]
          const parsed = JSON.parse(JSON.stringify(error));
          errorMessage = parsed.error || parsed.message || 'An unexpected error occurred. Please try again.';
        } catch {
          errorMessage = 'An unexpected error occurred. Please try again.';
        }
      }

      toast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Create your account</title>
        <meta name="description" content="Sign up to start generating AI videos" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[hsl(var(--canvas))]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Create your account</h1>
            <p className="text-[hsl(var(--text-secondary))]">
              Start creating cinematic videos with AI
            </p>
          </div>

          <div className="glass-surface rounded-xl p-8 shadow-glass-lg">
            <div className="space-y-3 mb-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => loginWithOAuth('google')}
              >
                <Chrome className="w-5 h-5 mr-2" />
                Continue with Google
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => loginWithOAuth('github')}
              >
                <Github className="w-5 h-5 mr-2" />
                Continue with GitHub
              </Button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[hsl(var(--border))]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))]">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maya Chen"
                  required
                  className="mt-1 bg-[hsl(var(--elevated))] text-white"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1 bg-[hsl(var(--elevated))] text-white"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="mt-1 bg-[hsl(var(--elevated))] text-white"
                />
                <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">
                  At least 8 characters
                </p>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={setAcceptTerms}
                  className="mt-1"
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                  I agree to the{' '}
                  <Link to="/terms" className="text-[hsl(var(--accent-primary))] hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-[hsl(var(--accent-primary))] hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>

              <TurnstileWidget onToken={setTurnstileToken} className="flex justify-center" />

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-sm text-[hsl(var(--text-secondary))] mt-6">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-[hsl(var(--accent-primary))] hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
