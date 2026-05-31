import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Submit a hidden auto-POST form to Paytm's hosted "Show Payment Page".
// We use a full-page redirect (NOT the Blink iframe SDK) because this app
// sets a Cross-Origin-Embedder-Policy that blocks Paytm's cross-origin
// iframe - the SDK would hang silently. A form POST navigates the whole tab
// to Paytm, exactly like Cashfree's redirectTarget: '_self'.
function postToPaytm(paymentUrl, fields) {
	const form = document.createElement('form');
	form.method = 'POST';
	form.action = paymentUrl;
	form.style.display = 'none';

	for (const [name, value] of Object.entries(fields)) {
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = name;
		input.value = value;
		form.appendChild(input);
	}

	document.body.appendChild(form);
	form.submit();
}

const PaytmCheckoutButton = ({ packId, popular, className, children }) => {
	const [loading, setLoading] = useState(false);

	const handleCheckout = async () => {
		setLoading(true);
		try {
			const successUrl = `${window.location.origin}/app/wallet/success`;

			// Server-authoritative: send only the pack id. Price + credits are
			// derived server-side and recorded against this order.
			const res = await apiServerClient.fetch('/paytm/create-order', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ packId, successUrl }),
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to create order');
			}

			const { order_id, txn_token, mid, payment_url } = await res.json();
			if (!order_id || !txn_token || !mid || !payment_url) {
				throw new Error('Server did not return a valid Paytm session');
			}

			// Full-page POST to Paytm. The tab navigates away; Paytm posts the
			// result back to our server callback, which redirects to the
			// wallet success page. We intentionally leave `loading` true since
			// the page is navigating away.
			postToPaytm(payment_url, {
				mid,
				orderId: order_id,
				txnToken: txn_token,
			});
		} catch (error) {
			console.error('Paytm checkout error:', error);
			toast(error.message || 'Failed to start Paytm checkout');
			setLoading(false);
		}
	};

	return (
		<Button
			onClick={handleCheckout}
			disabled={loading}
			className={className}
			variant={popular ? 'default' : 'outline'}
		>
			{loading ? (
				<>
					<Loader2 className="w-4 h-4 mr-2 animate-spin" />
					Redirecting...
				</>
			) : (
				children || 'Pay with Paytm'
			)}
		</Button>
	);
};

export default PaytmCheckoutButton;
