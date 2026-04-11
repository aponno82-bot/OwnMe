import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Settings, Bookmark, Users, Flag, HelpCircle, LogOut, Shield, Moon, Bell, MessageSquare, Heart, PlayCircle } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import VerificationBadge from '../VerificationBadge';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: any) => void;
  currentPage: string;
}

export default function MobileSidebar({ isOpen, onClose, onNavigate, currentPage }: MobileSidebarProps) {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const menuItems = [
    { id: 'profile', label: 'Profile', icon: User, color: 'text-blue-500 bg-blue-50' },
    { id: 'feed', label: 'Feed', icon: Heart, color: 'text-rose-500 bg-rose-50' },
    { id: 'reels', label: 'Reels', icon: PlayCircle, color: 'text-purple-500 bg-purple-50' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-50' },
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-amber-500 bg-amber-50' },
    { id: 'bookmarks', label: 'Saved', icon: Bookmark, color: 'text-pink-500 bg-pink-50' },
    { id: 'friends', label: 'Friends', icon: Users, color: 'text-cyan-500 bg-cyan-50' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-gray-500 bg-gray-50' },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'admin', label: 'Admin Panel', icon: Shield, color: 'text-indigo-500 bg-indigo-50' });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] lg:hidden"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-gray-50 z-[101] lg:hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">Menu</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Profile Section */}
            <div className="p-4">
              <div 
                onClick={() => {
                  onNavigate('profile');
                  onClose();
                }}
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-[0.98] transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <User className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <h3 className="font-bold text-gray-900">{profile?.full_name || profile?.username}</h3>
                    {profile?.is_verified && <VerificationBadge size="sm" />}
                  </div>
                  <p className="text-xs text-gray-500">View your profile</p>
                </div>
              </div>
            </div>

            {/* Menu Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={cn(
                      "flex flex-col items-start p-4 rounded-2xl bg-white border border-gray-100 shadow-sm transition-all active:scale-95",
                      currentPage === item.id && "ring-2 ring-emerald-500/20 border-emerald-500/20"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl mb-3", item.color)}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-gray-700">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Shortcuts/More */}
              <div className="space-y-2">
                <h4 className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resources</h4>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50">
                    <HelpCircle className="w-5 h-5 text-blue-500" />
                    Help & Support
                  </button>
                  <button className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    Privacy Policy
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-gray-100">
              <button 
                onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gray-50 hover:bg-rose-50 text-gray-600 hover:text-rose-600 rounded-2xl font-bold transition-all active:scale-95"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
              <p className="text-center text-[10px] text-gray-400 mt-4 font-medium uppercase tracking-widest">OwnMe v2.0.0</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
