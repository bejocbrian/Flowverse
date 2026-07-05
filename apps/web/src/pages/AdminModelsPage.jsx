
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Switch } from '@/components/ui/switch.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Label } from '@/components/ui/label.jsx';
import { ArrowUpDown, GripVertical, Pencil, Trash2, Plus, RefreshCw, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient.js';

const PROVIDERS = ['Google', 'xAI', 'Kling', 'ByteDance', 'Seedance', 'OpenAI'];
const BILLING_OPTIONS = ['per_video', 'per_second', 'per_image'];
const CATEGORIES = ['Free', 'Fast', 'Standard', 'Premium', 'VIP', 'Specialty'];

const emptyModel = {
  key: '',
  label: '',
  provider: 'Google',
  type: 'video',
  billing: 'per_video',
  credits: {},
  creditsPerSecond: {},
  durations: [],
  minDuration: null,
  maxDuration: null,
  aspectRatios: ['16:9', '9:16'],
  imageModes: [],
  maxRefImages: 0,
  freeAccess: false,
  routed: false,
  enabled: false,
  sortOrder: 0,
  vendorModelId: '',
  description: '',
  category: 'Standard',
};

const AdminModelsPage = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModel, setEditModel] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchModels(); }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/model-catalog/all');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      } else {
        toast.error('Failed to load models');
      }
    } catch {
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, field, value) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    try {
      const res = await apiServerClient.fetch(`/model-catalog/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('save failed');
      toast.success(`${field} updated`);
    } catch {
      toast.error('Failed to save');
      fetchModels();
    }
  };

  const handleDelete = async (id, key) => {
    if (!confirm(`Delete model "${key}"? This cannot be undone.`)) return;
    try {
      const res = await apiServerClient.fetch(`/model-catalog/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setModels(prev => prev.filter(m => m.id !== id));
      toast.success(`Model "${key}" deleted`);
    } catch {
      toast.error('Failed to delete model');
    }
  };

  const openEdit = (model) => {
    setEditModel({ ...model });
    setIsNew(false);
    setEditOpen(true);
  };

  const openNew = () => {
    setEditModel({ ...emptyModel });
    setIsNew(true);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editModel.key || !editModel.label || !editModel.provider) {
      toast.error('key, label, and provider are required');
      return;
    }
    setSaving(true);
    try {
      let res;
      if (isNew) {
        res = await apiServerClient.fetch('/model-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editModel),
        });
      } else {
        res = await apiServerClient.fetch(`/model-catalog/${editModel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editModel),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'save failed');
      }
      toast.success(isNew ? 'Model created' : 'Model updated');
      setEditOpen(false);
      fetchModels();
    } catch (err) {
      toast.error(err.message || 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshCache = async () => {
    try {
      const res = await apiServerClient.fetch('/model-catalog/refresh', { method: 'POST' });
      if (res.ok) toast.success('Cache refreshed');
      else toast.error('Failed to refresh cache');
    } catch {
      toast.error('Failed to refresh cache');
    }
  };

  const filtered = models.filter(m => {
    if (filter === 'enabled' && !m.enabled) return false;
    if (filter === 'disabled' && m.enabled) return false;
    if (filter === 'routed' && !m.routed) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.key.includes(q) || m.label.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
    }
    return true;
  });

  const providerCounts = {};
  models.forEach(m => { providerCounts[m.provider] = (providerCounts[m.provider] || 0) + 1; });

  const getPriceDisplay = (m) => {
    if (m.billing === 'per_video' && m.credits) {
      const vals = Object.values(m.credits).filter(Boolean);
      if (vals.length) return `${Math.min(...vals)}-${Math.max(...vals)} cr`;
      return '-';
    }
    if (m.billing === 'per_second' && m.creditsPerSecond) {
      const vals = Object.values(m.creditsPerSecond).filter(Boolean);
      if (vals.length) return `${Math.min(...vals)}-${Math.max(...vals)} cr/s`;
      return '-';
    }
    return '-';
  };

  return (
    <>
      <Helmet><title>Models - Admin</title></Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Model Catalog</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
              Manage models, pricing, and availability. {models.length} total, {models.filter(m => m.enabled).length} enabled.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshCache}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh Cache
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />
              Add Model
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <div className="flex gap-1 bg-[hsl(var(--surface))] p-1 rounded-lg">
            {['all', 'enabled', 'disabled', 'routed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-[hsl(var(--accent-primary))] text-white'
                    : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="ml-auto text-xs text-[hsl(var(--text-secondary))]">
            {Object.entries(providerCounts).map(([p, c]) => (
              <span key={p} className="mr-3">{p}: {c}</span>
            ))}
          </div>
        </div>

        {/* Models Table */}
        {loading ? (
          <div className="text-center py-12 text-[hsl(var(--text-secondary))]">Loading...</div>
        ) : (
          <div className="bg-[hsl(var(--surface))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Model</th>
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Billing</th>
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Pricing</th>
                  <th className="text-left px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Category</th>
                  <th className="text-center px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Routed</th>
                  <th className="text-center px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Enabled</th>
                  <th className="text-right px-4 py-3 font-medium text-[hsl(var(--text-secondary))]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--canvas))] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-xs text-[hsl(var(--text-secondary))] font-mono">{m.key}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--text-secondary))]">{m.provider}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[hsl(var(--canvas))]">
                        {m.billing}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{getPriceDisplay(m)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[hsl(var(--canvas))]">
                        {m.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={m.routed}
                        onCheckedChange={(v) => handleToggle(m.id, 'routed', v)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={m.enabled}
                        onCheckedChange={(v) => handleToggle(m.id, 'enabled', v)}
                        disabled={!m.routed}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-md hover:bg-[hsl(var(--canvas))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.key)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-[hsl(var(--text-secondary))] hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[hsl(var(--text-secondary))]">
                      No models found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Create Model' : `Edit: ${editModel?.key}`}</DialogTitle>
          </DialogHeader>

          {editModel && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Key *</Label>
                <Input
                  value={editModel.key}
                  onChange={(e) => setEditModel(p => ({ ...p, key: e.target.value }))}
                  placeholder="e.g. kling-3.0"
                  disabled={!isNew}
                />
              </div>
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input
                  value={editModel.label}
                  onChange={(e) => setEditModel(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. Kling 3.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Provider *</Label>
                <Select value={editModel.provider} onValueChange={(v) => setEditModel(p => ({ ...p, provider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing *</Label>
                <Select value={editModel.billing} onValueChange={(v) => setEditModel(p => ({ ...p, billing: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editModel.category} onValueChange={(v) => setEditModel(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vendor Model ID</Label>
                <Input
                  value={editModel.vendorModelId || ''}
                  onChange={(e) => setEditModel(p => ({ ...p, vendorModelId: e.target.value }))}
                  placeholder="Same as key if empty"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={editModel.sortOrder || 0}
                  onChange={(e) => setEditModel(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Ref Images</Label>
                <Input
                  type="number"
                  value={editModel.maxRefImages || 0}
                  onChange={(e) => setEditModel(p => ({ ...p, maxRefImages: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editModel.description || ''}
                  onChange={(e) => setEditModel(p => ({ ...p, description: e.target.value }))}
                  placeholder="Short description"
                />
              </div>
              <div className="space-y-2">
                <Label>Durations (comma-separated)</Label>
                <Input
                  value={(editModel.durations || []).join(', ')}
                  onChange={(e) => setEditModel(p => ({
                    ...p,
                    durations: e.target.value.split(',').map(s => parseInt(s.trim())).filter(Boolean)
                  }))}
                  placeholder="e.g. 5, 10, 15"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Duration</Label>
                <Input
                  type="number"
                  value={editModel.minDuration ?? ''}
                  onChange={(e) => setEditModel(p => ({ ...p, minDuration: e.target.value ? parseInt(e.target.value) : null }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Duration</Label>
                <Input
                  type="number"
                  value={editModel.maxDuration ?? ''}
                  onChange={(e) => setEditModel(p => ({ ...p, maxDuration: e.target.value ? parseInt(e.target.value) : null }))}
                />
              </div>

              {/* Credits JSON */}
              <div className="col-span-2 space-y-2">
                <Label>
                  {editModel.billing === 'per_second' ? 'Credits Per Second (JSON)' : 'Credits (JSON)'}
                </Label>
                <Input
                  value={JSON.stringify(editModel.billing === 'per_second' ? editModel.creditsPerSecond : editModel.credits)}
                  onChange={(e) => {
                    try {
                      const val = JSON.parse(e.target.value);
                      if (editModel.billing === 'per_second') setEditModel(p => ({ ...p, creditsPerSecond: val }));
                      else setEditModel(p => ({ ...p, credits: val }));
                    } catch {}
                  }}
                  placeholder='{"720p": 30, "1080p": 50}'
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Aspect Ratios</Label>
                <div className="flex gap-2">
                  {['16:9', '9:16', '1:1', '4:3', '3:4'].map(ar => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => {
                        setEditModel(p => ({
                          ...p,
                          aspectRatios: p.aspectRatios.includes(ar)
                            ? p.aspectRatios.filter(a => a !== ar)
                            : [...p.aspectRatios, ar]
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editModel.aspectRatios?.includes(ar)
                          ? 'bg-[hsl(var(--accent-primary))]/10 border-[hsl(var(--accent-primary))] text-[hsl(var(--accent-primary))]'
                          : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Image Modes</Label>
                <div className="flex gap-2">
                  {['frame', 'ingredient', 'reference'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setEditModel(p => ({
                          ...p,
                          imageModes: p.imageModes.includes(mode)
                            ? p.imageModes.filter(m => m !== mode)
                            : [...p.imageModes, mode]
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editModel.imageModes?.includes(mode)
                          ? 'bg-[hsl(var(--accent-primary))]/10 border-[hsl(var(--accent-primary))] text-[hsl(var(--accent-primary))]'
                          : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editModel.freeAccess}
                    onCheckedChange={(v) => setEditModel(p => ({ ...p, freeAccess: v }))}
                  />
                  <Label>Free Access</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editModel.routed}
                    onCheckedChange={(v) => setEditModel(p => ({ ...p, routed: v }))}
                  />
                  <Label>Routed</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editModel.enabled}
                    onCheckedChange={(v) => setEditModel(p => ({ ...p, enabled: v }))}
                  />
                  <Label>Enabled</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminModelsPage;
