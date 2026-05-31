import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Cashfree's JS SDK is dynamically imported on first click so the bundle
// stays small for users who never use this payment method. The `mode`
// (sandbox vs production) is driven by the server so it always matches
// the API's CASHFREE_ENV - a mismatch silently breaks checkout.
async function loadCashfree(mode) {
	const mod = await import('@cashfreepayments/cashfree-js');
	const factory = mod.load || mod.default?.load;
	if (!factory) throw new Error('Cashfree SDK did not expose a load() function');
	const resolvedMode = mode || import.meta.env.VITE_CASHFREE_ENV || 'sandbox';
	return factory({ mode: resolvedMode });
}

const CashfreeCheckoutButton = ({ packId, popular, mode, className, children }) => {
	const [loading, setLoading] = useState(false);

	const handleCheckout = async () => {
		setLoading(true);
		try {
			const successUrl =
				`${window.location.origin}/app/wallet/success?cf_order_id={order_id}`;

			// Server-authoritative: we send only the pack id. Price and credits
			// are derived from the server's pack table - never trusted from here.
			const res = await apiServerClient.fetch('/cashfree/create-order', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ packId, currency: 'INR', successUrl }),
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || 'Failed to create order');
			}

			const { payment_session_id } = await res.json();
			if (!payment_session_id) {
				throw new Error('Server did not return a payment session');
			}

			const cashfree = await loadCashfree(mode);
			await cashfree.checkout({
				paymentSessionId: payment_session_id,
				redirectTarget: '_self',
			});
		} catch (error) {
			console.error('Cashfree checkout error:', error);
			toast(error.message || 'Failed to start Cashfree checkout');
		} finally {
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
					Processing...
				</>
			) : (
				children || 'Pay with Cashfree'
			)}
		</Button>
	);
};

export default CashfreeCheckoutButton;
