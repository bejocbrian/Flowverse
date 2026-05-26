import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
	Briefcase,
	Film,
	Heart,
	Loader2,
	Share2,
	Sparkles,
	Mail,
	CheckCircle2,
	ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';

/* -------------------------------------------------------------------------- */

const USE_CASES = [
	{ id: 'marketing', label: 'Marketing', desc: 'Ads, social, brand content', icon: Briefcase },
	{ id: 'social', label: 'Social media', desc: 'Reels, Shorts, TikToks', icon: Share2 },
	{ id: 'film', label: 'Film & VFX', desc: 'Pre-vis, mood boards, b-roll', icon: Film },
	{ id: 'personal', label: 'Personal', desc: 'Just exploring', icon: Heart },
	{ id: 'other', label: 'Something else', desc: 'I will tell you later', icon: Sparkles },
];

const TOTAL_STEPS = 3;

/* -------------------------------------------------------------------------- */

const ProgressBar = ({ step }) => (
	<div className="flex gap-1.5">
		{Array.from({ length: TOTAL_STEPS }).map((_, i) => (
			<div
				key={i}
				className={`h-1 flex-1 rounded-full transition-colors ${
					i <= step ? 'bg-[hsl(var(--accent-primary))]' : 'bg-white/10'
				}`}
			/>
		))}
	</div>
);

const OnboardingPage = () => {
	const navigate = useNavigate();
	const { currentUser, updateProfile } = useAuth();
	const [step, setStep] = useState(0);
	const [useCase, setUseCase] = useState('');
	const [loading, setLoading] = useState(false);

	const handleComplete = async () => {
		setLoading(true);
		try {
			await updateProfile({ onboarding_completed: true });
			toast.success('Welcome to your workspace');
			navigate('/app/generate');
		} catch (err) {
			toast.error(err?.message || 'Failed to complete onboarding');
		} finally {
			setLoading(false);
		}
	};

	const handleNext = () => {
		if (step === 0 && !useCase) {
			toast('Pick a use case to continue');
			return;
		}
		if (step < TOTAL_STEPS - 1) {
			setStep((s) => s + 1);
		} else {
			handleComplete();
		}
	};

	const isVerified = Boolean(currentUser?.verified);
	const balance = currentUser?.credits_balance ?? 0;

	return (
		<>
			<Helmet>
				<title>Welcome - Aether Video</title>
			</Helmet>

			<div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[hsl(var(--canvas))] gradient-hero">
				<div className="w-full max-w-2xl">
					<div className="flex items-center justify-center mb-8">
						<div className="flex items-center gap-2 font-semibold tracking-tight">
							<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] grid place-items-center">
								<Sparkles className="w-3.5 h-3.5 text-[hsl(var(--canvas))]" />
							</span>
							Aether Video
						</div>
					</div>

					<div className="mb-6">
						<ProgressBar step={step} />
						<p className="text-[11px] font-mono uppercase tracking-wider text-white/40 mt-2">
							Step {step + 1} of {TOTAL_STEPS}
						</p>
					</div>

					<div className="glass-elevated rounded-2xl p-6 sm:p-8 shadow-glass-lg">
						<AnimatePresence mode="wait">
							{step === 0 && (
								<motion.div
									key="step-0"
									initial={{ opacity: 0, x: 16 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -16 }}
									className="space-y-5"
								>
									<div>
										<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1.5">
											What will you create?
										</h1>
										<p className="text-sm text-[hsl(var(--text-secondary))]">
											We will tune defaults around your answer.
										</p>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										{USE_CASES.map((u) => {
											const Icon = u.icon;
											const active = useCase === u.id;
											return (
												<button
													key={u.id}
													type="button"
													onClick={() => setUseCase(u.id)}
													className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors ${
														active
															? 'border-[hsl(var(--accent-primary))]/60 bg-[hsl(var(--accent-primary))]/10'
															: 'border-white/10 bg-white/[0.03] hover:border-white/20'
													}`}
												>
													<span
														className={`p-2 rounded-lg shrink-0 ${
															active ? 'bg-[hsl(var(--accent-primary))]/20' : 'bg-white/5'
														}`}
													>
														<Icon
															className={`w-4 h-4 ${
																active ? 'text-[hsl(var(--accent-primary))]' : 'text-white/60'
															}`}
														/>
													</span>
													<div className="min-w-0">
														<p className="text-sm font-medium leading-tight">{u.label}</p>
														<p className="text-xs text-white/40 mt-0.5 leading-snug">{u.desc}</p>
													</div>
												</button>
											);
										})}
									</div>
								</motion.div>
							)}

							{step === 1 && (
								<motion.div
									key="step-1"
									initial={{ opacity: 0, x: 16 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -16 }}
									className="space-y-5"
								>
									<div className="flex items-start gap-3">
										<span
											className={`p-2 rounded-lg ${
												isVerified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
											}`}
										>
											{isVerified ? <CheckCircle2 className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
										</span>
										<div>
											<h1 className="text-2xl font-semibold tracking-tight mb-1.5">
												{isVerified ? 'Email verified' : 'Verify your email'}
											</h1>
											<p className="text-sm text-[hsl(var(--text-secondary))]">
												{isVerified
													? 'You are all set. Free credits have been added to your account.'
													: 'We sent you a link. Click it to confirm your email and unlock free credits.'}
											</p>
										</div>
									</div>

									<div className="rounded-xl bg-black/40 border border-white/5 p-4">
										<div className="flex items-center justify-between mb-1.5">
											<span className="text-xs uppercase tracking-wider text-white/40 font-mono">
												Account email
											</span>
											{isVerified && (
												<span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
													Verified
												</span>
											)}
										</div>
										<p className="text-sm font-medium truncate">{currentUser?.email}</p>
									</div>

									{!isVerified && (
										<p className="text-xs text-white/50 leading-relaxed">
											Did not get the email? Check spam, or skip this step and verify later from
											Settings.
										</p>
									)}
								</motion.div>
							)}

							{step === 2 && (
								<motion.div
									key="step-2"
									initial={{ opacity: 0, x: 16 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -16 }}
									className="space-y-5 text-center"
								>
									<div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] flex items-center justify-center shadow-glow-primary">
										<Sparkles className="w-8 h-8 text-black" />
									</div>
									<div>
										<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
											Ready to create
										</h1>
										<p className="text-sm text-[hsl(var(--text-secondary))]">
											Your workspace is set up. Type a prompt and ship a shot.
										</p>
									</div>

									<div className="rounded-xl bg-black/40 border border-white/5 p-4 text-left">
										<div className="flex items-center justify-between">
											<span className="text-xs uppercase tracking-wider text-white/40 font-mono">
												Current balance
											</span>
											<span className="text-2xl font-semibold tracking-tight">
												{balance} <span className="text-sm text-white/40">credits</span>
											</span>
										</div>
										<p className="text-[11px] text-white/40 mt-1.5">
											{isVerified
												? 'Free credits added on email verification.'
												: 'Verify your email to unlock more free credits.'}
										</p>
									</div>
								</motion.div>
							)}
						</AnimatePresence>

						<div className="flex items-center justify-between mt-7 pt-5 border-t border-white/5">
							{step > 0 ? (
								<button
									onClick={() => setStep((s) => s - 1)}
									className="px-4 py-2 rounded-full text-sm text-white/60 hover:text-white transition-colors"
								>
									Back
								</button>
							) : (
								<span />
							)}

							<button
								onClick={handleNext}
								disabled={loading}
								className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-[1.02] active:scale-100 disabled:opacity-50 disabled:scale-100 transition-transform"
							>
								{loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
								{step === TOTAL_STEPS - 1 ? 'Open workspace' : 'Continue'}
								{step !== TOTAL_STEPS - 1 && !loading && <ArrowRight className="w-3.5 h-3.5" />}
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default OnboardingPage;
