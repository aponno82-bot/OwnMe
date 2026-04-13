import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { Post } from '../../types';
import PostCard from '../feed/PostCard';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function PostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockingMe, setIsBlockingMe] = useState(false);
  const { user } = useAuth();

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

      if (user && data.user_id !== user.id) {
        const { data: blockedByMe } = await supabase
          .from('blocks')
          .select('*')
          .eq('blocker_id', user.id)
          .eq('blocked_id', data.user_id)
          .single();
        
        setIsBlocked(!!blockedByMe);

        const { data: blockedByThem } = await supabase
          .from('blocks')
          .select('*')
          .eq('blocker_id', data.user_id)
          .eq('blocked_id', user.id)
          .single();
        
        setIsBlockingMe(!!blockedByThem);
      }
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

  if (!post || isBlocked || isBlockingMe) {
    return (
      <div className="text-center py-20 card-premium">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isBlockingMe ? 'You are blocked' : isBlocked ? 'User Blocked' : 'Post not found'}
        </h2>
        <p className="text-gray-500 mb-6">
          {isBlockingMe ? 'You cannot view this content.' : isBlocked ? 'Unblock this user to see their posts.' : 'This post may have been deleted.'}
        </p>
        <button 
          onClick={() => navigate(-1)}
          className="btn-primary px-8 py-2"
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
        autoShowComments={true}
      />
    </motion.div>
  );
}
