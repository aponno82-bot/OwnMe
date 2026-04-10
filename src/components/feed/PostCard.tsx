import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Send, User as UserIcon, Trash2, AlertCircle, Globe, Users, Lock, Edit3, Flag, X, Loader2 } from 'lucide-react';
import VerificationBadge from '../VerificationBadge';
import { Post, Comment } from '../../types';
import { formatDate, cn, formatRelativeTime } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { toast } from 'sonner';
import { createNotification } from '../../services/notificationService';

interface PostCardProps {
  post: Post;
  key?: string | number;
  onUserClick?: (userId: string) => void;
  onHashtagClick?: (hashtag: string) => void;
  onPostClick?: (postId: string) => void;
}

export default function PostCard({ post, onUserClick, onHashtagClick, onPostClick }: PostCardProps) {
  const { user, profile } = useAuth();
  const [likesCount, setLikesCount] = useState(post.reactions_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
  const [savesCount, setSavesCount] = useState(post.saves_count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editPrivacy, setEditPrivacy] = useState(post.privacy || 'public');
  const [isUpdating, setIsUpdating] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const instanceId = useState(() => Math.random().toString(36).substring(7))[0];
  const menuRef = useRef<HTMLDivElement>(null);
  const commentsSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (!user || user.id !== post.user_id) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;
      toast.success('Post deleted');
      setShowDeleteConfirm(false);
    } catch (error: any) {
      toast.error(error.message);
      setIsDeleting(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdatePost = async () => {
    if (!user || user.id !== post.user_id) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ 
          content: editContent.trim(),
          privacy: editPrivacy
        })
        .eq('id', post.id);

      if (error) throw error;
      toast.success('Post updated successfully!');
      setIsEditing(false);
      setShowMenu(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const isOwnPost = user?.id === post.user_id;
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportReason.trim()) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_id: post.id,
        target_type: 'post',
        reason: reportReason.trim()
      });
      if (error) throw error;
      toast.success('Report submitted. Our team will review this post.');
      setIsReporting(false);
      setReportReason('');
      setShowMenu(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkIfLiked();
      checkIfSaved();
    }

    const channel = supabase
      .channel(`post-stats-${post.id}-${instanceId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reactions',
        filter: `post_id=eq.${post.id}` 
      }, () => {
        fetchLikesCount();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${post.id}`
      }, () => {
        fetchCommentsCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, post.id]);

  async function checkIfSaved() {
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', user?.id)
      .single();
    
    setIsSaved(!!data);
  }

  async function fetchCommentsCount() {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    
    if (count !== null) setCommentsCount(count);
  }

  useEffect(() => {
    if (showComments) {
      fetchComments();
      subscribeToComments();
    } else {
      if (commentsSubscriptionRef.current) {
        supabase.removeChannel(commentsSubscriptionRef.current);
      }
    }
    return () => {
      if (commentsSubscriptionRef.current) {
        supabase.removeChannel(commentsSubscriptionRef.current);
      }
    };
  }, [showComments, post.id]);

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles (*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    
    if (data) setComments(data);
  }

  function subscribeToComments() {
    const channel = supabase
      .channel(`post-comments-${post.id}-${instanceId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'comments',
        filter: `post_id=eq.${post.id}` 
      }, (payload) => {
        fetchNewCommentWithProfile(payload.new.id);
      })
      .subscribe();
    
    commentsSubscriptionRef.current = channel;
  }

  async function fetchNewCommentWithProfile(commentId: string) {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles (*)')
      .eq('id', commentId)
      .single();
    
    if (data) {
      setComments(prev => {
        if (prev.find(c => c.id === data.id)) return prev;
        return [...prev, data];
      });
    }
  }

  async function checkIfLiked() {
    const { data } = await supabase
      .from('reactions')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', user?.id)
      .single();
    
    setIsLiked(!!data);
  }

  async function fetchLikesCount() {
    const { count } = await supabase
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    
    if (count !== null) setLikesCount(count);
  }

  const toggleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save posts');
      return;
    }

    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    setSavesCount(prev => wasSaved ? prev - 1 : prev + 1);

    try {
      if (wasSaved) {
        await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('bookmarks')
          .insert({
            post_id: post.id,
            user_id: user.id
          });
      }
    } catch (error) {
      setIsSaved(wasSaved);
      setSavesCount(prev => wasSaved ? prev + 1 : prev - 1);
      console.error('Error toggling save:', error);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'OwnMe Post',
        text: post.content,
        url: window.location.href
      });
      setSharesCount(prev => prev + 1);
      // In a real app, we'd update this in the DB too
    } catch (error) {
      console.log('Share failed', error);
    }
  };
  const toggleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like posts');
      return;
    }

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        await supabase
          .from('reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('reactions')
          .insert({
            post_id: post.id,
            user_id: user.id,
            type: 'like'
          });
        
        // Send notification
        await createNotification(post.user_id, user.id, 'like', post.id);
      }
    } catch (error) {
      // Rollback on error
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
      console.error('Error toggling like:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setIsSubmittingComment(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: post.id,
        user_id: user.id,
        text: newComment.trim(),
        parent_id: replyingTo?.id || null
      });

      if (error) throw error;
      
      // Send notification
      await createNotification(post.user_id, user.id, 'comment', post.id);
      
      setNewComment('');
      setReplyingTo(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      toast.error('Please sign in to like comments');
      return;
    }

    try {
      // Check if already liked
      const { data: existing } = await supabase
        .from('comment_reactions')
        .select('*')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase
          .from('comment_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('comment_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            type: 'like'
          });
      }
      fetchComments(); // Refresh comments to get updated counts
    } catch (error: any) {
      console.error('Error liking comment:', error);
    }
  };

  const [reportingComment, setReportingComment] = useState<Comment | null>(null);
  const [commentReportReason, setCommentReportReason] = useState('');

  const handleReportComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportingComment || !commentReportReason.trim()) return;

    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_id: reportingComment.id,
        target_type: 'comment',
        reason: commentReportReason.trim()
      });
      if (error) throw error;
      toast.success('Comment reported');
      setReportingComment(null);
      setCommentReportReason('');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const renderCommentThread = (parentId: string | null = null, depth = 0) => {
    const threadComments = comments.filter(c => c.parent_id === parentId);
    if (threadComments.length === 0) return null;

    return (
      <div className={cn("space-y-6", depth > 0 && "mt-4 ml-8 sm:ml-11 border-l-2 border-gray-100 pl-4 sm:pl-6")}>
        {threadComments.map((comment) => (
          <div key={comment.id} className="space-y-4">
            <div className="flex gap-3">
              <div className={cn(
                "rounded-full bg-gray-100 overflow-hidden flex-shrink-0",
                depth === 0 ? "w-8 h-8" : "w-6 h-6"
              )}>
                {comment.profiles?.avatar_url ? (
                  <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center text-gray-400 font-bold",
                    depth === 0 ? "text-xs" : "text-[10px]"
                  )}>
                    {comment.profiles?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className={cn(
                  "rounded-2xl px-4 py-2",
                  depth === 0 ? "bg-gray-50" : "bg-gray-50/50"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "font-bold text-gray-900 flex items-center gap-1",
                      depth === 0 ? "text-xs" : "text-[11px]"
                    )}>
                      {comment.profiles?.full_name || comment.profiles?.username}
                      {comment.profiles?.is_verified && (
                        <VerificationBadge size="sm" />
                      )}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatRelativeTime(comment.created_at)}</span>
                  </div>
                  <p className={cn(
                    "text-gray-700",
                    depth === 0 ? "text-sm" : "text-xs"
                  )}>
                    {comment.text}
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-1 ml-2">
                  <button 
                    onClick={() => handleLikeComment(comment.id)}
                    className="text-[10px] font-bold text-gray-400 hover:text-rose-500 transition-colors flex items-center gap-1"
                  >
                    <Heart className="w-3 h-3" />
                    Like
                  </button>
                  <button 
                    onClick={() => setReplyingTo(comment)}
                    className="text-[10px] font-bold text-gray-400 hover:text-emerald-500 transition-colors"
                  >
                    Reply
                  </button>
                  {(user?.id === comment.user_id || user?.id === post.user_id) && (
                    <button 
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-[10px] font-bold text-gray-400 hover:text-rose-500 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                  {user?.id !== comment.user_id && (
                    <button 
                      onClick={() => setReportingComment(comment)}
                      className="text-[10px] font-bold text-gray-400 hover:text-rose-500 transition-colors"
                    >
                      Report
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recursive call for replies */}
            {renderCommentThread(comment.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="card-premium p-4 sm:p-6">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Post?</h3>
              <p className="text-gray-500 mb-8">This action cannot be undone. Are you sure you want to remove this post?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-full transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onUserClick?.(post.user_id)}
        >
          <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden border border-gray-100 group-hover:border-emerald-500 transition-all">
            {post.profiles?.avatar_url ? (
              <img src={post.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1 flex-wrap">
              <div className="flex items-center gap-1">
                <h3 className="font-bold text-gray-900 hover:text-emerald-600 transition-colors cursor-pointer">
                  {post.profiles?.full_name || post.profiles?.username}
                </h3>
                {post.profiles?.is_verified && (
                  <VerificationBadge size="md" />
                )}
              </div>
              {post.feeling && (
                <span className="text-xs text-gray-500">
                  is feeling <span className="font-bold text-gray-700">{post.feeling}</span>
                </span>
              )}
              {post.tagged_users && post.tagged_users.length > 0 && (
                <span className="text-xs text-gray-500">
                  with <span className="font-bold text-gray-700">{post.tagged_users.length} others</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-gray-400 font-medium">{formatRelativeTime(post.created_at)}</p>
              <span className="text-gray-300">•</span>
              {post.privacy === 'public' && <Globe className="w-3 h-3 text-gray-400" />}
              {post.privacy === 'friends' && <Users className="w-3 h-3 text-gray-400" />}
              {post.privacy === 'private' && <Lock className="w-3 h-3 text-gray-400" />}
              {!post.privacy && <Globe className="w-3 h-3 text-gray-400" />}
            </div>
          </div>
        </div>
        
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20"
              >
                <button 
                  onClick={() => {
                    toggleSave();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Bookmark className={cn("w-4 h-4", isSaved && "fill-current text-emerald-500")} />
                  {isSaved ? 'Saved' : 'Save Post'}
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                    toast.success('Post link copied!');
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Copy Link
                </button>
                {isOwnPost ? (
                  <>
                    <button 
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Post
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeleting}
                      className="w-full px-4 py-2 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isDeleting ? 'Deleting...' : 'Delete Post'}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setIsReporting(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    Report Post
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Post</h2>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-50 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Privacy</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'public', label: 'Public', icon: Globe },
                      { id: 'friends', label: 'Friends', icon: Users },
                      { id: 'private', label: 'Only Me', icon: Lock },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setEditPrivacy(opt.id as any)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
                          editPrivacy === opt.id 
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                        )}
                      >
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button onClick={() => setIsEditing(false)} className="flex-1 btn-secondary py-3">Cancel</button>
                  <button 
                    onClick={handleUpdatePost}
                    disabled={isUpdating || !editContent.trim()}
                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div 
        className="space-y-4 cursor-pointer"
        onClick={() => onPostClick?.(post.id)}
      >
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {post.content.split(/(#[a-z0-9_]+)/gi).map((part, i) => {
            if (part.startsWith('#')) {
              const tagName = part.slice(1).toLowerCase();
              return (
                <span 
                  key={i} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onHashtagClick?.(tagName);
                  }}
                  className="text-emerald-600 font-bold hover:underline cursor-pointer"
                >
                  {part}
                </span>
              );
            }
            return part;
          })}
        </p>
        
        {post.media_url && (
          <div className="rounded-3xl overflow-hidden border border-gray-100 bg-gray-50">
            {post.media_type === 'video' ? (
              <video 
                src={post.media_url} 
                controls 
                className="w-full h-auto max-h-[600px] object-cover"
              />
            ) : (
              <img 
                src={post.media_url} 
                alt="Post media" 
                className="w-full h-auto max-h-[500px] object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {(likesCount > 0 || commentsCount > 0) && (
        <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            {likesCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center">
                  <Heart className="w-2.5 h-2.5 text-white fill-current" />
                </div>
                <span>{likesCount} {likesCount === 1 ? 'Like' : 'Likes'}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {commentsCount > 0 && (
              <span>{commentsCount} {commentsCount === 1 ? 'Comment' : 'Comments'}</span>
            )}
            {sharesCount > 0 && (
              <span>{sharesCount} {sharesCount === 1 ? 'Share' : 'Shares'}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleLike}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 transition-colors group",
              isLiked ? "text-rose-500" : "text-gray-500 hover:text-rose-500"
            )}
          >
            <div className={cn(
              "p-2 rounded-full transition-colors",
              isLiked ? "bg-rose-50" : "group-hover:bg-rose-50"
            )}>
              <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
            </div>
            <span className="text-sm font-semibold">{likesCount}</span>
          </button>
          
          <button 
            onClick={() => setShowComments(!showComments)}
            className={cn(
              "flex items-center gap-2 transition-colors group",
              showComments ? "text-emerald-500" : "text-gray-500 hover:text-emerald-500"
            )}
          >
            <div className={cn(
              "p-2 rounded-full transition-colors",
              showComments ? "bg-emerald-50" : "group-hover:bg-emerald-50"
            )}>
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold">{commentsCount}</span>
          </button>

          <button 
            onClick={handleShare}
            className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors group"
          >
            <div className="p-2 rounded-full group-hover:bg-blue-50 transition-colors">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold">{sharesCount}</span>
          </button>
        </div>

        <button 
          onClick={toggleSave}
          className={cn(
            "p-2 rounded-full transition-colors",
            isSaved ? "text-emerald-500 bg-emerald-50" : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          <Bookmark className={cn("w-5 h-5", isSaved && "fill-current")} />
        </button>
      </div>
      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-6 pt-6 border-t border-gray-50">
              {renderCommentThread(null)}

              <form onSubmit={handleAddComment} className="flex flex-col gap-2 pt-4">
                {replyingTo && (
                  <div className="flex items-center justify-between px-3 py-1 bg-emerald-50 rounded-lg">
                    <span className="text-[10px] font-bold text-emerald-600">
                      Replying to {replyingTo.profiles?.full_name || replyingTo.profiles?.username}
                    </span>
                    <button onClick={() => setReplyingTo(null)} className="text-emerald-400 hover:text-emerald-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                        {profile?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 pr-10"
                    />
                    <button 
                      type="submit"
                      disabled={isSubmittingComment || !newComment.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-600 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Comment Report Modal */}
      <AnimatePresence>
        {reportingComment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Report Comment</h2>
                <button onClick={() => setReportingComment(null)} className="p-2 hover:bg-gray-50 rounded-full">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleReportComment} className="p-6 space-y-4">
                <textarea 
                  required
                  rows={4}
                  value={commentReportReason}
                  onChange={(e) => setCommentReportReason(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 resize-none text-sm"
                  placeholder="Why are you reporting this comment?"
                />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setReportingComment(null)} className="flex-1 btn-secondary py-3">Cancel</button>
                  <button type="submit" className="flex-1 btn-primary bg-rose-500 hover:bg-rose-600 py-3">Report</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {isReporting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-rose-50/50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Flag className="w-5 h-5 text-rose-500" />
                  Report Post
                </h2>
                <button 
                  onClick={() => setIsReporting(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleReport} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reason for reporting</label>
                  <textarea 
                    required
                    rows={4}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 resize-none text-sm"
                    placeholder="Please describe why you are reporting this post..."
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsReporting(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdating || !reportReason.trim()}
                    className="flex-1 px-6 py-3 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 text-sm disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Report'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
