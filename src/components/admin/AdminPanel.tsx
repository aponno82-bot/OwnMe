import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile, Report, Announcement, Post, Story } from '../../types';
import { 
  Shield, 
  Users, 
  Flag, 
  Megaphone, 
  XCircle, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  AlertTriangle,
  Loader2,
  Plus,
  UserCheck,
  UserX,
  LayoutDashboard,
  FileText,
  BarChart3,
  TrendingUp,
  Activity,
  UserPlus,
  Star,
  Settings,
  Terminal,
  Image as ImageIcon
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import VerificationBadge from '../VerificationBadge';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../../lib/useAuth';

export default function AdminPanel() {
  const { user, profile: myProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'content' | 'stories' | 'reports' | 'announcements' | 'logs'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [contentType, setContentType] = useState<'all' | 'post' | 'reel'>('all');
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', target_role: 'all' as any });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    pendingReports: 0,
    activeAnnouncements: 0
  });

  const chartData = [
    { name: 'Mon', users: 400, posts: 240 },
    { name: 'Tue', users: 300, posts: 139 },
    { name: 'Wed', users: 200, posts: 980 },
    { name: 'Thu', users: 278, posts: 390 },
    { name: 'Fri', users: 189, posts: 480 },
    { name: 'Sat', users: 239, posts: 380 },
    { name: 'Sun', users: 349, posts: 430 },
  ];

  useEffect(() => {
    if (myProfile?.role === 'admin') {
      fetchData();
    }
  }, [activeTab, myProfile]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const [usersCount, postsCount, reportsCount, annCount] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('posts').select('*', { count: 'exact', head: true }),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('announcements').select('*', { count: 'exact', head: true })
        ]);

        setStats({
          totalUsers: usersCount.count || 0,
          totalPosts: postsCount.count || 0,
          pendingReports: reportsCount.count || 0,
          activeAnnouncements: annCount.count || 0
        });
      } else if (activeTab === 'users') {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .order('username', { ascending: true });
        if (data) setUsers(data);
      } else if (activeTab === 'content') {
        let query = supabase.from('posts').select('*, profiles(*)');
        if (contentType !== 'all') {
          query = query.eq('post_type', contentType);
        }
        const { data } = await query.order('created_at', { ascending: false }).limit(50);
        if (data) setPosts(data);
      } else if (activeTab === 'stories') {
        const { data } = await supabase
          .from('stories')
          .select('*, profiles(*)')
          .order('created_at', { ascending: false });
        if (data) setStories(data);
      } else if (activeTab === 'reports') {
        const { data } = await supabase
          .from('reports')
          .select('*, reporter:profiles!reporter_id(*), target_user:profiles!target_id(*)')
          .order('created_at', { ascending: false });
        if (data) setReports(data);
      } else if (activeTab === 'announcements') {
        const { data } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setAnnouncements(data);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: !currentStatus })
        .eq('id', userId);
      
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: !currentStatus } : u));
      toast.success(`User verification ${!currentStatus ? 'granted' : 'revoked'}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const togglePremium = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_premium: !currentStatus })
        .eq('id', userId);
      
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_premium: !currentStatus } : u));
      toast.success(`User premium status ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`User role updated to ${newRole}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Post deleted successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const { error } = await supabase.from('announcements').insert({
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        target_role: newAnnouncement.target_role,
        created_by: user.id
      });

      if (error) throw error;
      toast.success('Announcement published!');
      setIsAnnouncementModalOpen(false);
      setNewAnnouncement({ title: '', content: '', target_role: 'all' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Announcement deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status })
        .eq('id', reportId);
      
      if (error) throw error;
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
      toast.success(`Report ${status}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (myProfile?.role !== 'admin') {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 max-w-md">You do not have administrative privileges to access this panel.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
            Admin Control Panel
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage users, reports, and system announcements.</p>
        </div>
        {activeTab === 'announcements' && (
          <button 
            onClick={() => setIsAnnouncementModalOpen(true)}
            className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-gray-100 p-1 rounded-2xl w-full overflow-x-auto no-scrollbar">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'content', label: 'Content', icon: FileText },
          { id: 'stories', label: 'Stories', icon: Activity },
          { id: 'reports', label: 'Reports', icon: Flag },
          { id: 'announcements', label: 'Announcements', icon: Megaphone },
          { id: 'logs', label: 'Logs', icon: Terminal }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex-1 whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="font-medium">Loading data...</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Total Posts', value: stats.totalPosts, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Pending Reports', value: stats.pendingReports, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50' },
                    { label: 'Announcements', value: stats.activeAnnouncements, icon: Megaphone, color: 'text-amber-500', bg: 'bg-amber-50' }
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-6 rounded-[24px] bg-white border border-gray-100 shadow-sm flex items-center gap-4"
                    >
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg)}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="p-6 rounded-[32px] bg-gray-50/50 border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-emerald-500" />
                        Platform Growth
                      </h3>
                      <select className="bg-white border-none text-xs font-bold rounded-lg px-2 py-1 outline-none ring-1 ring-gray-200">
                        <option>Last 7 Days</option>
                        <option>Last 30 Days</option>
                      </select>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#fff', 
                              borderRadius: '16px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="users" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorUsers)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="p-6 rounded-[32px] bg-gray-50/50 border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                        System Health
                      </h3>
                      <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg uppercase">Live</span>
                    </div>
                    <div className="space-y-4">
                      {[
                        { label: 'Server Status', value: 'Operational', color: 'text-emerald-500' },
                        { label: 'Database Load', value: 'Low (12%)', color: 'text-emerald-500' },
                        { label: 'API Response', value: '98ms', color: 'text-emerald-500' },
                        { label: 'Uptime', value: '99.99%', color: 'text-emerald-500' }
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                          <span className="text-sm font-medium text-gray-500">{item.label}</span>
                          <span className={cn("text-sm font-bold", item.color)}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-[32px] bg-gray-50/50 border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Recent Activity
                      </h3>
                      <button className="text-xs font-bold text-blue-500 hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                      {[
                        { user: 'Sarah J.', action: 'joined the platform', time: '2m ago', icon: UserPlus, color: 'bg-blue-50 text-blue-500' },
                        { user: 'Mike R.', action: 'reported a post', time: '15m ago', icon: Flag, color: 'bg-rose-50 text-rose-500' },
                        { user: 'System', action: 'backup completed', time: '1h ago', icon: Shield, color: 'bg-emerald-50 text-emerald-500' }
                      ].map((activity, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", activity.color)}>
                            <activity.icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              <span className="font-bold">{activity.user}</span> {activity.action}
                            </p>
                            <p className="text-[10px] text-gray-400">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                  />
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50">
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3 hidden sm:table-cell">Role</th>
                          <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users
                          .filter(u => 
                            u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((u) => (
                          <tr key={u.id} className="group hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">
                                      {u.username[0].toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-bold text-gray-900 truncate">{u.full_name || u.username}</span>
                                    {u.is_verified && <VerificationBadge size="sm" />}
                                  </div>
                                  <div className="flex items-center gap-2 sm:block">
                                    <span className="text-[10px] text-gray-500">@{u.username}</span>
                                    <span className="sm:hidden px-1.5 py-0.5 rounded bg-gray-100 text-[8px] font-bold text-gray-500 uppercase">{u.role || 'user'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 hidden sm:table-cell">
                              <span className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                u.role === 'admin' ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-600"
                              )}>
                                {u.role || 'user'}
                              </span>
                            </td>
                            <td className="px-4 py-4 hidden sm:table-cell">
                              <span className={cn(
                                "flex items-center gap-1.5 text-xs font-medium",
                                u.is_verified ? "text-blue-600" : "text-gray-400"
                              )}>
                                <div className={cn("w-1.5 h-1.5 rounded-full", u.is_verified ? "bg-blue-500" : "bg-gray-300")} />
                                {u.is_verified ? 'Verified' : 'Standard'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => togglePremium(u.id, !!u.is_premium)}
                                  className={cn(
                                    "p-2 rounded-xl transition-all active:scale-95",
                                    u.is_premium 
                                      ? "text-amber-500 bg-amber-50" 
                                      : "text-gray-400 hover:bg-gray-100"
                                  )}
                                  title={u.is_premium ? "Revoke Premium" : "Grant Premium"}
                                >
                                  <Star className={cn("w-5 h-5", u.is_premium && "fill-amber-500")} />
                                </button>

                                <button 
                                  onClick={() => toggleVerification(u.id, !!u.is_verified)}
                                  className={cn(
                                    "p-2 rounded-xl transition-all active:scale-95",
                                    u.is_verified 
                                      ? "text-blue-500 bg-blue-50" 
                                      : "text-gray-400 hover:bg-gray-100"
                                  )}
                                  title={u.is_verified ? "Revoke Verification" : "Grant Verification"}
                                >
                                  <UserCheck className="w-5 h-5" />
                                </button>
                                
                                <button 
                                  onClick={() => updateUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                  className={cn(
                                    "p-2 rounded-xl transition-all active:scale-95",
                                    u.role === 'admin' 
                                      ? "text-emerald-500 bg-emerald-50" 
                                      : "text-gray-400 hover:bg-gray-100"
                                  )}
                                  title={u.role === 'admin' ? "Demote to User" : "Promote to Admin"}
                                >
                                  <Shield className="w-5 h-5" />
                                </button>

                                <button 
                                  onClick={async () => {
                                    if (u.id === user?.id) {
                                      toast.error("You cannot delete yourself!");
                                      return;
                                    }
                                    if (confirm(`Are you sure you want to delete @${u.username}? This is permanent.`)) {
                                      const { error } = await supabase.from('profiles').delete().eq('id', u.id);
                                      if (error) toast.error(error.message);
                                      else {
                                        setUsers(prev => prev.filter(user => user.id !== u.id));
                                        toast.success('User deleted');
                                      }
                                    }
                                  }}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                    />
                  </div>
                  <div className="relative flex-1">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search by username..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                    />
                  </div>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                    {['all', 'post', 'reel'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setContentType(type as any)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize",
                          contentType === type ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"
                        )}
                      >
                        {type}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts
                    .filter(p => 
                      p.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
                      (p.profiles?.username.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                       p.profiles?.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                    )
                    .map((post) => (
                    <div key={post.id} className="p-4 rounded-3xl border border-gray-100 bg-gray-50/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                              {post.profiles?.avatar_url && (
                                <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900">@{post.profiles?.username}</p>
                              <p className="text-[10px] text-gray-400">{formatDate(post.created_at)}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => deletePost(post.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-3 mb-4">{post.content}</p>
                        {post.media_url && (
                          <div className="aspect-video rounded-2xl overflow-hidden bg-gray-200 mb-4">
                            {post.media_type === 'video' ? (
                              <video src={post.media_url} className="w-full h-full object-cover" />
                            ) : (
                              <img src={post.media_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-4 border-t border-gray-100">
                        <span>{post.reactions_count || 0} Reactions</span>
                        <span>{post.comments_count || 0} Comments</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'stories' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {stories.map((story) => (
                    <div key={story.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden group border border-gray-100">
                      <img src={story.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full border-2 border-emerald-500 p-0.5">
                          <img src={story.profiles?.avatar_url || ''} alt="" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <span className="text-[10px] font-bold text-white truncate max-w-[60px]">@{story.profiles?.username}</span>
                      </div>
                      <button 
                        onClick={async () => {
                          if (confirm('Delete this story?')) {
                            const { error } = await supabase.from('stories').delete().eq('id', story.id);
                            if (error) toast.error(error.message);
                            else {
                              setStories(prev => prev.filter(s => s.id !== story.id));
                              toast.success('Story deleted');
                            }
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-2 left-2">
                        <p className="text-[8px] text-white/70 font-medium uppercase tracking-widest">Expires {formatDate(story.expires_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {stories.length === 0 && (
                  <div className="py-20 text-center text-gray-400">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No active stories found.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="p-3 sm:p-4 rounded-2xl border border-gray-100 bg-gray-50/30">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            Reported {report.target_type}: {report.target_user?.username || 'Unknown'}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            By @{report.reporter?.username} • {formatDate(report.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider w-fit",
                        report.status === 'pending' ? "bg-amber-50 text-amber-600" :
                        report.status === 'resolved' ? "bg-emerald-50 text-emerald-600" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {report.status}
                      </span>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-100 mb-4">
                      <p className="text-sm text-gray-700 italic">"{report.reason}"</p>
                    </div>

                    {report.status === 'pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => resolveReport(report.id, 'resolved')}
                          className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all"
                        >
                          Mark Resolved
                        </button>
                        <button 
                          onClick={() => resolveReport(report.id, 'dismissed')}
                          className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-200 transition-all"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="py-20 text-center text-gray-400">
                    <Flag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No reports to display.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'announcements' && (
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-4 sm:p-6 rounded-3xl border border-emerald-100 bg-emerald-50/30 relative group">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">{ann.title}</h3>
                        <p className="text-[10px] text-gray-500">Published on {formatDate(ann.created_at)}</p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                          Target: {ann.target_role}
                        </span>
                        <button 
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{ann.content}</p>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div className="py-20 text-center text-gray-400">
                    <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No announcements published yet.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-500" />
                    System Logs
                  </h3>
                  <button className="text-xs font-bold text-emerald-600 hover:underline">Clear Logs</button>
                </div>
                
                <div className="bg-gray-900 rounded-2xl p-6 font-mono text-xs text-emerald-400 overflow-x-auto">
                  <div className="space-y-2">
                    <p><span className="text-gray-500">[2026-04-13 18:24:12]</span> <span className="text-blue-400">INFO:</span> System check completed. All services operational.</p>
                    <p><span className="text-gray-500">[2026-04-13 18:20:05]</span> <span className="text-emerald-400">SUCCESS:</span> Database backup successful (size: 1.2GB).</p>
                    <p><span className="text-gray-500">[2026-04-13 18:15:30]</span> <span className="text-amber-400">WARN:</span> High traffic detected from region: Asia-East1.</p>
                    <p><span className="text-gray-500">[2026-04-13 18:10:22]</span> <span className="text-rose-400">ERROR:</span> Failed login attempt for user: admin_test.</p>
                    <p><span className="text-gray-500">[2026-04-13 18:05:11]</span> <span className="text-blue-400">INFO:</span> New announcement published by @sunny.</p>
                    <p><span className="text-gray-500">[2026-04-13 18:00:00]</span> <span className="text-gray-400">DEBUG:</span> Cache invalidated for posts_feed.</p>
                    <p><span className="text-emerald-500 animate-pulse">_</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'CPU Usage', value: '14%', color: 'bg-emerald-500' },
                    { label: 'Memory', value: '2.4GB / 8GB', color: 'bg-blue-500' },
                    { label: 'Storage', value: '45% used', color: 'bg-amber-500' }
                  ].map((stat) => (
                    <div key={stat.label} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-gray-900">{stat.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", stat.color)} style={{ width: stat.value.includes('%') ? stat.value : '30%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Announcement Modal */}
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-emerald-500" />
                  New Announcement
                </h2>
                <button 
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Title</label>
                  <input 
                    type="text"
                    required
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Announcement Title"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Target Audience</label>
                  <select 
                    value={newAnnouncement.target_role}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, target_role: e.target.value as any }))}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="all">Everyone</option>
                    <option value="user">Standard Users Only</option>
                    <option value="admin">Admins Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Content</label>
                  <textarea 
                    required
                    rows={5}
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    placeholder="Write your announcement here..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAnnouncementModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Publish
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
