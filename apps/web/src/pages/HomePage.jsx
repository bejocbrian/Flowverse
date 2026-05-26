import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button.jsx';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion.jsx';
import {
	ArrowRight,
	Sparkles,
	Wand2,
	Layers,
	Zap,
	Shield,
	Cpu,
	Play,
	Check,
	Star,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Static content                                                            */
/* -------------------------------------------------------------------------- */

// TODO: replace these with stills/thumbnails from your own AI generations.
// Hosted on Unsplash CDN so nothing ships in the bundle.
const SHOWCASE = [
	{
		src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=900&q=70',
		prompt: 'Synthwave cityscape at dusk, neon reflections',
		span: 'tall',
	},
	{
		src: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=900&q=70',
		prompt: 'Macro shot of liquid metal forming a sphere',
		span: 'wide',
	},
	{
		src: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=900&q=70',
		prompt: 'Aurora dancing over a still alpine lake',
	},
	{
		src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=70',
		prompt: 'Circuit board at microscope scale, blue glow',
	},
	{
		src: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=900&q=70',
		prompt: 'Cinematic portrait, soft window light, 35mm film',
		span: 'tall',
	},
	{
		src: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=900&q=70',
		prompt: 'Underwater coral reef in golden hour light',
		span: 'wide',
	},
];

const PROMPT_EXAMPLES = [
	'A koi pond with cherry blossoms drifting on the surface',
	'Astronaut riding a horse through a nebula',
	'Time-lapse of a city growing from forest to skyline',
	'Slow-motion ink dispersing in clear water',
	'Hyperrealistic close-up of a hummingbird in flight',
];

const STEPS = [
	{
		icon: Wand2,
		title: 'Describe your scene',
		desc: 'Type the shot you want. Style, camera move, mood, lighting - whatever helps.',
		image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=70',
	},
	{
		icon: Layers,
		title: 'Pick your model',
		desc: 'Choose from a growing roster of frontier models. Different strengths, different vibes.',
		image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=70',
	},
	{
		icon: Cpu,
		title: 'Render in seconds',
		desc: 'Distributed GPUs do the heavy lifting. Watch your idea become motion.',
		image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=70',
	},
];

const FEATURES = [
	{
		icon: Sparkles,
		title: 'Frontier models, one workspace',
		desc: 'A curated roster of the best video and image models. Switch models per project without leaving the app.',
	},
	{
		icon: Zap,
		title: 'Built for speed',
		desc: 'Median render under a minute on most prompts. Background queueing, never blocks your work.',
	},
	{
		icon: Layers,
		title: 'Reference frames + ingredients',
		desc: 'Drop in your own images to anchor the scene. Mix multiple references into one shot.',
	},
	{
		icon: Shield,
		title: 'Your work stays yours',
		desc: 'Private by default. Only you see your videos until you choose to share.',
	},
];

const TESTIMONIALS = [
	{
		quote: 'I prototype shots for client decks here. What used to take a half day with stock now takes minutes.',
		name: 'Maya Chen',
		role: 'Director, Loop Studio',
	},
	{
		quote: 'The ingredient mode is unfair. I drop one reference and the whole brand language just lands.',
		name: 'Diego Alvarez',
		role: 'Creative Lead, Northkit',
	},
	{
		quote: 'Replaces three tools in my pipeline. The render queue is the fastest I have used.',
		name: 'Priya Rao',
		role: 'Indie Filmmaker',
	},
];

const FAQS = [
	{
		q: 'How long does a typical generation take?',
		a: 'Most short clips render in 30-90 seconds. Higher quality and longer durations take longer. Generations run in the background, so you can keep working.',
	},
	{
		q: 'Do I own the videos I create?',
		a: 'Yes. You hold the rights to your generations subject to our Terms of Service. Private by default, share only what you choose to share.',
	},
	{
		q: 'Which models are available?',
		a: 'A growing roster of frontier video and image models. We add new models as they launch and surface them inside the workspace.',
	},
	{
		q: 'How are credits priced?',
		a: 'Credits scale with duration and quality. A short HD clip costs less than a long Full HD one. The cost is shown before you generate.',
	},
	{
		q: 'Can I cancel anytime?',
		a: 'Yes. Plans renew monthly and you can cancel from your billing settings. Unused credits expire at the end of the billing cycle.',
	},
];

/* -------------------------------------------------------------------------- */
/*  Hero with cycling prompt typewriter                                       */
/* -------------------------------------------------------------------------- */

function useCyclingText(items, { typingMs = 50, pauseMs = 1800, deletingMs = 25 } = {}) {
	const [text, setText] = useState('');
	const [index, setIndex] = useState(0);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		if (reduceMotion) {
			setText(items[index] || '');
			const t = setTimeout(() => setIndex((i) => (i + 1) % items.length), 3000);
			return () => clearTimeout(t);
		}

		const target = items[index] || '';
		let timeout;

		if (text.length < target.length) {
			timeout = setTimeout(() => setText(target.slice(0, text.length + 1)), typingMs);
		} else {
			timeout = setTimeout(() => {
				let t2;
				const erase = () => {
					setText((curr) => {
						if (!curr) {
							setIndex((i) => (i + 1) % items.length);
							return '';
						}
						t2 = setTimeout(erase, deletingMs);
						return curr.slice(0, -1);
					});
				};
				t2 = setTimeout(erase, deletingMs);
				timeout = t2;
			}, pauseMs);
		}

		return () => clearTimeout(timeout);
	}, [text, index, items, typingMs, pauseMs, deletingMs, reduceMotion]);

	return text;
}

const Hero = () => {
	const cycling = useCyclingText(PROMPT_EXAMPLES);
	const reduceMotion = useReducedMotion();
	const ref = useRef(null);
	const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
	const orbLeftY = useTransform(scrollYProgress, [0, 1], [0, -80]);
	const orbRightY = useTransform(scrollYProgress, [0, 1], [0, 60]);

	return (
		<section ref={ref} className="relative overflow-hidden gradient-hero">
			{/* Floating orbs */}
			<motion.div
				aria-hidden
				className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full"
				style={{
					background:
						'radial-gradient(circle, rgba(77, 142, 255, 0.25) 0%, transparent 60%)',
					filter: 'blur(40px)',
					y: orbLeftY,
				}}
			/>
			<motion.div
				aria-hidden
				className="pointer-events-none absolute top-40 -right-40 w-[520px] h-[520px] rounded-full"
				style={{
					background:
						'radial-gradient(circle, rgba(78, 222, 163, 0.18) 0%, transparent 60%)',
					filter: 'blur(60px)',
					y: orbRightY,
				}}
			/>
			<div aria-hidden className="absolute inset-0 canvas-dot-pattern opacity-50" />

			<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 lg:pt-32 lg:pb-40">
				<div className="grid lg:grid-cols-12 gap-12 items-center">
					{/* Copy */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, ease: 'easeOut' }}
						className="lg:col-span-7"
					>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs font-medium mb-6">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
								<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
							</span>
							<span className="text-[hsl(var(--text-secondary))]">
								New models added regularly
							</span>
						</div>

						<h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
							Turn ideas into{' '}
							<span className="bg-gradient-to-r from-[hsl(var(--accent-primary))] via-[hsl(var(--accent-secondary))] to-[hsl(var(--accent-tertiary))] bg-clip-text text-transparent">
								cinematic video
							</span>{' '}
							in seconds.
						</h1>
						<p className="text-lg md:text-xl text-[hsl(var(--text-secondary))] mb-8 max-w-xl leading-relaxed">
							Aether Video runs the latest frontier models on a fast queue. Type a shot,
							pick a model, ship to your timeline.
						</p>

						{/* Live prompt preview */}
						<div className="glass-elevated rounded-xl p-4 mb-8 max-w-xl">
							<div className="flex items-center gap-2 text-xs text-[hsl(var(--text-muted))] mb-2 font-mono">
								<Sparkles className="w-3.5 h-3.5" />
								<span>PROMPT</span>
							</div>
							<p className="font-mono text-sm md:text-base text-[hsl(var(--text-primary))] min-h-[1.75rem]">
								{cycling}
								{!reduceMotion && (
									<span className="inline-block w-[2px] h-4 bg-[hsl(var(--accent-primary))] animate-pulse ml-0.5 align-middle" />
								)}
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<Link to="/signup">
								<Button size="lg" className="text-base px-7 group">
									Start creating
									<ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
								</Button>
							</Link>
							<Link to="/login">
								<Button size="lg" variant="outline" className="text-base px-7">
									Sign in
								</Button>
							</Link>
							<span className="text-xs text-[hsl(var(--text-muted))]">
								No credit card. Free credits to try.
							</span>
						</div>
					</motion.div>

					{/* Visual side */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
						className="lg:col-span-5 relative"
					>
						<HeroPreviewCard />
					</motion.div>
				</div>
			</div>
		</section>
	);
};

/* Cycles through still frames in the hero card with a subtle Ken Burns effect. */
const HERO_PREVIEW_FRAMES = [
	'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=900&q=80',
	'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=900&q=80',
	'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=900&q=80',
];

const HeroPreviewCard = () => {
	const [active, setActive] = useState(0);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		if (reduceMotion) return undefined;
		const t = setInterval(
			() => setActive((i) => (i + 1) % HERO_PREVIEW_FRAMES.length),
			3500
		);
		return () => clearInterval(t);
	}, [reduceMotion]);

	return (
		<div className="relative">
			{/* outer glow */}
			<div
				aria-hidden
				className="absolute -inset-4 rounded-2xl opacity-30 blur-2xl"
				style={{
					background:
						'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
				}}
			/>

			<div className="relative glass-elevated rounded-2xl p-3 shadow-glass-lg">
				<div className="aspect-[4/5] rounded-xl overflow-hidden relative bg-[hsl(var(--surface))]">
					{HERO_PREVIEW_FRAMES.map((src, i) => (
						<motion.img
							key={src}
							src={src}
							alt=""
							loading={i === 0 ? 'eager' : 'lazy'}
							className="absolute inset-0 w-full h-full object-cover"
							initial={{ opacity: 0, scale: 1.05 }}
							animate={{
								opacity: i === active ? 1 : 0,
								scale: i === active ? 1 : 1.05,
							}}
							transition={{ duration: 1.2, ease: 'easeInOut' }}
						/>
					))}
					<div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

					<div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full glass-panel text-xs font-mono">
						<Play className="w-3 h-3 fill-current" />
						<span>00:08 / 720p</span>
					</div>
				</div>

				<div className="flex items-center justify-between mt-3 px-1">
					<div className="flex items-center gap-2">
						<span className="w-2 h-2 rounded-full bg-emerald-400" />
						<span className="text-xs text-[hsl(var(--text-secondary))] font-mono">
							Generated
						</span>
					</div>
					<span className="text-xs text-[hsl(var(--text-muted))] font-mono">
						12 credits
					</span>
				</div>
			</div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.6 }}
				className="hidden md:block absolute -bottom-6 -left-8 glass-elevated rounded-xl p-3 shadow-glass-lg"
			>
				<div className="flex items-center gap-3">
					<div className="w-9 h-9 rounded-lg bg-[hsl(var(--accent-primary))]/20 flex items-center justify-center">
						<Zap className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
					</div>
					<div>
						<p className="text-xs font-medium">Rendered in 47s</p>
						<p className="text-[10px] text-[hsl(var(--text-muted))] font-mono">
							distributed compute
						</p>
					</div>
				</div>
			</motion.div>
		</div>
	);
};

/* -------------------------------------------------------------------------- */
/*  Reusable section header                                                   */
/* -------------------------------------------------------------------------- */

const SectionHeader = ({ eyebrow, title, sub, center = true }) => (
	<motion.div
		initial={{ opacity: 0, y: 16 }}
		whileInView={{ opacity: 1, y: 0 }}
		viewport={{ once: true, margin: '-80px' }}
		transition={{ duration: 0.5 }}
		className={center ? 'text-center mx-auto max-w-2xl mb-12 md:mb-16' : 'mb-12 md:mb-16'}
	>
		{eyebrow && (
			<p className="text-label text-[hsl(var(--accent-primary))] mb-3">{eyebrow}</p>
		)}
		<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3">{title}</h2>
		{sub && (
			<p className="text-[hsl(var(--text-secondary))] text-base md:text-lg leading-relaxed">
				{sub}
			</p>
		)}
	</motion.div>
);

/* -------------------------------------------------------------------------- */
/*  Showcase gallery                                                          */
/* -------------------------------------------------------------------------- */

const Showcase = () => (
	<section className="py-24 px-4 sm:px-6 lg:px-8">
		<div className="max-w-7xl mx-auto">
			<SectionHeader
				eyebrow="GALLERY"
				title="See what's possible"
				sub="Real frames generated on Aether Video. Hover for the prompt that produced each one."
			/>

			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[180px] md:auto-rows-[200px]">
				{SHOWCASE.map((item, i) => (
					<motion.figure
						key={item.src}
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-50px' }}
						transition={{ duration: 0.5, delay: i * 0.05 }}
						className={[
							'relative group rounded-xl overflow-hidden glass-surface',
							item.span === 'tall' ? 'row-span-2' : '',
							item.span === 'wide' ? 'col-span-2' : '',
						].join(' ')}
					>
						<img
							src={item.src}
							alt={item.prompt}
							loading="lazy"
							className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none" />
						<figcaption className="absolute inset-x-0 bottom-0 p-3 md:p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
							<p className="text-xs md:text-sm font-mono text-white leading-snug line-clamp-2">
								{item.prompt}
							</p>
						</figcaption>
						<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
							<div className="w-12 h-12 rounded-full glass-elevated flex items-center justify-center backdrop-blur-md">
								<Play className="w-5 h-5 fill-white text-white" />
							</div>
						</div>
					</motion.figure>
				))}
			</div>
		</div>
	</section>
);

/* -------------------------------------------------------------------------- */
/*  How it works                                                              */
/* -------------------------------------------------------------------------- */

const HowItWorks = () => (
	<section className="py-24 px-4 sm:px-6 lg:px-8">
		<div className="max-w-7xl mx-auto">
			<SectionHeader
				eyebrow="HOW IT WORKS"
				title="From prompt to render in three steps"
				sub="No editing software, no plugins. Open the app and you're shipping."
			/>

			<div className="grid md:grid-cols-3 gap-6">
				{STEPS.map((step, i) => (
					<motion.div
						key={step.title}
						initial={{ opacity: 0, y: 24 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: i * 0.1 }}
						className="glass-surface rounded-2xl overflow-hidden flex flex-col"
					>
						<div className="aspect-[4/3] relative overflow-hidden">
							<img
								src={step.image}
								alt=""
								loading="lazy"
								className="absolute inset-0 w-full h-full object-cover"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--surface))] via-[hsl(var(--surface))]/30 to-transparent" />
							<div className="absolute top-3 left-3 w-9 h-9 rounded-lg glass-elevated flex items-center justify-center font-mono text-sm">
								0{i + 1}
							</div>
						</div>
						<div className="p-6">
							<div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent-primary))]/15 flex items-center justify-center mb-4">
								<step.icon className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
							</div>
							<h3 className="text-xl font-semibold mb-2">{step.title}</h3>
							<p className="text-[hsl(var(--text-secondary))] leading-relaxed">{step.desc}</p>
						</div>
					</motion.div>
				))}
			</div>
		</div>
	</section>
);

/* -------------------------------------------------------------------------- */
/*  Features                                                                  */
/* -------------------------------------------------------------------------- */

const Features = () => (
	<section className="py-24 px-4 sm:px-6 lg:px-8">
		<div className="max-w-7xl mx-auto">
			<SectionHeader
				eyebrow="WHY AETHER"
				title="Built for shipping, not for tinkering"
				sub="Defaults that just work, controls when you want them."
			/>

			<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{FEATURES.map((feat, i) => (
					<motion.div
						key={feat.title}
						initial={{ opacity: 0, y: 16 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.4, delay: i * 0.05 }}
						className="glass-surface rounded-xl p-6 hover:border-[hsl(var(--accent-primary))]/30 transition-colors"
					>
						<div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent-primary))]/15 flex items-center justify-center mb-4">
							<feat.icon className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
						</div>
						<h3 className="font-semibold mb-2">{feat.title}</h3>
						<p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">{feat.desc}</p>
					</motion.div>
				))}
			</div>
		</div>
	</section>
);

/* -------------------------------------------------------------------------- */
/*  Testimonials                                                              */
/* -------------------------------------------------------------------------- */

const Testimonials = () => (
	<section className="py-24 px-4 sm:px-6 lg:px-8">
		<div className="max-w-7xl mx-auto">
			<SectionHeader
				eyebrow="TRUSTED BY MAKERS"
				title="Used by directors, indies and studios"
			/>

			<div className="grid md:grid-cols-3 gap-4">
				{TESTIMONIALS.map((t, i) => (
					<motion.figure
						key={t.name}
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: i * 0.08 }}
						className="glass-surface rounded-xl p-6 flex flex-col gap-4"
					>
						<div className="flex gap-0.5">
							{Array.from({ length: 5 }).map((_, k) => (
								<Star
									key={k}
									className="w-4 h-4 fill-[hsl(var(--accent-tertiary))] text-[hsl(var(--accent-tertiary))]"
								/>
							))}
						</div>
						<blockquote className="text-[hsl(var(--text-primary))] leading-relaxed">
							{t.quote}
						</blockquote>
						<figcaption className="mt-auto pt-4 border-t border-[hsl(var(--border-subtle))]">
							<p className="text-sm font-medium">{t.name}</p>
							<p className="text-xs text-[hsl(var(--text-muted))]">{t.role}</p>
						</figcaption>
					</motion.figure>
				))}
			</div>
		</div>
	</section>
);

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */

const PRICING = [
	{
		tier: 'Free',
		price: '0',
		blurb: 'Try the workflow.',
		cta: 'Get started',
		variant: 'outline',
		features: ['Free credits to start', '720p export', 'Short clips', 'Watermark'],
	},
	{
		tier: 'Pro',
		price: '29',
		blurb: 'For working creators.',
		cta: 'Start Pro',
		variant: 'default',
		highlighted: true,
		features: [
			'1,000 credits / month',
			'720p and 1080p',
			'Longer durations',
			'Priority queue',
			'No watermark',
		],
	},
	{
		tier: 'Studio',
		price: '99',
		blurb: 'For teams shipping at scale.',
		cta: 'Talk to us',
		variant: 'outline',
		features: [
			'5,000 credits / month',
			'All resolutions',
			'Custom durations',
			'Team workspaces',
			'API access',
		],
	},
];

const Pricing = () => (
	<section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
		<div className="max-w-7xl mx-auto">
			<SectionHeader
				eyebrow="PRICING"
				title="Simple plans, scale when you need to"
				sub="Cancel anytime. Credits roll within the billing cycle."
			/>

			<div className="grid md:grid-cols-3 gap-4 lg:gap-6">
				{PRICING.map((p, i) => (
					<motion.div
						key={p.tier}
						initial={{ opacity: 0, y: 16 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.4, delay: i * 0.08 }}
						className={[
							'relative glass-surface rounded-2xl p-7 flex flex-col',
							p.highlighted
								? 'ring-1 ring-[hsl(var(--accent-primary))]/50 shadow-glow-primary'
								: '',
						].join(' ')}
					>
						{p.highlighted && (
							<div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[hsl(var(--accent-primary-container))] text-white">
								Most popular
							</div>
						)}
						<h3 className="text-xl font-semibold mb-1">{p.tier}</h3>
						<p className="text-sm text-[hsl(var(--text-muted))] mb-5">{p.blurb}</p>
						<div className="flex items-baseline gap-1 mb-6">
							<span className="text-5xl font-bold tracking-tight">${p.price}</span>
							<span className="text-[hsl(var(--text-muted))]">/mo</span>
						</div>
						<ul className="space-y-3 mb-8 flex-1">
							{p.features.map((f) => (
								<li key={f} className="flex items-start gap-2 text-sm">
									<Check className="w-4 h-4 mt-0.5 text-[hsl(var(--accent-secondary))] shrink-0" />
									<span>{f}</span>
								</li>
							))}
						</ul>
						<Link to="/signup" className="block">
							<Button variant={p.variant} className="w-full">
								{p.cta}
							</Button>
						</Link>
					</motion.div>
				))}
			</div>
		</div>
	</section>
);

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                       */
/* -------------------------------------------------------------------------- */

const FAQ = () => (
	<section className="py-24 px-4 sm:px-6 lg:px-8">
		<div className="max-w-3xl mx-auto">
			<SectionHeader eyebrow="FAQ" title="Questions, answered" />
			<Accordion type="single" collapsible className="glass-surface rounded-2xl px-6">
				{FAQS.map((item, i) => (
					<AccordionItem
						key={i}
						value={`item-${i}`}
						className="border-b border-[hsl(var(--border-subtle))] last:border-0"
					>
						<AccordionTrigger className="text-left text-base md:text-lg font-medium py-5 hover:no-underline">
							{item.q}
						</AccordionTrigger>
						<AccordionContent className="text-[hsl(var(--text-secondary))] leading-relaxed pb-5">
							{item.a}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	</section>
);

/* -------------------------------------------------------------------------- */
/*  Final CTA                                                                 */
/* -------------------------------------------------------------------------- */

const FinalCTA = () => (
	<section className="py-24 px-4 sm:px-6 lg:px-8">
		<div className="max-w-5xl mx-auto">
			<motion.div
				initial={{ opacity: 0, y: 24 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.6 }}
				className="relative overflow-hidden rounded-3xl glass-elevated p-10 md:p-16 text-center"
			>
				<div
					aria-hidden
					className="absolute inset-0 opacity-30"
					style={{
						background:
							'radial-gradient(ellipse at 30% 30%, rgba(77, 142, 255, 0.4) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(78, 222, 163, 0.3) 0%, transparent 60%)',
					}}
				/>
				<div className="relative">
					<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
						Your first idea is one prompt away.
					</h2>
					<p className="text-[hsl(var(--text-secondary))] max-w-xl mx-auto mb-8 text-base md:text-lg">
						Sign up, verify your email, and you'll get free credits to play with.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Link to="/signup">
							<Button size="lg" className="text-base px-8 group">
								Create your first video
								<ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
							</Button>
						</Link>
						<Link to="/login">
							<Button size="lg" variant="ghost" className="text-base px-8">
								Sign in
							</Button>
						</Link>
					</div>
				</div>
			</motion.div>
		</div>
	</section>
);

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */

const Footer = () => (
	<footer className="border-t border-[hsl(var(--border-subtle))] py-12 px-4 sm:px-6 lg:px-8 mt-12">
		<div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
			<div className="flex items-center gap-2">
				<span className="font-semibold tracking-tight">Aether Video</span>
				<span className="text-xs text-[hsl(var(--text-muted))] font-mono ml-2">
					&copy; {new Date().getFullYear()}
				</span>
			</div>
			<nav className="flex items-center flex-wrap justify-center gap-6 text-sm text-[hsl(var(--text-secondary))]">
				<a
					href="#pricing"
					className="hover:text-[hsl(var(--text-primary))] transition-colors"
				>
					Pricing
				</a>
				<Link to="/about" className="hover:text-[hsl(var(--text-primary))] transition-colors">
					About
				</Link>
				<Link
					to="/privacy"
					className="hover:text-[hsl(var(--text-primary))] transition-colors"
				>
					Privacy
				</Link>
				<Link to="/terms" className="hover:text-[hsl(var(--text-primary))] transition-colors">
					Terms
				</Link>
			</nav>
		</div>
	</footer>
);

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const HomePage = () => {
	const navBg = useMemo(
		() => ({
			background: 'rgba(16, 19, 26, 0.7)',
			backdropFilter: 'blur(12px)',
			WebkitBackdropFilter: 'blur(12px)',
		}),
		[]
	);

	return (
		<>
			<Helmet>
				<title>Aether Video - Turn ideas into cinematic video</title>
				<meta
					name="description"
					content="Generate cinematic video from a prompt. A growing roster of frontier AI models in one workspace, built for working creators."
				/>
			</Helmet>

			<div className="min-h-screen bg-[hsl(var(--canvas))] text-[hsl(var(--text-primary))]">
				<header
					className="sticky top-0 z-50 border-b border-[hsl(var(--border-subtle))]"
					style={navBg}
				>
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
						<Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
							<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(var(--accent-primary))] to-[hsl(var(--accent-secondary))] grid place-items-center">
								<Sparkles className="w-3.5 h-3.5 text-[hsl(var(--canvas))]" />
							</span>
							Aether Video
						</Link>
						<nav className="hidden md:flex items-center gap-6 text-sm text-[hsl(var(--text-secondary))]">
							<a
								href="#pricing"
								className="hover:text-[hsl(var(--text-primary))] transition-colors"
							>
								Pricing
							</a>
							<Link
								to="/login"
								className="hover:text-[hsl(var(--text-primary))] transition-colors"
							>
								Sign in
							</Link>
						</nav>
						<div className="flex items-center gap-2">
							<Link to="/login" className="md:hidden">
								<Button variant="ghost" size="sm">
									Sign in
								</Button>
							</Link>
							<Link to="/signup">
								<Button size="sm">Get started</Button>
							</Link>
						</div>
					</div>
				</header>

				<main>
					<Hero />
					<Showcase />
					<HowItWorks />
					<Features />
					<Testimonials />
					<Pricing />
					<FAQ />
					<FinalCTA />
				</main>
				<Footer />
			</div>
		</>
	);
};

export default HomePage;
