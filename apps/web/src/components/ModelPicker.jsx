
import React, { useState, useMemo } from 'react';
import { Check, ChevronDown, Search, Sparkles, Lock, Zap, Star } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.jsx';

const PROVIDER_COLORS = {
	Google: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
	xAI: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
	Kling: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
	ByteDance: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
	Seedance: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
	OpenAI: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const CATEGORY_ICONS = {
	Free: <Sparkles className="w-3 h-3" />,
	Fast: <Zap className="w-3 h-3" />,
	Premium: <Star className="w-3 h-3" />,
};

function getPriceLabel(model) {
	if (model.billing === 'per_second') {
		const vals = model.creditsPerSecond ? Object.values(model.creditsPerSecond) : [];
		if (!vals.length) return '?';
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		return min === max ? `${min} cr/s` : `${min}-${max} cr/s`;
	}
	const map = model.credits || {};
	const vals = Object.values(map);
	if (!vals.length) return '?';
	const min = Math.min(...vals);
	const max = Math.max(...vals);
	return min === max ? `${min} cr` : `${min}-${max} cr`;
}

const ModelPicker = ({ models, selectedModelKey, onSelectModel, isPaid }) => {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const [providerFilter, setProviderFilter] = useState('All');

	const providers = useMemo(() => {
		const set = new Set(models.map(m => m.provider));
		return ['All', ...Array.from(set)];
	}, [models]);

	const filtered = useMemo(() => {
		return models.filter(m => {
			if (providerFilter !== 'All' && m.provider !== providerFilter) return false;
			if (search) {
				const q = search.toLowerCase();
				return (
					m.label.toLowerCase().includes(q) ||
					m.key.includes(q) ||
					m.provider.toLowerCase().includes(q) ||
					(m.description && m.description.toLowerCase().includes(q))
				);
			}
			return true;
		});
	}, [models, providerFilter, search]);

	const grouped = useMemo(() => {
		const groups = {};
		filtered.forEach(m => {
			if (!groups[m.provider]) groups[m.provider] = [];
			groups[m.provider].push(m);
		});
		return groups;
	}, [filtered]);

	const selected = models.find(m => m.key === selectedModelKey);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-black/40 text-sm text-white hover:bg-black/60 transition-colors text-left"
				>
					<span className="flex flex-col min-w-0">
						<span className="leading-tight truncate flex items-center gap-2">
							{selected?.label || 'Select model'}
							{selected?.freeAccess && (
								<span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
									FREE
								</span>
							)}
						</span>
						{selected && (
							<span className="text-[10px] text-white/40 font-mono truncate">
								{selected.provider} &middot; {getPriceLabel(selected)}
							</span>
						)}
					</span>
					<ChevronDown className={`w-4 h-4 text-white/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
				</button>
			</PopoverTrigger>

			<PopoverContent
				align="start"
				sideOffset={6}
				className="w-[min(420px,calc(100vw-32px))] p-0 bg-[#1a1b1e]/98 backdrop-blur-3xl border-white/10 shadow-2xl"
			>
				{/* Search */}
				<div className="p-3 border-b border-white/10">
					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search models..."
							className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30"
						/>
					</div>
				</div>

				{/* Provider tabs */}
				<div className="flex gap-1 px-3 pt-2 pb-1 overflow-x-auto no-scrollbar">
					{providers.map(p => (
						<button
							key={p}
							onClick={() => setProviderFilter(p)}
							className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors border ${
								providerFilter === p
									? 'bg-white/15 border-white/30 text-white'
									: 'border-transparent text-white/40 hover:text-white/60'
							}`}
						>
							{p}
							{p !== 'All' && (
								<span className="ml-1 opacity-60">
									{models.filter(m => m.provider === p).length}
								</span>
							)}
						</button>
					))}
				</div>

				{/* Model list */}
				<div className="max-h-[350px] overflow-y-auto p-2">
					{Object.entries(grouped).map(([provider, groupModels]) => (
						<div key={provider} className="mb-2">
							{providerFilter === 'All' && (
								<div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-white/30">
									{provider}
								</div>
							)}
							{groupModels.map(m => {
								const active = m.key === selectedModelKey;
								const locked = !isPaid && !m.freeAccess;
								return (
									<button
										key={m.key}
										onClick={() => {
											if (!locked) {
												onSelectModel(m);
												setOpen(false);
											}
										}}
										disabled={locked}
										title={locked ? 'Purchase credits to unlock this model' : undefined}
										className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
											locked
												? 'opacity-35 cursor-not-allowed'
												: active
												? 'bg-white/10 text-white'
												: 'text-white/70 hover:text-white hover:bg-white/5'
										}`}
									>
										<span className="flex flex-col min-w-0 gap-0.5">
											<span className="flex items-center gap-1.5 leading-tight">
												<span className="truncate text-sm font-medium">{m.label}</span>
												{m.freeAccess && (
													<span className="text-[7px] font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0">
														FREE
													</span>
												)}
												{locked && (
													<Lock className="w-3 h-3 text-white/30 shrink-0" />
												)}
											</span>
											<span className="flex items-center gap-1.5 text-[10px]">
												<span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${PROVIDER_COLORS[m.provider] || 'bg-white/10 text-white/50 border-white/20'}`}>
													{m.provider}
												</span>
												{m.category && m.category !== 'Standard' && (
													<span className="text-white/30 flex items-center gap-0.5">
														{CATEGORY_ICONS[m.category]}
														{m.category}
													</span>
												)}
											</span>
										</span>
										<span className="flex items-center gap-2 shrink-0">
											<span className="text-[10px] font-mono text-white/40 whitespace-nowrap">
												{getPriceLabel(m)}
											</span>
											{active && !locked && <Check className="w-4 h-4 text-white" />}
										</span>
									</button>
								);
							})}
						</div>
					))}
					{filtered.length === 0 && (
						<div className="py-6 text-center text-sm text-white/30">
							No models found
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default ModelPicker;
