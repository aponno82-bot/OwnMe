import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck, User, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { Profile } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import VerificationBadge from '../VerificationBadge';

interface SuggestedUsersProps {
  onUserClick: (userId: string) => void;
}

export default function SuggestedUsers({ onUserClick }: SuggestedUsersProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSuggestions();
      fetchFollowing();
    }
  }, [user]);

  async function fetchFollowing() {
    if (!user) return;
    const { data } = await supabase
      .from('connections')
      .select('receiver_id')
      .eq('sender_id', user.id)
      .eq('status', 'accepted');
    if (data) setFollowingIds(data.map(c => c.receiver_id));
  }

  async function fetchSuggestions() {
    if (!user) return;
    
    // Fetch users who are not the current user and not already followed
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .limit(10);

    if (error) {
      console.error('Error fetching suggestions:', error);
    } else if (profiles) {
      // Filter out users already followed (client-side for simplicity in this demo)
      const { data: connections } = await supabase
        .from('connections')
        .select('receiver_id')
        .eq('sender_id', user.id);
      
      const followedIds = connections?.map(c => c.receiver_id) || [];
      const filtered = profiles.filter(p => !followedIds.includes(p.id));
      setSuggestions(filtered.slice(0, 5));
    }
    setLoading(false);
  }

  const handleFollow = async (targetUserId: string) => {
    if (!user) {
      toast.error('Please sign in to follow users');
      return;
    }

    try {
      const { error } = await supabase
        .from('connections')
        .insert({
          sender_id: user.id,
          receiver_id: targetUserId,
          status: 'accepted' // Auto-accept for demo purposes
        });

      if (error) throw error;
      
      setFollowingIds(prev => [...prev, targetUserId]);
      toast.success('Following user');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 bg-gray-100 animate-pulse rounded-lg" />
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-40 h-52 bg-gray-50 animate-pulse rounded-[24px]" />
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Suggested for you</h3>
        </div>
        <button className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1">
          See All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
        <AnimatePresence mode="popLayout">
          {suggestions.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex-shrink-0 w-44 bg-white rounded-[32px] p-5 border border-gray-100 shadow-premium hover:shadow-premium-hover transition-all group relative overflow-hidden"
            >
              {/* Background Decoration */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100 transition-colors" />
              
              <div className="relative flex flex-col items-center text-center">
                <div 
                  className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-emerald-500 to-teal-400 mb-4 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => onUserClick(profile.id)}
                >
                  <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-gray-50">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 
                    className="text-sm font-bold text-gray-900 truncate max-w-[140px] flex items-center justify-center gap-1 cursor-pointer hover:text-emerald-600 transition-colors"
                    onClick={() => onUserClick(profile.id)}
                  >
                    {profile.full_name || profile.username}
                    {profile.is_verified && <VerificationBadge size="sm" />}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium truncate">@{profile.username}</p>
                </div>

                <button
                  onClick={() => handleFollow(profile.id)}
                  disabled={followingIds.includes(profile.id)}
                  className={cn(
                    "w-full py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
                    followingIds.includes(profile.id)
                      ? "bg-gray-50 text-gray-400 cursor-default"
                      : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:shadow-emerald-500/40"
                  )}
                >
                  {followingIds.includes(profile.id) ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Follow
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
