import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { toast } from 'sonner';
import { Image as ImageIcon, Video, Smile, Send, X, Camera, Loader2, Users, Globe, Lock, Shield, Search } from 'lucide-react';
import { Profile } from '../../types';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function CreatePost() {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [postType, setPostType] = useState<'post' | 'reel'>('post');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<Profile[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isFeelingModalOpen, setIsFeelingModalOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const feelings = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😇', label: 'Blessed' },
    { emoji: '😍', label: 'Loved' },
    { emoji: '😎', label: 'Cool' },
    { emoji: '🥳', label: 'Excited' },
    { emoji: '😴', label: 'Tired' },
    { emoji: '🤔', label: 'Thinking' },
    { emoji: '🤒', label: 'Sick' },
    { emoji: '😤', label: 'Angry' },
    { emoji: '😭', label: 'Sad' },
  ];

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${query}%`)
      .neq('id', user?.id)
      .limit(5);
    setSearchResults(data || []);
    setSearching(false);
  };

  const toggleTagUser = (profile: Profile) => {
    setTaggedUsers(prev => 
      prev.find(u => u.id === profile.id) 
        ? prev.filter(u => u.id !== profile.id)
        : [...prev, profile]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file type
    if (type === 'image' && !file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (type === 'video' && !file.type.startsWith('video/')) {
      toast.error('Please upload a video file');
      return;
    }

    // Check file size (max 20MB for video, 5MB for image)
    const maxSize = type === 'video' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${type === 'video' ? '20MB' : '5MB'}`);
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setMediaUrl(publicUrl);
      setMediaType(type);
      if (type === 'video') setPostType('reel');
      toast.success(`${type === 'image' ? 'Photo' : 'Video'} uploaded!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaUrl) return;
    if (!user) return;

    setLoading(true);
    try {
      // Extract hashtags
      const hashtags = content.match(/#[a-z0-9_]+/gi) || [];
      const cleanHashtags = hashtags.map(tag => tag.slice(1).toLowerCase());

      const { data: postData, error: postError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim(),
        media_url: mediaUrl || null,
        media_type: mediaType,
        post_type: postType,
        privacy: privacy,
        feeling: feeling,
        tagged_users: taggedUsers.map(u => u.id)
      }).select().single();

      if (postError) throw postError;

      // Save hashtags
      if (cleanHashtags.length > 0 && postData) {
        for (const tagName of cleanHashtags) {
          // 1. Ensure hashtag exists
          const { data: tagData, error: tagError } = await supabase
            .from('hashtags')
            .upsert({ name: tagName }, { onConflict: 'name' })
            .select()
            .single();
          
          if (tagData) {
            // 2. Link post to hashtag
            await supabase.from('post_hashtags').insert({
              post_id: postData.id,
              hashtag_id: tagData.id
            });
          }
        }
      }
      
      setContent('');
      setMediaUrl('');
      setMediaType(null);
      setPostType('post');
      setFeeling(null);
      setTaggedUsers([]);
      setPrivacy('public');
      toast.success('Post shared successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-premium p-4 sm:p-6 mb-6">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
              {profile?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsPrivacyOpen(!isPrivacyOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 transition-all active:scale-95"
              >
                {privacy === 'public' && <Globe className="w-3 h-3" />}
                {privacy === 'friends' && <Users className="w-3 h-3" />}
                {privacy === 'private' && <Lock className="w-3 h-3" />}
                <span className="capitalize">{privacy}</span>
              </button>
              
              <AnimatePresence>
                {isPrivacyOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsPrivacyOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden"
                    >
                      {[
                        { id: 'public', label: 'Public', icon: Globe },
                        { id: 'friends', label: 'Friends', icon: Users },
                        { id: 'private', label: 'Only Me', icon: Lock },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setPrivacy(opt.id as any);
                            setIsPrivacyOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold transition-colors",
                            privacy === opt.id ? "bg-emerald-50 text-emerald-600" : "text-gray-500 hover:bg-gray-50"
                          )}
                        >
                          <opt.icon className="w-3 h-3" />
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {feeling && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg text-[10px] font-bold text-amber-600">
                <span>Feeling {feeling}</span>
                <button type="button" onClick={() => setFeeling(null)}><X className="w-3 h-3" /></button>
              </div>
            )}

            {taggedUsers.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg text-[10px] font-bold text-blue-600">
                <span>with {taggedUsers.length} others</span>
                <button type="button" onClick={() => setTaggedUsers([])}><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>

          <textarea
            placeholder={`What's on your mind, ${profile?.full_name?.split(' ')[0] || 'friend'}?`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-gray-400 resize-none min-h-[100px] outline-none font-medium"
          />

          {mediaUrl && (
            <div className="mt-4 relative rounded-2xl overflow-hidden group">
              {mediaType === 'video' ? (
                <video 
                  src={mediaUrl} 
                  controls 
                  className="w-full aspect-video object-cover"
                />
              ) : (
                <img 
                  src={mediaUrl} 
                  alt="Upload preview" 
                  className="w-full aspect-video object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <button 
                type="button"
                onClick={() => {
                  setMediaUrl('');
                  setMediaType(null);
                }}
                className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploading && (
            <div className="mt-4 p-8 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm font-bold text-gray-500">Uploading your media...</p>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e, mediaType || 'image')}
            accept={mediaType === 'video' ? "video/*" : "image/*"}
            className="hidden"
          />

          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={() => {
                  setMediaType('image');
                  setTimeout(() => fileInputRef.current?.click(), 0);
                }}
                disabled={uploading}
                className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <ImageIcon className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline">Photo</span>
              </button>
              <button 
                type="button"
                onClick={() => {
                  setMediaType('video');
                  setTimeout(() => fileInputRef.current?.click(), 0);
                }}
                disabled={uploading}
                className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Video className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline">Video</span>
              </button>
              <button 
                type="button" 
                onClick={() => setIsFeelingModalOpen(true)}
                className="p-2 hover:bg-amber-50 text-amber-600 rounded-xl transition-colors flex items-center gap-2"
              >
                <Smile className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline">Feeling</span>
              </button>
              <button 
                type="button" 
                onClick={() => setIsTagModalOpen(true)}
                className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors flex items-center gap-2"
              >
                <Users className="w-5 h-5" />
                <span className="text-xs font-bold hidden sm:inline">Tag</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || uploading || (!content.trim() && !mediaUrl)}
              className="btn-primary px-5 py-2 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="font-bold">Share</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* Feeling Modal */}
      <AnimatePresence>
        {isFeelingModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFeelingModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold">How are you feeling?</h2>
                <button onClick={() => setIsFeelingModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-3">
                {feelings.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => {
                      setFeeling(`${f.emoji} ${f.label}`);
                      setIsFeelingModalOpen(false);
                    }}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
                  >
                    <span className="text-2xl">{f.emoji}</span>
                    <span className="text-sm font-bold text-gray-700">{f.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tag Modal */}
      <AnimatePresence>
        {isTagModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTagModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold">Tag Friends</h2>
                <button onClick={() => setIsTagModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6">
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search friends..."
                    value={searchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
                  {searching ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleTagUser(p)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-2xl transition-all",
                          taggedUsers.find(u => u.id === p.id) ? "bg-emerald-50 border-emerald-100" : "hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                                {p.username[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <h4 className="text-sm font-bold text-gray-900">{p.full_name || p.username}</h4>
                            <p className="text-[10px] text-gray-400 font-medium">@{p.username}</p>
                          </div>
                        </div>
                        {taggedUsers.find(u => u.id === p.id) && (
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <Shield className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))
                  ) : searchQuery.length >= 2 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">No users found</p>
                  ) : (
                    <p className="text-center py-8 text-gray-400 text-sm">Type to search for friends</p>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="w-full btn-primary py-3 mt-6"
                >
                  Done ({taggedUsers.length} tagged)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
