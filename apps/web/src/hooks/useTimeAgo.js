import { useMemo } from 'react';

/**
 * Shared time-ago formatter hook.
 * Returns a function that converts an ISO timestamp to a human-readable
 * relative time string (e.g., "5m ago", "2h ago", "3d ago").
 *
 * Fixes the bug where days were calculated as h/86400 instead of h/24.
 */
export function useTimeAgo() {
	return useMemo(() => (iso) => {
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
	}, []);
}

export default useTimeAgo;