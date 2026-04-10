import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Post } from '../../types';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import Announcements from './Announcements';
import StoryBar from '../stories/StoryBar';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Clock, Loader2 } from 'lucide-react';
import { getAIFeedRecommendations } from '../../services/aiFeedService';
import { useAuth } from '../../lib/useAuth';
import { cn } from '../../lib/utils';

interface FeedProps {
  onUserClick: (userId: string) => void;
  onHashtagClick: (hashtag: string) => void;
  onPostClick: (postId: string) => void;
  highlightPostId?: string | null;
}

export default function Feed({ onUserClick, onHashtagClick, onPostClick, highlightPostId }: FeedProps) {
  const { profile, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [forYouPosts, setForYouPosts] = useState<Post[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [feedType, setFeedType] = useState<'latest' | 'forYou'>('latest');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [forYouLoading, setForYouLoading] = useState(false);
  const instanceId = useState(() => Math.random().toString(36).substring(7))[0];

  useEffect(() => {
    fetchBlockedIds();
    fetchPosts();

    // Real-time subscription for new posts
    const channel = supabase
      .channel(`public:posts:${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new as Post;
        // We need to fetch the profile for the new post
        fetchNewPostWithProfile(newPost.id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts(prev => prev.filter(post => post.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchBlockedIds() {
    if (!user) return;
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id);
    
    if (data) {
      setBlockedIds(data.map(b => b.blocked_id));
    }
  }

  async function fetchPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const fetchedPosts = data || [];
      setPosts(fetchedPosts);
      
      // Pre-fetch recommendations if not already done
      if (fetchedPosts.length > 0) {
        generateForYouFeed(fetchedPosts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateForYouFeed(basePosts: Post[]) {
    setForYouLoading(true);
    const result = await getAIFeedRecommendations(basePosts, profile);
    setForYouPosts(result.posts);
    setExplanation(result.explanation || '');
    setForYouLoading(false);
  }

  useEffect(() => {
    if (highlightPostId) {
      const element = document.getElementById(`post-${highlightPostId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightPostId, posts, forYouPosts]);
  async function fetchNewPostWithProfile(postId: string) {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles (*)')
      .eq('id', postId)
      .single();
    
    if (data) {
      setPosts(prev => [data, ...prev]);
    }
  }

  return (
    <div className="space-y-6">
      <Announcements />
      <StoryBar />
      <CreatePost />

      <div className="flex gap-2 p-1.5 bg-gray-100/50 backdrop-blur-sm rounded-[24px] w-fit border border-gray-100">
        <button 
          onClick={() => setFeedType('latest')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-[20px] text-sm font-bold transition-all active:scale-95",
            feedType === 'latest' ? "bg-white text-emerald-600 shadow-premium" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
          )}
        >
          <Clock className="w-4 h-4" />
          Latest
        </button>
        <button 
          onClick={() => setFeedType('forYou')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-[20px] text-sm font-bold transition-all active:scale-95",
            feedType === 'forYou' ? "bg-white text-emerald-600 shadow-premium" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
          )}
        >
          <Zap className="w-4 h-4" />
          For You
        </button>
      </div>

      {feedType === 'forYou' && explanation && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100"
        >
          <div className="flex items-center justify-between gap-2 text-emerald-700 mb-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">For You Insight</span>
            </div>
            {explanation.includes("resting") && (
              <button 
                onClick={() => generateForYouFeed(posts)}
                disabled={forYouLoading}
                className="text-[10px] font-bold hover:underline flex items-center gap-1"
              >
                {forYouLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh Feed"}
              </button>
            )}
          </div>
          <p className="text-sm text-emerald-800 italic">"{explanation}"</p>
        </motion.div>
      )}
      
      <div className="space-y-6">
        {loading || (feedType === 'forYou' && forYouLoading) ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-premium h-64 animate-pulse bg-gray-50" />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {(feedType === 'latest' ? posts : forYouPosts)
              .filter(post => !blockedIds.includes(post.user_id))
              .map((post) => (
                <motion.div
                  key={post.id}
                  id={`post-${post.id}`}
                  initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <PostCard 
                  post={post} 
                  onUserClick={onUserClick} 
                  onHashtagClick={onHashtagClick}
                  onPostClick={onPostClick}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
