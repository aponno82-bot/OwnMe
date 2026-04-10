import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Post } from '../../types';
import { supabase } from '../../lib/supabase';
import PostCard from './PostCard';
import { motion } from 'motion/react';

interface PostPageProps {
  postId: string;
  onBack: () => void;
  onUserClick: (userId: string) => void;
  onHashtagClick: (hashtag: string) => void;
}

export default function PostPage({ postId, onBack, onUserClick, onHashtagClick }: PostPageProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  async function fetchPost() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles (*)')
        .eq('id', postId)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (err: any) {
      console.error('Error fetching post:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="card-premium p-8 text-center">
        <p className="text-gray-500 mb-4">{error || 'Post not found'}</p>
        <button onClick={onBack} className="btn-primary px-6 py-2">Go Back</button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Post</h1>
      </div>

      <PostCard 
        post={post} 
        onUserClick={onUserClick}
        onHashtagClick={onHashtagClick}
      />
    </motion.div>
  );
}
