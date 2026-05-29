import { useEffect, useState } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

const DEFAULT = {
	feature_flags: {
		show_duration_selector: false,
		default_duration: 8,
		available_durations: [4, 6, 8],
		allow_multi_generation: false,
		max_generations_per_request: 1,
	},
	default_aspect_ratio: { text: '16:9' },
	default_quality: { text: 'Standard' },
	payment_methods: { stripe: true, cashfree: false },
};

/**
 * Fetches /settings/public once on mount. Returns { settings, loading, error }.
 * Keeps server-controlled defaults so the UI degrades gracefully if the
 * settings endpoint is unreachable.
 */
export default function usePublicSettings() {
	const [settings, setSettings] = useState(DEFAULT);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await apiServerClient.fetch('/settings/public');
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				if (cancelled) return;
				setSettings({
					...DEFAULT,
					...data,
					payment_methods: {
						...DEFAULT.payment_methods,
						...(data.payment_methods || {}),
					},
				});
			} catch (e) {
				if (!cancelled) setError(e);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return { settings, loading, error };
}
