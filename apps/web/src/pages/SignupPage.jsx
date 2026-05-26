import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import TurnstileWidget from '@/components/TurnstileWidget.jsx';

const TURNSTILE_REQUIRED = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

const SignupPage = () => {
	const navigate = useNavigate();
	const { signup } = useAuth();
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
			toast.success('Account created. Check your email to verify and unlock free credits.');
			navigate('/onboarding');
		} catch (error) {
			toast.error(error?.message || 'Signup failed. Please try again.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<Helmet>
				<title>Create your account - Aether Video</title>
				<meta name="description" content="Sign up to start generating AI videos" />
			</Helmet>

			<div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[hsl(var(--canvas))] gradient-hero">
				<div className="w-full max-w-md">
					{/* Brand */}
					<div className="flex items-center justify-center mb-8">
						<Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
							<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] grid place-items-center">
								<Sparkles className="w-3.5 h-3.5 text-[hsl(var(--canvas))]" />
							</span>
							Aether Video
						</Link>
					</div>

					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold mb-2 tracking-tight">Create your account</h1>
						<p className="text-[hsl(var(--text-secondary))] text-sm">
							Start creating cinematic videos with AI.
						</p>
					</div>

					<div className="glass-elevated rounded-2xl p-7 shadow-glass-lg">
						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<Label htmlFor="name" className="text-sm">Full name</Label>
								<Input
									id="name"
									type="text"
									autoComplete="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Maya Chen"
									required
									minLength={2}
									className="mt-1.5 bg-[hsl(var(--surface))] border-[hsl(var(--border))]"
								/>
							</div>

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
								<Label htmlFor="password" className="text-sm">Password</Label>
								<Input
									id="password"
									type="password"
									autoComplete="new-password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="At least 8 characters"
									required
									minLength={8}
									className="mt-1.5 bg-[hsl(var(--surface))] border-[hsl(var(--border))]"
								/>
							</div>

							<div className="flex items-start gap-2 pt-1">
								<Checkbox
									id="terms"
									checked={acceptTerms}
									onCheckedChange={setAcceptTerms}
									className="mt-1"
								/>
								<Label
									htmlFor="terms"
									className="text-xs leading-relaxed cursor-pointer text-[hsl(var(--text-secondary))]"
								>
									I agree to the Terms of Service and Privacy Policy.
								</Label>
							</div>

							<TurnstileWidget onToken={setTurnstileToken} className="flex justify-center" />

							<Button type="submit" className="w-full mt-2" disabled={loading}>
								{loading ? 'Creating account...' : 'Create account'}
							</Button>
						</form>
					</div>

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
		</>
	);
};

export default SignupPage;
