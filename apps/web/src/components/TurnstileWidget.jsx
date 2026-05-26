import React, { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile widget.
 *
 * Loads the Turnstile script once, renders the widget, and passes the
 * verification token back via onToken. If VITE_TURNSTILE_SITE_KEY is not
 * configured, renders nothing and immediately calls onToken('') so the form
 * still works in dev without a captcha.
 *
 * Usage:
 *   <TurnstileWidget onToken={setToken} />
 */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;
function loadTurnstile() {
	if (typeof window === 'undefined') return Promise.resolve(null);
	if (window.turnstile) return Promise.resolve(window.turnstile);
	if (scriptPromise) return scriptPromise;

	scriptPromise = new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
		if (existing) {
			existing.addEventListener('load', () => resolve(window.turnstile));
			existing.addEventListener('error', reject);
			return;
		}
		const s = document.createElement('script');
		s.src = SCRIPT_SRC;
		s.async = true;
		s.defer = true;
		s.onload = () => resolve(window.turnstile);
		s.onerror = reject;
		document.head.appendChild(s);
	});
	return scriptPromise;
}

const TurnstileWidget = ({ onToken, className = '' }) => {
	const containerRef = useRef(null);
	const widgetIdRef = useRef(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		// No site key configured: bypass.
		if (!SITE_KEY) {
			onToken('');
			return undefined;
		}

		let cancelled = false;

		loadTurnstile()
			.then((turnstile) => {
				if (cancelled || !turnstile || !containerRef.current) return;
				widgetIdRef.current = turnstile.render(containerRef.current, {
					sitekey: SITE_KEY,
					callback: (token) => onToken(token),
					'error-callback': () => {
						setError('Captcha failed to load. Please refresh.');
						onToken('');
					},
					'expired-callback': () => onToken(''),
					theme: 'auto',
				});
			})
			.catch(() => setError('Could not load captcha.'));

		return () => {
			cancelled = true;
			if (widgetIdRef.current && window.turnstile) {
				try { window.turnstile.remove(widgetIdRef.current); } catch (_e) { /* noop */ }
				widgetIdRef.current = null;
			}
		};
	}, [onToken]);

	if (!SITE_KEY) return null;

	return (
		<div className={className}>
			<div ref={containerRef} />
			{error && (
				<p className="text-xs text-red-500 mt-1">{error}</p>
			)}
		</div>
	);
};

export default TurnstileWidget;
