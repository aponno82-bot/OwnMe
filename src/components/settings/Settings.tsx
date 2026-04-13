import React, { useState } from 'react';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';
import { User, Shield, Trash2, ChevronRight, Lock, Eye, Bell, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function Settings() {
  const { user, profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'personal' | 'privacy' | 'notifications' | 'appearance' | 'security' | 'delete'>('personal');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('notifications') !== 'false');

  const menuItems = [
    { id: 'personal', label: 'Personal Info', icon: User, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'privacy', label: 'Privacy', icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'appearance', label: 'Appearance', icon: Globe, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'security', label: 'Security', icon: Shield, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'delete', label: 'Danger Zone', icon: Trash2, color: 'text-rose-500', bg: 'bg-rose-50' },
  ] as const;

  const toggleTheme = () => {
    const newTheme = !isDarkMode ? 'dark' : 'light';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', !isDarkMode);
    toast.success(`Theme changed to ${newTheme} mode`);
  };

  const toggleNotifications = () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    localStorage.setItem('notifications', String(newState));
    toast.success(`Notifications ${newState ? 'enabled' : 'disabled'}`);
  };

  const handleSavePersonal = async () => {
    setLoading(true);
    try {
      await updateProfile({
        full_name: fullName,
        username: username,
        bio: bio
      });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async () => {
    const confirmed = window.confirm('Are you sure you want to request account deletion? This action cannot be undone.');
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user?.id,
        target_id: user?.id,
        target_type: 'user',
        reason: 'ACCOUNT_DELETE_REQUEST'
      });
      if (error) throw error;
      toast.success('Account deletion request submitted. Our team will process it soon.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 group",
                activeSection === item.id 
                  ? "bg-white shadow-sm ring-1 ring-gray-100" 
                  : "hover:bg-white/50"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                activeSection === item.id ? item.bg : "bg-gray-100 group-hover:bg-white",
                activeSection === item.id ? item.color : "text-gray-400 group-hover:text-gray-600"
              )}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "font-bold text-sm transition-colors",
                activeSection === item.id ? "text-gray-900" : "text-gray-500 group-hover:text-gray-700"
              )}>
                {item.label}
              </span>
              {activeSection === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500"
                />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-8"
          >
            {activeSection === 'personal' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                  <p className="text-sm text-gray-500 mt-1">Update your profile details and public identity.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Username</label>
                      <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="username"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                    <input 
                      type="email" 
                      disabled
                      value={user?.email || ''}
                      className="w-full px-4 py-3 bg-gray-100 border-none rounded-2xl text-sm text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-gray-400 italic">Email is managed by your authentication provider.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bio</label>
                    <textarea 
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                      placeholder="Tell the world about yourself..."
                    />
                  </div>

                  <button 
                    onClick={handleSavePersonal}
                    disabled={loading}
                    className="btn-primary w-full py-4 mt-4 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                    Save Profile Changes
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Privacy Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Control who can see your content and interact with you.</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-500 shadow-sm">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Private Account</h4>
                        <p className="text-[10px] text-gray-400">Only approved followers can see your posts</p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        const newValue = !profile?.is_private;
                        await updateProfile({ is_private: newValue });
                        toast.success(`Account is now ${newValue ? 'private' : 'public'}`);
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors",
                        profile?.is_private ? "bg-emerald-500" : "bg-gray-200"
                      )}
                    >
                      <motion.div 
                        animate={{ x: profile?.is_private ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Search Visibility</h4>
                        <p className="text-[10px] text-gray-400">Allow search engines to index your profile</p>
                      </div>
                    </div>
                    <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
                  <p className="text-sm text-gray-500 mt-1">Stay updated with what's happening.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-orange-500 shadow-sm">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Push Notifications</h4>
                        <p className="text-[10px] text-gray-400">Receive alerts on your device</p>
                      </div>
                    </div>
                    <button 
                      onClick={toggleNotifications}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors",
                        notificationsEnabled ? "bg-emerald-500" : "bg-gray-200"
                      )}
                    >
                      <motion.div 
                        animate={{ x: notificationsEnabled ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Appearance</h2>
                  <p className="text-sm text-gray-500 mt-1">Customize how the platform looks for you.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-purple-500 shadow-sm">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Dark Mode</h4>
                        <p className="text-[10px] text-gray-400">Switch between light and dark themes</p>
                      </div>
                    </div>
                    <button 
                      onClick={toggleTheme}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors",
                        isDarkMode ? "bg-emerald-500" : "bg-gray-200"
                      )}
                    >
                      <motion.div 
                        animate={{ x: isDarkMode ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Security</h2>
                  <p className="text-sm text-gray-500 mt-1">Protect your account and data.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-500 shadow-sm">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Two-Factor Authentication</h4>
                        <p className="text-xs text-gray-500">Add an extra layer of security to your account.</p>
                      </div>
                    </div>
                    <button className="w-full py-3 bg-white border border-indigo-100 rounded-2xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors">
                      Enable 2FA
                    </button>
                  </div>

                  <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-2">Active Sessions</h4>
                    <p className="text-xs text-gray-500 mb-4">You are currently logged in on this device.</p>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium">Current Session (This Browser)</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Active Now</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'delete' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-rose-600">Danger Zone</h2>
                  <p className="text-sm text-gray-500 mt-1">Irreversible actions for your account.</p>
                </div>

                <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100">
                  <h4 className="font-bold text-rose-900 mb-2">Delete Account</h4>
                  <p className="text-xs text-rose-700/70 mb-6">
                    Once you delete your account, all of your data will be permanently removed. 
                    This action cannot be undone.
                  </p>
                  <button 
                    onClick={handleDeleteRequest}
                    disabled={loading}
                    className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    Request Account Deletion
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
