
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Palette, PlaySquare, CreditCard, Activity, Save, Settings2, Clock, Layers } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState({});
  const [featureFlags, setFeatureFlags] = useState({
    show_duration_selector: false,
    default_duration: 8,
    available_durations: [4, 6, 8],
    allow_multi_generation: false,
    max_generations_per_request: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        
        // Parse feature_flags if present
        if (data.feature_flags) {
          const flags = typeof data.feature_flags === 'string' 
            ? JSON.parse(data.feature_flags) 
            : data.feature_flags;
          setFeatureFlags(flags);
        }
      }
    } catch (error) {
      toast('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Prepare settings with feature_flags as JSON
      const settingsToSave = {
        ...settings,
        feature_flags: featureFlags,
      };
      
      const res = await apiServerClient.fetch('/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave })
      });
      if (res.ok) {
        toast('Settings saved successfully');
        // Re-read from the server so we display whatever it actually
        // persisted (and benefit from any value normalization).
        await fetchSettings();
      } else {
        toast('Failed to save settings');
      }
    } catch (error) {
      toast('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateFeatureFlag = (key, value) => {
    setFeatureFlags(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="p-8 text-[hsl(var(--text-secondary))]">Loading configuration...</div>;

  return (
    <>
      <Helmet>
        <title>Settings - Admin</title>
      </Helmet>

      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold mb-1">System Settings</h1>
          <p className="text-[hsl(var(--text-secondary))]">Configure global platform behavior and rules.</p>
        </div>

        <form onSubmit={handleSave}>
          <Tabs defaultValue="features" className="w-full">
            <TabsList className="bg-[hsl(var(--admin-surface))] border border-[hsl(var(--admin-border))] mb-6 w-full justify-start overflow-x-auto h-auto p-1">
              <TabsTrigger value="features" className="data-[state=active]:bg-[hsl(var(--elevated))] py-2 px-4 gap-2">
                <Settings2 className="w-4 h-4" /> Feature Flags
              </TabsTrigger>
              <TabsTrigger value="branding" className="data-[state=active]:bg-[hsl(var(--elevated))] py-2 px-4 gap-2">
                <Palette className="w-4 h-4" /> Branding
              </TabsTrigger>
              <TabsTrigger value="generation" className="data-[state=active]:bg-[hsl(var(--elevated))] py-2 px-4 gap-2">
                <PlaySquare className="w-4 h-4" /> Generation
              </TabsTrigger>
              <TabsTrigger value="billing" className="data-[state=active]:bg-[hsl(var(--elevated))] py-2 px-4 gap-2">
                <CreditCard className="w-4 h-4" /> Billing
              </TabsTrigger>
              <TabsTrigger value="ratelimits" className="data-[state=active]:bg-[hsl(var(--elevated))] py-2 px-4 gap-2">
                <Activity className="w-4 h-4" /> Rate Limits
              </TabsTrigger>
            </TabsList>

            <div className="admin-surface rounded-xl border border-[hsl(var(--admin-border))] p-6 shadow-sm">
              {/* Feature Flags Tab */}
              <TabsContent value="features" className="mt-0 space-y-6">
                <h3 className="text-lg font-bold border-b border-[hsl(var(--admin-border))] pb-4 mb-4">Feature Flags</h3>
                <p className="text-[hsl(var(--text-secondary))] text-sm mb-6">
                  Control which features are visible to users. Disable features to simplify the UI or enforce defaults.
                </p>

                {/* Duration Selector Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[hsl(var(--elevated))] rounded-lg border border-[hsl(var(--admin-border))]">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
                      <div>
                        <Label className="text-white font-medium">Show Duration Selector</Label>
                        <p className="text-[hsl(var(--text-secondary))] text-sm">
                          When disabled, users cannot change duration and it defaults to the value below.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={featureFlags.show_duration_selector || false}
                      onCheckedChange={(checked) => updateFeatureFlag('show_duration_selector', checked)}
                    />
                  </div>

                  {/* Default Duration (shown when selector is hidden) */}
                  <div className="flex items-center justify-between p-4 bg-[hsl(var(--elevated))] rounded-lg border border-[hsl(var(--admin-border))]">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center text-[hsl(var(--text-secondary))]">
                        <span className="text-xs font-bold">{featureFlags.default_duration}s</span>
                      </div>
                      <div>
                        <Label className="text-white font-medium">Default Duration</Label>
                        <p className="text-[hsl(var(--text-secondary))] text-sm">
                          The duration used when the selector is hidden or when users don't select one.
                        </p>
                      </div>
                    </div>
                    <Select 
                      value={featureFlags.default_duration?.toString() || '8'} 
                      onValueChange={(val) => updateFeatureFlag('default_duration', parseInt(val))}
                    >
                      <SelectTrigger className="w-32 bg-[hsl(var(--canvas))] border-[hsl(var(--admin-border))]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 Seconds</SelectItem>
                        <SelectItem value="6">6 Seconds</SelectItem>
                        <SelectItem value="8">8 Seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Available Durations (when selector is shown) */}
                  {featureFlags.show_duration_selector && (
                    <div className="flex items-center justify-between p-4 bg-[hsl(var(--elevated))] rounded-lg border border-[hsl(var(--admin-border))]">
                      <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
                        <div>
                          <Label className="text-white font-medium">Available Durations</Label>
                          <p className="text-[hsl(var(--text-secondary))] text-sm">
                            Select which duration options users can choose from.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {[4, 6, 8].map(dur => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => {
                              const current = featureFlags.available_durations || [];
                              const updated = current.includes(dur)
                                ? current.filter(d => d !== dur)
                                : [...current, dur].sort((a, b) => a - b);
                              updateFeatureFlag('available_durations', updated);
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                              (featureFlags.available_durations || [4, 6, 8]).includes(dur)
                                ? 'bg-[hsl(var(--accent-primary))] text-white'
                                : 'bg-[hsl(var(--canvas))] text-[hsl(var(--text-secondary))] hover:text-white'
                            }`}
                          >
                            {dur}s
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-[hsl(var(--admin-border))] my-6"></div>

                {/* Multi-Generation Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[hsl(var(--elevated))] rounded-lg border border-[hsl(var(--admin-border))]">
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
                      <div>
                        <Label className="text-white font-medium">Allow Multi-Generation</Label>
                        <p className="text-[hsl(var(--text-secondary))] text-sm">
                          When disabled, users can only generate 1 video at a time (rate limiting).
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={featureFlags.allow_multi_generation || false}
                      onCheckedChange={(checked) => updateFeatureFlag('allow_multi_generation', checked)}
                    />
                  </div>

                  {featureFlags.allow_multi_generation && (
                    <div className="flex items-center justify-between p-4 bg-[hsl(var(--elevated))] rounded-lg border border-[hsl(var(--admin-border))]">
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
                        <div>
                          <Label className="text-white font-medium">Max Generations Per Request</Label>
                          <p className="text-[hsl(var(--text-secondary))] text-sm">
                            Maximum number of videos a user can generate in a single request.
                          </p>
                        </div>
                      </div>
                      <Select 
                        value={featureFlags.max_generations_per_request?.toString() || '1'} 
                        onValueChange={(val) => updateFeatureFlag('max_generations_per_request', parseInt(val))}
                      >
                        <SelectTrigger className="w-32 bg-[hsl(var(--canvas))] border-[hsl(var(--admin-border))]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Video</SelectItem>
                          <SelectItem value="2">2 Videos</SelectItem>
                          <SelectItem value="3">3 Videos</SelectItem>
                          <SelectItem value="4">4 Videos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="branding" className="mt-0 space-y-6">
                <h3 className="text-lg font-bold border-b border-[hsl(var(--admin-border))] pb-4 mb-4">Platform Branding</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">App Name</Label>
                    <Input 
                      value={settings.app_name || ''} 
                      onChange={(e) => updateSetting('app_name', e.target.value)}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Support Email</Label>
                    <Input 
                      type="email"
                      value={settings.support_email || ''} 
                      onChange={(e) => updateSetting('support_email', e.target.value)}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Logo URL</Label>
                    <Input 
                      value={settings.logo_url || ''} 
                      onChange={(e) => updateSetting('logo_url', e.target.value)}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white font-mono" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Primary Color</Label>
                    <Input
                      type="text"
                      value={settings.primary_color || ''}
                      onChange={(e) => updateSetting('primary_color', e.target.value)}
                      placeholder="#6366f1"
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white font-mono"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="generation" className="mt-0 space-y-6">
                <h3 className="text-lg font-bold border-b border-[hsl(var(--admin-border))] pb-4 mb-4">Default Generation Rules</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Default Aspect Ratio</Label>
                    <Select value={settings.default_aspect_ratio || '16:9'} onValueChange={(val) => updateSetting('default_aspect_ratio', val)}>
                      <SelectTrigger className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                        <SelectItem value="1:1">1:1</SelectItem>
                        <SelectItem value="4:3">4:3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Default Quality</Label>
                    <Select value={settings.default_quality || 'Standard'} onValueChange={(val) => updateSetting('default_quality', val)}>
                      <SelectTrigger className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fast">Fast</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Hard Cap Max Duration (s)</Label>
                    <Input 
                      type="number"
                      value={settings.max_video_duration || 10} 
                      onChange={(e) => updateSetting('max_video_duration', parseInt(e.target.value))}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white font-mono" 
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="billing" className="mt-0 space-y-6">
                <h3 className="text-lg font-bold border-b border-[hsl(var(--admin-border))] pb-4 mb-4">Billing & Credits</h3>
                <div className="space-y-2 mb-6">
                  <Label className="text-[hsl(var(--text-secondary))] flex justify-between">
                    <span>Stripe Public Key</span>
                    <span className="text-xs">Managed in Environment</span>
                  </Label>
                  <Input 
                    disabled 
                    value="pk_live_••••••••••••••••" 
                    className="bg-[hsl(var(--admin-hover))] border-[hsl(var(--admin-border))] text-[hsl(var(--text-secondary))] font-mono opacity-50 cursor-not-allowed" 
                  />
                </div>
              </TabsContent>

              <TabsContent value="ratelimits" className="mt-0 space-y-6">
                <h3 className="text-lg font-bold border-b border-[hsl(var(--admin-border))] pb-4 mb-4">Concurrency & Tier Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Free Tier Daily Limit</Label>
                    <Input 
                      type="number"
                      value={settings.free_tier_limit || 5} 
                      onChange={(e) => updateSetting('free_tier_limit', parseInt(e.target.value))}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white font-mono" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Pro Tier Daily Limit</Label>
                    <Input 
                      type="number"
                      value={settings.pro_tier_limit || 50} 
                      onChange={(e) => updateSetting('pro_tier_limit', parseInt(e.target.value))}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white font-mono" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[hsl(var(--text-secondary))]">Studio Tier Daily Limit</Label>
                    <Input 
                      type="number"
                      value={settings.studio_tier_limit || 200} 
                      onChange={(e) => updateSetting('studio_tier_limit', parseInt(e.target.value))}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white font-mono" 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label className="text-[hsl(var(--text-secondary))]">System-Wide Max Concurrent Jobs</Label>
                    <Input 
                      type="number"
                      value={settings.max_concurrent_generations || 10} 
                      onChange={(e) => updateSetting('max_concurrent_generations', parseInt(e.target.value))}
                      className="bg-[hsl(var(--elevated))] border-[hsl(var(--admin-border))] text-white font-mono max-w-[200px]" 
                    />
                  </div>
                </div>
              </TabsContent>

              <div className="mt-8 pt-6 border-t border-[hsl(var(--admin-border))] flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </div>
          </Tabs>
        </form>
      </div>
    </>
  );
};

export default AdminSettingsPage;
