
import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const WalletCancelPage = () => {
  return (
    <>
      <Helmet>
        <title>Payment Cancelled - VideoAI</title>
      </Helmet>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="glass-surface rounded-2xl p-8 md:p-12 max-w-md w-full text-center shadow-glass-lg">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Purchase Cancelled</h1>
          <p className="text-[hsl(var(--text-secondary))] mb-8 leading-relaxed">
            Your checkout session was cancelled. No charges were made to your account.
          </p>

          <Link to="/app/wallet">
            <Button variant="outline" className="w-full h-12 text-lg">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Return to Wallet
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default WalletCancelPage;
