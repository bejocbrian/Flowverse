/**
 * Single source of truth for the model catalog the workspace exposes.
 *
 * Edit here when adding/removing models. The frontend pulls this via
 * GET /models and renders the picker dynamically.
 *
 * Each variant becomes its own row in the model picker. Two variants of
 * the same `id` (e.g. HD vs Full HD) differ only in their available
 * `resolutions`.
 */

export const MODEL_VARIANTS = [
	{
		key: 'veo-3.1-fast-hd',
		id: 'veo-3.1-fast',
		label: 'Veo 3.1 Fast HD',
		provider: 'Google',
		type: 'video',
		durations: [4, 6, 8],
		resolutions: ['720p'],
		credits: { '720p': 8 },
		enabled: true,
	},
	{
		key: 'veo-3.1-fast-fullhd',
		id: 'veo-3.1-fast',
		label: 'Veo 3.1 Fast Full HD',
		provider: 'Google',
		type: 'video',
		durations: [4, 6, 8],
		resolutions: ['1080p'],
		credits: { '1080p': 12 },
		enabled: true,
	},
	{
		key: 'veo-3.1-lite-hd',
		id: 'veo-3.1-lite',
		label: 'Veo 3.1 Lite HD',
		provider: 'Google',
		type: 'video',
		durations: [4, 6, 8],
		resolutions: ['720p'],
		credits: { '720p': 6 },
		enabled: true,
	},
	{
		key: 'veo-3.1-lite-fullhd',
		id: 'veo-3.1-lite',
		label: 'Veo 3.1 Lite Full HD',
		provider: 'Google',
		type: 'video',
		durations: [4, 6, 8],
		resolutions: ['1080p'],
		credits: { '1080p': 10 },
		enabled: true,
	},
	{
		key: 'grok-3-hd',
		id: 'grok-3',
		label: 'Grok 3',
		provider: 'xAI',
		type: 'video',
		durations: [4, 6, 8],
		resolutions: ['720p'],
		credits: { '720p': 8 },
		enabled: true,
	},
];

export function getEnabledModels() {
	return MODEL_VARIANTS.filter((m) => m.enabled);
}
