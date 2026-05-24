
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Coins, TrendingUp, TrendingDown, Clock, ShieldCheck, CreditCard } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import StripeCheckoutButton from '@/components/StripeCheckoutButton.jsx';

const STRIPE_PACKAGES = [
  { credits: 50, price: 4.99, popular: false },
  { credits: 100, price: 8.99, popular: true },
  { credits: 500, price: 39.99, popular: false }
];

const WalletPage = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('wallet'); // 'wallet' | 'buy'

  useEffect(() => {
    fetchTransactions();
  }, [currentUser]);

  const fetchTransactions = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const records = await pb.collection('transactions').getFullList({
        filter: `user_id = "${currentUser.id}"`,
        sort: '-created',
        $autoCancel: false
      });
      setTransactions(records);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    if (type === 'credit') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    return <TrendingDown className="w-4 h-4 text-[hsl(var(--warning))]" />;
  };

  return (
    <>
      <Helmet>
        <title>Wallet & Credits - AI Video Studio</title>
        <meta name="description" content="Manage your credits and billing" />
      </Helmet>

      <div className="min-h-[calc(100vh-64px)] bg-[hsl(var(--canvas))] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Balance card */}
          <div className="glass-surface rounded-3xl p-8 sm:p-12 text-center shadow-glass-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[hsl(var(--accent-primary))]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-[hsl(var(--accent-secondary))]/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="w-24 h-24 rounded-full bg-[hsl(var(--accent-primary))]/10 border border-[hsl(var(--accent-primary))]/20 flex items-center justify-center mx-auto mb-6 relative z-10">
              <Coins className="w-12 h-12 text-[hsl(var(--accent-primary))]" />
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-4 font-mono tracking-tight relative z-10">
              {currentUser?.credits_balance || 0}
            </h1>
            <p className="text-lg text-[hsl(var(--text-secondary))] relative z-10">Available credits</p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 bg-[hsl(var(--surface))] rounded-2xl p-1 border border-[hsl(var(--border))]">
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'wallet' ? 'bg-[hsl(var(--accent-primary))] text-white' : 'text-[hsl(var(--text-secondary))] hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Credits
            </button>
            <button
              onClick={() => setActiveTab('buy')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'buy' ? 'bg-[hsl(var(--accent-primary))] text-white' : 'text-[hsl(var(--text-secondary))] hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Buy Credits
            </button>
          </div>

          {/* Admin credits info */}
          {activeTab === 'wallet' && (
            <div className="glass-surface rounded-2xl p-8 border border-[hsl(var(--border))]">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
                Admin-Managed Credits
              </h2>
              <p className="text-[hsl(var(--text-secondary))] text-sm leading-relaxed">
                Your credit balance is managed by the platform administrators. Credits are allocated based on your plan or subscription. 
                If you need additional credits, please contact support or purchase them via the <button onClick={() => setActiveTab('buy')} className="text-[hsl(var(--accent-primary))] underline underline-offset-2">Buy Credits</button> tab.
              </p>
            </div>
          )}

          {/* Stripe purchase section */}
          {activeTab === 'buy' && (
            <div>
              <h2 className="text-2xl font-bold mb-8">Purchase Credits</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {STRIPE_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.credits}
                    className={`glass-surface rounded-2xl p-8 relative flex flex-col ${
                      pkg.popular ? 'ring-2 ring-[hsl(var(--accent-primary))]' : 'border border-[hsl(var(--border))] hover:border-[hsl(var(--accent-primary))]/50 transition-colors'
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[hsl(var(--accent-primary))] text-xs font-bold text-white uppercase tracking-wider">
                        Most Popular
                      </div>
                    )}
                    
                    <div className="text-center mb-8 flex-1">
                      <p className="text-5xl font-bold mb-2 text-white">{pkg.credits}</p>
                      <p className="text-[hsl(var(--text-secondary))] uppercase text-sm tracking-wider font-medium">credits</p>
                    </div>

                    <div className="text-center mb-8">
                      <p className="text-4xl font-bold text-white mb-2">${pkg.price}</p>
                      <p className="text-sm text-[hsl(var(--text-secondary))]">
                        ${(pkg.price / pkg.credits).toFixed(3)} per credit
                      </p>
                    </div>

                    <StripeCheckoutButton 
                      creditAmount={pkg.credits}
                      price={pkg.price}
                      popular={pkg.popular}
                      className="w-full h-12 text-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction history */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Transaction History</h2>
              <div className="text-sm text-[hsl(var(--text-secondary))] flex items-center gap-2">
                <Clock className="w-4 h-4" /> Recent
              </div>
            </div>
            
            <div className="glass-surface rounded-2xl overflow-hidden shadow-glass">
              {loading ? (
                <div className="p-16 text-center">
                  <div className="w-8 h-8 border-t-2 border-[hsl(var(--accent-primary))] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-[hsl(var(--text-secondary))]">Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-16 text-center">
                  <Coins className="w-12 h-12 text-[hsl(var(--border))] mx-auto mb-4" />
                  <p className="text-[hsl(var(--text-secondary))]">No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[hsl(var(--surface))] border-b border-[hsl(var(--border))]">
                      <tr>
                        <th className="py-4 px-6 text-sm font-medium text-[hsl(var(--text-secondary))]">Date</th>
                        <th className="py-4 px-6 text-sm font-medium text-[hsl(var(--text-secondary))]">Description</th>
                        <th className="py-4 px-6 text-sm font-medium text-[hsl(var(--text-secondary))] text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-[hsl(var(--elevated))] transition-colors">
                          <td className="py-4 px-6 text-sm font-mono text-[hsl(var(--text-secondary))]">
                            {new Date(transaction.created).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(transaction.type)}
                              <span className="text-sm font-medium">
                                {transaction.description || transaction.type}
                              </span>
                            </div>
                          </td>
                          <td className={`py-4 px-6 text-right font-mono font-medium ${
                            transaction.type === 'credit' ? 'text-emerald-500' : 'text-[hsl(var(--warning))]'
                          }`}>
                            {transaction.type === 'credit' ? '+' : '-'}{Math.abs(transaction.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default WalletPage;
