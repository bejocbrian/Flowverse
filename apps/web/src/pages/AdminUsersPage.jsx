import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Search, MoreVertical, ShieldAlert, ShieldMinus, Coins, Trash2, User as UserIcon, Crown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Credit modal
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditTargetUser, setCreditTargetUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditAction, setCreditAction] = useState('add');

  // Grant/Revoke paid modal
  const [paidModalOpen, setPaidModalOpen] = useState(false);
  const [paidTargetUser, setPaidTargetUser] = useState(null);
  const [paidAction, setPaidAction] = useState('grant'); // 'grant' | 'revoke'
  const [paidReason, setPaidReason] = useState('');
  const [paidLoading, setPaidLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page, filter, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiServerClient.fetch(
        `/admin/users?page=${page}&limit=25&search=${encodeURIComponent(search)}&filter=${filter}`
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      toast('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, userId) => {
    try {
      let endpoint = '';
      let method = 'POST';
      if (action === 'ban') endpoint = `/admin/users/${userId}/ban`;
      if (action === 'unban') endpoint = `/admin/users/${userId}/unban`;
      if (action === 'delete') {
        if (!window.confirm('Delete user? This cannot be undone.')) return;
        endpoint = `/admin/users/${userId}`;
        method = 'DELETE';
      }
      const res = await apiServerClient.fetch(endpoint, { method });
      if (res.ok) {
        toast(`Action ${action} successful`);
        fetchUsers();
      }
    } catch {
      toast(`Failed to ${action} user`);
    }
  };

  const handleBulkBan = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Ban ${selectedIds.size} selected user${selectedIds.size === 1 ? '' : 's'}?`)) return;
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => apiServerClient.fetch(`/admin/users/${id}/ban`, { method: 'POST' }))
    );
    const failed = results.filter((r) => r.status === 'rejected' || (r.value && !r.value.ok)).length;
    toast(failed === 0 ? `Banned ${ids.length} user(s)` : `Banned ${ids.length - failed} of ${ids.length}; ${failed} failed`);
    setSelectedIds(new Set());
    fetchUsers();
  };

  const submitCredits = async () => {
    if (!creditAmount || !creditReason.trim()) {
      toast('Amount and reason are required');
      return;
    }
    const signedAmount = creditAction === 'deduct'
      ? -Math.abs(parseInt(creditAmount))
      : Math.abs(parseInt(creditAmount));
    try {
      const res = await apiServerClient.fetch(`/admin/users/${creditTargetUser.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: signedAmount, reason: creditReason.trim() }),
      });
      if (res.ok) {
        toast(creditAction === 'add' ? 'Credits added' : 'Credits deducted');
        setCreditModalOpen(false);
        setCreditAmount('');
        setCreditReason('');
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Failed to adjust credits');
      }
    } catch {
      toast('Failed to adjust credits');
    }
  };

  const openPaidModal = (user, action) => {
    setPaidTargetUser(user);
    setPaidAction(action);
    setPaidReason('');
    setPaidModalOpen(true);
  };

  const submitPaidAction = async () => {
    if (!paidTargetUser) return;
    setPaidLoading(true);
    try {
      const endpoint = paidAction === 'grant'
        ? `/admin/users/${paidTargetUser.id}/grant-paid`
        : `/admin/users/${paidTargetUser.id}/revoke-paid`;
      const res = await apiServerClient.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: paidReason.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.already_paid) {
          toast('User is already on the paid tier');
        } else {
          toast(paidAction === 'grant' ? 'Paid tier granted' : 'Paid tier revoked');
        }
        setPaidModalOpen(false);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || `Failed to ${paidAction} paid tier`);
      }
    } catch {
      toast(`Failed to ${paidAction} paid tier`);
    } finally {
      setPaidLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length && users.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map((u) => u.id)));
  };

  const toggleSelect = (id) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedIds(s);
  };

  return (
    <>
      <Helmet>
        <title>Users - Admin</title>
      </Helmet>

      <div className="space-y-6 flex flex-col h-full">
        <div>
          <h1 className="text-3xl font-bold mb-1">Users Management</h1>
          <p className="text-[hsl(var(--text-secondary))]">
            View and manage customer accounts, credits, and access. Grant or revoke paid tier for manual payments.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--text-secondary))]" />
            <Input
              placeholder="Search email or name..."
              className="pl-9 bg-[hsl(var(--admin-surface))] border-[hsl(var(--admin-border))]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
            {['All', 'Active', 'Banned', 'Paid', 'Free'].map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setFilter(f); setPage(1); }}
                className={filter !== f ? 'border-[hsl(var(--admin-border))] bg-[hsl(var(--admin-surface))] hover:bg-[hsl(var(--admin-hover))]' : ''}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="admin-surface rounded-xl border border-[hsl(var(--admin-border))] flex-1 flex flex-col overflow-hidden">
          {selectedIds.size > 0 && (
            <div className="bg-[hsl(var(--accent-primary))]/10 border-b border-[hsl(var(--admin-border))] px-6 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-[hsl(var(--accent-primary))]">
                {selectedIds.size} users selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleBulkBan} className="border-red-500/20 text-red-500 hover:bg-red-500/10">
                  Bulk Ban
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-[hsl(var(--admin-hover))] sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 w-12 border-b border-[hsl(var(--admin-border))]">
                    <Checkbox
                      checked={selectedIds.size === users.length && users.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--admin-border))]">User</th>
                  <th className="py-3 px-4 text-sm font-medium text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--admin-border))]">Tier</th>
                  <th className="py-3 px-4 text-sm font-medium text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--admin-border))]">Balance</th>
                  <th className="py-3 px-4 text-sm font-medium text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--admin-border))]">Joined</th>
                  <th className="py-3 px-4 text-sm font-medium text-[hsl(var(--text-secondary))] border-b border-[hsl(var(--admin-border))]">Status</th>
                  <th className="py-3 px-4 text-right border-b border-[hsl(var(--admin-border))] w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--admin-border))]">
                {loading ? (
                  <tr><td colSpan="7" className="p-8 text-center text-[hsl(var(--text-secondary))]">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-[hsl(var(--text-secondary))]">No users found</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-[hsl(var(--admin-hover))] transition-colors group">
                      <td className="py-3 px-4">
                        <Checkbox checked={selectedIds.has(user.id)} onCheckedChange={() => toggleSelect(user.id)} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[hsl(var(--accent-primary))]/20 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{user.name || 'Unnamed'}</div>
                            <div className="text-xs text-[hsl(var(--text-secondary))]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {user.is_paid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400">
                            <Crown className="w-3 h-3" /> Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 text-white/40">
                            Free
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm">{user.credits_balance || 0}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[hsl(var(--text-secondary))]">
                        {new Date(user.created).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {user.banned_at ? (
                          <span className="status-down">Banned</span>
                        ) : (
                          <span className="status-operational">Active</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 bg-[hsl(var(--elevated))] border-[hsl(var(--border))] text-white">
                            {/* Tier management */}
                            {!user.is_paid ? (
                              <DropdownMenuItem onClick={() => openPaidModal(user, 'grant')} className="text-amber-400 focus:text-amber-400">
                                <Crown className="w-4 h-4 mr-2" /> Grant Paid Tier
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => openPaidModal(user, 'revoke')} className="text-white/60 focus:text-white">
                                <ShieldMinus className="w-4 h-4 mr-2" /> Revoke Paid Tier
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onClick={() => { setCreditTargetUser(user); setCreditModalOpen(true); }}>
                              <Coins className="w-4 h-4 mr-2" /> Adjust Credits
                            </DropdownMenuItem>
                            {user.banned_at ? (
                              <DropdownMenuItem onClick={() => handleAction('unban', user.id)}>
                                <ShieldAlert className="w-4 h-4 mr-2" /> Unban User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleAction('ban', user.id)} className="text-red-400 focus:text-red-400">
                                <ShieldAlert className="w-4 h-4 mr-2" /> Ban User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleAction('delete', user.id)} className="text-red-400 focus:text-red-400">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-[hsl(var(--admin-border))] flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--text-secondary))]">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Credits modal */}
      <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
        <DialogContent className="sm:max-w-sm bg-[hsl(var(--surface))] border-[hsl(var(--border))] text-white">
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              User: <span className="text-white font-medium">{creditTargetUser?.email}</span>
            </p>
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              Current balance: <span className="text-white font-mono font-medium">{creditTargetUser?.credits_balance ?? '—'}</span>
            </p>
            <div className="flex bg-[hsl(var(--elevated))] p-1 rounded-xl">
              <button
                onClick={() => setCreditAction('add')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${creditAction === 'add' ? 'bg-emerald-600 text-white' : 'text-[hsl(var(--text-secondary))] hover:text-white'}`}
              >Add</button>
              <button
                onClick={() => setCreditAction('deduct')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${creditAction === 'deduct' ? 'bg-red-600 text-white' : 'text-[hsl(var(--text-secondary))] hover:text-white'}`}
              >Deduct</button>
            </div>
            <Input type="number" min="1" placeholder="Amount (e.g. 100)" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="bg-[hsl(var(--elevated))] text-white" />
            <Input type="text" placeholder="Reason (required)" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} className="bg-[hsl(var(--elevated))] text-white" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreditModalOpen(false); setCreditAmount(''); setCreditReason(''); }}>Cancel</Button>
            <Button onClick={submitCredits} className={creditAction === 'deduct' ? 'bg-red-600 hover:bg-red-700' : ''}>
              {creditAction === 'add' ? 'Add Credits' : 'Deduct Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant / Revoke Paid Tier modal */}
      <Dialog open={paidModalOpen} onOpenChange={setPaidModalOpen}>
        <DialogContent className="sm:max-w-sm bg-[hsl(var(--surface))] border-[hsl(var(--border))] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paidAction === 'grant' ? <Crown className="w-5 h-5 text-amber-400" /> : <ShieldMinus className="w-5 h-5 text-white/50" />}
              {paidAction === 'grant' ? 'Grant Paid Tier' : 'Revoke Paid Tier'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              User: <span className="text-white font-medium">{paidTargetUser?.email}</span>
            </p>
            {paidAction === 'grant' ? (
              <p className="text-sm text-[hsl(var(--text-secondary))]">
                This will unlock all paid models (Veo 3.1 Fast, Veo 3.1, Grok 3) for this user. Use this after confirming a manual UPI payment.
              </p>
            ) : (
              <p className="text-sm text-red-400/80">
                This will remove the paid tier and revert the user to free access (Veo 3.1 Lite only). Their credit balance is not affected.
              </p>
            )}
            <Input
              type="text"
              placeholder={paidAction === 'grant' ? 'Reason (e.g. Manual UPI payment ₹299)' : 'Reason (optional)'}
              value={paidReason}
              onChange={(e) => setPaidReason(e.target.value)}
              className="bg-[hsl(var(--elevated))] text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidModalOpen(false)}>Cancel</Button>
            <Button
              onClick={submitPaidAction}
              disabled={paidLoading}
              className={paidAction === 'revoke' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {paidLoading ? 'Processing…' : paidAction === 'grant' ? 'Grant Paid Tier' : 'Revoke Paid Tier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminUsersPage;
