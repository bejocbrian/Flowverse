import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
	BarChart3,
	Coins,
	Loader2,
	Sparkles,
	TrendingUp,
	XCircle,
	Clock,
	CheckCircle2,
	ArrowUpRight,
} from 'lucide-react';
import {
	ResponsiveContainer,
	AreaChart,
	Area,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
} from 'recharts';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatNumber(n) {
	if (n === null || n === undefined) return '–';
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

function timeAgo(iso) {
	if (!iso) return '';
	const ms = Date.now() - new Date(iso).getTime();
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d}d ago`;
	return new Date(iso).toLocaleDateString();
}

const STATUS_BADGE = {
	completed: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-300' },
	queued: { label: 'Queued', className: 'bg-blue-500/15 text-blue-300' },
	processing: { label: 'Processing', className: 'bg-blue-500/15 text-blue-300' },
	generating: { label: 'Generating', className: 'bg-blue-500/15 text-blue-300' },
	failed: { label: 'Failed', className: 'bg-red-500/15 text-red-300' },
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

const StatCard = ({ icon: Icon, label, value, hint, accent = 'primary' }) => {
	const accentClass =
		accent === 'success'
			? 'text-emerald-300 bg-emerald-500/10'
			: accent === 'warn'
			? 'text-amber-300 bg-amber-500/10'
			: 'text-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/15';

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-3"
		>
			<div className="flex items-center justify-between">
				<span className={`p-2 rounded-lg ${accentClass}`}>
					<Icon className="w-4 h-4" />
				</span>
				{hint && <span className="text-[11px] font-mono text-white/40">{hint}</span>}
			</div>
			<div>
				<p className="text-3xl font-semibold tracking-tight">{value}</p>
				<p className="text-xs text-white/50 mt-1">{label}</p>
			</div>
		</motion.div>
	);
};

const ChartCard = ({ title, subtitle, children, action }) => (
	<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
		<div className="flex items-start justify-between mb-4">
			<div>
				<h3 className="text-sm font-semibold">{title}</h3>
				{subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
			</div>
			{action}
		</div>
		{children}
	</div>
);

const TooltipCard = ({ active, payload, label }) => {
	if (!active || !payload?.length) return null;
	return (
		<div className="bg-[#0e0e10] border border-white/10 rounded-lg px-3 py-2 text-xs">
			<p className="text-white/50 font-mono mb-1">{label}</p>
			{payload.map((p) => (
				<p key={p.dataKey} className="text-white">
					<span className="opacity-60 mr-2">{p.name}</span>
					<span className="font-mono">{p.value}</span>
				</p>
			))}
		</div>
	);
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const AnalyticsPage = () => {
	const [overview, setOverview] = useState(null);
	const [timeline, setTimeline] = useState(null);
	const [breakdown, setBreakdown] = useState(null);
	const [recent, setRecent] = useState(null);
	const [loading, setLoading] = useState(true);
	const [windowDays, setWindowDays] = useState(30);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const [oRes, tRes, bRes, rRes] = await Promise.all([
					apiServerClient.fetch('/users/me/analytics/overview'),
					apiServerClient.fetch(`/users/me/analytics/timeline?days=${windowDays}`),
					apiServerClient.fetch('/users/me/analytics/breakdown'),
					apiServerClient.fetch('/users/me/analytics/recent'),
				]);

				if (!oRes.ok || !tRes.ok || !bRes.ok || !rRes.ok) {
					throw new Error('Failed to load analytics');
				}

				const [o, t, b, r] = await Promise.all([
					oRes.json(),
					tRes.json(),
					bRes.json(),
					rRes.json(),
				]);

				if (cancelled) return;
				setOverview(o);
				setTimeline(t);
				setBreakdown(b);
				setRecent(r);
			} catch (err) {
				if (!cancelled) toast.error(err.message || 'Failed to load analytics');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [windowDays]);

	const timelineData = useMemo(
		() =>
			(timeline?.points ?? []).map((p) => ({
				...p,
				label: new Date(p.date).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
				}),
			})),
		[timeline]
	);

	const isEmpty = !loading && (overview?.generations?.total ?? 0) === 0;

	return (
		<>
			<Helmet>
				<title>Analytics - Aether Video</title>
			</Helmet>

			<div className="flex-1 overflow-y-auto bg-black text-white">
				<div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
					{/* Header */}
					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
						<div>
							<p className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--accent-primary))] mb-1">
								Analytics
							</p>
							<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
								Your activity
							</h1>
							<p className="text-sm text-white/50 mt-1">
								What you have generated, what it cost, and how it has gone.
							</p>
						</div>

						<div className="flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/[0.03] self-start sm:self-end">
							{[7, 30, 90].map((d) => (
								<button
									key={d}
									onClick={() => setWindowDays(d)}
									className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
										windowDays === d
											? 'bg-white text-black'
											: 'text-white/60 hover:text-white'
									}`}
								>
									{d}d
								</button>
							))}
						</div>
					</div>

					{loading && (
						<div className="flex items-center justify-center py-24">
							<Loader2 className="w-6 h-6 animate-spin text-white/40" />
						</div>
					)}

					{!loading && isEmpty && (
						<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 text-center">
							<Sparkles className="w-8 h-8 mx-auto text-[hsl(var(--accent-primary))] mb-3" />
							<h2 className="text-lg font-semibold mb-1">Nothing to chart yet</h2>
							<p className="text-sm text-white/50 mb-5">
								Once you create your first video, it will show up here.
							</p>
							<Link
								to="/app/generate"
								className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-105 transition-transform"
							>
								<Sparkles className="w-3.5 h-3.5" />
								Create your first video
							</Link>
						</div>
					)}

					{!loading && !isEmpty && overview && (
						<>
							{/* KPI grid */}
							<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
								<StatCard
									icon={Sparkles}
									label="Total generations"
									value={formatNumber(overview.generations.total)}
									hint={`${overview.generations.completed} completed`}
								/>
								<StatCard
									icon={CheckCircle2}
									label="Success rate"
									value={`${overview.successRate}%`}
									hint={`${overview.generations.failed} failed`}
									accent="success"
								/>
								<StatCard
									icon={Coins}
									label="Credits spent (lifetime)"
									value={formatNumber(overview.credits.lifetimeSpent)}
									hint={`${overview.credits.monthSpent} this month`}
								/>
								<StatCard
									icon={TrendingUp}
									label="Current balance"
									value={formatNumber(overview.balance)}
									hint="credits"
									accent="warn"
								/>
							</div>

							{/* Charts */}
							<div className="grid lg:grid-cols-3 gap-4 mb-6">
								<div className="lg:col-span-2">
									<ChartCard
										title="Generations over time"
										subtitle={`Last ${windowDays} days`}
									>
										<div className="h-64">
											<ResponsiveContainer width="100%" height="100%">
												<AreaChart
													data={timelineData}
													margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
												>
													<defs>
														<linearGradient id="gradGens" x1="0" y1="0" x2="0" y2="1">
															<stop offset="0%" stopColor="hsl(220, 100%, 84%)" stopOpacity={0.4} />
															<stop offset="100%" stopColor="hsl(220, 100%, 84%)" stopOpacity={0} />
														</linearGradient>
													</defs>
													<CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
													<XAxis
														dataKey="label"
														tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
														tickLine={false}
														axisLine={false}
														minTickGap={20}
													/>
													<YAxis
														allowDecimals={false}
														tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
														tickLine={false}
														axisLine={false}
													/>
													<Tooltip content={<TooltipCard />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
													<Area
														type="monotone"
														name="Generations"
														dataKey="generations"
														stroke="hsl(220, 100%, 84%)"
														strokeWidth={2}
														fill="url(#gradGens)"
													/>
												</AreaChart>
											</ResponsiveContainer>
										</div>
									</ChartCard>
								</div>

								<ChartCard
									title="Credits spent"
									subtitle={`Last ${windowDays} days`}
								>
									<div className="h-64">
										<ResponsiveContainer width="100%" height="100%">
											<BarChart
												data={timelineData}
												margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
											>
												<CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
												<XAxis
													dataKey="label"
													tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
													tickLine={false}
													axisLine={false}
													minTickGap={28}
												/>
												<YAxis
													allowDecimals={false}
													tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
													tickLine={false}
													axisLine={false}
												/>
												<Tooltip content={<TooltipCard />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
												<Bar dataKey="credits" name="Credits" fill="hsl(155, 73%, 59%)" radius={[3, 3, 0, 0]} />
											</BarChart>
										</ResponsiveContainer>
									</div>
								</ChartCard>
							</div>

							{/* Breakdown + recent */}
							<div className="grid lg:grid-cols-3 gap-4">
								<ChartCard
									title="By model"
									subtitle="Lifetime usage"
								>
									{(breakdown?.byProvider?.length ?? 0) === 0 ? (
										<p className="text-sm text-white/40 py-6">No data yet.</p>
									) : (
										<ul className="space-y-3">
											{breakdown.byProvider.map((row) => {
												const max = breakdown.byProvider[0].count || 1;
												const pct = (row.count / max) * 100;
												return (
													<li key={row.name}>
														<div className="flex items-center justify-between text-xs mb-1">
															<span className="font-medium">{row.name}</span>
															<span className="text-white/40 font-mono">{row.count}</span>
														</div>
														<div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
															<div
																className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]"
																style={{ width: `${pct}%` }}
															/>
														</div>
													</li>
												);
											})}
										</ul>
									)}
								</ChartCard>

								<div className="lg:col-span-2">
									<ChartCard
										title="Recent activity"
										subtitle="Your last 5 generations"
										action={
											<Link
												to="/app/library"
												className="text-[11px] font-mono text-white/40 hover:text-white inline-flex items-center gap-1"
											>
												Library <ArrowUpRight className="w-3 h-3" />
											</Link>
										}
									>
										{(recent?.videos?.length ?? 0) === 0 ? (
											<p className="text-sm text-white/40 py-6">No generations yet.</p>
										) : (
											<ul className="divide-y divide-white/5">
												{recent.videos.map((v) => {
													const badge = STATUS_BADGE[v.status] || {
														label: v.status,
														className: 'bg-white/10 text-white/70',
													};
													return (
														<li key={v.id} className="py-3 flex items-center gap-3">
															<div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
																{v.video_url ? (
																	<img
																		src={v.video_url}
																		alt=""
																		className="w-full h-full rounded-lg object-cover"
																		onError={(e) => {
																			e.currentTarget.style.display = 'none';
																		}}
																	/>
																) : (
																	<Sparkles className="w-4 h-4 text-white/30" />
																)}
															</div>
															<div className="min-w-0 flex-1">
																<Link
																	to={`/app/library/${v.id}`}
																	className="text-sm truncate block hover:underline"
																>
																	{v.prompt}
																</Link>
																<div className="flex items-center gap-2 text-[11px] text-white/40 font-mono mt-0.5">
																	<span>{v.provider}</span>
																	<span>·</span>
																	<span>{v.credit_cost ?? 0} cr</span>
																	<span>·</span>
																	<span>{timeAgo(v.created)}</span>
																</div>
															</div>
															<span
																className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}
															>
																{badge.label}
															</span>
														</li>
													);
												})}
											</ul>
										)}
									</ChartCard>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</>
	);
};

export default AnalyticsPage;
