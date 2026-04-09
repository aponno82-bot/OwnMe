import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Post } from '../../types';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import Announcements from './Announcements';
import StoryBar from '../stories/StoryBar';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Clock, Loader2 } from 'lucide-react';
import { getAIFeedRecommendations } from '../../services/aiFeedService';
import { useAuth } from '../../lib/useAuth';
import { cn } from '../../lib/utils';

interface FeedProps {
  onUserClick: (userId: string) => void;
  onHashtagClick: (hashtag: string) => void;
}

export default function Feed({ onUserClick, onHashtagClick }: FeedProps) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [aiPosts, setAiPosts] = useState<Post[]>([]);
  const [feedType, setFeedType] = useState<'latest' | 'ai'>('latest');
  const [aiExplanation, setAiExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const instanceId = useState(() => Math.random().toString(36).substring(7))[0];

  useEffect(() => {
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
      
      // Pre-fetch AI recommendations if not already done
      if (fetchedPosts.length > 0) {
        generateAIFeed(fetchedPosts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateAIFeed(basePosts: Post[]) {
    setAiLoading(true);
    const result = await getAIFeedRecommendations(basePosts, profile);
    setAiPosts(result.posts);
    setAiExplanation(result.explanation || '');
    setAiLoading(false);
  }

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

      {/* Feed Tabs */}
      <div className="flex gap-4 p-1 bg-gray-100 rounded-2xl w-fit">
        <button 
          onClick={() => setFeedType('latest')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
            feedType === 'latest' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Clock className="w-4 h-4" />
          Latest
        </button>
        <button 
          onClick={() => setFeedType('ai')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
            feedType === 'ai' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Sparkles className="w-4 h-4" />
          AI For You
        </button>
      </div>

      {feedType === 'ai' && aiExplanation && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100"
        >
          <div className="flex items-center justify-between gap-2 text-emerald-700 mb-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">AI Insight</span>
            </div>
            {aiExplanation.includes("temporarily unavailable") && (
              <button 
                onClick={() => generateAIFeed(posts)}
                disabled={aiLoading}
                className="text-[10px] font-bold hover:underline flex items-center gap-1"
              >
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retry AI"}
              </button>
            )}
          </div>
          <p className="text-sm text-emerald-800 italic">"{aiExplanation}"</p>
        </motion.div>
      )}
      
      <div className="space-y-6">
        {loading || (feedType === 'ai' && aiLoading) ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-premium h-64 animate-pulse bg-gray-50" />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {(feedType === 'latest' ? posts : aiPosts).map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <PostCard 
                  post={post} 
                  onUserClick={onUserClick} 
                  onHashtagClick={onHashtagClick}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
