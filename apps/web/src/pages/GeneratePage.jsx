import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
	ArrowLeftRight,
	ArrowUp,
	Check,
	ChevronDown,
	Coins,
	Film,
	ImagePlus,
	Layers,
	Loader2,
	Plus,
	Settings as SettingsIcon,
	Smartphone,
	RectangleHorizontal,
	Sparkles,
	Trash2,
	Wand2,
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

const MAX_REF_IMAGE_MB = 8;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const STARTER_PROMPTS = [
	'Slow-motion ink dispersing in clear water, macro lens',
	'Aurora dancing over a still alpine lake at midnight',
	'Hyperrealistic close-up of a hummingbird in flight',
	'Synthwave cityscape at dusk, neon reflections on wet asphalt',
];

const DEFAULT_DURATION = 8;

/** Read an image File into { id, preview, dataUrl }, or null on error (toasts). */
function readImageFile(file) {
	return new Promise((resolve) => {
		if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
			toast.error('Only JPEG, PNG, or WebP images are allowed');
			resolve(null);
			return;
		}
		if (file.size > MAX_REF_IMAGE_MB * 1024 * 1024) {
			toast.error(`Each image must be under ${MAX_REF_IMAGE_MB}MB`);
			resolve(null);
			return;
		}
		const reader = new FileReader();
		reader.onload = () =>
			resolve({
				id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
				preview: reader.result,
				dataUrl: reader.result,
			});
		reader.onerror = () => {
			toast.error('Could not read that image');
			resolve(null);
		};
		reader.readAsDataURL(file);
	});
}

/* -------------------------------------------------------------------------- */
/*  Compact Start/End frame chip (opens picker; shows thumb when set)         */
/* -------------------------------------------------------------------------- */

const FrameChip = ({ label, image, onPick, onClear }) => {
	const inputRef = useRef(null);
	return (
		<div className="flex flex-col items-center gap-1">
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (f) onPick(f);
					if (inputRef.current) inputRef.current.value = '';
				}}
				className="hidden"
			/>
			{image ? (
				<div className="relative w-20 h-14 rounded-lg overflow-hidden border border-white/15">
					<img src={image.preview} alt={label} className="w-full h-full object-cover" />
					<button
						type="button"
						onClick={onClear}
						className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-white/80 hover:bg-red-500/80"
						aria-label={`Remove ${label}`}
					>
						<X className="w-3 h-3" />
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className="w-20 h-14 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/40 transition-colors"
				>
					<ImagePlus className="w-4 h-4" />
				</button>
			)}
			<span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">{label}</span>
		</div>
	);
};

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
	isPaid,
	resolution,
	onSelectResolution,
	resolutions,
	aspectRatio,
	onSelectAspect,
	aspectRatios,
	durations,
	duration,
	onSelectDuration,
	// reference images
	supportsFrames,
	supportsIngredients,
	activeMode,
	onToggleMode,
	creditCost,
	balance,
}) => {
	const panelRef = useRef(null);

	// Dismiss on outside-click and Escape. Registered only while open.
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e) => {
			if (!panelRef.current) return;
			// Ignore clicks inside the panel.
			if (panelRef.current.contains(e.target)) return;
			// Ignore clicks inside Radix portaled content (e.g. the model
			// dropdown), which renders OUTSIDE the panel via a portal. Without
			// this, selecting a model would close the panel before the click
			// registers - making the model unselectable.
			if (e.target.closest?.('[data-radix-popper-content-wrapper]')) return;
			onClose();
		};
		const onKeyDown = (e) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open, onClose]);

	if (!open) return null;

	const insufficient = balance < creditCost;

	return (
		<motion.div
			ref={panelRef}
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
					{ASPECT_RATIOS.filter((r) => !aspectRatios || aspectRatios.includes(r.id)).map((r) => {
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

			{/* Quality / resolution */}
			{resolutions.length > 1 && (
				<div className="flex flex-col gap-2">
					<label className="text-xs uppercase tracking-wider text-white/40 font-mono">Quality</label>
					<div className="flex bg-black/40 p-1 rounded-xl">
						{resolutions.map((r) => {
							const tag = r === '1080p' ? 'Full HD' : r === '720p' ? 'HD' : r === '480p' ? 'SD' : '';
							return (
								<button
									key={r}
									onClick={() => onSelectResolution(r)}
									className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-center leading-tight ${
										resolution === r ? 'bg-white text-black' : 'text-white/50 hover:text-white'
									}`}
								>
									<span>{r}</span>
									{tag && (
										<span className={`text-[9px] font-mono ${resolution === r ? 'text-black/50' : 'text-white/30'}`}>
											{tag}
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* Frames / Ingredients mode toggle */}
			{(supportsFrames || supportsIngredients) && (
				<div className="flex flex-col gap-2">
					<label className="text-xs uppercase tracking-wider text-white/40 font-mono">Image input</label>
					<div className="flex bg-black/40 p-1 rounded-xl">
						{supportsFrames && (
							<button
								onClick={() => onToggleMode(activeMode === 'frame' ? null : 'frame')}
								className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
									activeMode === 'frame' ? 'bg-white text-black' : 'text-white/50 hover:text-white'
								}`}
							>
								<Film className="w-3.5 h-3.5" />
								Frames
							</button>
						)}
						{supportsIngredients && (
							<button
								onClick={() => onToggleMode(activeMode === 'ingredient' ? null : 'ingredient')}
								className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
									activeMode === 'ingredient' ? 'bg-white text-black' : 'text-white/50 hover:text-white'
								}`}
							>
								<Layers className="w-3.5 h-3.5" />
								Ingredients
							</button>
						)}
					</div>
					<p className="text-[11px] text-white/40">
						{activeMode === 'frame'
							? 'Start/End frame slots appear in the prompt bar below.'
							: activeMode === 'ingredient'
							? 'Use the + in the prompt bar to add reference images.'
							: 'Select a mode to add reference images.'}
					</p>
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
								const locked = !isPaid && !m.freeAccess;
								const priceMap = m.billing === 'per_second' ? m.creditsPerSecond : m.credits;
								const vals = priceMap ? Object.values(priceMap) : [];
								const minCr = vals.length ? Math.min(...vals) : null;
								const maxCr = vals.length ? Math.max(...vals) : null;
								const unit = m.billing === 'per_second' ? ' cr/s' : ' cr';
								return (
									<button
										key={m.key}
										onClick={() => !locked && onSelectModel(m)}
										disabled={locked}
										title={locked ? 'Purchase credits to unlock this model' : undefined}
										className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
											locked
												? 'opacity-40 cursor-not-allowed text-white/40'
												: active
												? 'bg-white/10 text-white'
												: 'text-white/70 hover:text-white hover:bg-white/5'
										}`}
									>
										<span className="flex flex-col min-w-0">
											<span className="leading-tight truncate flex items-center gap-1.5">
												{m.label}
												{locked && (
													<span className="text-[8px] font-bold px-1 py-0.5 rounded bg-white/10 text-white/50">
														PRO
													</span>
												)}
											</span>
											<span className="text-[10px] text-white/40 font-mono truncate">
												{m.provider}
											</span>
										</span>
										<span className="flex items-center gap-2 shrink-0">
											{minCr !== null && (
												<span className="text-[10px] font-mono text-white/40 whitespace-nowrap">
													{minCr === maxCr ? `${minCr}` : `${minCr}–${maxCr}`}{unit}
												</span>
											)}
											{active && !locked && <Check className="w-4 h-4 text-white" />}
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
					{insufficient
						? 'Not enough credits'
						: selectedModel?.billing === 'per_second'
						? `≈ ${creditCost} cr for ${duration}s`
						: 'Cost per generation'}
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
	const isPaid = currentUser?.is_paid === true;
	const [models, setModels] = useState([]);
	const [modelsLoading, setModelsLoading] = useState(true);

	const [prompt, setPrompt] = useState('');
	const [aspectRatio, setAspectRatio] = useState('16:9');
	const [selectedModelKey, setSelectedModelKey] = useState(null);
	const [resolution, setResolution] = useState('720p');
	const [duration, setDuration] = useState(DEFAULT_DURATION);
	const [showSettings, setShowSettings] = useState(false);

	// Reference images. Frames (first/last keyframes) and Ingredients
	// (subject/style refs) are MUTUALLY EXCLUSIVE - the API's mode_image is one
	// or the other. Each image: { id, preview, dataUrl }.
	// `activeMode`: null | 'frame' | 'ingredient' — controls which picker shows
	// in the dock bar. Toggled from the settings panel.
	const [activeMode, setActiveMode] = useState(null);
	const [frameFirst, setFrameFirst] = useState(null);
	const [frameLast, setFrameLast] = useState(null);
	const [ingredients, setIngredients] = useState([]);

	const [loading, setLoading] = useState(false);
	const [stage, setStage] = useState(0);
	const [progress, setProgress] = useState(0);
	const [generatedResult, setGeneratedResult] = useState(null); // { type, url, thumbnail, aspectRatio }
	// The DB id of the last completed video, used for the Extend action.
	const [lastVideoId, setLastVideoId] = useState(null);
	const [extendOpen, setExtendOpen] = useState(false);
	const [extendPrompt, setExtendPrompt] = useState('');

	const pollingRef = useRef(null);
	const progressRef = useRef(null);
	const ingredientInputRef = useRef(null);

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
					// Default to the first model the user can actually use:
					// free users default to a free-access model (Veo 3.1 Lite).
					const accessible = list.find((m) => isPaid || m.freeAccess) || list[0];
					setSelectedModelKey(accessible.key);
					setResolution(accessible.resolutions?.[0] || '720p');
					if (accessible.durations?.length) {
						setDuration(accessible.durations.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : accessible.durations[0]);
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
	const aspectRatios = selectedModel?.aspectRatios ?? ['16:9'];
	const imageModes = selectedModel?.imageModes ?? [];

	// Which reference controls this model supports.
	const supportsFrames = imageModes.includes('frame');
	// 'ingredient' (Veo) or 'reference' (Grok) both render as the Ingredients control.
	const ingredientMode = imageModes.includes('ingredient')
		? 'ingredient'
		: imageModes.includes('reference')
		? 'reference'
		: null;
	const supportsIngredients = Boolean(ingredientMode);
	const maxIngredients = Math.min(selectedModel?.maxRefImages ?? 3, 3);

	const clearRefImages = useCallback(() => {
		setFrameFirst(null);
		setFrameLast(null);
		setIngredients([]);
	}, []);

	const handleToggleMode = useCallback((mode) => {
		if (mode === activeMode) {
			// Deactivate
			setActiveMode(null);
			return;
		}
		// Switching modes: clear the other mode's images (mutual exclusivity).
		if (mode === 'frame') {
			setIngredients([]);
		} else if (mode === 'ingredient') {
			setFrameFirst(null);
			setFrameLast(null);
		}
		setActiveMode(mode);
	}, [activeMode]);

	// keep resolution + duration + aspect valid, and drop ref images the model
	// can't use, whenever the model changes.
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
		const ars = selectedModel.aspectRatios || ['16:9'];
		if (!ars.includes(aspectRatio)) setAspectRatio(ars[0]);

		const modes = selectedModel.imageModes || [];
		if (!modes.includes('frame') && (frameFirst || frameLast)) {
			setFrameFirst(null);
			setFrameLast(null);
		}
		if (!modes.includes('ingredient') && !modes.includes('reference') && ingredients.length > 0) {
			setIngredients([]);
		}
		// Reset activeMode if the model doesn't support it.
		if (activeMode === 'frame' && !modes.includes('frame')) setActiveMode(null);
		if (activeMode === 'ingredient' && !modes.includes('ingredient') && !modes.includes('reference')) setActiveMode(null);
	}, [selectedModel, resolution, duration, aspectRatio, frameFirst, frameLast, ingredients.length, activeMode]);

	const creditCost = useMemo(() => {
		if (!selectedModel) return 0;
		if (selectedModel.billing === 'per_second') {
			const rate = selectedModel.creditsPerSecond?.[resolution];
			if (!rate || !duration) return 0;
			return Math.ceil(rate * duration);
		}
		const map = selectedModel.credits || {};
		return map[resolution] ?? map.default ?? 0;
	}, [selectedModel, resolution, duration]);
	const balance = currentUser?.credits_balance ?? 0;
	const insufficient = balance < creditCost;
	const promptOk = prompt.trim().length >= 3;
	const canSubmit = !loading && promptOk && !insufficient && Boolean(selectedModel);

	const refCount = (frameFirst ? 1 : 0) + (frameLast ? 1 : 0) + ingredients.length;

	/* ---------------------------- reference images ----------------------- */

	// Frames and Ingredients are mutually exclusive: picking one clears the other.
	const handlePickFrame = useCallback(async (slot, file) => {
		const img = await readImageFile(file);
		if (!img) return;
		setIngredients([]); // mutual exclusivity
		if (slot === 'first') setFrameFirst(img);
		else setFrameLast(img);
	}, []);

	const handleClearFrame = useCallback((slot) => {
		if (slot === 'first') setFrameFirst(null);
		else setFrameLast(null);
	}, []);

	const handleAddIngredients = useCallback(
		async (files) => {
			if (!files.length) return;
			const slotsLeft = maxIngredients - ingredients.length;
			if (slotsLeft <= 0) return;
			const read = await Promise.all(files.slice(0, slotsLeft).map(readImageFile));
			const valid = read.filter(Boolean);
			if (!valid.length) return;
			// mutual exclusivity: ingredients replace any frame images
			setFrameFirst(null);
			setFrameLast(null);
			setIngredients((prev) => [...prev, ...valid]);
		},
		[maxIngredients, ingredients.length]
	);

	const handleRemoveIngredient = useCallback((id) => {
		setIngredients((prev) => prev.filter((img) => img.id !== id));
	}, []);

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
						setGeneratedResult({
							type: 'video',
							url: data.video_url,
							thumbnail: data.thumbnail_url || null,
							aspectRatio: data.aspect_ratio || '16:9',
						});
						setLastVideoId(videoId);
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

	// Resolve the active reference-image payload from the mutually-exclusive
	// Frames / Ingredients state.
	const buildImagePayload = useCallback(() => {
		if (frameFirst || frameLast) {
			// Order matters for frames: [first, last].
			const imgs = [frameFirst, frameLast].filter(Boolean).map((i) => i.dataUrl);
			return { image_mode: 'frame', ref_images: imgs };
		}
		if (ingredients.length > 0 && ingredientMode) {
			return { image_mode: ingredientMode, ref_images: ingredients.map((i) => i.dataUrl) };
		}
		return null;
	}, [frameFirst, frameLast, ingredients, ingredientMode]);

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

			const imagePayload = buildImagePayload();

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
					model_key: selectedModel.key,
					output_type: 'video',
					idempotency_key: idempotencyKey,
					...(imagePayload || {}),
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
	}, [canSubmit, selectedModel, prompt, aspectRatio, duration, resolution, buildImagePayload, startPolling, stopPolling]);

	const handleClear = () => {
		stopPolling();
		setGeneratedResult(null);
		setPrompt('');
		setProgress(0);
		setStage(0);
		setLoading(false);
		clearRefImages();
		setActiveMode(null);
		setLastVideoId(null);
		setExtendOpen(false);
		setExtendPrompt('');
	};

	const handleStarter = (text) => {
		setPrompt(text);
	};

	/* ---------------------------- extend --------------------------------- */

	const handleExtend = useCallback(async () => {
		if (!lastVideoId || !extendPrompt.trim() || extendPrompt.trim().length < 3) {
			toast.error('Describe what should happen next (a few words).');
			return;
		}
		setLoading(true);
		setProgress(0);
		setStage(0);
		setExtendOpen(false);
		const continuation = extendPrompt.trim();

		try {
			const idempotencyKey =
				typeof crypto !== 'undefined' && crypto.randomUUID
					? crypto.randomUUID()
					: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

			const response = await apiServerClient.fetch(`/videos/${lastVideoId}/extend`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: continuation, idempotency_key: idempotencyKey }),
			});

			if (!response.ok) {
				const errData = await response.json().catch(() => ({}));
				throw new Error(errData.error || `Extend failed (HTTP ${response.status})`);
			}

			const data = await response.json();
			const newId = data.video?.id;
			setGeneratedResult(null);
			setPrompt(continuation);
			setExtendPrompt('');
			setStage(1);
			progressRef.current = setInterval(() => {
				setProgress((p) => (p >= 90 ? 90 : p + 1));
			}, 1000);
			if (newId) startPolling(newId);
		} catch (error) {
			stopPolling();
			setLoading(false);
			setProgress(0);
			setStage(0);
			toast.error(typeof error?.message === 'string' ? error.message : 'Extend failed');
		}
	}, [lastVideoId, extendPrompt, startPolling, stopPolling]);

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
								<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center">
									{/* Animated ring */}
									<div className="relative w-16 h-16 mb-6">
										<svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
											<circle
												cx="32" cy="32" r="28"
												fill="none"
												stroke="rgba(255,255,255,0.08)"
												strokeWidth="4"
											/>
											<motion.circle
												cx="32" cy="32" r="28"
												fill="none"
												stroke="hsl(var(--accent-primary))"
												strokeWidth="4"
												strokeLinecap="round"
												strokeDasharray={`${2 * Math.PI * 28}`}
												strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
												transition={{ duration: 0.5 }}
											/>
										</svg>
										<div className="absolute inset-0 flex items-center justify-center">
											<span className="text-sm font-mono font-semibold text-white">{progress}%</span>
										</div>
									</div>

									{/* Animated stage label */}
									<AnimatePresence mode="wait">
										<motion.p
											key={stage}
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											transition={{ duration: 0.2 }}
											className="text-xs uppercase tracking-[0.2em] text-white/50 font-mono mb-4"
										>
											{STAGES[Math.min(stage, STAGES.length - 1)]}
										</motion.p>
									</AnimatePresence>

									{/* Progress bar */}
									<div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-5">
										<motion.div
											className="h-full bg-gradient-to-r from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))]"
											initial={{ width: 0 }}
											animate={{ width: `${progress}%` }}
											transition={{ duration: 0.5 }}
										/>
									</div>

									{/* Animated dots */}
									<div className="flex items-center gap-1.5 mb-4">
										{[0, 1, 2].map((i) => (
											<motion.div
												key={i}
												className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent-primary))]"
												animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
												transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
											/>
										))}
									</div>

									<p className="text-xs text-white/30">
										You can leave this page — your video will keep rendering.
									</p>
								</div>
							</div>
						)}

						{/* Result */}
						{generatedResult && !loading && (
							<motion.div
								initial={{ opacity: 0, scale: 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								className={`w-full mt-6 ${generatedResult.aspectRatio === '9:16' ? 'max-w-sm' : 'max-w-4xl'}`}
							>
								<div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group bg-black">
									{/* Thumbnail shown until video loads */}
									<VideoPlayer
										src={generatedResult.url}
										poster={generatedResult.thumbnail || undefined}
										className={`w-full ${generatedResult.aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[80vh]' : 'aspect-video'}`}
									/>
									{/* Thumbnail overlay badge */}
									{generatedResult.thumbnail && (
										<div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-mono text-white/60 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
											Ready
										</div>
									)}
									<button
										onClick={handleClear}
										className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 text-white"
										aria-label="Clear result"
									>
										<Trash2 className="w-4 h-4" />
									</button>
								</div>

								{/* Thumbnail strip — shows the still frame separately below the player */}
								{generatedResult.thumbnail && (
									<div className="mt-3 flex items-center gap-3 px-1">
										<img
											src={generatedResult.thumbnail}
											alt="Video thumbnail"
											className="w-20 h-12 rounded-lg object-cover border border-white/10 shrink-0"
										/>
										<div className="flex flex-col min-w-0">
											<span className="text-xs text-white/60 font-mono truncate">{prompt}</span>
											<span className="text-[11px] text-white/30 mt-0.5">Tap the video to play</span>
										</div>
									</div>
								)}
								<div className="flex items-center justify-between mt-4 px-1 text-xs text-white/50">
									<span className="font-mono truncate">{prompt}</span>
									<div className="ml-3 flex items-center gap-2 shrink-0">
										{lastVideoId && (
											<button
												onClick={() => setExtendOpen((v) => !v)}
												className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-white"
											>
												<Wand2 className="w-3.5 h-3.5" />
												Extend
											</button>
										)}
										<button
											onClick={handleClear}
											className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-white"
										>
											<Plus className="w-3.5 h-3.5" />
											New
										</button>
									</div>
								</div>

								{/* Extend composer */}
								<AnimatePresence>
									{extendOpen && lastVideoId && (
										<motion.div
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: 'auto' }}
											exit={{ opacity: 0, height: 0 }}
											className="mt-3 overflow-hidden"
										>
											<div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex flex-col gap-2">
												<p className="text-[11px] text-white/40">
													Describe what happens next — the new clip continues from this video.
												</p>
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
														placeholder="e.g. the camera pulls back to reveal a city skyline"
														className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30"
													/>
													<button
														onClick={handleExtend}
														disabled={extendPrompt.trim().length < 3}
														className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
													>
														Extend
													</button>
												</div>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
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
									isPaid={isPaid}
									resolution={resolution}
									onSelectResolution={setResolution}
									resolutions={resolutions}
									aspectRatio={aspectRatio}
									onSelectAspect={setAspectRatio}
									aspectRatios={aspectRatios}
									durations={durations}
									duration={duration}
									onSelectDuration={setDuration}
									supportsFrames={supportsFrames}
									supportsIngredients={supportsIngredients}
									activeMode={activeMode}
									onToggleMode={handleToggleMode}
									creditCost={creditCost}
									balance={balance}
								/>
							)}
						</AnimatePresence>

						<div className="bg-[#1a1b1e]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5">
							{/* Frame chips (left of input, when Frames mode active) */}
							{activeMode === 'frame' && (
								<div className="flex items-center gap-1.5 shrink-0">
									<FrameChip label="Start" image={frameFirst} onPick={(f) => handlePickFrame('first', f)} onClear={() => handleClearFrame('first')} />
									<ArrowLeftRight className="w-3.5 h-3.5 text-white/25" />
									<FrameChip label="End" image={frameLast} onPick={(f) => handlePickFrame('last', f)} onClear={() => handleClearFrame('last')} />
								</div>
							)}

							{/* Ingredient + button (left of input, when Ingredients mode active) */}
							{activeMode === 'ingredient' && (
								<div className="flex items-center gap-1 shrink-0">
									{ingredients.map((img) => (
										<div key={img.id} className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10">
											<img src={img.preview} alt="ref" className="w-full h-full object-cover" />
											<button
												type="button"
												onClick={() => handleRemoveIngredient(img.id)}
												className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity"
												aria-label="Remove"
											>
												<X className="w-3 h-3 text-white" />
											</button>
										</div>
									))}
									{ingredients.length < maxIngredients && (
										<>
											<input
												ref={ingredientInputRef}
												type="file"
												accept="image/jpeg,image/png,image/webp"
												multiple
												onChange={(e) => {
													handleAddIngredients(Array.from(e.target.files || []));
													if (ingredientInputRef.current) ingredientInputRef.current.value = '';
												}}
												className="hidden"
											/>
											<button
												type="button"
												onClick={() => ingredientInputRef.current?.click()}
												className="w-9 h-9 flex items-center justify-center rounded-lg border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/40 transition-colors"
												aria-label="Add reference image"
											>
												<Plus className="w-4 h-4" />
											</button>
										</>
									)}
								</div>
							)}

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
								className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm sm:text-base text-white placeholder:text-white/30 disabled:opacity-50 min-w-0"
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
								{refCount > 0 && (
									<>
										<span className="text-white/30">·</span>
										<span className="inline-flex items-center gap-1 text-[hsl(var(--accent-primary))]">
											<ImagePlus className="w-3 h-3" />
											{refCount}
										</span>
									</>
								)}
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
