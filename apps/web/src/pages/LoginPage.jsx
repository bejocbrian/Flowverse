import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import TurnstileWidget from '@/components/TurnstileWidget.jsx';

const TURNSTILE_REQUIRED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

const LoginPage = () => {
	const navigate = useNavigate();
	const { login } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [turnstileToken, setTurnstileToken] = useState('');

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (TURNSTILE_REQUIRED && !turnstileToken) {
			toast('Please complete the captcha');
			return;
		}

		setLoading(true);

		try {
			await login(email, password, turnstileToken);
			toast.success('Welcome back');
			navigate('/app/dashboard');
		} catch (error) {
			toast.error(error?.message || 'Login failed. Please check your credentials.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<Helmet>
				<title>Sign in - Aether Video</title>
				<meta name="description" content="Sign in to your Aether Video account" />
			</Helmet>

			<div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[hsl(var(--canvas))] gradient-hero">
				<div className="w-full max-w-md">
					<div className="flex items-center justify-center mb-8">
						<Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
							<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] grid place-items-center">
								<Sparkles className="w-3.5 h-3.5 text-[hsl(var(--canvas))]" />
							</span>
							Aether Video
						</Link>
					</div>

					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold mb-2 tracking-tight">Welcome back</h1>
						<p className="text-[hsl(var(--text-secondary))] text-sm">
							Sign in to continue creating.
						</p>
					</div>

					<div className="glass-elevated rounded-2xl p-7 shadow-glass-lg">
						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<Label htmlFor="email" className="text-sm">Email</Label>
								<Input
									id="email"
									type="email"
									autoComplete="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@example.com"
									required
									className="mt-1.5 bg-[hsl(var(--surface))] border-[hsl(var(--border))]"
								/>
							</div>

							<div>
								<div className="flex items-center justify-between">
									<Label htmlFor="password" className="text-sm">Password</Label>
									<Link
										to="/reset"
										className="text-xs text-[hsl(var(--accent-primary))] hover:underline"
									>
										Forgot?
									</Link>
								</div>
								<Input
									id="password"
									type="password"
									autoComplete="current-password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••"
									required
									className="mt-1.5 bg-[hsl(var(--surface))] border-[hsl(var(--border))]"
								/>
							</div>

							<TurnstileWidget onToken={setTurnstileToken} className="flex justify-center pt-1" />

							<Button type="submit" className="w-full mt-2" disabled={loading}>
								{loading ? 'Signing in...' : 'Sign in'}
							</Button>
						</form>
					</div>

					<p className="text-center text-sm text-[hsl(var(--text-secondary))] mt-6">
						Don't have an account?{' '}
						<Link
							to="/signup"
							className="text-[hsl(var(--accent-primary))] hover:underline font-medium"
						>
							Sign up
						</Link>
					</p>
				</div>
			</div>
		</>
	);
};

export default LoginPage;
