import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Post } from '../../types';
import PostCard from '../feed/PostCard';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function PostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
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
    } catch (error: any) {
      console.error('Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Post not found</h2>
        <button 
          onClick={() => navigate(-1)}
          className="text-emerald-600 font-bold hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Post</h1>
      </div>

      <PostCard 
        post={post} 
        onUserClick={(userId) => navigate(`/profile/${userId}`)}
        onHashtagClick={(tag) => navigate(`/hashtag/${tag}`)}
        onPostClick={() => {}} // Already on post page
      />
    </motion.div>
  );
}
