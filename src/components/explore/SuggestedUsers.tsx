import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types';
import { useAuth } from '../../lib/useAuth';
import { useConnections } from '../../lib/useConnections';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

function SuggestedUserCard({ profile, onUserClick }: { profile: Profile, onUserClick: (id: string) => void, key?: string }) {
  const { isFollowing, toggleFollow, loading } = useConnections(profile.id);

  return (
    <div className="flex items-center justify-between group py-2">
      <div 
        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
        onClick={() => onUserClick(profile.id)}
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">
              {profile.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
            {profile.full_name || profile.username}
          </h4>
          <p className="text-[10px] text-gray-400 truncate">
            {(profile as any).mutual_count 
              ? `${(profile as any).mutual_count} mutual followers` 
              : `@${profile.username}`}
          </p>
        </div>
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFollow();
        }}
        disabled={loading}
        className={cn(
          "p-2 rounded-lg transition-all active:scale-90",
          isFollowing 
            ? "text-emerald-500 hover:bg-emerald-50" 
            : "text-gray-400 hover:bg-gray-50 hover:text-emerald-500"
        )}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function SuggestedUsers({ onUserClick }: { onUserClick: (id: string) => void }) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSuggestions();
    }
  }, [user]);

  async function fetchSuggestions() {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get people I follow
      const { data: followingData } = await supabase
        .from('connections')
        .select('receiver_id')
        .eq('sender_id', user.id)
        .eq('status', 'accepted');
      
      const followingIds = followingData?.map(f => f.receiver_id) || [];

      // 2. Get mutual suggestions (people followed by people I follow)
      let mutualSuggestions: Profile[] = [];
      if (followingIds.length > 0) {
        const { data: mutualData } = await supabase
          .from('connections')
          .select(`
            receiver_id,
            profiles:receiver_id (*)
          `)
          .in('sender_id', followingIds)
          .eq('status', 'accepted')
          .not('receiver_id', 'in', `(${[user.id, ...followingIds].join(',')})`)
          .limit(10);
        
        if (mutualData) {
          // Count occurrences to find most "mutual"
          const counts: Record<string, { profile: Profile, count: number }> = {};
          mutualData.forEach((item: any) => {
            if (item.profiles) {
              if (!counts[item.receiver_id]) {
                counts[item.receiver_id] = { profile: item.profiles, count: 0 };
              }
              counts[item.receiver_id].count++;
            }
          });
          
          mutualSuggestions = Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .map(item => ({
              ...item.profile,
              mutual_count: item.count
            })) as any;
        }
      }

      // 3. Get general suggestions if not enough mutuals
      if (mutualSuggestions.length < 5) {
        const excludeIds = [user.id, ...followingIds, ...mutualSuggestions.map(s => s.id)];
        const { data: generalData } = await supabase
          .from('profiles')
          .select('*')
          .not('id', 'in', `(${excludeIds.join(',')})`)
          .limit(5 - mutualSuggestions.length);
        
        if (generalData) {
          mutualSuggestions = [...mutualSuggestions, ...generalData];
        }
      }

      setSuggestions(mutualSuggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;

  return (
    <div className="card-premium p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Suggested for you</h3>
        <button 
          onClick={() => onUserClick('explore')} // This is a hack, we should navigate to explore
          className="text-[10px] font-bold text-emerald-600 hover:underline uppercase tracking-wider"
        >
          See All
        </button>
      </div>
      <div className="space-y-1">
        {suggestions.map((profile) => (
          <SuggestedUserCard key={profile.id} profile={profile} onUserClick={onUserClick} />
        ))}
      </div>
    </div>
  );
}
