import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
	Bell,
	BellOff,
	CreditCard,
	Loader2,
	Lock,
	LogOut,
	Mail,
	Sparkles,
	User as UserIcon,
	Moon,
	Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { Toggle } from '@/components/ui/toggle.jsx';

/* -------------------------------------------------------------------------- */
/*  Section primitives                                                        */
/* -------------------------------------------------------------------------- */

const Card = ({ children, className = '' }) => (
	<div className={`bg-white/[0.03] border border-white/10 rounded-2xl p-5 sm:p-6 ${className}`}>
		{children}
	</div>
);

const SectionHeader = ({ icon: Icon, title, sub }) => (
	<div className="flex items-start gap-3 mb-5">
		<span className="p-2 rounded-lg bg-white/5 text-[hsl(var(--accent-primary))]">
			<Icon className="w-4 h-4" />
		</span>
		<div>
			<h2 className="text-base font-semibold">{title}</h2>
			{sub && <p className="text-xs text-white/50 mt-0.5">{sub}</p>}
		</div>
	</div>
);

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const SettingsPage = () => {
	const { currentUser, refreshUser, logout } = useAuth();
	const { theme, toggleTheme } = useTheme();

	const [name, setName] = useState(currentUser?.name || '');
	const [savingProfile, setSavingProfile] = useState(false);

	const [notifEnabled, setNotifEnabled] = useState(false);
	const [savingNotif, setSavingNotif] = useState(false);

	const [resetSending, setResetSending] = useState(false);

	useEffect(() => {
		if (currentUser) {
			setName(currentUser.name || '');
			setNotifEnabled(Boolean(currentUser.notifications_enabled));
		}
	}, [currentUser]);

	const handleSaveProfile = async (e) => {
		e.preventDefault();
		if (name.trim().length < 2) {
			toast.error('Name must be at least 2 characters');
			return;
		}
		setSavingProfile(true);
		try {
			const res = await apiServerClient.fetch('/users/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim() }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to update profile');
			}
			await refreshUser();
			toast.success('Profile updated');
		} catch (err) {
			toast.error(err.message);
		} finally {
			setSavingProfile(false);
		}
	};

	const handleToggleNotif = async (next) => {
		setSavingNotif(true);
		setNotifEnabled(next); // optimistic
		try {
			const res = await apiServerClient.fetch('/users/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notifications: next }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to update notifications');
			}
			await refreshUser();
		} catch (err) {
			setNotifEnabled(!next); // rollback
			toast.error(err.message);
		} finally {
			setSavingNotif(false);
		}
	};

	const handlePasswordReset = async () => {
		if (!currentUser?.email) return;
		setResetSending(true);
		try {
			const res = await apiServerClient.fetch('/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: currentUser.email }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Could not send reset link');
			}
			toast.success('Password reset email sent. Check your inbox.');
		} catch (err) {
			toast.error(err.message);
		} finally {
			setResetSending(false);
		}
	};

	return (
		<>
			<Helmet>
				<title>Settings - FlowVerse</title>
			</Helmet>

			<div className="flex-1 overflow-y-auto bg-black text-white">
				<div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">
					{/* Header */}
					<div>
						<p className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--accent-primary))] mb-1">
							Settings
						</p>
						<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Account</h1>
						<p className="text-sm text-white/50 mt-1">
							Manage your profile and how you get notified.
						</p>
					</div>

					{/* Profile */}
					<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
						<Card>
							<SectionHeader icon={UserIcon} title="Profile" sub="How your name appears in the app." />
							<form onSubmit={handleSaveProfile} className="space-y-4">
								<div>
									<label htmlFor="name" className="text-xs uppercase tracking-wider text-white/40 font-mono mb-1.5 block">
										Display name
									</label>
									<input
										id="name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										minLength={2}
										required
										className="w-full h-11 px-3 rounded-lg bg-black/40 border border-white/10 text-sm focus:bg-black/60 focus:border-white/20 outline-none transition-colors"
									/>
								</div>
								<div>
									<label className="text-xs uppercase tracking-wider text-white/40 font-mono mb-1.5 block">
										Email
									</label>
									<input
										value={currentUser?.email || ''}
										disabled
										className="w-full h-11 px-3 rounded-lg bg-black/20 border border-white/5 text-sm text-white/50 cursor-not-allowed"
									/>
									<p className="text-[11px] text-white/40 mt-1.5 flex items-center gap-1.5">
										<Mail className="w-3 h-3" />
										Email is read-only. Contact support to change it.
									</p>
								</div>
								<div className="flex items-center justify-end pt-1">
									<button
										type="submit"
										disabled={savingProfile || name === currentUser?.name}
										className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-[1.02] active:scale-100 disabled:opacity-40 disabled:scale-100 transition-transform"
									>
										{savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
										Save changes
									</button>
								</div>
							</form>
						</Card>
					</motion.div>

					{/* Notifications */}
					<Card>
						<SectionHeader
							icon={notifEnabled ? Bell : BellOff}
							title="Notifications"
							sub="Email me about activity on my account."
						/>
						<div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
							<div>
								<p className="text-sm font-medium">Email notifications</p>
								<p className="text-xs text-white/40 mt-0.5">
									Generation updates, billing receipts, and product news.
								</p>
							</div>
							<Toggle checked={notifEnabled} onChange={handleToggleNotif} disabled={savingNotif} />
						</div>
					</Card>

					{/* Appearance */}
					<Card>
						<SectionHeader icon={theme === 'dark' ? Moon : Sun} title="Appearance" sub="Switch between dark and light mode." />
						<div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
							<div>
								<p className="text-sm font-medium">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
								<p className="text-xs text-white/40 mt-0.5">
									{theme === 'dark' ? 'Easier on the eyes at night.' : 'Better visibility in bright environments.'}
								</p>
							</div>
							<Toggle checked={theme === 'light'} onChange={toggleTheme} />
						</div>
					</Card>

					{/* Security */}
					<Card>
						<SectionHeader icon={Lock} title="Security" sub="Reset your password by email." />
						<button
							onClick={handlePasswordReset}
							disabled={resetSending}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-black/40 text-sm font-medium hover:bg-black/60 disabled:opacity-50 transition-colors"
						>
							{resetSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
							Send password reset email
						</button>
					</Card>

					{/* Quick links */}
					<Card>
						<SectionHeader icon={Sparkles} title="Quick links" />
						<div className="grid sm:grid-cols-2 gap-3">
							<Link
								to="/app/wallet"
								className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 transition-colors"
							>
								<span className="p-2 rounded-lg bg-white/5">
									<CreditCard className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
								</span>
								<div>
									<p className="text-sm font-medium">Credits and billing</p>
									<p className="text-xs text-white/40">Buy credits, view receipts</p>
								</div>
							</Link>
							<Link
								to="/app/analytics"
								className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 transition-colors"
							>
								<span className="p-2 rounded-lg bg-white/5">
									<Sparkles className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
								</span>
								<div>
									<p className="text-sm font-medium">Usage analytics</p>
									<p className="text-xs text-white/40">Activity and spend over time</p>
								</div>
							</Link>
						</div>
					</Card>

					{/* Danger zone */}
					<Card className="border-red-500/20">
						<SectionHeader icon={LogOut} title="Sign out" />
						<p className="text-sm text-white/50 mb-4">
							Sign out of this device. You can sign back in any time.
						</p>
						<button
							onClick={logout}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors"
						>
							<LogOut className="w-3.5 h-3.5" />
							Sign out
						</button>
					</Card>
				</div>
			</div>
		</>
	);
};

export default SettingsPage;
