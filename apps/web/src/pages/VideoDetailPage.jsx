import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
	ArrowLeft,
	Copy,
	Download,
	Heart,
	Loader2,
	Play,
	Repeat,
	Share2,
	Sparkles,
	Trash2,
	Wand2,
	XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import VideoPlayer from '@/components/VideoPlayer.jsx';
import RegenerateModal from '@/components/RegenerateModal.jsx';
import apiServerClient from '@/lib/apiServerClient.js';

const STATUS_BADGE = {
	completed: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-300' },
	queued: { label: 'Queued', className: 'bg-blue-500/15 text-blue-300' },
	processing: { label: 'Processing', className: 'bg-blue-500/15 text-blue-300' },
	generating: { label: 'Generating', className: 'bg-blue-500/15 text-blue-300' },
	failed: { label: 'Failed', className: 'bg-red-500/15 text-red-300' },
};

/* -------------------------------------------------------------------------- */

const Toggle = ({ checked, onChange, disabled }) => (
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		disabled={disabled}
		onClick={() => onChange(!checked)}
		className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
			checked ? 'bg-[hsl(var(--accent-primary-container))]' : 'bg-white/10'
		}`}
	>
		<span
			className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
				checked ? 'translate-x-5' : 'translate-x-0.5'
			}`}
		/>
	</button>
);

/* -------------------------------------------------------------------------- */

const VideoDetailPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const [video, setVideo] = useState(null);
	const [relatedVideos, setRelatedVideos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState({}); // { delete, share, favorite }
	const [regenOpen, setRegenOpen] = useState(false);
	const [extendOpen, setExtendOpen] = useState(false);
	const [extendPrompt, setExtendPrompt] = useState('');
	const [extendLoading, setExtendLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const res = await apiServerClient.fetch(`/videos/${id}`);
				if (!res.ok) throw new Error('Failed to fetch video');
				const data = await res.json();
				if (cancelled) return;
				setVideo(data.video);
				setRelatedVideos(data.relatedVideos || []);
			} catch (err) {
				if (!cancelled) toast.error(err.message || 'Failed to load video');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id]);

	const isImage = video?.output_type === 'image';
	const completed = video?.status === 'completed' && !!video?.video_url;

	const setBusyKey = (key, val) => setBusy((prev) => ({ ...prev, [key]: val }));

	const handleCopy = async (text, label) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copied`);
		} catch {
			toast.error(`Could not copy ${label.toLowerCase()}`);
		}
	};

	const handleDownload = () => {
		if (!video?.video_url) return;
		window.open(video.video_url, '_blank', 'noopener');
	};

	const handleDelete = async () => {
		if (!window.confirm('Delete this video? This cannot be undone.')) return;
		setBusyKey('delete', true);
		try {
			const res = await apiServerClient.fetch(`/videos/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete');
			toast.success('Deleted');
			navigate('/app/library');
		} catch (err) {
			toast.error(err.message);
			setBusyKey('delete', false);
		}
	};

	const handleExtend = async () => {
		if (!extendPrompt.trim() || extendPrompt.trim().length < 3) {
			toast.error('Describe what should happen next (a few words).');
			return;
		}
		setExtendLoading(true);
		try {
			const idempotencyKey =
				typeof crypto !== 'undefined' && crypto.randomUUID
					? crypto.randomUUID()
					: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

			const res = await apiServerClient.fetch(`/videos/${id}/extend`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: extendPrompt.trim(),
					idempotency_key: idempotencyKey,
				}),
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || `Extend failed (HTTP ${res.status})`);
			}

			const data = await res.json();
			const newId = data.video?.id;
			toast.success('Extension started — merging clips in the background');
			setExtendOpen(false);
			setExtendPrompt('');
			// Navigate to the new merged video once it exists
			if (newId) navigate(`/app/library/${newId}`);
		} catch (err) {
			toast.error(typeof err?.message === 'string' ? err.message : 'Extend failed');
		} finally {
			setExtendLoading(false);
		}
	};

	const togglePublic = async (next) => {
		setBusyKey('share', true);
		try {
			if (next) {
				const res = await apiServerClient.fetch(`/videos/${id}/share`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({}),
				});
				if (!res.ok) throw new Error('Failed to enable sharing');
				const data = await res.json();
				setVideo((p) => ({ ...p, is_public: true, share_token: data.shareToken || data.share_token || p?.share_token }));
				toast.success('Public link is on');
			} else {
				const res = await apiServerClient.fetch(`/videos/${id}/unshare`, { method: 'POST' });
				if (!res.ok) throw new Error('Failed to disable sharing');
				setVideo((p) => ({ ...p, is_public: false }));
				toast.success('Public link is off');
			}
		} catch (err) {
			toast.error(err.message);
		} finally {
			setBusyKey('share', false);
		}
	};

	const toggleFavorite = async () => {
		setBusyKey('favorite', true);
		try {
			if (video.is_favorite) {
				const res = await apiServerClient.fetch(`/videos/${id}/favorite`, { method: 'DELETE' });
				if (!res.ok) throw new Error('Failed to update favorite');
				setVideo((p) => ({ ...p, is_favorite: false }));
				toast.success('Removed from favorites');
			} else {
				const res = await apiServerClient.fetch(`/videos/${id}/favorite`, { method: 'POST' });
				if (!res.ok) throw new Error('Failed to update favorite');
				setVideo((p) => ({ ...p, is_favorite: true }));
				toast.success('Added to favorites');
			}
		} catch (err) {
			toast.error(err.message);
		} finally {
			setBusyKey('favorite', false);
		}
	};

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-black">
				<Loader2 className="w-8 h-8 animate-spin text-white/40" />
			</div>
		);
	}

	if (!video) {
		return (
			<div className="flex-1 flex items-center justify-center bg-black px-4">
				<div className="text-center max-w-md">
					<XCircle className="w-10 h-10 mx-auto text-red-400 mb-3" />
					<h2 className="text-xl font-semibold mb-2">Video not found</h2>
					<p className="text-sm text-white/50 mb-5">
						It may have been deleted, or you do not have access.
					</p>
					<Link
						to="/app/library"
						className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-105 transition-transform"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
						Back to library
					</Link>
				</div>
			</div>
		);
	}

	const badge = STATUS_BADGE[video.status] || { label: video.status, className: 'bg-white/10 text-white/70' };
	const shareUrl = video.share_token
		? `${window.location.origin}/videos/public/${video.share_token}`
		: '';

	return (
		<>
			<Helmet>
				<title>{`${video.prompt.slice(0, 60)} - Aether Video`}</title>
				<meta name="description" content={video.prompt} />
			</Helmet>

			<div className="flex-1 overflow-y-auto bg-black text-white">
				<div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
					<button
						onClick={() => navigate('/app/library')}
						className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-6"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
						Back to library
					</button>

					<div className="grid lg:grid-cols-3 gap-6">
						{/* Player */}
						<div className="lg:col-span-2 space-y-5">
							<motion.div
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								className="rounded-2xl overflow-hidden border border-white/10 bg-black"
							>
								{completed ? (
									isImage ? (
										<img src={video.video_url} alt={video.prompt} className="w-full" />
									) : (
										<VideoPlayer src={video.video_url} className="w-full aspect-video" />
									)
								) : video.status === 'failed' ? (
									<div className="aspect-video flex flex-col items-center justify-center gap-2 text-red-300">
										<XCircle className="w-10 h-10" />
										<p className="text-sm">{video.error_message || 'Generation failed'}</p>
									</div>
								) : (
									<div className="aspect-video flex flex-col items-center justify-center gap-2 text-white/60">
										<Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--accent-primary))]" />
										<p className="text-xs uppercase tracking-wider font-mono">{video.status}…</p>
									</div>
								)}
							</motion.div>

							{/* Action row */}
							<div className="flex flex-wrap items-center gap-2">
								<button
									onClick={handleDownload}
									disabled={!completed}
									className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-[1.02] active:scale-100 disabled:opacity-30 disabled:scale-100 transition-transform"
								>
									<Download className="w-3.5 h-3.5" />
									Download
								</button>

								{/* Extend button — only for completed, non-image videos */}
								{completed && !isImage && (
									<button
										onClick={() => setExtendOpen((v) => !v)}
										className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors ${
											extendOpen
												? 'border-[hsl(var(--accent-primary))]/40 bg-[hsl(var(--accent-primary))]/10 text-[hsl(var(--accent-primary))]'
												: 'border-white/15 bg-white/[0.03] hover:bg-white/[0.07]'
										}`}
									>
										<Wand2 className="w-3.5 h-3.5" />
										Extend
									</button>
								)}

								<button
									onClick={() => setRegenOpen(true)}
									disabled={!completed}
									className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/15 bg-white/[0.03] text-sm font-medium hover:bg-white/[0.07] disabled:opacity-30 transition-colors"
								>
									<Repeat className="w-3.5 h-3.5" />
									Regenerate
								</button>

								<button
									onClick={toggleFavorite}
									disabled={busy.favorite}
									className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors ${
										video.is_favorite
											? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
											: 'border-white/15 bg-white/[0.03] hover:bg-white/[0.07]'
									}`}
								>
									<Heart className={`w-3.5 h-3.5 ${video.is_favorite ? 'fill-current' : ''}`} />
									{video.is_favorite ? 'Favorited' : 'Favorite'}
								</button>

								<button
									onClick={handleDelete}
									disabled={busy.delete}
									className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/20 transition-colors"
								>
									{busy.delete ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
									Delete
								</button>
							</div>

							{/* Extend composer */}
							<AnimatePresence>
								{extendOpen && (
									<motion.div
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: 'auto' }}
										exit={{ opacity: 0, height: 0 }}
										className="overflow-hidden"
									>
										<div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
											<div>
												<p className="text-sm font-medium mb-1 flex items-center gap-1.5">
													<Wand2 className="w-3.5 h-3.5 text-[hsl(var(--accent-primary))]" />
													Extend this video
												</p>
												<p className="text-xs text-white/40">
													Describe what happens next. A new clip will be generated and merged into a single continuous video.
													{video.total_duration ? ` Current length: ${video.total_duration}s.` : ''}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<input
													type="text"
													value={extendPrompt}
													onChange={(e) => setExtendPrompt(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === 'Enter' && !e.shiftKey) {
															e.preventDefault();
															handleExtend();
														}
													}}
													placeholder="e.g. the camera pulls back to reveal a mountain range"
													className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
												/>
												<button
													onClick={handleExtend}
													disabled={extendLoading || extendPrompt.trim().length < 3}
													className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-1.5"
												>
													{extendLoading
														? <Loader2 className="w-4 h-4 animate-spin" />
														: <Wand2 className="w-4 h-4" />}
													Extend
												</button>
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Related */}
							{relatedVideos.length > 0 && (
								<div className="pt-6 border-t border-white/5">
									<h2 className="text-sm font-semibold mb-3">Variations and related</h2>
									<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
										{relatedVideos.map((r) => (
											<Link
												key={r.id}
												to={`/app/library/${r.id}`}
												className="group rounded-xl overflow-hidden bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors"
											>
												<div className="aspect-video bg-black flex items-center justify-center relative overflow-hidden">
													{r.video_url && r.output_type === 'image' ? (
														<img
															src={r.video_url}
															alt=""
															className="absolute inset-0 w-full h-full object-cover"
														/>
													) : r.thumbnail_url ? (
														<img
															src={r.thumbnail_url}
															alt=""
															className="absolute inset-0 w-full h-full object-cover"
														/>
													) : r.video_url ? (
														<video
															src={r.video_url}
															muted
															playsInline
															preload="metadata"
															className="absolute inset-0 w-full h-full object-cover"
														/>
													) : (
														<Sparkles className="w-6 h-6 text-white/20" />
													)}
													<div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
														<Play className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
													</div>
												</div>
											</Link>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Sidebar */}
						<div className="space-y-4">
							{/* Status + meta */}
							<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
								<div className="flex items-center justify-between">
									<span className="text-xs uppercase tracking-wider text-white/40 font-mono">
										Status
									</span>
									<span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
										{badge.label}
									</span>
								</div>

								<div>
									<p className="text-xs uppercase tracking-wider text-white/40 font-mono mb-1.5">
										Prompt
									</p>
									<div className="relative group">
										<p className="text-sm leading-relaxed pr-7">{video.prompt}</p>
										<button
											onClick={() => handleCopy(video.prompt, 'Prompt')}
											className="absolute top-0 right-0 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
											aria-label="Copy prompt"
										>
											<Copy className="w-3.5 h-3.5" />
										</button>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
									<MetaRow label="Aspect" value={video.aspect_ratio} />
									{!isImage && <MetaRow label="Duration" value={video.total_duration ? `${video.total_duration}s (merged)` : `${video.duration || 0}s`} />}
									<MetaRow label="Quality" value={video.quality} />
									<MetaRow label="Model" value={video.model} />
									<MetaRow label="Cost" value={`${video.credit_cost ?? 0} cr`} />
									<MetaRow label="Created" value={new Date(video.created).toLocaleDateString()} />
								</div>
							</div>

							{/* Sharing */}
							<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium flex items-center gap-1.5">
											<Share2 className="w-3.5 h-3.5 text-[hsl(var(--accent-primary))]" />
											Public link
										</p>
										<p className="text-xs text-white/40 mt-0.5">Anyone with the link can view.</p>
									</div>
									<Toggle
										checked={Boolean(video.is_public)}
										onChange={togglePublic}
										disabled={busy.share || !completed}
									/>
								</div>

								{video.is_public && shareUrl && (
									<div className="flex items-center gap-1.5">
										<div className="flex-1 truncate font-mono text-[11px] bg-black/40 border border-white/5 rounded-md px-2 py-2">
											{shareUrl}
										</div>
										<button
											onClick={() => handleCopy(shareUrl, 'Link')}
											className="p-2 rounded-md border border-white/10 bg-black/40 hover:bg-black/60 transition-colors"
											aria-label="Copy link"
										>
											<Copy className="w-3.5 h-3.5" />
										</button>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<RegenerateModal
				videoId={id}
				isOpen={regenOpen}
				onClose={() => setRegenOpen(false)}
				defaultSettings={video}
				originalPrompt={video?.prompt}
			/>
		</>
	);
};

const MetaRow = ({ label, value }) => (
	<div className="flex items-center justify-between gap-2">
		<span className="text-white/40 font-mono uppercase tracking-wider">{label}</span>
		<span className="font-mono truncate text-right">{value || '—'}</span>
	</div>
);

export default VideoDetailPage;
