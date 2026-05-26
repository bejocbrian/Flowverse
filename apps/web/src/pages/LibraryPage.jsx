import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
	Play,
	Search,
	Download,
	Share2,
	Trash2,
	Sparkles,
	Loader2,
	XCircle,
	Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient.js';
import pb from '@/lib/pocketbaseClient.js';

const FILTER_OPTIONS = [
	{ key: 'all', label: 'All' },
	{ key: 'completed', label: 'Completed' },
	{ key: 'generating', label: 'Generating' },
	{ key: 'queued', label: 'Queued' },
	{ key: 'failed', label: 'Failed' },
];

const SORT_OPTIONS = [
	{ key: 'newest', label: 'Newest' },
	{ key: 'oldest', label: 'Oldest' },
	{ key: 'duration', label: 'Duration' },
];

/* -------------------------------------------------------------------------- */
/*  Tile                                                                      */
/* -------------------------------------------------------------------------- */

const VideoTile = ({ video, onDelete }) => {
	const isImage = video.output_type === 'image';
	const status = video.status;
	const completed = status === 'completed' && !!video.video_url;
	const inProgress = status === 'queued' || status === 'generating' || status === 'processing';
	const failed = status === 'failed';

	const handleDownload = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!video.video_url) return;
		// Open in a new tab; browsers respect Content-Disposition where set,
		// otherwise the user can save manually.
		window.open(video.video_url, '_blank', 'noopener');
	};

	const handleShare = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!video.video_url) return;
		try {
			await navigator.clipboard.writeText(video.video_url);
			toast.success('Link copied');
		} catch {
			toast.error('Could not copy link');
		}
	};

	const handleDelete = (e) => {
		e.preventDefault();
		e.stopPropagation();
		onDelete(video.id);
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden group hover:border-white/20 transition-colors"
		>
			<Link to={`/app/library/${video.id}`} className="block relative">
				<div className="aspect-video bg-black flex items-center justify-center relative overflow-hidden">
					{completed ? (
						isImage ? (
							<img
								src={video.video_url}
								alt={video.prompt}
								loading="lazy"
								className="absolute inset-0 w-full h-full object-cover"
							/>
						) : video.thumbnail_url ? (
							// Image thumbnail provided by GeminiGen webhook
							<img
								src={video.thumbnail_url}
								alt={video.prompt}
								loading="lazy"
								className="absolute inset-0 w-full h-full object-cover"
							/>
						) : (
							// Fallback: render the video itself with metadata preloaded so the
							// browser paints frame zero as the poster.
							<video
								src={video.video_url}
								muted
								playsInline
								preload="metadata"
								className="absolute inset-0 w-full h-full object-cover"
							/>
						)
					) : inProgress ? (
						<div className="flex flex-col items-center gap-2 text-white/60">
							<Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--accent-primary))]" />
							<span className="text-[10px] font-mono uppercase tracking-wider">{status}…</span>
						</div>
					) : failed ? (
						<div className="flex flex-col items-center gap-2 text-red-300">
							<XCircle className="w-7 h-7" />
							<span className="text-[10px] font-mono uppercase tracking-wider">Failed</span>
						</div>
					) : (
						<Sparkles className="w-7 h-7 text-white/20" />
					)}

					{/* Hover play overlay (videos only) */}
					{completed && !isImage && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
							<Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
						</div>
					)}

					{/* Status badge */}
					<span
						className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
							completed
								? 'bg-emerald-500/15 text-emerald-300'
								: inProgress
								? 'bg-blue-500/15 text-blue-300'
								: failed
								? 'bg-red-500/15 text-red-300'
								: 'bg-white/10 text-white/60'
						}`}
					>
						{status}
					</span>

					{/* Type badge (image vs video) */}
					{completed && (
						<span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/60 backdrop-blur-md text-white/80">
							{isImage ? <ImageIcon className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
							{isImage ? 'Image' : `${video.duration || 0}s`}
						</span>
					)}
				</div>
			</Link>

			<div className="p-3">
				<p className="text-sm font-medium leading-snug line-clamp-2 mb-1">{video.prompt}</p>
				<div className="flex items-center gap-2 text-[11px] text-white/40 font-mono mb-3 truncate">
					<span>{new Date(video.created).toLocaleDateString()}</span>
					{video.model && (
						<>
							<span>·</span>
							<span className="truncate">{video.model}</span>
						</>
					)}
				</div>

				<div className="flex items-center gap-1">
					<button
						onClick={handleDownload}
						disabled={!completed}
						className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						aria-label="Download"
						title="Open in new tab"
					>
						<Download className="w-4 h-4" />
					</button>
					<button
						onClick={handleShare}
						disabled={!completed}
						className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						aria-label="Copy link"
						title="Copy link"
					>
						<Share2 className="w-4 h-4" />
					</button>
					<button
						onClick={handleDelete}
						className="p-1.5 rounded-md text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-colors ml-auto"
						aria-label="Delete"
						title="Delete"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>
		</motion.div>
	);
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const LibraryPage = () => {
	const [videos, setVideos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filterType, setFilterType] = useState('all');
	const [sortBy, setSortBy] = useState('newest');
	const [search, setSearch] = useState('');

	const fetchVideos = async () => {
		setLoading(true);
		try {
			const res = await apiServerClient.fetch('/videos?perPage=100');
			if (!res.ok) throw new Error('Failed to load videos');
			const data = await res.json();
			setVideos(data.items || []);
		} catch (err) {
			toast.error(err.message || 'Failed to load videos');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchVideos();
	}, []);

	const handleDelete = async (id) => {
		if (!window.confirm('Delete this video?')) return;
		try {
			// Use PB directly: the API delete endpoint isn't exposed here yet and
			// PB enforces user-scoped delete rules.
			await pb.collection('videos').delete(id, { $autoCancel: false });
			setVideos((prev) => prev.filter((v) => v.id !== id));
			toast.success('Deleted');
		} catch {
			toast.error('Failed to delete');
		}
	};

	const filtered = useMemo(() => {
		let list = videos;
		if (filterType !== 'all') {
			list = list.filter((v) => v.status === filterType);
		}
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			list = list.filter((v) => (v.prompt || '').toLowerCase().includes(q));
		}
		list = [...list].sort((a, b) => {
			if (sortBy === 'oldest') return new Date(a.created) - new Date(b.created);
			if (sortBy === 'duration') return (b.duration || 0) - (a.duration || 0);
			return new Date(b.created) - new Date(a.created);
		});
		return list;
	}, [videos, filterType, sortBy, search]);

	return (
		<>
			<Helmet>
				<title>Library - Aether Video</title>
			</Helmet>

			<div className="flex-1 overflow-y-auto bg-black text-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
					{/* Header */}
					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
						<div>
							<p className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--accent-primary))] mb-1">
								Library
							</p>
							<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Your videos</h1>
							<p className="text-sm text-white/50 mt-1">
								Everything you have generated, in one place.
							</p>
						</div>
						<Link
							to="/app/generate"
							className="self-start sm:self-end inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-105 transition-transform"
						>
							<Sparkles className="w-3.5 h-3.5" />
							New
						</Link>
					</div>

					{/* Toolbar */}
					<div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search prompts…"
								className="w-full pl-9 pr-3 h-10 rounded-full bg-white/[0.03] border border-white/10 text-sm placeholder:text-white/30 focus:bg-white/[0.05] focus:border-white/20 outline-none transition-colors"
							/>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<div className="flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/[0.03]">
								{FILTER_OPTIONS.map((f) => (
									<button
										key={f.key}
										onClick={() => setFilterType(f.key)}
										className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
											filterType === f.key
												? 'bg-white text-black'
												: 'text-white/60 hover:text-white'
										}`}
									>
										{f.label}
									</button>
								))}
							</div>
							<div className="flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/[0.03]">
								{SORT_OPTIONS.map((s) => (
									<button
										key={s.key}
										onClick={() => setSortBy(s.key)}
										className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
											sortBy === s.key
												? 'bg-white text-black'
												: 'text-white/60 hover:text-white'
										}`}
									>
										{s.label}
									</button>
								))}
							</div>
						</div>
					</div>

					{/* Grid */}
					{loading ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{Array.from({ length: 8 }).map((_, i) => (
								<div
									key={i}
									className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
								>
									<div className="aspect-video bg-white/5 animate-pulse" />
									<div className="p-3 space-y-2">
										<div className="h-3 bg-white/10 rounded animate-pulse" />
										<div className="h-3 bg-white/5 rounded w-2/3 animate-pulse" />
									</div>
								</div>
							))}
						</div>
					) : filtered.length === 0 ? (
						<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 text-center">
							<Sparkles className="w-8 h-8 mx-auto text-[hsl(var(--accent-primary))] mb-3" />
							<h2 className="text-lg font-semibold mb-1">
								{videos.length === 0 ? 'No videos yet' : 'Nothing matches that filter'}
							</h2>
							<p className="text-sm text-white/50 mb-5">
								{videos.length === 0
									? 'Generate your first video to fill this up.'
									: 'Try a different status or clear your search.'}
							</p>
							<Link
								to="/app/generate"
								className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:scale-105 transition-transform"
							>
								<Sparkles className="w-3.5 h-3.5" />
								Create your first video
							</Link>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{filtered.map((v) => (
								<VideoTile key={v.id} video={v} onDelete={handleDelete} />
							))}
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default LibraryPage;
