import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { Post, Profile } from '../../types';
import PostCard from '../feed/PostCard';
import { Edit3, MapPin, Link as LinkIcon, Calendar, Grid, List, Heart, X, Camera, MessageCircle, MoreHorizontal, ShieldAlert, Flag, Copy, Loader2, Shield } from 'lucide-react';
import VerificationBadge from '../VerificationBadge';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { useConnections } from '../../lib/useConnections';

interface ProfilePageProps {
  userId: string;
  onNavigate?: (page: any, id?: string) => void;
}

export default function ProfilePage({ userId, onNavigate }: ProfilePageProps) {
  const { user, profile: myProfile, updateProfile } = useAuth();
  const { isFollowing, toggleFollow, loading: followLoading } = useConnections(userId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'likes' | 'media'>('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockingMe, setIsBlockingMe] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState<'followers' | 'following' | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [connectionsList, setConnectionsList] = useState<Profile[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const instanceId = useState(() => Math.random().toString(36).substring(7))[0];
  
  const isOwnProfile = user?.id === userId;

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    bio: '',
    workplace: '',
    address: '',
    school: '',
    avatar_url: '',
    cover_url: ''
  });

  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchUserPosts();
      fetchCounts();
      fetchLikedPosts();
      checkBlockStatus();

      const profileChannel = supabase
        .channel(`profile-${userId}-${instanceId}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `id=eq.${userId}` 
        }, (payload) => {
          setProfile(payload.new as Profile);
        })
        .subscribe();

      const connectionsChannel = supabase
        .channel(`connections-${userId}-${instanceId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'connections'
        }, () => {
          fetchCounts();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(connectionsChannel);
      };
    }
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function checkBlockStatus() {
    if (!user || isOwnProfile) return;
    try {
      // Check if I blocked them
      const { data: blockedByMe } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId)
        .single();
      
      setIsBlocked(!!blockedByMe);

      // Check if they blocked me
      const { data: blockedByThem } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', userId)
        .eq('blocked_id', user.id)
        .single();
      
      setIsBlockingMe(!!blockedByThem);
    } catch (error) {
      console.error('Error checking block status:', error);
    }
  }

  const toggleBlock = async () => {
    if (!user || isOwnProfile) return;
    
    try {
      if (isBlocked) {
        const { error } = await supabase
          .from('blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', userId);
        if (error) throw error;
        setIsBlocked(false);
        toast.success('User unblocked');
      } else {
        if (!showBlockConfirm) {
          setShowBlockConfirm(true);
          return;
        }

        const { error } = await supabase
          .from('blocks')
          .insert({
            blocker_id: user.id,
            blocked_id: userId
          });
        if (error) throw error;
        setIsBlocked(true);
        setShowBlockConfirm(false);
        toast.success('User blocked');
        setIsMenuOpen(false);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  async function fetchCounts() {
    const { count: followers } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('status', 'accepted');
    
    const { count: following } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .eq('status', 'accepted');
    
    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);
  }

  async function fetchConnections(type: 'followers' | 'following') {
    setConnectionsLoading(true);
    try {
      const query = supabase
        .from('connections')
        .select(`
          profiles: ${type === 'followers' ? 'sender_id' : 'receiver_id'} (*)
        `)
        .eq(type === 'followers' ? 'receiver_id' : 'sender_id', userId)
        .eq('status', 'accepted');

      const { data, error } = await query;
      if (error) throw error;
      
      const profiles = data.map((item: any) => item.profiles);
      setConnectionsList(profiles);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setConnectionsLoading(false);
    }
  }

  useEffect(() => {
    if (showConnectionsModal) {
      fetchConnections(showConnectionsModal);
    }
  }, [showConnectionsModal]);

  useEffect(() => {
    if (myProfile && isOwnProfile) {
      setEditForm({
        full_name: myProfile.full_name || '',
        username: myProfile.username || '',
        bio: myProfile.bio || '',
        workplace: myProfile.workplace || '',
        address: myProfile.address || '',
        school: myProfile.school || '',
        avatar_url: myProfile.avatar_url || '',
        cover_url: myProfile.cover_url || ''
      });
    }
  }, [myProfile, isOwnProfile]);

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  }

  async function fetchUserPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles (*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLikedPosts() {
    if (!userId) return;
    try {
      const { data: reactions } = await supabase
        .from('reactions')
        .select('post_id')
        .eq('user_id', userId)
        .eq('type', 'like');
      
      if (reactions && reactions.length > 0) {
        const postIds = reactions.map(r => r.post_id);
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, profiles (*)')
          .in('id', postIds)
          .order('created_at', { ascending: false });
        
        if (postsData) setLikedPosts(postsData);
      } else {
        setLikedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching liked posts:', error);
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(type);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${type}-${Math.random()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const updateData = type === 'avatar' ? { avatar_url: publicUrl } : { cover_url: publicUrl };
      const { error: updateError } = await updateProfile(updateData);
      
      if (updateError) throw updateError;
      
      setEditForm(prev => ({ ...prev, ...updateData }));
      setProfile(prev => prev ? { ...prev, ...updateData } : null);
      toast.success(`${type === 'avatar' ? 'Profile' : 'Cover'} picture updated!`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await updateProfile(editForm);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated!');
      setIsEditModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card-premium overflow-hidden">
        {/* Cover Photo */}
        <div className="h-48 sm:h-64 bg-emerald-50 relative group">
          {profile?.cover_url ? (
            <img 
              src={profile.cover_url} 
              alt="Cover" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-emerald-400 to-teal-500" />
          )}
          
          {isOwnProfile && (
            <>
              <input 
                type="file" 
                ref={coverInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'cover')}
              />
              <button 
                onClick={() => coverInputRef.current?.click()}
                disabled={!!uploading}
                className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md p-2.5 rounded-xl text-emerald-600 hover:bg-white transition-all shadow-lg z-20 border border-emerald-100 active:scale-95"
                title="Update Cover Photo"
              >
                {uploading === 'cover' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              </button>
            </>
          )}
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-12 sm:-mt-16 mb-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[32px] bg-white p-1 shadow-xl relative z-10 group">
              <div className="w-full h-full rounded-[28px] bg-gray-100 overflow-hidden relative">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-bold">
                    {profile?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                
                {isOwnProfile && (
                  <>
                    <input 
                      type="file" 
                      ref={avatarInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'avatar')}
                    />
                    <div 
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/20 flex items-center justify-center hover:bg-black/40 transition-all cursor-pointer group/avatar"
                    >
                      <div className="bg-white/90 p-2 rounded-xl shadow-lg transform scale-90 group-hover/avatar:scale-100 transition-all">
                        {uploading === 'avatar' ? <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" /> : <Camera className="w-5 h-5 text-emerald-600" />}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{profile?.full_name || profile?.username}</h1>
                    {profile?.is_verified && (
                      <VerificationBadge size="lg" />
                    )}
                  </div>
                  <p className="text-gray-500 font-medium">@{profile?.username}</p>
                </div>
                <div className="flex gap-3">
                  {isOwnProfile ? (
                    <button 
                      onClick={() => setIsEditModalOpen(true)}
                      className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button 
                        onClick={toggleFollow}
                        disabled={followLoading}
                        className={cn(
                          "px-8 py-2 text-sm font-bold rounded-full transition-all active:scale-95",
                          isFollowing 
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        )}
                      >
                        {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                      </button>
                      <button 
                        onClick={() => onNavigate?.('messages', userId)}
                        className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Message
                      </button>

                      <div className="relative" ref={menuRef}>
                        <button 
                          onClick={() => setIsMenuOpen(!isMenuOpen)}
                          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20"
                            >
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(window.location.href);
                                  toast.success('Profile link copied!');
                                  setIsMenuOpen(false);
                                }}
                                className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Copy Link
                              </button>
                              <button 
                                onClick={async () => {
                                  if (!user) return;
                                  try {
                                    const { error } = await supabase.from('reports').insert({
                                      reporter_id: user.id,
                                      target_id: userId,
                                      target_type: 'user',
                                      reason: 'Reported from UI'
                                    });
                                    if (error) throw error;
                                    toast.info('Report submitted. Thank you for keeping OwnMe safe.');
                                    setIsMenuOpen(false);
                                  } catch (error: any) {
                                    toast.error(error.message);
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Flag className="w-4 h-4" />
                                Report User
                              </button>
                              <button 
                                onClick={toggleBlock}
                                className="w-full px-4 py-2 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                              >
                                <ShieldAlert className="w-4 h-4" />
                                {isBlocked ? 'Unblock User' : 'Block User'}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isBlockingMe ? (
            <div className="p-20 text-center">
              <ShieldAlert className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900">You are blocked</h3>
              <p className="text-gray-500">You cannot view this profile or its content.</p>
            </div>
          ) : isBlocked ? (
            <div className="p-20 text-center">
              <ShieldAlert className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900">User Blocked</h3>
              <p className="text-gray-500">You have blocked this user. Unblock them to see their content.</p>
              <button 
                onClick={toggleBlock}
                className="mt-4 px-6 py-2 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all"
              >
                Unblock User
              </button>
            </div>
          ) : (
            <>
              {/* Bio & Meta */}
              <div className="space-y-4 max-w-2xl">
                <p className="text-gray-700 leading-relaxed">
                  {profile?.bio || "No bio yet."}
                </p>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 font-medium">
                  {profile?.workplace && (
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      <span>Works at <span className="text-gray-900">{profile.workplace}</span></span>
                    </div>
                  )}
                  {profile?.school && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>Studied at <span className="text-gray-900">{profile.school}</span></span>
                    </div>
                  )}
                  {profile?.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>Lives in <span className="text-gray-900">{profile.address}</span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Joined April 2026</span>
                  </div>
                </div>

                <div className="flex gap-8 pt-2">
                  <button 
                    onClick={() => setShowConnectionsModal('followers')}
                    className="flex flex-col hover:opacity-70 transition-opacity"
                  >
                    <span className="text-lg font-bold text-gray-900">{followerCount}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Followers</span>
                  </button>
                  <button 
                    onClick={() => setShowConnectionsModal('following')}
                    className="flex flex-col hover:opacity-70 transition-opacity"
                  >
                    <span className="text-lg font-bold text-gray-900">{followingCount}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Following</span>
                  </button>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-gray-900">{posts.length}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Posts</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        {!isBlocked && !isBlockingMe && (
          <div className="px-6 border-t border-gray-50 flex gap-8">
            {[
              { id: 'posts', label: 'Posts', icon: Grid },
              { id: 'media', label: 'Media', icon: List },
              { id: 'likes', label: 'Likes', icon: Heart },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 py-4 border-b-2 transition-all font-bold text-sm",
                  activeTab === tab.id 
                    ? "border-emerald-500 text-emerald-600" 
                    : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Grid */}
      {!isBlocked && !isBlockingMe && (
        <div className="space-y-6">
          {loading ? (
            <div className="card-premium h-64 animate-pulse bg-gray-50" />
          ) : (
            (activeTab === 'likes' ? likedPosts : posts)
              .filter(post => {
                if (activeTab === 'posts') return true;
                if (activeTab === 'media') return !!post.media_url;
                if (activeTab === 'likes') return true;
                return true;
              })
              .map((post: Post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onHashtagClick={(tag) => onNavigate?.('hashtag', tag)}
                  onPostClick={(id) => onNavigate?.('post', id)}
                />
              ))
          )}
          {!loading && (activeTab === 'likes' ? likedPosts : posts).length === 0 && (
            <div className="text-center py-20 card-premium">
              <h3 className="text-xl font-bold text-gray-400">No posts yet</h3>
              <p className="text-gray-500 mt-2">Share your first update with the community!</p>
            </div>
          )}
        </div>
      )}

      {/* Connections Modal */}
      <AnimatePresence>
        {showConnectionsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConnectionsModal(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold capitalize">{showConnectionsModal}</h2>
                <button onClick={() => setShowConnectionsModal(null)} className="p-2 hover:bg-gray-50 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto no-scrollbar">
                {connectionsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : connectionsList.length > 0 ? (
                  <div className="space-y-2">
                    {connectionsList.map((p) => (
                      <div 
                        key={p.id} 
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-all cursor-pointer group"
                        onClick={() => {
                          setShowConnectionsModal(null);
                          onNavigate?.('profile', p.id);
                        }}
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
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{p.full_name || p.username}</h4>
                            <p className="text-[10px] text-gray-400 font-medium">@{p.username}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-400 font-medium">No {showConnectionsModal} yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Profile</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-[24px] bg-gray-100 overflow-hidden">
                      {editForm.avatar_url ? (
                        <img src={editForm.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400"><Camera className="w-8 h-8" /></div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[24px] cursor-pointer">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                    <input 
                      type="text" 
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                      className="input-premium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Username</label>
                    <input 
                      type="text" 
                      value={editForm.username}
                      onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                      className="input-premium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bio</label>
                  <textarea 
                    value={editForm.bio}
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                    rows={3}
                    className="input-premium resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Workplace</label>
                    <input 
                      type="text" 
                      value={editForm.workplace}
                      onChange={(e) => setEditForm({...editForm, workplace: e.target.value})}
                      placeholder="Where do you work?"
                      className="input-premium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">School</label>
                    <input 
                      type="text" 
                      value={editForm.school}
                      onChange={(e) => setEditForm({...editForm, school: e.target.value})}
                      placeholder="Where did you study?"
                      className="input-premium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Address</label>
                  <input 
                    type="text" 
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    placeholder="Where do you live?"
                    className="input-premium"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 btn-secondary py-3">Cancel</button>
                  <button type="submit" className="flex-1 btn-primary py-3">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
