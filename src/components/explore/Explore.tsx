import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Post, Profile } from '../../types';
import { Search, UserPlus, UserCheck, TrendingUp, Grid, Image as ImageIcon, PlayCircle } from 'lucide-react';
import PostCard from '../feed/PostCard';
import { useConnections } from '../../lib/useConnections';
import { cn } from '../../lib/utils';

interface UserCardProps {
  profile: Profile;
  onUserClick: (id: string) => void;
  key?: string;
}

function UserCard({ profile, onUserClick }: UserCardProps) {
  const { isFollowing, toggleFollow, loading } = useConnections(profile.id);

  return (
    <div className="card-premium p-4 flex items-center justify-between group">
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => onUserClick(profile.id)}
      >
        <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden border border-gray-100 group-hover:border-emerald-500 transition-all">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
              {profile.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{profile.full_name || profile.username}</h4>
          <p className="text-[10px] text-gray-400 font-medium">@{profile.username}</p>
        </div>
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFollow();
        }}
        disabled={loading}
        className={cn(
          "p-2 rounded-xl transition-all active:scale-90",
          isFollowing 
            ? "bg-gray-100 text-gray-500 hover:bg-gray-200" 
            : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
        )}
      >
        {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function Explore({ onUserClick, onHashtagClick, onPostClick }: { onUserClick: (id: string) => void, onHashtagClick: (tag: string) => void, onPostClick: (id: string) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'people' | 'posts'>('people');

  useEffect(() => {
    fetchProfiles();
    fetchTrendingPosts();
  }, []);

  async function fetchProfiles() {
    try {
      const { data: allProfiles, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', (await supabase.auth.getUser()).data.user?.id)
        .limit(50);
      
      if (error) throw error;
      if (allProfiles) setProfiles(allProfiles);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }

  async function fetchTrendingPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles (*)')
      .order('reactions_count', { ascending: false })
      .limit(10);
    
    if (data) setTrendingPosts(data);
    setLoading(false);
  }

  const filteredProfiles = profiles.filter(p => 
    p.username.toLowerCase().includes(search.toLowerCase()) || 
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPosts = trendingPosts.filter(p => 
    p.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Explore</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search people, usernames, or keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
        />
      </div>

      <div className="flex gap-4 border-b border-gray-100">
        {[
          { id: 'people', label: 'People', icon: UserPlus },
          { id: 'posts', label: 'Trending Posts', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 py-4 border-b-2 transition-all font-bold text-sm",
              activeTab === tab.id 
                ? "border-emerald-500 text-emerald-600" 
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'people' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
            ))
          ) : (
            filteredProfiles.map((profile) => (
              <UserCard key={profile.id} profile={profile} onUserClick={onUserClick} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 bg-gray-50 rounded-[32px] animate-pulse" />
            ))
          ) : (
            filteredPosts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onUserClick={onUserClick}
                onHashtagClick={onHashtagClick}
                onPostClick={onPostClick}
              />
            ))
          )}
        </div>
      )}

      {!loading && (activeTab === 'people' ? filteredProfiles.length === 0 : filteredPosts.length === 0) && (
        <div className="text-center py-20">
          <p className="text-gray-400 font-medium">No {activeTab} found matching "{search}"</p>
        </div>
      )}
    </div>
  );
}
