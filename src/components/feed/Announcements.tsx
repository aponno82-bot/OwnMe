import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Announcement } from '../../types';
import { Megaphone, X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/useAuth';
import { formatDate } from '../../lib/utils';

export default function Announcements() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchAnnouncements();
  }, [profile?.role]);

  async function fetchAnnouncements() {
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .or(`target_role.eq.all,target_role.eq.${profile?.role || 'user'}`)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (data) setAnnouncements(data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  }

  const visibleAnnouncements = announcements.filter(a => !dismissedIds.includes(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <AnimatePresence>
        {visibleAnnouncements.map((ann) => (
          <motion.div
            key={ann.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 opacity-50" />
            <div className="relative p-4 sm:p-6 rounded-[32px] border border-emerald-100 bg-white/80 backdrop-blur-md shadow-lg shadow-emerald-500/5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                  <Megaphone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-gray-900 truncate pr-8">{ann.title}</h4>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Announcement
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-2">{ann.content}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{formatDate(ann.created_at)}</p>
                </div>
                <button 
                  onClick={() => setDismissedIds(prev => [...prev, ann.id])}
                  className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
