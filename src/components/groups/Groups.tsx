import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Group, Profile } from '../../types';
import { useAuth } from '../../lib/useAuth';
import { Users, Plus, Search, Globe, Lock, MoreHorizontal, UserPlus, LogOut, Settings, Shield, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Groups() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupPosts, setGroupPosts] = useState<any[]>([]);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [groupPostContent, setGroupPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGroup || !user) return;

    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedGroup.id}-${Math.random()}.${fileExt}`;
      const filePath = `group-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('groups')
        .update({ cover_url: publicUrl })
        .eq('id', selectedGroup.id);

      if (updateError) throw updateError;

      setSelectedGroup({ ...selectedGroup, cover_url: publicUrl });
      toast.success('Group cover updated!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCreateGroupPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !user || !groupPostContent.trim()) return;

    setIsPosting(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          group_id: selectedGroup.id,
          content: groupPostContent.trim(),
          privacy: 'public' // Group posts are public within the group
        })
        .select('*, profiles(*)')
        .single();

      if (error) throw error;

      setGroupPosts([data, ...groupPosts]);
      setGroupPostContent('');
      toast.success('Post shared to group!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsPosting(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    if (user) fetchMyGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupData(selectedGroup.id);
    }
  }, [selectedGroup]);

  async function fetchGroupData(groupId: string) {
    // Fetch members
    const { data: members } = await supabase
      .from('group_members')
      .select('*, profiles(*)')
      .eq('group_id', groupId);
    if (members) setGroupMembers(members);

    // Fetch posts
    const { data: posts } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (posts) setGroupPosts(posts);
  }

  const isAdmin = (groupId: string) => {
    return groupMembers.some(m => m.user_id === user?.id && m.role === 'admin');
  };

  const isCreator = (group: Group) => group.created_by === user?.id;

  const handlePromoteToAdmin = async (memberUserId: string) => {
    if (!selectedGroup || !isCreator(selectedGroup)) return;
    const { error } = await supabase
      .from('group_members')
      .update({ role: 'admin' })
      .eq('group_id', selectedGroup.id)
      .eq('user_id', memberUserId);
    
    if (error) toast.error(error.message);
    else {
      toast.success('Member promoted to admin');
      fetchGroupData(selectedGroup.id);
    }
  };

  async function fetchGroups() {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setGroups(data);
    setLoading(false);
  }

  async function fetchMyGroups() {
    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user?.id);
    
    if (data) setMyGroups(data.map(m => m.group_id));
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newGroupName.trim()) return;

    setCreating(true);
    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          privacy: newGroupPrivacy,
          created_by: user.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      toast.success('Group created successfully!');
      setGroups([group, ...groups]);
      setMyGroups([...myGroups, group.id]);
      setIsCreateModalOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleJoin = async (groupId: string) => {
    if (!user) return;

    const isMember = myGroups.includes(groupId);
    try {
      if (isMember) {
        await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', user.id);
        setMyGroups(myGroups.filter(id => id !== groupId));
        toast.success('Left group');
      } else {
        await supabase
          .from('group_members')
          .insert({
            group_id: groupId,
            user_id: user.id,
            role: 'member'
          });
        setMyGroups([...myGroups, groupId]);
        toast.success('Joined group');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.description.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedGroup) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setSelectedGroup(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-bold text-sm"
        >
          <X className="w-4 h-4" />
          Back to Groups
        </button>

        <div className="card-premium overflow-hidden">
          <div className="h-48 sm:h-64 bg-emerald-50 relative group">
            {selectedGroup.cover_url ? (
              <img src={selectedGroup.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-emerald-400 to-teal-500" />
            )}
            {isAdmin(selectedGroup.id) && (
              <>
                <input 
                  type="file" 
                  ref={coverInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleCoverUpload}
                />
                <button 
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-xl text-gray-700 hover:bg-white transition-all shadow-sm opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  {uploadingCover ? <Plus className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                </button>
              </>
            )}
          </div>

          <div className="px-6 pb-8 relative">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-12 sm:-mt-16 mb-6">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[32px] bg-white p-1 shadow-xl relative z-10">
                <div className="w-full h-full rounded-[28px] bg-gray-100 flex items-center justify-center text-emerald-500 font-bold text-3xl">
                  {selectedGroup.avatar_url ? (
                    <img src={selectedGroup.avatar_url} alt="" className="w-full h-full object-cover rounded-[28px]" />
                  ) : (
                    selectedGroup.name[0].toUpperCase()
                  )}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{selectedGroup.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedGroup.privacy === 'public' ? <Globe className="w-3 h-3 text-gray-400" /> : <Lock className="w-3 h-3 text-gray-400" />}
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{selectedGroup.privacy} Group</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsMemberModalOpen(true)}
                      className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      {groupMembers.length} Members
                    </button>
                    <button 
                      onClick={() => toggleJoin(selectedGroup.id)}
                      className={cn(
                        "px-6 py-2 text-sm font-bold rounded-xl transition-all active:scale-95",
                        myGroups.includes(selectedGroup.id)
                          ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                      )}
                    >
                      {myGroups.includes(selectedGroup.id) ? 'Joined' : 'Join Group'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm max-w-2xl">{selectedGroup.description}</p>
          </div>
        </div>

        {myGroups.includes(selectedGroup.id) && (
          <div className="space-y-6">
            <div className="card-premium p-4">
              <h3 className="text-sm font-bold mb-4">Post to Group</h3>
              <form onSubmit={handleCreateGroupPost} className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-emerald-500 font-bold">
                      {profile?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text" 
                    value={groupPostContent}
                    onChange={(e) => setGroupPostContent(e.target.value)}
                    placeholder={`Write something to ${selectedGroup.name}...`}
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button 
                    type="submit"
                    disabled={isPosting || !groupPostContent.trim()}
                    className="btn-primary px-4 py-2 text-xs disabled:opacity-50"
                  >
                    {isPosting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              {groupPosts.map(post => (
                <div key={post.id} className="card-premium p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                      {post.profiles?.avatar_url && <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{post.profiles?.full_name || post.profiles?.username}</h4>
                      <p className="text-[10px] text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{post.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members Modal */}
        <AnimatePresence>
          {isMemberModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMemberModalOpen(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Group Members</h2>
                  <button onClick={() => setIsMemberModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-full">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto no-scrollbar space-y-2">
                  {groupMembers.map(member => (
                    <div key={member.user_id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                          {member.profiles?.avatar_url && <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">{member.profiles?.full_name || member.profiles?.username}</h4>
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{member.role}</span>
                        </div>
                      </div>
                      {isCreator(selectedGroup) && member.role === 'member' && (
                        <button 
                          onClick={() => handlePromoteToAdmin(member.user_id)}
                          className="text-[10px] font-bold text-emerald-600 hover:underline"
                        >
                          Make Admin
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Groups</h2>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-50 rounded-[32px] animate-pulse" />
          ))
        ) : (
          filteredGroups.map((group) => (
            <div 
              key={group.id} 
              onClick={() => setSelectedGroup(group)}
              className="card-premium overflow-hidden group cursor-pointer"
            >
              <div className="h-24 bg-gradient-to-r from-emerald-400 to-teal-500 relative">
                {group.cover_url && (
                  <img src={group.cover_url} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute -bottom-6 left-6">
                  <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-xl">
                    <div className="w-full h-full rounded-xl bg-gray-100 flex items-center justify-center text-emerald-500 font-bold text-xl">
                      {group.avatar_url ? (
                        <img src={group.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        group.name[0].toUpperCase()
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 pt-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {group.privacy === 'public' ? (
                        <Globe className="w-3 h-3 text-gray-400" />
                      ) : (
                        <Lock className="w-3 h-3 text-gray-400" />
                      )}
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {group.privacy} Group
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleJoin(group.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95",
                      myGroups.includes(group.id)
                        ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                    )}
                  >
                    {myGroups.includes(group.id) ? 'Joined' : 'Join'}
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                  {group.description || 'No description provided.'}
                </p>
                <div className="mt-4 flex items-center gap-4 text-[10px] font-bold text-gray-400">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {group.members_count || 0} Members
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleCreateGroup}>
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Create New Group</h2>
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-full">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Group Name</label>
                    <input 
                      type="text" 
                      required
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. Photography Enthusiasts"
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</label>
                    <textarea 
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="What is this group about?"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Privacy</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'public', label: 'Public', icon: Globe, desc: 'Anyone can see and join' },
                        { id: 'private', label: 'Private', icon: Lock, desc: 'Only members can see content' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNewGroupPrivacy(opt.id as any)}
                          className={cn(
                            "flex-1 p-4 rounded-2xl border-2 transition-all text-left",
                            newGroupPrivacy === opt.id 
                              ? "border-emerald-500 bg-emerald-50/50" 
                              : "border-gray-50 bg-gray-50 hover:bg-gray-100"
                          )}
                        >
                          <opt.icon className={cn("w-5 h-5 mb-2", newGroupPrivacy === opt.id ? "text-emerald-500" : "text-gray-400")} />
                          <div className={cn("text-sm font-bold", newGroupPrivacy === opt.id ? "text-emerald-700" : "text-gray-700")}>{opt.label}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gray-50 flex gap-3">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 btn-secondary py-3">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={creating || !newGroupName.trim()}
                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                  >
                    {creating ? 'Creating...' : 'Create Group'}
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
