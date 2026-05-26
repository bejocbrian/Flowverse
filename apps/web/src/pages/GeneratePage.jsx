import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
	ArrowUp,
	Check,
	ChevronDown,
	Coins,
	Loader2,
	Plus,
	Settings as SettingsIcon,
	Smartphone,
	RectangleHorizontal,
	Sparkles,
	Trash2,
	X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import VideoPlayer from '@/components/VideoPlayer.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.jsx';

const ASPECT_RATIOS = [
	{ id: '16:9', label: '16:9', icon: RectangleHorizontal },
	{ id: '9:16', label: '9:16', icon: Smartphone },
];

const STARTER_PROMPTS = [
	'Slow-motion ink dispersing in clear water, macro lens',
	'Aurora dancing over a still alpine lake at midnight',
	'Hyperrealistic close-up of a hummingbird in flight',
	'Synthwave cityscape at dusk, neon reflections on wet asphalt',
];

const DEFAULT_DURATION = 8;

/* -------------------------------------------------------------------------- */
/*  Settings panel                                                            */
/* -------------------------------------------------------------------------- */

const SettingsPanel = ({
	open,
	onClose,
	models,
	selectedModel,
	selectedModelKey,
	onSelectModel,
	resolution,
	onSelectResolution,
	resolutions,
	aspectRatio,
	onSelectAspect,
	durations,
	duration,
	onSelectDuration,
	creditCost,
	balance,
}) => {
	if (!open) return null;

	const insufficient = balance < creditCost;

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 12 }}
			transition={{ duration: 0.15 }}
			className="absolute bottom-[calc(100%+12px)] right-0 sm:right-2 w-[min(380px,calc(100vw-32px))] bg-[#1a1b1e]/95 backdrop-blur-3xl rounded-2xl p-5 border border-white/10 shadow-2xl flex flex-col gap-5 max-h-[70vh] overflow-y-auto"
		>
			<div className="flex items-center justify-between">
				<p className="text-xs uppercase tracking-wider text-white/40 font-mono">Settings</p>
				<button
					onClick={onClose}
					className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
					aria-label="Close settings"
				>
					<X className="w-4 h-4" />
				</button>
			</div>

			{/* Aspect ratio */}
			<div className="flex flex-col gap-2">
				<label className="text-xs uppercase tracking-wider text-white/40 font-mono">Aspect ratio</label>
				<div className="flex bg-black/40 p-1 rounded-xl">
					{ASPECT_RATIOS.map((r) => {
						const Icon = r.icon;
						const active = aspectRatio === r.id;
						return (
							<button
								key={r.id}
								onClick={() => onSelectAspect(r.id)}
								className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
									active ? 'bg-white text-black' : 'text-white/50 hover:text-white'
								}`}
							>
								<Icon className="w-4 h-4" />
								{r.label}
							</button>
						);
					})}
				</div>
			</div>

			{/* Duration */}
			{durations.length > 0 && (
				<div className="flex flex-col gap-2">
					<label className="text-xs uppercase tracking-wider text-white/40 font-mono">Duration</label>
					<div className="flex bg-black/40 p-1 rounded-xl">
						{durations.map((d) => (
							<button
								key={d}
								onClick={() => onSelectDuration(d)}
								className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
									duration === d ? 'bg-white text-black' : 'text-white/50 hover:text-white'
								}`}
							>
								{d}s
							</button>
						))}
					</div>
				</div>
			)}

			{/* Resolution */}
			{resolutions.length > 1 && (
				<div className="flex flex-col gap-2">
					<label className="text-xs uppercase tracking-wider text-white/40 font-mono">Resolution</label>
					<div className="flex bg-black/40 p-1 rounded-xl">
						{resolutions.map((r) => (
							<button
								key={r}
								onClick={() => onSelectResolution(r)}
								className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
									resolution === r ? 'bg-white text-black' : 'text-white/50 hover:text-white'
								}`}
							>
								{r}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Model picker (compact, in popover) */}
			<div className="flex flex-col gap-2">
				<label className="text-xs uppercase tracking-wider text-white/40 font-mono">Model</label>
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-black/40 text-sm text-white hover:bg-black/60 transition-colors text-left"
						>
							<span className="flex flex-col min-w-0">
								<span className="leading-tight truncate">
									{selectedModel?.label ?? 'Select model'}
								</span>
								{selectedModel?.provider && (
									<span className="text-[10px] text-white/40 font-mono truncate">
										{selectedModel.provider}
									</span>
								)}
							</span>
							<ChevronDown className="w-4 h-4 text-white/50 shrink-0" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						sideOffset={6}
						className="w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto p-1.5 bg-[#1a1b1e]/95 backdrop-blur-3xl border-white/10"
					>
						<div className="flex flex-col gap-1">
							{models.map((m) => {
								const active = m.key === selectedModelKey;
								const minCr = m.credits ? Math.min(...Object.values(m.credits)) : null;
								const maxCr = m.credits ? Math.max(...Object.values(m.credits)) : null;
								return (
									<button
										key={m.key}
										onClick={() => onSelectModel(m)}
										className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
											active
												? 'bg-white/10 text-white'
												: 'text-white/70 hover:text-white hover:bg-white/5'
										}`}
									>
										<span className="flex flex-col min-w-0">
											<span className="leading-tight truncate">{m.label}</span>
											<span className="text-[10px] text-white/40 font-mono truncate">
												{m.provider}
											</span>
										</span>
										<span className="flex items-center gap-2 shrink-0">
											{minCr !== null && (
												<span className="text-[10px] font-mono text-white/40 whitespace-nowrap">
													{minCr === maxCr ? `${minCr}` : `${minCr}–${maxCr}`} cr
												</span>
											)}
											{active && <Check className="w-4 h-4 text-white" />}
										</span>
									</button>
								);
							})}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Cost summary */}
			<div
				className={`rounded-xl border p-3 text-sm flex items-center justify-between ${
					insufficient
						? 'bg-red-500/10 border-red-500/30 text-red-300'
						: 'bg-white/5 border-white/10 text-white/80'
				}`}
			>
				<span className="flex items-center gap-2">
					<Coins className="w-4 h-4" />
					{insufficient ? 'Not enough credits' : 'Cost per generation'}
				</span>
				<span className="font-mono font-medium">
					{creditCost} / {balance}
				</span>
			</div>
		</motion.div>
	);
};

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

const STAGES = ['Submitting…', 'Queued', 'Synthesizing frames…', 'Finalizing…'];

const GeneratePage = () => {
	const { currentUser, refreshUser } = useAuth();
	const [models, setModels] = useState([]);
	const [modelsLoading, setModelsLoading] = useState(true);

	const [prompt, setPrompt] = useState('');
	const [aspectRatio, setAspectRatio] = useState('16:9');
	const [selectedModelKey, setSelectedModelKey] = useState(null);
	const [resolution, setResolution] = useState('720p');
	const [duration, setDuration] = useState(DEFAULT_DURATION);
	const [showSettings, setShowSettings] = useState(false);

	const [loading, setLoading] = useState(false);
	const [stage, setStage] = useState(0);
	const [progress, setProgress] = useState(0);
	const [generatedResult, setGeneratedResult] = useState(null);

	const pollingRef = useRef(null);
	const progressRef = useRef(null);

	/* ---------------------------- load models ---------------------------- */

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await apiServerClient.fetch('/models');
				if (!res.ok) throw new Error('Failed to fetch models');
				const data = await res.json();
				if (cancelled) return;
				const list = Array.isArray(data.models) ? data.models : [];
				setModels(list);
				if (list.length > 0) {
					const first = list[0];
					setSelectedModelKey(first.key);
					setResolution(first.resolutions?.[0] || '720p');
					if (first.durations?.length) {
						setDuration(first.durations.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : first.durations[0]);
					}
				}
			} catch (err) {
				console.error('models fetch failed:', err);
				toast.error('Could not load models. Check your connection.');
			} finally {
				if (!cancelled) setModelsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	/* ---------------------------- derived state -------------------------- */

	const selectedModel = useMemo(
		() => models.find((m) => m.key === selectedModelKey) || null,
		[models, selectedModelKey]
	);

	const resolutions = selectedModel?.resolutions ?? [];
	const durations = selectedModel?.durations ?? [];

	// keep resolution + duration valid when the model changes
	useEffect(() => {
		if (!selectedModel) return;
		if (!selectedModel.resolutions?.includes(resolution)) {
			setResolution(selectedModel.resolutions?.[0] || '720p');
		}
		if (!selectedModel.durations?.includes(duration)) {
			setDuration(
				selectedModel.durations?.includes(DEFAULT_DURATION)
					? DEFAULT_DURATION
					: selectedModel.durations?.[0] || DEFAULT_DURATION
			);
		}
	}, [selectedModel, resolution, duration]);

	const creditCost = selectedModel?.credits?.[resolution] ?? 0;
	const balance = currentUser?.credits_balance ?? 0;
	const insufficient = balance < creditCost;
	const promptOk = prompt.trim().length >= 3;
	const canSubmit = !loading && promptOk && !insufficient && Boolean(selectedModel);

	/* ---------------------------- polling -------------------------------- */

	const stopPolling = useCallback(() => {
		if (pollingRef.current) clearInterval(pollingRef.current);
		if (progressRef.current) clearInterval(progressRef.current);
		pollingRef.current = null;
		progressRef.current = null;
	}, []);

	useEffect(() => () => stopPolling(), [stopPolling]);

	const startPolling = useCallback(
		(videoId) => {
			stopPolling();
			pollingRef.current = setInterval(async () => {
				try {
					const res = await apiServerClient.fetch(`/videos/${videoId}/status`);
					if (!res.ok) return;
					const data = await res.json();

					if (data.status === 'generating' || data.status === 'processing') {
						setStage(2);
					}

					if (data.status === 'completed' && data.video_url) {
						stopPolling();
						setStage(3);
						setProgress(100);
						setGeneratedResult({ type: 'video', url: data.video_url });
						setLoading(false);
						refreshUser();
						toast.success('Generation complete');
					} else if (data.status === 'failed') {
						stopPolling();
						setLoading(false);
						setProgress(0);
						setStage(0);
						refreshUser();
						toast.error(data.error_message || 'Generation failed');
					}
				} catch (err) {
					// transient network errors are fine - keep polling
				}
			}, 5000);
		},
		[refreshUser, stopPolling]
	);

	/* ---------------------------- submit --------------------------------- */

	const handleSubmit = useCallback(async () => {
		if (!canSubmit || !selectedModel) return;

		setLoading(true);
		setProgress(0);
		setStage(0);
		setGeneratedResult(null);

		try {
			const idempotencyKey =
				typeof crypto !== 'undefined' && crypto.randomUUID
					? crypto.randomUUID()
					: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

			const response = await apiServerClient.fetch('/videos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: prompt.trim(),
					aspect_ratio: aspectRatio,
					duration,
					quality: resolution,
					provider: selectedModel.provider,
					model: selectedModel.id,
					output_type: 'video',
					idempotency_key: idempotencyKey,
				}),
			});

			if (!response.ok) {
				const errData = await response.json().catch(() => ({}));
				const msg =
					(typeof errData.error === 'string' && errData.error) ||
					(typeof errData.message === 'string' && errData.message) ||
					(typeof errData.detail === 'string' && errData.detail) ||
					`Generation failed (HTTP ${response.status})`;
				throw new Error(msg);
			}

			const data = await response.json();
			const videoId = data.video?.id;

			setStage(1);
			progressRef.current = setInterval(() => {
				setProgress((p) => (p >= 90 ? 90 : p + 1));
			}, 1000);

			if (videoId) startPolling(videoId);
		} catch (error) {
			stopPolling();
			setLoading(false);
			setProgress(0);
			setStage(0);
			const message =
				typeof error?.message === 'string'
					? error.message
					: typeof error === 'string'
					? error
					: 'Generation failed';
			toast.error(message);
		}
	}, [canSubmit, selectedModel, prompt, aspectRatio, duration, resolution, startPolling, stopPolling]);

	const handleClear = () => {
		stopPolling();
		setGeneratedResult(null);
		setPrompt('');
		setProgress(0);
		setStage(0);
		setLoading(false);
	};

	const handleStarter = (text) => {
		setPrompt(text);
	};

	/* ---------------------------- render --------------------------------- */

	return (
		<>
			<Helmet>
				<title>Workspace - Aether Video</title>
			</Helmet>

			<div className="flex-1 relative bg-black flex flex-col overflow-hidden">
				{/* Workspace canvas */}
				<div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-6 pb-44">
					<div className="mx-auto w-full max-w-5xl flex flex-col items-center">
						{/* Empty state */}
						{!loading && !generatedResult && (
							<motion.div
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
								className="text-center max-w-2xl mt-12 sm:mt-24"
							>
								<div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] mb-5 shadow-glow-primary">
									<Sparkles className="w-7 h-7 text-black" />
								</div>
								<h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
									What do you want to create?
								</h1>
								<p className="text-white/50 mb-8 max-w-lg mx-auto">
									Describe a shot or pick a starter below. The model and settings are tweakable
									from the bottom-right gear.
								</p>

								<div className="flex flex-wrap justify-center gap-2">
									{STARTER_PROMPTS.map((p) => (
										<button
											key={p}
											type="button"
											onClick={() => handleStarter(p)}
											className="px-3 py-2 text-xs sm:text-sm rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-colors max-w-full text-left"
										>
											<span className="opacity-70">"</span>
											<span className="line-clamp-1 inline">{p}</span>
											<span className="opacity-70">"</span>
										</button>
									))}
								</div>
							</motion.div>
						)}

						{/* Loading state with stages */}
						{loading && (
							<div className="w-full max-w-xl mt-16 sm:mt-24">
								<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
									<Loader2 className="w-8 h-8 mb-4 animate-spin text-[hsl(var(--accent-primary))]" />
									<p className="text-sm uppercase tracking-[0.2em] text-white/50 font-mono mb-2">
										{STAGES[Math.min(stage, STAGES.length - 1)]}
									</p>
									<p className="text-2xl font-mono font-semibold mb-5">{progress}%</p>
									<div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
										<motion.div
											className="h-full bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]"
											initial={{ width: 0 }}
											animate={{ width: `${progress}%` }}
											transition={{ duration: 0.4 }}
										/>
									</div>
									<p className="text-xs text-white/40 mt-4">
										You can leave this page - your video will keep rendering.
									</p>
								</div>
							</div>
						)}

						{/* Result */}
						{generatedResult && !loading && (
							<motion.div
								initial={{ opacity: 0, scale: 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								className="w-full max-w-4xl mt-6"
							>
								<div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group bg-black">
									<VideoPlayer src={generatedResult.url} className="w-full aspect-video" />
									<button
										onClick={handleClear}
										className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 text-white"
										aria-label="Clear result"
									>
										<Trash2 className="w-4 h-4" />
									</button>
								</div>
								<div className="flex items-center justify-between mt-4 px-1 text-xs text-white/50">
									<span className="font-mono truncate">{prompt}</span>
									<button
										onClick={handleClear}
										className="ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-white"
									>
										<Plus className="w-3.5 h-3.5" />
										New
									</button>
								</div>
							</motion.div>
						)}
					</div>
				</div>

				{/* Bottom dock */}
				<div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 z-30 bg-gradient-to-t from-black via-black/80 to-transparent">
					<div className="relative mx-auto w-full max-w-3xl">
						<AnimatePresence>
							{showSettings && selectedModel && (
								<SettingsPanel
									key="settings-panel"
									open={showSettings}
									onClose={() => setShowSettings(false)}
									models={models}
									selectedModel={selectedModel}
									selectedModelKey={selectedModelKey}
									onSelectModel={(m) => {
										setSelectedModelKey(m.key);
									}}
									resolution={resolution}
									onSelectResolution={setResolution}
									resolutions={resolutions}
									aspectRatio={aspectRatio}
									onSelectAspect={setAspectRatio}
									durations={durations}
									duration={duration}
									onSelectDuration={setDuration}
									creditCost={creditCost}
									balance={balance}
								/>
							)}
						</AnimatePresence>

						<div className="bg-[#1a1b1e]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5">
							<input
								type="text"
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										handleSubmit();
									}
								}}
								placeholder={modelsLoading ? 'Loading models…' : 'Describe the shot you want…'}
								disabled={modelsLoading || loading}
								className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm sm:text-base text-white placeholder:text-white/30 disabled:opacity-50"
							/>

							<button
								type="button"
								onClick={() => setShowSettings((v) => !v)}
								disabled={!selectedModel}
								className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-colors ${
									showSettings
										? 'bg-white/15 border-white/30 text-white'
										: 'bg-black/40 border-white/10 text-white/60 hover:text-white hover:bg-black/60'
								} disabled:opacity-40`}
							>
								<SettingsIcon className="w-3.5 h-3.5" />
								<span>{aspectRatio}</span>
								<span className="text-white/30">·</span>
								<span>{resolution}</span>
								<span className="text-white/30">·</span>
								<span>{duration}s</span>
								<span className="text-white/30">·</span>
								<span className={insufficient ? 'text-red-400' : ''}>{creditCost} cr</span>
							</button>

							{/* Mobile compact settings button */}
							<button
								type="button"
								onClick={() => setShowSettings((v) => !v)}
								disabled={!selectedModel}
								className="sm:hidden p-2.5 rounded-full bg-black/40 border border-white/10 text-white/60 hover:text-white hover:bg-black/60 disabled:opacity-40"
								aria-label="Settings"
							>
								<SettingsIcon className="w-4 h-4" />
							</button>

							<button
								type="button"
								onClick={handleSubmit}
								disabled={!canSubmit}
								className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
								aria-label="Generate"
							>
								{loading ? (
									<Loader2 className="w-5 h-5 animate-spin" />
								) : (
									<ArrowUp className="w-5 h-5" strokeWidth={2.5} />
								)}
							</button>
						</div>

						{/* Status row under the input */}
						<div className="flex items-center justify-between mt-2 px-1 text-[11px] font-mono text-white/40">
							<span>
								{!promptOk
									? 'Type at least a few words to start.'
									: insufficient
									? 'Not enough credits for these settings.'
									: 'Press Enter or click the arrow to generate.'}
							</span>
							<span className="hidden sm:inline">{balance} credits available</span>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default GeneratePage;
