import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Post } from '../../types';
import { Heart, MessageCircle, Share2, Music2, User as UserIcon, Loader2, ChevronUp, ChevronDown, Video, X, Send, Flag, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/useAuth';
import { useConnections } from '../../lib/useConnections';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface ReelCardProps {
  reel: Post;
  isActive: boolean;
  onUserClick: (userId: string) => void;
}

function ReelCard({ reel, isActive, onUserClick }: ReelCardProps) {
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.reactions_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const { isFollowing, toggleFollow, loading: followLoading } = useConnections(reel.user_id);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportReason.trim()) return;
    setIsSubmittingReport(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_id: reel.id,
        target_type: 'post',
        reason: reportReason.trim()
      });
      if (error) throw error;
      toast.success('Report submitted. Our team will review this reel.');
      setIsReporting(false);
      setReportReason('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    if (user) {
      checkIfLiked();
    }
  }, [user, reel.id]);

  async function checkIfLiked() {
    const { data } = await supabase
      .from('reactions')
      .select('*')
      .eq('post_id', reel.id)
      .eq('user_id', user?.id)
      .single();
    
    setIsLiked(!!data);
  }

  const toggleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like reels');
      return;
    }

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        await supabase.from('reactions').delete().eq('post_id', reel.id).eq('user_id', user.id);
      } else {
        await supabase.from('reactions').insert({ post_id: reel.id, user_id: user.id, type: 'like' });
      }
    } catch (error) {
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'Check out this reel!',
        text: reel.content,
        url: window.location.href
      });
    } catch (error) {
      // Fallback to copy link
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles (*)')
      .eq('post_id', reel.id)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: reel.id,
          user_id: user.id,
          text: newComment.trim()
        })
        .select('*, profiles (*)')
        .single();
      if (error) throw error;
      setComments(prev => [...prev, data]);
      setNewComment('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments]);

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={reel.media_url || ''}
        className="h-full w-full object-contain cursor-pointer"
        loop
        playsInline
        onClick={() => {
          if (videoRef.current?.paused) videoRef.current.play();
          else videoRef.current?.pause();
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

      {/* Right Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-10">
        <button 
          onClick={toggleLike}
          className="flex flex-col items-center gap-1 group"
        >
          <div className={cn(
            "p-3 rounded-full backdrop-blur-md transition-all active:scale-90",
            isLiked ? "bg-rose-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
          )}>
            <Heart className={cn("w-7 h-7", isLiked && "fill-current")} />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">{likesCount}</span>
        </button>

        <button 
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90">
            <MessageCircle className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">{reel.comments_count || 0}</span>
        </button>

        <button 
          onClick={handleShare}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90">
            <Share2 className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">{reel.shares_count || 0}</span>
        </button>

        <button 
          onClick={() => setIsReporting(true)}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90">
            <Flag className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">Report</span>
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-full border-2 border-white overflow-hidden cursor-pointer"
            onClick={() => onUserClick(reel.user_id)}
          >
            {reel.profiles?.avatar_url ? (
              <img src={reel.profiles.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                {reel.profiles?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div 
              className="flex items-center gap-1 cursor-pointer group/name"
              onClick={() => onUserClick(reel.user_id)}
            >
              <h3 className="text-white font-bold text-lg group-hover/name:underline">
                @{reel.profiles?.username}
              </h3>
              {reel.profiles?.is_verified && (
                <CheckCircle className="w-4 h-4 text-blue-500 fill-current shadow-sm" />
              )}
            </div>
            {user?.id !== reel.user_id && (
              <button 
                onClick={toggleFollow}
                disabled={followLoading}
                className={cn(
                  "text-xs font-bold px-4 py-1 rounded-full mt-1 transition-all active:scale-95",
                  isFollowing 
                    ? "bg-white/20 text-white border border-white/30" 
                    : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                )}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>
        
        <p className="text-white text-sm mb-4 line-clamp-2">{reel.content}</p>
        
        <div className="flex items-center gap-2 text-white/80">
          <Music2 className="w-4 h-4 animate-spin-slow" />
          <span className="text-xs font-medium">Original Audio - {reel.profiles?.username}</span>
        </div>
      </div>

      {/* Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComments(false)}
              className="absolute inset-0 bg-black/40 z-40"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute bottom-0 left-0 right-0 h-[70%] bg-white rounded-t-[32px] z-50 flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Comments</h3>
                <button onClick={() => setShowComments(false)} className="p-2 hover:bg-gray-50 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                      {comment.profiles?.avatar_url ? (
                        <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                          {comment.profiles?.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-2xl px-4 py-2">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-bold text-gray-900">{comment.profiles?.username}</span>
                          {comment.profiles?.is_verified && (
                            <CheckCircle className="w-3 h-3 text-blue-500 fill-current shadow-sm" />
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm">No comments yet. Be the first!</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleAddComment} className="p-4 border-t border-gray-100 bg-white">
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button 
                    type="submit"
                    disabled={isSubmitting || !newComment.trim()}
                    className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
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
                  Report Reel
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
                    placeholder="Please describe why you are reporting this reel..."
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
                    disabled={isSubmittingReport || !reportReason.trim()}
                    className="flex-1 px-6 py-3 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 text-sm disabled:opacity-50"
                  >
                    {isSubmittingReport ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Report'}
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

export default function Reels({ onUserClick }: { onUserClick: (id: string) => void }) {
  const [reels, setReels] = useState<Post[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBlockedIds();
    fetchReels();
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

  async function fetchReels() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles (*)')
        .eq('post_type', 'reel')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReels(data || []);
    } catch (error) {
      console.error('Error fetching reels:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const height = e.currentTarget.clientHeight;
    const index = Math.round(scrollTop / height);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-black rounded-[32px]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center bg-black rounded-[32px] text-white p-8 text-center">
        <Video className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Reels Yet</h2>
        <p className="text-gray-400">Be the first to share a video reel with the community!</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-120px)] w-full max-w-[450px] mx-auto bg-black rounded-[32px] overflow-hidden shadow-2xl">
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {reels
          .filter(reel => !blockedIds.includes(reel.user_id))
          .map((reel, index) => (
            <div key={reel.id} className="h-full w-full snap-start">
              <ReelCard 
                reel={reel} 
                isActive={index === activeIndex} 
                onUserClick={onUserClick}
              />
            </div>
          ))}
      </div>

      {/* Navigation Arrows */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
        <button 
          onClick={() => containerRef.current?.scrollBy({ top: -containerRef.current.clientHeight, behavior: 'smooth' })}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
        <button 
          onClick={() => containerRef.current?.scrollBy({ top: containerRef.current.clientHeight, behavior: 'smooth' })}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
