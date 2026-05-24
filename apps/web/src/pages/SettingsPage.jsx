
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { User, Lock, CreditCard, Bell } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';

const SettingsPage = () => {
  const { currentUser, updateProfile } = useAuth();
  const [name, setName] = useState(currentUser?.name || '');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfile({ name });
      toast('Profile updated');
    } catch (error) {
      toast('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Settings - AI Video Studio</title>
        <meta name="description" content="Manage your account settings" />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--canvas))] p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="glass-surface">
              <TabsTrigger value="profile" className="gap-2">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2">
                <Lock className="w-4 h-4" />
                Account
              </TabsTrigger>
              <TabsTrigger value="billing" className="gap-2">
                <CreditCard className="w-4 h-4" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="glass-surface rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6">Profile Information</h2>
                
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 bg-[hsl(var(--elevated))] text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={currentUser?.email || ''}
                      disabled
                      className="mt-1 bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))]"
                    />
                    <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">
                      Email cannot be changed
                    </p>
                  </div>

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="account">
              <div className="glass-surface rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6">Account Security</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-2">Password</h3>
                    <p className="text-sm text-[hsl(var(--text-secondary))] mb-4">
                      Change your password to keep your account secure
                    </p>
                    <Button variant="outline">Change Password</Button>
                  </div>

                  <div className="pt-6 border-t border-[hsl(var(--border))]">
                    <h3 className="font-medium mb-2">Connected Accounts</h3>
                    <p className="text-sm text-[hsl(var(--text-secondary))] mb-4">
                      Manage your OAuth connections
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 glass-elevated rounded-lg">
                        <span className="text-sm">Google</span>
                        <Button variant="outline" size="sm">Connect</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 glass-elevated rounded-lg">
                        <span className="text-sm">GitHub</span>
                        <Button variant="outline" size="sm">Connect</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="billing">
              <div className="glass-surface rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6">Billing & Credits</h2>
                
                <div className="space-y-6">
                  <div className="glass-elevated rounded-lg p-6 text-center">
                    <p className="text-sm text-[hsl(var(--text-secondary))] mb-2">Current Balance</p>
                    <p className="text-4xl font-bold text-[hsl(var(--accent-primary))]">
                      {currentUser?.credits_balance || 0}
                    </p>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">credits</p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-4">Usage (Last 30 days)</h3>
                    <div className="h-48 glass-elevated rounded-lg flex items-center justify-center">
                      <p className="text-[hsl(var(--text-secondary))]">Usage graph placeholder</p>
                    </div>
                  </div>

                  <Button className="w-full">Buy More Credits</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <div className="glass-surface rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6">Notification Preferences</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 glass-elevated rounded-lg">
                    <div>
                      <p className="font-medium">Video Generation Complete</p>
                      <p className="text-sm text-[hsl(var(--text-secondary))]">
                        Get notified when your videos are ready
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 glass-elevated rounded-lg">
                    <div>
                      <p className="font-medium">Credit Balance Low</p>
                      <p className="text-sm text-[hsl(var(--text-secondary))]">
                        Alert when credits are running low
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 glass-elevated rounded-lg">
                    <div>
                      <p className="font-medium">Product Updates</p>
                      <p className="text-sm text-[hsl(var(--text-secondary))]">
                        News about new features and improvements
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
