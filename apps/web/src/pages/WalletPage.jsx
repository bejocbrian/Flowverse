import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
	Coins,
	TrendingUp,
	TrendingDown,
	Loader2,
	CreditCard,
	History as HistoryIcon,
	Gift,
	RotateCcw,
	Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import StripeCheckoutButton from '@/components/StripeCheckoutButton.jsx';
import CashfreeCheckoutButton from '@/components/CashfreeCheckoutButton.jsx';
import usePublicSettings from '@/hooks/usePublicSettings.js';

const STRIPE_PACKAGES = [
	{ credits: 50, price: 4.99, popular: false, label: 'Starter' },
	{ credits: 100, price: 8.99, popular: true, label: 'Standard' },
	{ credits: 500, price: 39.99, popular: false, label: 'Studio' },
];

// Cashfree primarily settles in INR. Approximate INR pricing in line with
// the Stripe USD packs above; admins can later move these to settings.
const CASHFREE_PACKAGES = [
	{ credits: 50, price: 399, popular: false, label: 'Starter' },
	{ credits: 100, price: 749, popular: true, label: 'Standard' },
	{ credits: 500, price: 3299, popular: false, label: 'Studio' },
];

/* -------------------------------------------------------------------------- */
/*  Transaction utilities                                                     */
/* -------------------------------------------------------------------------- */

// `generation` charges credits (negative effect on balance).
// `purchase`, `bonus`, `refund` add credits.
const CREDIT_TYPES = new Set(['purchase', 'bonus', 'refund']);
const DEBIT_TYPES = new Set(['generation']);

function txDirection(type) {
	if (CREDIT_TYPES.has(type)) return 'credit';
	if (DEBIT_TYPES.has(type)) return 'debit';
	return 'unknown';
}

const TYPE_META = {
	generation: { label: 'Generation', icon: TrendingDown, accent: 'text-amber-300' },
	refund: { label: 'Refund', icon: RotateCcw, accent: 'text-blue-300' },
	bonus: { label: 'Bonus', icon: Gift, accent: 'text-emerald-300' },
	purchase: { label: 'Purchase', icon: CreditCard, accent: 'text-emerald-300' },
};

function timeAgo(iso) {
	if (!iso) return '';
	const ms = Date.now() - new Date(iso).getTime();
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 86400);
	if (d < 7) return `${d}d ago`;
	return new Date(iso).toLocaleDateString();
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const WalletPage = () => {
	const { currentUser } = useAuth();
	const [transactions, setTransactions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState('overview'); // 'overview' | 'buy'
	const { settings: publicSettings } = usePublicSettings();
	const paymentMethods = publicSettings.payment_methods;
	const [provider, setProvider] = useState('stripe'); // 'stripe' | 'cashfree'

	useEffect(() => {
		// Pick the first enabled provider as the default. If the admin only
		// enabled one, the picker collapses naturally below.
		if (!paymentMethods.stripe && paymentMethods.cashfree) setProvider('cashfree');
		else if (paymentMethods.stripe) setProvider('stripe');
	}, [paymentMethods]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const res = await apiServerClient.fetch('/wallet/balance');
				if (!res.ok) throw new Error('Failed to load wallet');
				const data = await res.json();
				if (cancelled) return;
				setTransactions(data.transactions || []);
			} catch (err) {
				if (!cancelled) toast.error(err.message || 'Could not load wallet');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const stats = useMemo(() => {
		let totalSpent = 0;
		let totalEarned = 0;
		for (const t of transactions) {
			const dir = txDirection(t.type);
			const amount = Math.abs(t.amount || 0);
			if (dir === 'credit') totalEarned += amount;
			else if (dir === 'debit') totalSpent += amount;
		}
		return { totalSpent, totalEarned };
	}, [transactions]);

	const balance = currentUser?.credits_balance ?? 0;

	return (
		<>
			<Helmet>
				<title>Wallet - Aether Video</title>
			</Helmet>

			<div className="flex-1 overflow-y-auto bg-black text-white">
				<div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
					{/* Header */}
					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
						<div>
							<p className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--accent-primary))] mb-1">
								Wallet
							</p>
							<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Credits and billing</h1>
							<p className="text-sm text-white/50 mt-1">
								Buy credits, review activity, and track spend.
							</p>
						</div>
					</div>

					{/* Balance + KPIs */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
						<motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							className="lg:col-span-1 relative overflow-hidden bg-gradient-to-br from-[hsl(var(--accent-primary))]/15 via-white/[0.03] to-[hsl(var(--accent-secondary))]/10 border border-white/10 rounded-2xl p-6"
						>
							<div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50 font-mono mb-2">
								<Coins className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
								Balance
							</div>
							<div className="flex items-baseline gap-2">
								<span className="text-5xl font-semibold tracking-tight">{balance}</span>
								<span className="text-sm text-white/40">credits</span>
							</div>
							<button
								onClick={() => setTab('buy')}
								className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--accent-primary))] hover:underline"
							>
								Buy more <CreditCard className="w-3.5 h-3.5" />
							</button>
						</motion.div>

						<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-2">
							<span className="p-2 rounded-lg w-fit bg-amber-500/10 text-amber-300">
								<TrendingDown className="w-4 h-4" />
							</span>
							<p className="text-3xl font-semibold tracking-tight">{stats.totalSpent}</p>
							<p className="text-xs text-white/50">Spent on generations</p>
						</div>

						<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-2">
							<span className="p-2 rounded-lg w-fit bg-emerald-500/10 text-emerald-300">
								<TrendingUp className="w-4 h-4" />
							</span>
							<p className="text-3xl font-semibold tracking-tight">{stats.totalEarned}</p>
							<p className="text-xs text-white/50">Bonuses, refunds, purchases</p>
						</div>
					</div>

					{/* Tab switcher */}
					<div className="flex gap-1 p-1 rounded-full border border-white/10 bg-white/[0.03] w-fit mb-6">
						<button
							onClick={() => setTab('overview')}
							className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
								tab === 'overview' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
							}`}
						>
							<HistoryIcon className="w-3.5 h-3.5 inline mr-1.5" />
							Activity
						</button>
						<button
							onClick={() => setTab('buy')}
							className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
								tab === 'buy' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
							}`}
						>
							<CreditCard className="w-3.5 h-3.5 inline mr-1.5" />
							Buy credits
						</button>
					</div>

					{tab === 'buy' ? (
						(() => {
							const stripeOn = paymentMethods.stripe;
							const cashfreeOn = paymentMethods.cashfree;

							if (!stripeOn && !cashfreeOn) {
								return (
									<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 text-center">
										<CreditCard className="w-8 h-8 mx-auto text-white/40 mb-3" />
										<h2 className="text-lg font-semibold mb-1">Payments are paused</h2>
										<p className="text-sm text-white/50">
											Buying credits is temporarily unavailable. Please try again later.
										</p>
									</div>
								);
							}

							const showSwitch = stripeOn && cashfreeOn;
							const usingCashfree = provider === 'cashfree' && cashfreeOn;
							const packages = usingCashfree ? CASHFREE_PACKAGES : STRIPE_PACKAGES;
							const currencySymbol = usingCashfree ? '₹' : '$';

							return (
								<>
									{showSwitch && (
										<div className="flex gap-1 p-1 rounded-full border border-white/10 bg-white/[0.03] w-fit mb-5">
											<button
												onClick={() => setProvider('stripe')}
												className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
													provider === 'stripe' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
												}`}
											>
												Card (USD)
											</button>
											<button
												onClick={() => setProvider('cashfree')}
												className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
													provider === 'cashfree' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
												}`}
											>
												UPI / Cards (INR)
											</button>
										</div>
									)}

									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{packages.map((pkg) => (
											<motion.div
												key={`${usingCashfree ? 'cf' : 'stripe'}-${pkg.credits}`}
												initial={{ opacity: 0, y: 12 }}
												whileInView={{ opacity: 1, y: 0 }}
												viewport={{ once: true }}
												className={`relative bg-white/[0.03] border rounded-2xl p-7 flex flex-col ${
													pkg.popular
														? 'border-[hsl(var(--accent-primary))]/50 shadow-glow-primary'
														: 'border-white/10'
												}`}
											>
												{pkg.popular && (
													<div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[hsl(var(--accent-primary-container))] text-white">
														Most popular
													</div>
												)}
												<h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
													{pkg.label}
												</h3>
												<div className="mt-3 mb-1 flex items-baseline gap-2">
													<span className="text-5xl font-bold tracking-tight">{pkg.credits}</span>
													<span className="text-sm text-white/40">credits</span>
												</div>
												<p className="text-2xl font-semibold mt-4">
													{currencySymbol}
													{pkg.price}
												</p>
												<p className="text-xs text-white/40 mt-0.5 mb-6">
													{currencySymbol}
													{(pkg.price / pkg.credits).toFixed(usingCashfree ? 2 : 3)} per credit
												</p>
												{usingCashfree ? (
													<CashfreeCheckoutButton
														creditAmount={pkg.credits}
														price={pkg.price}
														popular={pkg.popular}
														mode={paymentMethods.cashfree_mode}
														className="w-full mt-auto"
													/>
												) : (
													<StripeCheckoutButton
														creditAmount={pkg.credits}
														price={pkg.price}
														popular={pkg.popular}
														className="w-full mt-auto"
													/>
												)}
											</motion.div>
										))}
									</div>
								</>
							);
						})()
					) : loading ? (
						<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 flex items-center justify-center">
							<Loader2 className="w-6 h-6 animate-spin text-white/40" />
						</div>
					) : transactions.length === 0 ? (
						<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 text-center">
							<Sparkles className="w-8 h-8 mx-auto text-[hsl(var(--accent-primary))] mb-3" />
							<h2 className="text-lg font-semibold mb-1">No activity yet</h2>
							<p className="text-sm text-white/50 mb-5">
								Generate something or buy credits to see your activity here.
							</p>
							<Link
								to="/app/generate"
								className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-105 transition-transform"
							>
								<Sparkles className="w-3.5 h-3.5" />
								Start creating
							</Link>
						</div>
					) : (
						<div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
							<ul className="divide-y divide-white/5">
								{transactions.map((t) => {
									const meta = TYPE_META[t.type] || {
										label: t.type,
										icon: Coins,
										accent: 'text-white/60',
									};
									const Icon = meta.icon;
									const dir = txDirection(t.type);
									const amount = Math.abs(t.amount || 0);
									const sign = dir === 'credit' ? '+' : dir === 'debit' ? '−' : '';
									const amountColor =
										dir === 'credit' ? 'text-emerald-300' : dir === 'debit' ? 'text-amber-300' : 'text-white/60';
									return (
										<li key={t.id} className="px-5 py-3.5 flex items-center gap-3">
											<span className={`p-2 rounded-lg bg-white/5 ${meta.accent}`}>
												<Icon className="w-4 h-4" />
											</span>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">
													{t.description || meta.label}
												</p>
												<p className="text-[11px] text-white/40 font-mono">
													{meta.label} · {timeAgo(t.created)}
												</p>
											</div>
											<div className={`font-mono text-sm font-medium ${amountColor}`}>
												{sign}
												{amount}
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default WalletPage;
