import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Post } from '../../types';
import { Heart, MessageCircle, Share2, Music2, User as UserIcon, Loader2, ChevronUp, ChevronDown, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/useAuth';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface ReelCardProps {
  reel: Post;
  isActive: boolean;
}

function ReelCard({ reel, isActive }: ReelCardProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.reactions_count || 0);

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

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={reel.media_url || ''}
        className="h-full w-full object-contain"
        loop
        playsInline
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

        <button className="flex flex-col items-center gap-1 group">
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90">
            <MessageCircle className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">{reel.comments_count || 0}</span>
        </button>

        <button className="flex flex-col items-center gap-1 group">
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90">
            <Share2 className="w-7 h-7" />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">{reel.shares_count || 0}</span>
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
            {reel.profiles?.avatar_url ? (
              <img src={reel.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                {reel.profiles?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">@{reel.profiles?.username}</h3>
            <button className="text-xs font-bold text-white/80 hover:text-white border border-white/30 px-3 py-1 rounded-full mt-1">
              Follow
            </button>
          </div>
        </div>
        
        <p className="text-white text-sm mb-4 line-clamp-2">{reel.content}</p>
        
        <div className="flex items-center gap-2 text-white/80">
          <Music2 className="w-4 h-4 animate-spin-slow" />
          <span className="text-xs font-medium">Original Audio - {reel.profiles?.username}</span>
        </div>
      </div>
    </div>
  );
}

export default function Reels() {
  const [reels, setReels] = useState<Post[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReels();
  }, []);

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
        {reels.map((reel, index) => (
          <div key={reel.id} className="h-full w-full snap-start">
            <ReelCard reel={reel} isActive={index === activeIndex} />
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
