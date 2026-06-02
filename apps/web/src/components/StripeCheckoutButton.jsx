
import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// StripeCheckoutButton now only requires a `packId` — the server derives the
// price and credit amount from its own pack catalog. We never send price/amount
// from the client, which prevents clients from charging themselves ₹1 for the
// largest pack.
const StripeCheckoutButton = ({ packId, popular, className }) => {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await apiServerClient.fetch('/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Checkout error:', error);
      toast(error.message || 'Failed to initialize checkout. Please try again.');
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
        'Purchase'
      )}
    </Button>
  );
};

export default StripeCheckoutButton;
