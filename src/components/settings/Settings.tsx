import React, { useState } from 'react';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';
import { User, Shield, Trash2, ChevronRight, Lock, Eye, Bell, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export default function Settings() {
  const { user, profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'main' | 'personal' | 'privacy' | 'delete'>('main');

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

  if (activeSection === 'personal') {
    return (
      <div className="space-y-6">
        <button onClick={() => setActiveSection('main')} className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-2">
          ← Back to Settings
        </button>
        <div className="card-premium p-6">
          <h2 className="text-xl font-bold mb-6">Personal Information</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                defaultValue={profile?.full_name || ''}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Username</label>
              <input 
                type="text" 
                defaultValue={profile?.username || ''}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button className="btn-primary w-full py-3 mt-4">Save Changes</button>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'privacy') {
    return (
      <div className="space-y-6">
        <button onClick={() => setActiveSection('main')} className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-2">
          ← Back to Settings
        </button>
        <div className="card-premium p-6">
          <h2 className="text-xl font-bold mb-6">Privacy Settings</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-emerald-500" />
                <div>
                  <h4 className="text-sm font-bold">Public Profile</h4>
                  <p className="text-[10px] text-gray-400">Allow everyone to see your profile</p>
                </div>
              </div>
              <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-emerald-500" />
                <div>
                  <h4 className="text-sm font-bold">Private Account</h4>
                  <p className="text-[10px] text-gray-400">Only followers can see your posts</p>
                </div>
              </div>
              <div className="w-12 h-6 bg-gray-200 rounded-full relative">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-gray-50">
          <button 
            onClick={() => setActiveSection('personal')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                <User className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-900">Personal Info</h4>
                <p className="text-[10px] text-gray-400">Edit your name, username, and bio</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
          </button>

          <button 
            onClick={() => setActiveSection('privacy')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                <Shield className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-900">Privacy & Security</h4>
                <p className="text-[10px] text-gray-400">Manage your account visibility</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </button>

          <button 
            onClick={handleDeleteRequest}
            disabled={loading}
            className="w-full flex items-center justify-between p-6 hover:bg-rose-50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-rose-600">Delete Account</h4>
                <p className="text-[10px] text-rose-400">Request permanent account deletion</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-rose-300 group-hover:text-rose-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
