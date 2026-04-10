import React, { useState, useEffect, useRef } from 'react';
import { Plus, User as UserIcon, X, ChevronLeft, ChevronRight, Loader2, Trash2, Heart, Send, Smile } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';
import { Story, StoryReaction } from '../../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../lib/utils';

interface UserStories {
  userId: string;
  profile: any;
  stories: Story[];
}

export default function StoryBar() {
  const { user, profile } = useAuth();
  const [userStories, setUserStories] = useState<UserStories[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeUserIndex, setActiveUserIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instanceId = useState(() => Math.random().toString(36).substring(7))[0];

  useEffect(() => {
    fetchStories();
  }, [blockedIds]);

  useEffect(() => {
    fetchBlockedIds();

    const storiesChannel = supabase
      .channel(`public:stories:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        fetchStories();
      })
      .subscribe();

    const reactionsChannel = supabase
      .channel(`public:story_reactions:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_reactions' }, () => {
        fetchStories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(storiesChannel);
      supabase.removeChannel(reactionsChannel);
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

  async function fetchStories() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('stories')
      .select('*, profiles (*), story_reactions (*, profiles (*))')
      .gt('expires_at', now)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching stories:', error);
    } else if (data) {
      // Group stories by user and filter out blocked users
      const grouped = data.reduce((acc: UserStories[], story: any) => {
        if (blockedIds.includes(story.user_id)) return acc;
        
        const existing = acc.find(u => u.userId === story.user_id);
        if (existing) {
          existing.stories.push(story);
        } else {
          acc.push({
            userId: story.user_id,
            profile: story.profiles,
            stories: [story]
          });
        }
        return acc;
      }, []);
      
      // Put current user's stories first if they exist
      const currentUserStories = grouped.find(u => u.userId === user?.id);
      const otherUserStories = grouped.filter(u => u.userId !== user?.id);
      
      setUserStories(currentUserStories ? [currentUserStories, ...otherUserStories] : otherUserStories);
    }
    setLoading(false);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `stories/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: user.id,
        image_url: publicUrl,
        expires_at: expiresAt.toISOString()
      });

      if (insertError) throw insertError;
      toast.success('Story shared!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload story');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!window.confirm('Delete this story?')) return;

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

      if (error) throw error;
      toast.success('Story deleted');
      
      // If it was the last story in the group, close modal
      const currentUserGroup = userStories[activeUserIndex!];
      if (currentUserGroup.stories.length === 1) {
        setActiveUserIndex(null);
      } else {
        // Move to next story or previous if it was the last one
        if (activeStoryIndex >= currentUserGroup.stories.length - 1) {
          setActiveStoryIndex(prev => prev - 1);
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReact = async (type: string) => {
    if (!user || activeUserIndex === null) return;
    const story = userStories[activeUserIndex].stories[activeStoryIndex];
    
    try {
      // 1. Save to story_reactions table
      const { error: reactionError } = await supabase
        .from('story_reactions')
        .insert({
          story_id: story.id,
          user_id: user.id,
          emoji: type
        });

      if (reactionError) throw reactionError;

      // 2. Send as a message
      await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: story.user_id,
        content: `Reacted to your story: ${type}`,
        media_url: story.image_url,
        media_type: 'image'
      });

      toast.success(`Reacted with ${type}!`);
    } catch (error: any) {
      console.error('Error reacting:', error);
      toast.error('Failed to send reaction');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeUserIndex === null || !replyText.trim()) return;
    const story = userStories[activeUserIndex].stories[activeStoryIndex];
    
    setIsSendingReply(true);
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: story.user_id,
        content: replyText.trim(),
        media_url: story.image_url,
        media_type: 'image'
      });

      if (error) throw error;
      toast.success('Reply sent!');
      setReplyText('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const nextStory = () => {
    if (activeUserIndex === null) return;
    const currentGroup = userStories[activeUserIndex];
    
    if (activeStoryIndex < currentGroup.stories.length - 1) {
      setActiveStoryIndex(prev => prev + 1);
    } else if (activeUserIndex < userStories.length - 1) {
      setActiveUserIndex(prev => prev! + 1);
      setActiveStoryIndex(0);
    } else {
      setActiveUserIndex(null);
    }
  };

  const prevStory = () => {
    if (activeUserIndex === null) return;
    
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    } else if (activeUserIndex > 0) {
      const prevGroup = userStories[activeUserIndex - 1];
      setActiveUserIndex(activeUserIndex - 1);
      setActiveStoryIndex(prevGroup.stories.length - 1);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {/* Create Story */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 w-32 h-48 rounded-[24px] bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-100 hover:border-emerald-300 transition-all group relative overflow-hidden"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              <span className="text-[10px] font-bold text-gray-400">Uploading...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-gray-500">Add Story</span>
            </>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Story Items (Grouped by User) */}
        {userStories.map((group, index) => (
          <div 
            key={group.userId} 
            onClick={() => {
              setActiveUserIndex(index);
              setActiveStoryIndex(0);
            }}
            className="flex-shrink-0 w-32 h-48 rounded-[24px] overflow-hidden relative cursor-pointer group border-2 border-transparent hover:border-emerald-500 transition-all"
          >
            <img 
              src={group.stories[0].image_url} 
              alt={group.profile?.username} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            <div className="absolute top-3 left-3 w-9 h-9 rounded-full border-2 border-emerald-500 p-0.5 bg-white">
              {group.profile?.avatar_url ? (
                <img 
                  src={group.profile.avatar_url} 
                  alt="" 
                  className="w-full h-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
            
            <span className="absolute bottom-3 left-3 right-3 text-[10px] font-bold text-white truncate">
              {group.profile?.full_name || group.profile?.username}
            </span>
            
            {group.stories.length > 1 && (
              <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {group.stories.length}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {activeUserIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 sm:p-8"
          >
            <button 
              onClick={() => setActiveUserIndex(null)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md z-[110]"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="relative w-full max-w-lg aspect-[9/16] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              <div className="relative flex-1">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={userStories[activeUserIndex].stories[activeStoryIndex].id}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    src={userStories[activeUserIndex].stories[activeStoryIndex].image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {/* Progress Bar */}
                <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
                  {userStories[activeUserIndex].stories.map((_, i) => (
                    <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: i === activeStoryIndex ? '100%' : i < activeStoryIndex ? '100%' : '0%' }}
                        transition={{ duration: i === activeStoryIndex ? 5 : 0, ease: 'linear' }}
                        onAnimationComplete={() => i === activeStoryIndex && nextStory()}
                        className="h-full bg-white"
                      />
                    </div>
                  ))}
                </div>

                {/* User Info */}
                <div className="absolute top-10 left-4 flex items-center gap-3 z-20">
                  <div className="w-10 h-10 rounded-full border-2 border-white p-0.5">
                    {userStories[activeUserIndex].profile?.avatar_url ? (
                      <img src={userStories[activeUserIndex].profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <UserIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{userStories[activeUserIndex].profile?.full_name || userStories[activeUserIndex].profile?.username}</h4>
                    <p className="text-[10px] text-white/60">{formatDate(userStories[activeUserIndex].stories[activeStoryIndex].created_at)}</p>
                  </div>
                </div>

                {/* Reactions Display */}
                <div className="absolute bottom-24 left-4 right-4 flex flex-wrap gap-2 z-20">
                  <AnimatePresence>
                    {userStories[activeUserIndex].stories[activeStoryIndex].story_reactions?.map((reaction: any) => (
                      <motion.div
                        key={reaction.id}
                        initial={{ opacity: 0, scale: 0, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/30"
                      >
                        <span className="text-sm">{reaction.emoji}</span>
                        <span className="text-[8px] font-bold text-white/80">@{reaction.profiles?.username}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Delete Button (if own story) */}
                {user?.id === userStories[activeUserIndex].stories[activeStoryIndex].user_id && (
                  <button 
                    onClick={() => handleDeleteStory(userStories[activeUserIndex].stories[activeStoryIndex].id)}
                    className="absolute top-10 right-4 p-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-500 rounded-xl backdrop-blur-md transition-all z-20"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}

                {/* Navigation */}
                <button 
                  onClick={(e) => { e.stopPropagation(); prevStory(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md z-20 disabled:opacity-0"
                  disabled={activeUserIndex === 0 && activeStoryIndex === 0}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); nextStory(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md z-20"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Story Actions (Reactions & Reply) */}
              {user?.id !== userStories[activeUserIndex].userId && (
                <div className="p-4 bg-gradient-to-t from-black/80 to-transparent z-20">
                  <div className="flex items-center gap-2 mb-4">
                    {['❤️', '🔥', '😂', '😮', '😢', '👏'].map(emoji => (
                      <button 
                        key={emoji}
                        onClick={() => handleReact(emoji)}
                        className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xl transition-all active:scale-90"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleReply} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Send a message..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/50 outline-none focus:bg-white/20 transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={isSendingReply || !replyText.trim()}
                      className="p-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
                    >
                      {isSendingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
