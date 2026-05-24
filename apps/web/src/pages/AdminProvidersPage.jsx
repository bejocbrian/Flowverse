
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Switch } from '@/components/ui/switch.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Slider } from '@/components/ui/slider.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Activity, ServerCrash, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient.js';

const AdminProvidersPage = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/admin/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      toast('Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, field, value) => {
    // Optimistic update locally
    setProviders(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    
    try {
      const provider = providers.find(p => p.id === id);
      const payload = { ...provider, [field]: value };
      const res = await apiServerClient.fetch(`/admin/providers/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      toast('Provider settings saved');
    } catch (error) {
      toast('Failed to save settings');
      fetchProviders(); // Revert on failure
    }
  };

  const handleTestConnection = async (id) => {
    try {
      const res = await apiServerClient.fetch(`/admin/providers/${id}/test`, { method: 'POST' });
      const data = await res.json();
      
      setProviders(prev => prev.map(p => p.id === id ? { ...p, status: data.status, last_tested_at: new Date().toISOString() } : p));
      
      if (data.status === 'Operational') {
        toast(`Connection successful (${data.latency}ms)`);
      } else {
        toast(`Connection failed: ${data.status}`);
      }
    } catch (error) {
      toast('Test request failed');
    }
  };

  const renderStatusBadge = (status) => {
    if (status === 'Operational') return <span className="status-operational">Operational</span>;
    if (status === 'Degraded') return <span className="status-degraded">Degraded</span>;
    return <span className="status-down">Down</span>;
  };

  return (
    <>
      <Helmet>
        <title>Providers - Admin</title>
      </Helmet>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Providers Management</h1>
            <p className="text-[hsl(var(--text-secondary))]">Configure AI model providers, API keys, and routing weights.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-[hsl(var(--text-secondary))]">Loading providers...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {providers.map(provider => (
              <div key={provider.id} className="admin-surface rounded-xl p-6 border-[hsl(var(--admin-border))] shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-[hsl(var(--admin-border))]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-[hsl(var(--surface))] border border-[hsl(var(--border))] flex items-center justify-center font-bold text-lg text-[hsl(var(--accent-primary))]">
                      {provider.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-3">
                        {provider.name}
                        {renderStatusBadge(provider.status)}
                      </h3>
                      <p className="text-sm text-[hsl(var(--text-secondary))] font-mono mt-1">
                        Last tested: {provider.last_tested_at ? new Date(provider.last_tested_at).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={provider.enabled} 
                    onCheckedChange={(val) => handleUpdate(provider.id, 'enabled', val)}
                  />
                </div>

                <div className="space-y-6 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-2">API Key</label>
                    <div className="flex gap-2">
                      <Input 
                        type="password" 
                        defaultValue={provider.api_key || '••••••••••••••••'} 
                        className="bg-[hsl(var(--elevated))] font-mono text-sm"
                        onBlur={(e) => {
                          if (e.target.value && !e.target.value.includes('••')) {
                            handleUpdate(provider.id, 'api_key', e.target.value);
                          }
                        }}
                      />
                      <Button variant="outline" size="icon" onClick={() => handleTestConnection(provider.id)}>
                        <Activity className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-2">Default Model</label>
                      <Select value={provider.model || ''} onValueChange={(val) => handleUpdate(provider.id, 'model', val)}>
                        <SelectTrigger className="bg-[hsl(var(--elevated))]">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={`${provider.name.toLowerCase()}-1`}>{provider.name} Gen-1</SelectItem>
                          <SelectItem value={`${provider.name.toLowerCase()}-2`}>{provider.name} Gen-2</SelectItem>
                          <SelectItem value={`${provider.name.toLowerCase()}-3`}>{provider.name} Gen-3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-2 flex justify-between">
                        <span>Routing Weight</span>
                        <span className="font-mono text-[hsl(var(--accent-primary))]">{provider.weight || 0}%</span>
                      </label>
                      <div className="py-2">
                        <Slider 
                          defaultValue={[provider.weight || 0]} 
                          max={100} 
                          step={5}
                          onValueCommit={(vals) => handleUpdate(provider.id, 'weight', vals[0])}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 admin-surface rounded-xl p-8 border-[hsl(var(--admin-border))]">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <ServerCrash className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
            Global Routing Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-2">Default Fallback</label>
              <Select defaultValue="runway">
                <SelectTrigger className="bg-[hsl(var(--elevated))]">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(p => <SelectItem key={p.id} value={p.name.toLowerCase()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-[hsl(var(--text-secondary))] mt-2">Used if all primary nodes fail.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-2">Max Queue Length</label>
              <Input type="number" defaultValue={500} className="bg-[hsl(var(--elevated))] font-mono" />
              <p className="text-xs text-[hsl(var(--text-secondary))] mt-2">Reject jobs if queue exceeds this.</p>
            </div>
            
            <div className="flex items-end">
              <Button className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Save Global Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminProvidersPage;
