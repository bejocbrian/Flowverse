import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
	ArrowUpRight,
	BarChart3,
	Coins,
	Loader2,
	Play,
	Plus,
	Sparkles,
	Wallet,
	XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

/* -------------------------------------------------------------------------- */

const STATUS_BADGE = {
	completed: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-300' },
	queued: { label: 'Queued', className: 'bg-blue-500/15 text-blue-300' },
	processing: { label: 'Processing', className: 'bg-blue-500/15 text-blue-300' },
	generating: { label: 'Generating', className: 'bg-blue-500/15 text-blue-300' },
	failed: { label: 'Failed', className: 'bg-red-500/15 text-red-300' },
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

const StatPill = ({ icon: Icon, label, value, hint, accent }) => (
	<div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex items-center gap-3">
		<span className={`p-2 rounded-lg ${accent || 'bg-white/5 text-[hsl(var(--accent-primary))]'}`}>
			<Icon className="w-4 h-4" />
		</span>
		<div className="min-w-0">
			<p className="text-xl font-semibold tracking-tight leading-none">{value}</p>
			<p className="text-[11px] text-white/40 mt-1">{label}</p>
			{hint && <p className="text-[10px] text-white/30 font-mono mt-0.5 truncate">{hint}</p>}
		</div>
	</div>
);

const Tile = ({ video }) => {
	const isImage = video.output_type === 'image';
	const completed = video.status === 'completed' && !!video.video_url;
	const failed = video.status === 'failed';

	return (
		<Link
			to={`/app/library/${video.id}`}
			className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden group hover:border-white/20 transition-colors"
		>
			<div className="aspect-video bg-black relative overflow-hidden flex items-center justify-center">
				{completed ? (
					isImage ? (
						<img
							src={video.video_url}
							alt={video.prompt}
							loading="lazy"
							className="absolute inset-0 w-full h-full object-cover"
						/>
					) : video.thumbnail_url ? (
						<img
							src={video.thumbnail_url}
							alt={video.prompt}
							loading="lazy"
							className="absolute inset-0 w-full h-full object-cover"
						/>
					) : (
						<video
							src={video.video_url}
							muted
							playsInline
							preload="metadata"
							className="absolute inset-0 w-full h-full object-cover"
						/>
					)
				) : failed ? (
					<XCircle className="w-7 h-7 text-red-300" />
				) : (
					<Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--accent-primary))]" />
				)}

				{completed && !isImage && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
						<Play className="w-9 h-9 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
					</div>
				)}
			</div>
			<div className="p-3">
				<p className="text-xs font-medium leading-snug line-clamp-2 mb-1">{video.prompt}</p>
				<p className="text-[10px] text-white/40 font-mono">{timeAgo(video.created)}</p>
			</div>
		</Link>
	);
};

/* -------------------------------------------------------------------------- */

const DashboardPage = () => {
	const { currentUser } = useAuth();
	const [overview, setOverview] = useState(null);
	const [recent, setRecent] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const [oRes, rRes] = await Promise.all([
					apiServerClient.fetch('/users/me/analytics/overview'),
					apiServerClient.fetch('/users/me/analytics/recent'),
				]);
				const o = oRes.ok ? await oRes.json() : null;
				const r = rRes.ok ? await rRes.json() : null;
				if (cancelled) return;
				setOverview(o);
				setRecent(r);
			} catch (err) {
				if (!cancelled) toast.error(err.message || 'Failed to load dashboard');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const greeting = useMemo(() => {
		const h = new Date().getHours();
		if (h < 5) return 'Working late';
		if (h < 12) return 'Good morning';
		if (h < 17) return 'Good afternoon';
		if (h < 21) return 'Good evening';
		return 'Working late';
	}, []);

	const balance = currentUser?.credits_balance ?? 0;
	const isEmpty = !loading && (overview?.generations?.total ?? 0) === 0;

	return (
		<>
			<Helmet>
				<title>Dashboard - Aether Video</title>
			</Helmet>

			<div className="flex-1 overflow-y-auto bg-black text-white">
				<div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
					{/* Hero */}
					<motion.section
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(var(--accent-primary))]/15 via-white/[0.03] to-[hsl(var(--accent-secondary))]/10 p-8 sm:p-10"
					>
						<div
							aria-hidden
							className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-50"
							style={{
								background:
									'radial-gradient(circle, rgba(77,142,255,0.35) 0%, transparent 60%)',
								filter: 'blur(40px)',
							}}
						/>
						<div className="relative max-w-2xl">
							<p className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--accent-primary))] mb-1">
								{greeting}
							</p>
							<h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
								{currentUser?.name?.split(' ')[0] || 'there'}, ready to ship a shot?
							</h1>
							<p className="text-sm sm:text-base text-white/60 mb-6">
								Type a prompt, pick a model, get a video. Your work picks up where you left off.
							</p>
							<div className="flex flex-wrap items-center gap-2">
								<Link
									to="/app/generate"
									className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:scale-[1.02] active:scale-100 transition-transform"
								>
									<Sparkles className="w-3.5 h-3.5" />
									Open workspace
								</Link>
								<Link
									to="/app/library"
									className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/15 bg-white/[0.03] text-sm font-medium hover:bg-white/[0.07] transition-colors"
								>
									<Play className="w-3.5 h-3.5" />
									Browse library
								</Link>
							</div>
						</div>
					</motion.section>

					{/* Stats row */}
					<section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
						<StatPill
							icon={Coins}
							label="Credits balance"
							value={balance}
							accent="bg-[hsl(var(--accent-primary))]/15 text-[hsl(var(--accent-primary))]"
						/>
						<StatPill
							icon={Sparkles}
							label="Generations"
							value={overview?.generations?.total ?? 0}
							hint={`${overview?.generations?.completed ?? 0} completed`}
						/>
						<StatPill
							icon={BarChart3}
							label="Success rate"
							value={`${overview?.successRate ?? 0}%`}
							accent="bg-emerald-500/10 text-emerald-300"
						/>
						<StatPill
							icon={Wallet}
							label="Spent this month"
							value={overview?.credits?.monthSpent ?? 0}
							hint="credits"
							accent="bg-amber-500/10 text-amber-300"
						/>
					</section>

					{/* Recent + quick actions */}
					<section className="grid lg:grid-cols-3 gap-4">
						<div className="lg:col-span-2">
							<div className="flex items-end justify-between mb-3">
								<div>
									<h2 className="text-base font-semibold">Recent generations</h2>
									<p className="text-xs text-white/40">Your last few projects.</p>
								</div>
								<Link
									to="/app/library"
									className="text-[11px] font-mono text-white/40 hover:text-white inline-flex items-center gap-1"
								>
									Library <ArrowUpRight className="w-3 h-3" />
								</Link>
							</div>

							{loading ? (
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
									{Array.from({ length: 3 }).map((_, i) => (
										<div
											key={i}
											className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden"
										>
											<div className="aspect-video bg-white/5 animate-pulse" />
											<div className="p-3 space-y-2">
												<div className="h-2 bg-white/10 rounded animate-pulse" />
												<div className="h-2 bg-white/5 rounded w-2/3 animate-pulse" />
											</div>
										</div>
									))}
								</div>
							) : isEmpty || (recent?.videos?.length ?? 0) === 0 ? (
								<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
									<Sparkles className="w-7 h-7 mx-auto text-[hsl(var(--accent-primary))] mb-3" />
									<h3 className="text-base font-semibold mb-1">Nothing here yet</h3>
									<p className="text-xs text-white/50 mb-4">
										Create your first shot and it will show up here.
									</p>
									<Link
										to="/app/generate"
										className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-105 transition-transform"
									>
										<Plus className="w-3.5 h-3.5" />
										New generation
									</Link>
								</div>
							) : (
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
									{recent.videos.map((v) => (
										<Tile key={v.id} video={v} />
									))}
								</div>
							)}
						</div>

						<div className="space-y-3">
							<div>
								<h2 className="text-base font-semibold mb-3">Activity</h2>
							</div>

							{loading ? (
								<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
									<Loader2 className="w-4 h-4 animate-spin text-white/40" />
								</div>
							) : (recent?.transactions?.length ?? 0) === 0 ? (
								<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
									<p className="text-xs text-white/40">No activity yet.</p>
								</div>
							) : (
								<div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
									{recent.transactions.slice(0, 5).map((t) => {
										const isCharge = t.type === 'generation';
										const sign = isCharge ? '−' : '+';
										const cls = isCharge ? 'text-amber-300' : 'text-emerald-300';
										return (
											<div key={t.id} className="px-4 py-3 flex items-center gap-3">
												<div className="flex-1 min-w-0">
													<p className="text-xs font-medium truncate">
														{t.description || t.type}
													</p>
													<p className="text-[10px] text-white/40 font-mono">
														{timeAgo(t.created)}
													</p>
												</div>
												<span className={`text-xs font-mono font-medium ${cls}`}>
													{sign}
													{Math.abs(t.amount || 0)}
												</span>
											</div>
										);
									})}
								</div>
							)}

							<Link
								to="/app/wallet"
								className="block bg-white/[0.03] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors"
							>
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium">Wallet</p>
										<p className="text-xs text-white/40">Buy credits, view receipts.</p>
									</div>
									<ArrowUpRight className="w-4 h-4 text-white/40" />
								</div>
							</Link>
						</div>
					</section>
				</div>
			</div>
		</>
	);
};

export default DashboardPage;
