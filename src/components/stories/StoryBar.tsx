import React, { useState, useEffect, useRef } from 'react';
import { Plus, User as UserIcon, X, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';
import { Story } from '../../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../lib/utils';

export default function StoryBar() {
  const { user, profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instanceId = useState(() => Math.random().toString(36).substring(7))[0];

  useEffect(() => {
    fetchStories();

    const channel = supabase
      .channel(`public:stories:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        fetchStories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchStories() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('stories')
      .select('*, profiles (*)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stories:', error);
    } else {
      setStories(data || []);
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
      setActiveStoryIndex(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const nextStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else {
      setActiveStoryIndex(null);
    }
  };

  const prevStory = () => {
    if (activeStoryIndex !== null && activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
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

        {/* Story Items */}
        {stories.map((story, index) => (
          <div 
            key={story.id} 
            onClick={() => setActiveStoryIndex(index)}
            className="flex-shrink-0 w-32 h-48 rounded-[24px] overflow-hidden relative cursor-pointer group border-2 border-transparent hover:border-emerald-500 transition-all"
          >
            <img 
              src={story.image_url} 
              alt={story.profiles?.username} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            <div className="absolute top-3 left-3 w-9 h-9 rounded-full border-2 border-emerald-500 p-0.5 bg-white">
              {story.profiles?.avatar_url ? (
                <img 
                  src={story.profiles.avatar_url} 
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
              {story.profiles?.full_name || story.profiles?.username}
            </span>
          </div>
        ))}
      </div>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {activeStoryIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 sm:p-8"
          >
            <button 
              onClick={() => setActiveStoryIndex(null)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md z-[110]"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="relative w-full max-w-lg aspect-[9/16] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl">
              <AnimatePresence mode="wait">
                <motion.img
                  key={stories[activeStoryIndex].id}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  src={stories[activeStoryIndex].image_url}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              {/* Progress Bar */}
              <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
                {stories.map((_, i) => (
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
                  {stories[activeStoryIndex].profiles?.avatar_url ? (
                    <img src={stories[activeStoryIndex].profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{stories[activeStoryIndex].profiles?.full_name || stories[activeStoryIndex].profiles?.username}</h4>
                  <p className="text-[10px] text-white/60">{formatDate(stories[activeStoryIndex].created_at)}</p>
                </div>
              </div>

              {/* Delete Button (if own story) */}
              {user?.id === stories[activeStoryIndex].user_id && (
                <button 
                  onClick={() => handleDeleteStory(stories[activeStoryIndex].id)}
                  className="absolute bottom-6 right-6 p-3 bg-rose-500/20 hover:bg-rose-500/40 text-rose-500 rounded-2xl backdrop-blur-md transition-all z-20"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              {/* Navigation */}
              <button 
                onClick={(e) => { e.stopPropagation(); prevStory(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md z-20 disabled:opacity-0"
                disabled={activeStoryIndex === 0}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
