import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Post } from '../../types';
import PostCard from '../feed/PostCard';
import { Hash, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HashtagFeedProps {
  hashtag: string;
  onBack: () => void;
  onUserClick: (userId: string) => void;
  onHashtagClick: (hashtag: string) => void;
  onPostClick: (postId: string) => void;
}

export default function HashtagFeed({ hashtag, onBack, onUserClick, onHashtagClick, onPostClick }: HashtagFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHashtagPosts();
  }, [hashtag]);

  async function fetchHashtagPosts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (*),
          post_hashtags!inner (
            hashtags!inner (name)
          )
        `)
        .eq('post_hashtags.hashtags.name', hashtag)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching hashtag posts:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <Hash className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">#{hashtag}</h2>
            <p className="text-xs text-gray-500 font-medium">{posts.length} posts found</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-premium h-64 animate-pulse bg-gray-50" />
          ))
        ) : posts.length === 0 ? (
          <div className="card-premium p-12 text-center">
            <Hash className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No posts yet</h3>
            <p className="text-gray-500">Be the first to post with #{hashtag}!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
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
