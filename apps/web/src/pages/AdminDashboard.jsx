
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Users, Film, DollarSign, ListTodo, Activity, Server, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalUsers: 0, videosGeneratedToday: 0, apiCosts: 0, activeQueue: 0 });
  const [chartData, setChartData] = useState([]);
  const [recentGens, setRecentGens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [overviewRes, chartRes, recentRes] = await Promise.all([
        apiServerClient.fetch('/admin/analytics/overview'),
        apiServerClient.fetch('/admin/analytics/generations'),
        apiServerClient.fetch('/admin/analytics/recent-generations')
      ]);
      
      if (overviewRes.ok) setStats(await overviewRes.json());
      if (chartRes.ok) setChartData(await chartRes.json());
      if (recentRes.ok) setRecentGens(await recentRes.json());
      
    } catch (error) {
      toast('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-500' },
    { title: 'Videos Generated Today', value: stats.videosGeneratedToday.toLocaleString(), icon: Film, color: 'text-emerald-500' },
    { title: 'API Costs (USD)', value: `$${stats.apiCosts.toFixed(2)}`, icon: DollarSign, color: 'text-amber-500' },
    { title: 'Active Queue', value: stats.activeQueue.toLocaleString(), icon: ListTodo, color: 'text-purple-500' }
  ];

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - VideoAI</title>
      </Helmet>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="admin-surface rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-[hsl(var(--admin-hover))] ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-[hsl(var(--text-secondary))] text-sm font-medium mb-1">{stat.title}</h3>
                <p className="text-3xl font-bold font-mono tracking-tight">{loading ? '-' : stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Charts & Actions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 admin-surface rounded-xl p-6">
            <h3 className="text-lg font-bold mb-6">Generations (Last 7 Days)</h3>
            <div className="h-72">
              {!loading && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--admin-border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--text-secondary))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--text-secondary))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--elevated))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--text-primary))' }}
                    />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--accent-primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--accent-primary))' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[hsl(var(--text-secondary))]">
                  {loading ? 'Loading chart...' : 'No data available'}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="admin-surface rounded-xl p-6 flex flex-col">
            <h3 className="text-lg font-bold mb-6">Quick Actions</h3>
            <div className="space-y-4 flex-1">
              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto py-4 border-[hsl(var(--admin-border))] hover:bg-[hsl(var(--admin-hover))]"
                onClick={() => fetchDashboardData()}
              >
                <Activity className="w-5 h-5 mr-3 text-[hsl(var(--text-secondary))]" />
                <div>
                  <div className="font-medium">Refresh Stats</div>
                  <div className="text-xs text-[hsl(var(--text-secondary))] mt-1">Reload analytics from the database</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto py-4 border-[hsl(var(--admin-border))] hover:bg-[hsl(var(--admin-hover))]"
                asChild
              >
                <a href="/admin/providers">
                  <Server className="w-5 h-5 mr-3 text-[hsl(var(--text-secondary))]" />
                  <div>
                    <div className="font-medium">Manage Providers</div>
                    <div className="text-xs text-[hsl(var(--text-secondary))] mt-1">Configure and test AI providers</div>
                  </div>
                </a>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto py-4 border-[hsl(var(--admin-border))] hover:bg-[hsl(var(--admin-hover))]"
                asChild
              >
                <a href="/admin/users">
                  <FileText className="w-5 h-5 mr-3 text-[hsl(var(--text-secondary))]" />
                  <div>
                    <div className="font-medium">Manage Users</div>
                    <div className="text-xs text-[hsl(var(--text-secondary))] mt-1">View, ban, or adjust credits</div>
                  </div>
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Generations Table */}
        <div className="admin-surface rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[hsl(var(--admin-border))]">
            <h3 className="text-lg font-bold">Recent Generations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[hsl(var(--admin-hover))]">
                  <th className="py-3 px-6 text-sm font-medium text-[hsl(var(--text-secondary))]">User</th>
                  <th className="py-3 px-6 text-sm font-medium text-[hsl(var(--text-secondary))]">Prompt Preview</th>
                  <th className="py-3 px-6 text-sm font-medium text-[hsl(var(--text-secondary))]">Provider</th>
                  <th className="py-3 px-6 text-sm font-medium text-[hsl(var(--text-secondary))]">Status</th>
                  <th className="py-3 px-6 text-sm font-medium text-[hsl(var(--text-secondary))]">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--admin-border))]">
                {loading ? (
                  <tr><td colSpan="5" className="p-6 text-center text-[hsl(var(--text-secondary))]">Loading...</td></tr>
                ) : recentGens.length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-[hsl(var(--text-secondary))]">No recent generations</td></tr>
                ) : (
                  recentGens.map((gen, idx) => (
                    <tr key={idx} className="hover:bg-[hsl(var(--admin-hover))] transition-colors">
                      <td className="py-3 px-6 text-sm truncate max-w-[150px]">{gen.userEmail}</td>
                      <td className="py-3 px-6 text-sm truncate max-w-[200px]" title={gen.promptPreview}>{gen.promptPreview}</td>
                      <td className="py-3 px-6 text-sm font-mono text-[hsl(var(--text-secondary))]">{gen.provider}</td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          gen.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                          gen.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {gen.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-sm font-mono text-[hsl(var(--text-secondary))]">{new Date(gen.time).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
