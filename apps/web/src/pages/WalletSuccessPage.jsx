
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

const WalletSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (sessionId) {
      apiServerClient.fetch(`/stripe/session/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          setDetails(data);
          refreshUser();
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [sessionId, refreshUser]);

  return (
    <>
      <Helmet>
        <title>Payment Successful - VideoAI</title>
      </Helmet>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="glass-surface rounded-2xl p-8 md:p-12 max-w-md w-full text-center shadow-glass-lg">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Payment Successful</h1>
          
          {loading ? (
            <p className="text-[hsl(var(--text-secondary))] mb-8 animate-pulse">Verifying transaction...</p>
          ) : details ? (
            <div className="space-y-4 mb-8 bg-[hsl(var(--elevated))] rounded-xl p-6 text-left">
              <div className="flex justify-between border-b border-[hsl(var(--border))] pb-3">
                <span className="text-[hsl(var(--text-secondary))]">Credits Added</span>
                <span className="font-bold text-[hsl(var(--accent-primary))]">+{details.creditAmount}</span>
              </div>
              <div className="flex justify-between border-b border-[hsl(var(--border))] pb-3">
                <span className="text-[hsl(var(--text-secondary))]">Amount Paid</span>
                <span className="font-mono">${(details.amountTotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--text-secondary))]">Transaction ID</span>
                <span className="font-mono text-xs max-w-[120px] truncate">{details.id}</span>
              </div>
            </div>
          ) : (
            <p className="text-[hsl(var(--text-secondary))] mb-8">Your credits have been added to your account.</p>
          )}

          <Link to="/app/wallet">
            <Button className="w-full h-12 text-lg">
              Return to Wallet
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default WalletSuccessPage;
