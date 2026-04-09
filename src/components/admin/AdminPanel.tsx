import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile, Report, Announcement, Post } from '../../types';
import { 
  Shield, 
  Users, 
  Flag, 
  Megaphone, 
  CheckCircle, 
  XCircle, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  AlertTriangle,
  Loader2,
  ExternalLink,
  UserCheck,
  UserX,
  Plus
} from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../../lib/useAuth';

export default function AdminPanel() {
  const { user, profile: myProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'announcements'>('users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', target_role: 'all' as any });

  useEffect(() => {
    if (myProfile?.role === 'admin') {
      fetchData();
    }
  }, [activeTab, myProfile]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .order('username', { ascending: true });
        if (data) setUsers(data);
      } else if (activeTab === 'reports') {
        const { data } = await supabase
          .from('reports')
          .select('*, reporter:profiles!reporter_id(*)')
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
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-500" />
            Admin Control Panel
          </h1>
          <p className="text-gray-500 mt-1">Manage users, reports, and system announcements.</p>
        </div>
        {activeTab === 'announcements' && (
          <button 
            onClick={() => setIsAnnouncementModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-gray-100 p-1 rounded-2xl w-fit">
        {[
          { id: 'users', label: 'Users', icon: Users },
          { id: 'reports', label: 'Reports', icon: Flag },
          { id: 'announcements', label: 'Announcements', icon: Megaphone }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
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
          <div className="p-6">
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search users by name or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
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
                              <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                                    {u.username[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-bold text-gray-900">{u.full_name || u.username}</span>
                                  {u.is_verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500 fill-current" />}
                                </div>
                                <span className="text-xs text-gray-500">@{u.username}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                              u.role === 'admin' ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-600"
                            )}>
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              "flex items-center gap-1.5 text-xs font-medium",
                              u.is_verified ? "text-blue-600" : "text-gray-400"
                            )}>
                              <div className={cn("w-1.5 h-1.5 rounded-full", u.is_verified ? "bg-blue-500" : "bg-gray-300")} />
                              {u.is_verified ? 'Verified' : 'Standard'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button 
                              onClick={() => toggleVerification(u.id, !!u.is_verified)}
                              className={cn(
                                "p-2 rounded-xl transition-all active:scale-95",
                                u.is_verified 
                                  ? "text-rose-500 hover:bg-rose-50" 
                                  : "text-blue-500 hover:bg-blue-50"
                              )}
                              title={u.is_verified ? "Revoke Verification" : "Grant Verification"}
                            >
                              {u.is_verified ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            Reported {report.target_type}
                          </p>
                          <p className="text-xs text-gray-500">
                            By @{report.reporter?.username} • {formatDate(report.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
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
                  <div key={ann.id} className="p-6 rounded-3xl border border-emerald-100 bg-emerald-50/30">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{ann.title}</h3>
                        <p className="text-xs text-gray-500">Published on {formatDate(ann.created_at)}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        Target: {ann.target_role}
                      </span>
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
