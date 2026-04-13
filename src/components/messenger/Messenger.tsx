import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreHorizontal, MessageCircle, Send, User as UserIcon, Paperclip, Image as ImageIcon, FileText, Mic, X, Loader2, ChevronLeft, ShieldAlert, VolumeX, Check, CheckCheck, Trash2, Shield, Ban, MessageSquare, Heart, Smile, Share2, Edit3, Copy, Archive, Inbox, MessageSquareQuote } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { useBadges } from '../../lib/useBadges';
import { Message, Profile, Connection } from '../../types';
import { toast } from 'sonner';
import { usePresence } from '../../lib/usePresence';
import { cn, formatDate } from '../../lib/utils';
import VerificationBadge from '../VerificationBadge';
import { motion, AnimatePresence } from 'motion/react';
import { sendBrowserNotification } from '../../lib/notifications';
import { createNotification } from '../../services/notificationService';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';
import VideoPlayer from './VideoPlayer';

interface MessengerProps {
  initialContactId?: string | null;
  onUserClick?: (userId: string) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export default function Messenger({ initialContactId, onUserClick, onNavigate }: MessengerProps) {
  const { user, profile } = useAuth();
  const { refreshMessages: refreshBadgeCount } = useBadges();
  const { isUserOnline } = usePresence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeChat, setActiveChat] = useState<Profile | null>(null);
  const activeChatRef = useRef<Profile | null>(null);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockingMe, setIsBlockingMe] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMessageActions, setActiveMessageActions] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [editValue, setEditValue] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'archived'>('chats');
  const [chatSettings, setChatSettings] = useState<Record<string, any>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instanceId = useRef(Math.random().toString(36).substring(7));

  // Handle initial contact
  useEffect(() => {
    if (initialContactId && user) {
      fetchInitialContact(initialContactId);
    }
  }, [initialContactId, user]);

  async function fetchInitialContact(id: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) {
      setActiveChat(data);
      fetchMessages(id);
    }
  }

  // Keep ref in sync with state
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user?.id, activeTab, connections, chatSettings]);

  useEffect(() => {
    if (!user) return;
    
    fetchConnections();
    fetchChatSettings();

    // Mark all as read when entering the messenger
    const markAllAsReadOnMount = async () => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true, seen_at: new Date().toISOString(), status: 'seen' })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        refreshBadgeCount();
        fetchContacts(); // Refresh the contact list badges
      }
    };
    
    markAllAsReadOnMount();
    
    const channel = supabase
      .channel(`messages:${user.id}:${instanceId.current}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new as Message;
          const currentActiveChat = activeChatRef.current;
          
          if (msg.receiver_id === user.id) {
            // Handle Call Signaling - Now handled globally in App.tsx
            if (msg.media_type === 'call') return;

            if (currentActiveChat && msg.sender_id === currentActiveChat.id) {
              setMessages(prev => {
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
              markAsRead(msg.id);
            } else {
              markAsDelivered(msg.id);
              fetchContacts(); // Refresh contact list to show unread badge
              fetchProfileForNotification(msg.sender_id, msg.content);
              toast.info(`New message from someone`);
            }
          } else if (msg.sender_id === user.id && currentActiveChat && msg.receiver_id === currentActiveChat.id) {
            // Message sent by me on another device
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any).id;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: string[] = [];
        Object.keys(state).forEach(key => {
          const presences = state[key] as any[];
          presences.forEach(p => {
            if (p.isTyping && p.typingTo === user.id) {
              typing.push(p.userId);
            }
          });
        });
        setTypingUsers(typing);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Handle typing indicator
  useEffect(() => {
    if (!user || !activeChat) return;

    const channel = supabase.channel(`typing:${activeChat.id}`);
    
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId: user.id,
          isTyping: isTyping,
          typingTo: activeChat.id
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [isTyping, activeChat?.id, user?.id]);

  const handleTyping = () => {
    if (!isTyping) setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  };

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 300);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleForwardMessage = async (contactId: string) => {
    if (!forwardingMessage || !user) return;

    const messageObj = {
      sender_id: user.id,
      receiver_id: contactId,
      content: forwardingMessage.content,
      media_url: forwardingMessage.media_url,
      media_type: forwardingMessage.media_type,
      is_read: false,
      is_delivered: false
    };

    const { error } = await supabase.from('messages').insert(messageObj);
    if (error) {
      toast.error('Failed to forward message');
    } else {
      toast.success('Message forwarded');
      setForwardingMessage(null);
    }
  };

  async function fetchConnections() {
    if (!user) return;
    const { data } = await supabase
      .from('connections')
      .select('*, sender:sender_id(*), receiver:receiver_id(*)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted');
    if (data) setConnections(data as any);
  }

  const isMutualFollow = (otherUserId: string) => {
    if (!user) return false;
    const following = connections.some(c => c.sender_id === user.id && c.receiver_id === otherUserId);
    const follower = connections.some(c => c.sender_id === otherUserId && c.receiver_id === user.id);
    return following && follower;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
      if (activeMessageActions) {
        const target = event.target as HTMLElement;
        if (!target.closest('.group\\/msg')) {
          setActiveMessageActions(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMessageActions]);

  async function fetchProfileForNotification(userId: string, content: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      sendBrowserNotification(`Message from ${data.full_name || data.username}`, {
        body: content,
        icon: data.avatar_url || '/favicon.ico'
      });
    }
  }

  async function fetchChatSettings() {
    if (!user) return;
    const { data } = await supabase
      .from('chat_settings')
      .select('*')
      .eq('user_id', user.id);
    
    if (data) {
      const settings: Record<string, any> = {};
      data.forEach(s => {
        settings[s.chat_partner_id] = s;
      });
      setChatSettings(settings);
    }
  }

  async function toggleArchive(contactId: string) {
    if (!user) return;
    const isArchived = chatSettings[contactId]?.is_archived;
    
    const { error } = await supabase
      .from('chat_settings')
      .upsert({
        user_id: user.id,
        chat_partner_id: contactId,
        is_archived: !isArchived,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast.error('Failed to update archive status');
    } else {
      toast.success(isArchived ? 'Chat unarchived' : 'Chat archived');
      fetchChatSettings();
      if (!isArchived) setActiveChat(null);
    }
  }

  async function markAsDelivered(messageId: string) {
    await supabase.from('messages').update({ 
      is_delivered: true,
      delivered_at: new Date().toISOString(),
      status: 'delivered'
    }).eq('id', messageId);
  }

  async function markAsRead(messageId: string) {
    await supabase.from('messages').update({ 
      is_read: true,
      seen_at: new Date().toISOString(),
      status: 'seen'
    }).eq('id', messageId);
    refreshBadgeCount();
    fetchContacts(); // Refresh local counts
  }

  async function acceptRequest(contactId: string) {
    if (!user) return;
    const { error } = await supabase
      .from('connections')
      .upsert({
        sender_id: user.id,
        receiver_id: contactId,
        status: 'accepted'
      });

    if (error) {
      toast.error('Failed to accept request');
    } else {
      toast.success('Request accepted');
      fetchConnections();
      fetchContacts();
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function fetchContacts() {
    if (!user) return;
    
    // Fetch unique contacts from messages
    const { data: recentMessages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent messages:', error);
      return;
    }

    const contactIds = new Set<string>();
    const lastMsgs: Record<string, Message> = {};
    
    recentMessages?.forEach(msg => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!contactIds.has(otherId)) {
        contactIds.add(otherId);
        lastMsgs[otherId] = msg;
      }
    });

    setLastMessages(lastMsgs);

    // Fetch unread counts for all contacts
    const { data: unreadData } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    
    const counts: Record<string, number> = {};
    unreadData?.forEach(msg => {
      counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
    });
    setUnreadCounts(counts);

    if (contactIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(contactIds));
      
      if (profiles) {
        // Sort profiles by the order they appeared in recentMessages
        const sortedProfiles = Array.from(contactIds)
          .map(id => profiles.find(p => p.id === id))
          .filter((p): p is Profile => !!p);
        
        // Filter based on activeTab and connections
        const filteredProfiles = sortedProfiles.filter(p => {
          const isArchived = chatSettings[p.id]?.is_archived;
          const isAccepted = connections.some(c => 
            (c.sender_id === user.id && c.receiver_id === p.id) || 
            (c.sender_id === p.id && c.receiver_id === user.id)
          );
          
          const lastMsg = lastMsgs[p.id];
          const iSentLast = lastMsg?.sender_id === user.id;

          if (activeTab === 'archived') return isArchived;
          if (isArchived) return false;
          if (activeTab === 'requests') return !isAccepted && !iSentLast;
          return isAccepted || iSentLast;
        });

        setContacts(filteredProfiles);
      }
    } else {
      // Fallback to some suggested contacts if no messages yet
      const { data: suggested } = await supabase.from('profiles').select('*').limit(10);
      if (suggested) {
        const filteredSuggested = suggested.filter(p => p.id !== user.id);
        if (activeTab === 'chats') setContacts(filteredSuggested);
        else setContacts([]);
      }
    }
  }

  async function checkBlockStatus(contactId: string) {
    if (!user) return;
    try {
      const { data: blockedByMe } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', user.id)
        .eq('blocked_id', contactId)
        .single();
      
      setIsBlocked(!!blockedByMe);

      const { data: blockedByThem } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', contactId)
        .eq('blocked_id', user.id)
        .single();
      
      setIsBlockingMe(!!blockedByThem);
    } catch (error) {
      console.error('Error checking block status:', error);
    }
  }

  async function fetchMessages(contactId: string) {
    checkBlockStatus(contactId);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true });
    
    if (data) {
      setMessages(data);
      // Mark unread messages from this contact as read
      const unreadIds = data
        .filter(m => m.receiver_id === user?.id && !m.is_read)
        .map(m => m.id);
      
      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ 
            is_read: true, 
            seen_at: new Date().toISOString(),
            status: 'seen'
          })
          .in('id', unreadIds);
        
        refreshBadgeCount();
        fetchContacts(); // Also refresh local unread counts for the sidebar
      }
    }
  }

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const handleVoiceRecordingComplete = async (blob: Blob) => {
    const file = new File([blob], 'voice_message.webm', { type: 'audio/webm' });
    await uploadVoiceMessage(file);
    setIsRecording(false);
  };

  const uploadVoiceMessage = async (file: File) => {
    if (!user || !activeChat) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.webm`;
      const filePath = `chat/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const messageObj = {
        sender_id: user.id,
        receiver_id: activeChat.id,
        content: 'Voice message',
        media_url: publicUrl,
        media_type: 'audio' as const,
      };

      const { data, error } = await supabase.from('messages').insert(messageObj).select().single();
      if (error) {
        console.error('Insert voice message error:', error);
        throw error;
      }
      // Removed optimistic update: setMessages(prev => [...prev, data]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeChat) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `chat/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      let mediaType: Message['media_type'] = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';

      const messageObj = {
        sender_id: user.id,
        receiver_id: activeChat.id,
        content: file.name,
        media_url: publicUrl,
        media_type: mediaType,
      };

      const { data, error } = await supabase.from('messages').insert(messageObj).select().single();
      if (error) {
        console.error('Insert file message error:', error);
        throw error;
      }
      
      // Removed optimistic update: setMessages(prev => [...prev, data]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    const messageObj: any = {
      sender_id: user.id,
      receiver_id: activeChat.id,
      content: newMessage.trim(),
    };

    // Only add reply_to_id if it's set
    if (replyingTo) {
      messageObj.reply_to_id = replyingTo.id;
    }

    try {
      const { data, error } = await supabase.from('messages').insert(messageObj).select().single();
      if (error) {
        console.error('Send message error:', error);
        // If it failed, maybe reply_to_id is missing? Try without it
        if (replyingTo) {
          const { data: retryData, error: retryError } = await supabase
            .from('messages')
            .insert({
              sender_id: user.id,
              receiver_id: activeChat.id,
              content: newMessage.trim()
            })
            .select()
            .single();
          
          if (retryError) throw retryError;
          toast.warning('Reply context lost (database column missing)');
        } else {
          throw error;
        }
      }
      
      setNewMessage('');
      setReplyingTo(null);
      setIsTyping(false);
      
      requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
      
      if (activeChat) {
        await createNotification(activeChat.id, user.id, 'message');
      }
    } catch (error: any) {
      console.error('Final send error:', error);
      toast.error(`Failed to send message: ${error.message}`);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || {};
    const userIds = currentReactions[emoji] || [];
    
    let newUserIds;
    if (userIds.includes(user.id)) {
      newUserIds = userIds.filter(id => id !== user.id);
    } else {
      newUserIds = [...userIds, user.id];
    }

    const updatedReactions = { ...currentReactions };
    if (newUserIds.length === 0) {
      delete updatedReactions[emoji];
    } else {
      updatedReactions[emoji] = newUserIds;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ reactions: updatedReactions })
        .eq('id', messageId);

      if (error) throw error;
      
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: updatedReactions } : m));
    } catch (error: any) {
      console.error('Reaction error:', error);
      toast.error('Failed to react: ' + (error.message || 'Unknown error'));
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editValue.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: editValue.trim(),
          is_edited: true 
        })
        .eq('id', editingMessage.id);

      if (error) {
        console.error('Edit error:', error);
        // Try without is_edited if it failed (maybe column missing)
        const { error: retryError } = await supabase
          .from('messages')
          .update({ content: editValue.trim() })
          .eq('id', editingMessage.id);
        
        if (retryError) throw retryError;
      }
      
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: editValue.trim(), is_edited: true } : m));
      toast.success('Message updated');
      setEditingMessage(null);
      setEditValue('');
    } catch (err: any) {
      console.error('Edit catch error:', err);
      toast.error('Failed to edit message: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteMessage = async () => {
    if (!deletingMessage) return;

    try {
      console.log('Attempting to unsend message:', deletingMessage.id);
      const { error, status, statusText } = await supabase
        .from('messages')
        .delete()
        .eq('id', deletingMessage.id);

      if (error) {
        console.error('Delete error details:', { error, status, statusText });
        toast.error(`Failed to unsend: ${error.message || 'Permission denied or database error'}`);
      } else {
        console.log('Message unsent successfully from database');
        setMessages(prev => prev.filter(m => m.id !== deletingMessage.id));
        toast.success('Message unsent');
        setDeletingMessage(null);
        setActiveMessageActions(null);
      }
    } catch (err: any) {
      console.error('Delete catch error:', err);
      toast.error(`An unexpected error occurred: ${err.message}`);
    }
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.media_type === 'image') {
      return (
        <div className="space-y-2">
          <img src={msg.media_url!} alt="" className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" referrerPolicy="no-referrer" onClick={() => window.open(msg.media_url!, '_blank')} />
          {msg.content && <p>{msg.content}</p>}
        </div>
      );
    }
    if (msg.media_type === 'video') {
      return (
        <VideoPlayer url={msg.media_url!} />
      );
    }
    if (msg.media_type === 'document') {
      return (
        <a href={msg.media_url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-black/5 rounded-lg hover:bg-black/10 transition-colors">
          <FileText className="w-5 h-5" />
          <span className="text-xs font-medium truncate max-w-[150px]">{msg.content}</span>
        </a>
      );
    }
    if (msg.media_type === 'audio') {
      return (
        <VoicePlayer url={msg.media_url!} isOwn={msg.sender_id === user?.id} />
      );
    }
    return msg.content;
  };

  if (activeChat) {
    return (
      <div className="flex flex-col bg-white lg:rounded-[32px] overflow-hidden border border-gray-100 shadow-premium fixed inset-0 z-[100] lg:relative lg:inset-auto lg:z-0 lg:h-full h-[100dvh] lg:h-[calc(100vh-120px)]">
        {/* Chat Header */}
        <div className="shrink-0 p-4 border-b border-gray-100 bg-white/80 backdrop-blur-xl z-30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveChat(null)}
                className="p-2 -ml-2 hover:bg-gray-50 text-gray-900 rounded-2xl transition-all active:scale-90 flex items-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
                
                {isSearchingChat ? (
                  <div className="flex-1 flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100 focus-within:border-emerald-500/30 transition-all">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Search in chat..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      className="bg-transparent border-none text-sm outline-none w-full"
                    />
                    <button onClick={() => { setIsSearchingChat(false); setChatSearchQuery(''); }} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => onUserClick?.(activeChat.id)}
                  >
                    <div className="relative">
                      <div className="w-11 h-11 rounded-2xl bg-gray-100 overflow-hidden border-2 border-gray-50 group-hover:border-emerald-500 transition-all">
                        {activeChat.avatar_url ? (
                          <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                            {activeChat.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      {isUserOnline(activeChat.id) && isMutualFollow(activeChat.id) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-gray-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1 truncate">
                        {activeChat.full_name || activeChat.username}
                        {activeChat.is_verified && <VerificationBadge size="sm" />}
                      </h4>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-widest truncate",
                        (isUserOnline(activeChat.id) && isMutualFollow(activeChat.id)) ? "text-emerald-500" : "text-gray-400"
                      )}>
                        {(isUserOnline(activeChat.id) && isMutualFollow(activeChat.id)) ? 'Active now' : 'Offline'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {activeTab === 'requests' && activeChat && (
                  <button 
                    onClick={() => acceptRequest(activeChat.id)}
                    className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 mr-2"
                  >
                    Accept Request
                  </button>
                )}
                {!isSearchingChat && (
                  <button onClick={() => setIsSearchingChat(true)} className="p-2.5 hover:bg-gray-50 text-gray-500 rounded-2xl transition-all active:scale-90">
                    <Search className="w-5 h-5" />
                  </button>
                )}
                <div className="relative" ref={headerMenuRef}>
                  <button 
                    onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                    className="p-2.5 hover:bg-gray-50 text-gray-500 rounded-2xl transition-all active:scale-90"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                <AnimatePresence>
                  {isHeaderMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-3xl shadow-2xl border border-gray-100 py-3 z-50 overflow-hidden"
                    >
                      <button 
                        onClick={() => toggleArchive(activeChat.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 transition-colors"
                      >
                        <Archive className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold">{chatSettings[activeChat.id]?.is_archived ? 'Unarchive Chat' : 'Archive Chat'}</span>
                      </button>
                      <button 
                        onClick={() => onUserClick?.(activeChat.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold">View Profile</span>
                      </button>
                      <div className="h-px bg-gray-50 my-1 mx-4" />
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to clear this chat?')) {
                            const { error } = await supabase
                              .from('messages')
                              .delete()
                              .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${user?.id})`);
                            
                            if (error) {
                              toast.error('Failed to clear chat');
                            } else {
                              setMessages([]);
                              toast.success('Chat cleared');
                            }
                          }
                          setIsHeaderMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold">Clear Chat</span>
                      </button>
                      <button 
                        onClick={async () => {
                          if (isBlocked) {
                            await supabase.from('blocks').delete().eq('blocker_id', user?.id).eq('blocked_id', activeChat.id);
                            setIsBlocked(false);
                            toast.success('User unblocked');
                          } else {
                            await supabase.from('blocks').insert({ blocker_id: user?.id, blocked_id: activeChat.id });
                            setIsBlocked(true);
                            toast.success('User blocked');
                          }
                          setIsHeaderMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                          isBlocked ? "text-emerald-600" : "text-rose-600"
                        )}
                      >
                        {isBlocked ? <Shield className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        <span className="text-sm font-bold">{isBlocked ? 'Unblock User' : 'Block User'}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 no-scrollbar bg-white relative">
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 to-white/50 pointer-events-none" />
            <div className="relative z-0 space-y-4">
              {messages
                .filter(m => m.content.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                .map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex flex-col gap-1 max-w-[80%]">
                      {msg.reply_to_id && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            const element = document.getElementById(`msg-${msg.reply_to_id}`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              element.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
                              setTimeout(() => {
                                element.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2');
                              }, 2000);
                            }
                          }}
                          className={cn(
                            "text-[10px] px-3 py-2 bg-gray-50/80 backdrop-blur-sm rounded-t-2xl border-l-4 border-emerald-500 text-gray-500 mb-[-8px] pb-3 shadow-sm cursor-pointer hover:bg-gray-100 transition-colors",
                            msg.sender_id === user?.id ? "mr-2" : "ml-2"
                          )}
                        >
                          <div className="font-bold text-emerald-600 mb-0.5 flex items-center gap-1">
                            <MessageSquare className="w-2 h-2" />
                            {messages.find(m => m.id === msg.reply_to_id)?.sender_id === user?.id ? 'You' : activeChat?.full_name || activeChat?.username}
                          </div>
                          <div className="truncate opacity-80">
                            {messages.find(m => m.id === msg.reply_to_id)?.content || 'Media message'}
                          </div>
                        </div>
                      )}
                      <div className="relative group/msg" id={`msg-${msg.id}`}>
                        <motion.div 
                          drag="x"
                          dragConstraints={{ left: 0, right: 100 }}
                          dragElastic={0.2}
                          onDragEnd={(_, info) => {
                            if (info.offset.x > 50) {
                              setReplyingTo(msg);
                              messageInputRef.current?.focus();
                            }
                          }}
                          onClick={() => setActiveMessageActions(activeMessageActions === msg.id ? null : msg.id)}
                          className={cn(
                            "px-5 py-3.5 rounded-[28px] text-sm relative group/msg shadow-sm transition-all duration-300 cursor-pointer touch-none",
                            msg.sender_id === user?.id 
                              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-tr-none hover:shadow-emerald-500/20' 
                              : 'bg-white text-gray-800 rounded-tl-none border border-gray-100 hover:border-gray-200'
                          )}
                        >
                          {renderMessageContent(msg)}
                          
                          {/* Reactions Display */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className={cn(
                              "absolute -bottom-2 flex gap-1",
                              msg.sender_id === user?.id ? "right-0" : "left-0"
                            )}>
                              {Object.entries(msg.reactions).map(([emoji, uids]) => (
                                <button
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(msg.id, emoji);
                                  }}
                                  className="bg-white border border-gray-100 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1"
                                >
                                  <span>{emoji}</span>
                                  <span className="font-bold text-gray-500">{(uids as string[]).length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </motion.div>

                        {/* Message Actions (Desktop Hover) */}
                        <div className={cn(
                          "hidden lg:flex absolute top-1/2 -translate-y-1/2 items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10",
                          msg.sender_id === user?.id ? "right-full mr-2" : "left-full ml-2"
                        )}>
                          <button 
                            onClick={() => setReplyingTo(msg)}
                            className="p-2 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-emerald-500 shadow-sm transition-all active:scale-90"
                            title="Reply"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setForwardingMessage(msg)}
                            className="p-2 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-blue-500 shadow-sm transition-all active:scale-90"
                            title="Forward"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              toast.success('Copied to clipboard');
                            }}
                            className="p-2 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-emerald-500 shadow-sm transition-all active:scale-90"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {msg.sender_id === user?.id && (
                            <button 
                              onClick={() => {
                                setEditingMessage(msg);
                                setEditValue(msg.content);
                              }}
                              className="p-2 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-emerald-500 shadow-sm"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {msg.sender_id === user?.id && (
                            <button 
                              onClick={() => setDeletingMessage(msg)}
                              className="p-2 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-rose-500 shadow-sm"
                              title="Unsend"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 mt-1",
                        msg.sender_id === user?.id ? "justify-end" : "justify-start"
                      )}>
                        <span className="text-[9px] font-medium text-gray-400 flex items-center gap-1">
                          {formatDate(msg.created_at)}
                          {msg.is_edited && <span className="text-[8px] uppercase tracking-tighter opacity-70 font-bold">(Edited)</span>}
                        </span>
                        {msg.sender_id === user?.id && (
                          <div className="flex items-center gap-0.5">
                            {msg.status === 'seen' || msg.is_read ? (
                              <div className="relative flex items-center">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                {activeChat?.avatar_url && (
                                  <motion.img 
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    src={activeChat.avatar_url} 
                                    className="w-2.5 h-2.5 rounded-full border border-white absolute -right-1 -bottom-0.5 shadow-sm" 
                                    alt=""
                                  />
                                )}
                              </div>
                            ) : msg.status === 'delivered' || msg.is_delivered ? (
                              <CheckCheck className="w-3.5 h-3.5 text-gray-300" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-gray-300" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {typingUsers.length > 0 && activeChat && (
                  <div className="flex justify-start">
                    <div className="flex items-end gap-2">
                      <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                        {activeChat.avatar_url ? (
                          <img src={activeChat.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-400">
                            {activeChat.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="bg-white border border-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-sm">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {uploading && (
                  <div className="flex justify-end">
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl rounded-tr-none flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold">Uploading...</span>
                    </div>
                  </div>
                )}
            </div>
          </div>
            
          <AnimatePresence>
            {showScrollBottom && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                onClick={scrollToBottom}
                className="absolute bottom-24 right-4 p-3 bg-white border border-gray-100 rounded-full shadow-lg text-emerald-500 hover:bg-gray-50 transition-all z-20"
              >
                <ChevronLeft className="w-5 h-5 -rotate-90" />
              </motion.button>
            )}
          </AnimatePresence>

          <div className="shrink-0 bg-white border-t border-gray-100 z-20">
            {isBlocked || isBlockingMe ? (
              <div className="p-6 text-center bg-gray-50">
                <p className="text-sm font-bold text-gray-500">
                  {isBlocked ? 'You have blocked this user. Unblock to message.' : 'You cannot reply to this conversation.'}
                </p>
              </div>
            ) : (
              <>
                {replyingTo && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-1 h-8 bg-emerald-500 rounded-full shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Replying to</p>
                        <p className="text-xs text-gray-500 truncate">{replyingTo.content || 'Media'}</p>
                      </div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100/50 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto">
                    {isRecording ? (
                      <VoiceRecorder 
                        onRecordingComplete={handleVoiceRecordingComplete}
                        onCancel={() => setIsRecording(false)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 sm:p-2.5 hover:bg-gray-50 text-gray-400 rounded-xl transition-all active:scale-90"
                            title="Attach File"
                          >
                            <Paperclip className="w-5 h-5" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="hidden sm:block p-2.5 hover:bg-gray-50 text-gray-400 rounded-xl transition-all active:scale-90"
                            title="Upload Image"
                          >
                            <ImageIcon className="w-5 h-5" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={cn(
                              "p-2 sm:p-2.5 hover:bg-gray-50 rounded-xl transition-all active:scale-90",
                              showEmojiPicker ? "text-emerald-500 bg-emerald-50" : "text-gray-400"
                            )}
                            title="Emoji Picker"
                          >
                            <Smile className="w-5 h-5" />
                          </button>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                        />
                        <div className="relative flex-1">
                          <input
                            type="text"
                            ref={messageInputRef}
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => {
                              setNewMessage(e.target.value);
                              handleTyping();
                            }}
                            className="w-full pl-4 pr-10 py-2.5 bg-gray-50/80 border border-transparent rounded-[20px] text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500/10 transition-all placeholder:text-gray-400"
                          />
                          {newMessage.trim() && (
                            <button 
                              type="submit" 
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:bg-emerald-50 rounded-full transition-all active:scale-90"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        {!newMessage.trim() && (
                          <button 
                            type="button" 
                            onClick={() => setIsRecording(true)}
                            className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 shrink-0"
                          >
                            <Mic className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  
                  {showEmojiPicker && (
                    <div className="mt-4 flex flex-wrap gap-2 p-2 bg-gray-50 rounded-2xl border border-gray-100">
                      {['❤️', '🔥', '😂', '😮', '😢', '👏', '👍', '🙏', '✨', '🎉', '💯', '🚀'].map(emoji => (
                        <button 
                          key={emoji}
                          onClick={() => {
                            setNewMessage(prev => prev + emoji);
                            setShowEmojiPicker(false);
                            messageInputRef.current?.focus();
                          }}
                          className="text-xl p-2 hover:bg-white rounded-xl transition-all active:scale-90"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              </>
            )}
          </div>

      {/* Mobile Action Sheet */}
      <AnimatePresence>
        {activeMessageActions && (
          <div className="lg:hidden fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setActiveMessageActions(null)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full rounded-t-[32px] p-6 pb-12 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
              <div className="grid grid-cols-4 gap-4 mb-8">
                <button 
                  onClick={() => { 
                    const msg = messages.find(m => m.id === activeMessageActions);
                    if (msg) setReplyingTo(msg); 
                    setActiveMessageActions(null); 
                  }} 
                  className="flex flex-col items-center gap-2"
                >
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><MessageSquare className="w-6 h-6" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Reply</span>
                </button>
                <button 
                  onClick={() => { 
                    const msg = messages.find(m => m.id === activeMessageActions);
                    if (msg) setForwardingMessage(msg); 
                    setActiveMessageActions(null); 
                  }} 
                  className="flex flex-col items-center gap-2"
                >
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Share2 className="w-6 h-6" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Forward</span>
                </button>
                <button 
                  onClick={() => { 
                    const msg = messages.find(m => m.id === activeMessageActions);
                    if (msg) {
                      navigator.clipboard.writeText(msg.content); 
                      toast.success('Copied'); 
                    }
                    setActiveMessageActions(null); 
                  }} 
                  className="flex flex-col items-center gap-2"
                >
                  <div className="p-4 bg-gray-50 text-gray-600 rounded-2xl"><Copy className="w-6 h-6" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Copy</span>
                </button>
                <button 
                  onClick={() => { 
                    const msg = messages.find(m => m.id === activeMessageActions);
                    if (msg) {
                      setEditingMessage(msg);
                      setEditValue(msg.content);
                    }
                    setActiveMessageActions(null); 
                  }} 
                  className="flex flex-col items-center gap-2"
                >
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><Edit3 className="w-6 h-6" /></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Edit</span>
                </button>
                {messages.find(m => m.id === activeMessageActions)?.sender_id === user?.id && (
                  <button 
                    onClick={() => { 
                      const msg = messages.find(m => m.id === activeMessageActions);
                      if (msg) setDeletingMessage(msg); 
                      setActiveMessageActions(null); 
                    }} 
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl"><Trash2 className="w-6 h-6" /></div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Unsend</span>
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                {['❤️', '🔥', '😂', '😮', '😢', '👏'].map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => { 
                      if (activeMessageActions) handleReact(activeMessageActions, emoji); 
                      setActiveMessageActions(null); 
                    }} 
                    className="text-2xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forward Modal */}
      <AnimatePresence>
        {forwardingMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 glass">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Forward Message</h3>
                <button onClick={() => setForwardingMessage(null)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto no-scrollbar">
                <div className="space-y-2">
                  {connections.map(conn => {
                    const contact = conn.sender_id === user?.id ? conn.receiver : conn.sender;
                    if (!contact) return null;
                    return (
                      <button
                        key={contact.id}
                        onClick={() => handleForwardMessage(contact.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100 group-hover:border-emerald-500 transition-all">
                          {contact.avatar_url ? (
                            <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                              {contact.username[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="text-sm font-bold text-gray-900">{contact.full_name || contact.username}</h4>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">@{contact.username}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                          <Send className="w-4 h-4" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingMessage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Unsend Message?</h3>
              <p className="text-gray-500 mb-8 text-sm">This message will be removed for everyone in the chat. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingMessage(null)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteMessage}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-full transition-all active:scale-95"
                >
                  Unsend
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Message Modal */}
      <AnimatePresence>
        {editingMessage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Edit Message</h3>
                <button onClick={() => setEditingMessage(null)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                  rows={4}
                  placeholder="Edit your message..."
                  autoFocus
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setEditingMessage(null)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleEditMessage}
                    disabled={!editValue.trim() || editValue === editingMessage?.content}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </div>
      );
    }

  return (
    <div className="flex flex-col h-full bg-white lg:bg-transparent">
      <div className="flex items-center justify-between mb-6 px-4 lg:px-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate?.('feed')}
            className="lg:hidden p-2.5 bg-gray-50 text-gray-900 rounded-2xl hover:bg-gray-100 transition-all active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Messenger</h2>
        </div>
        <button className="p-2.5 bg-gray-50 text-gray-900 rounded-2xl hover:bg-gray-100 transition-all active:scale-95">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Active Users Horizontal List */}
      <div className="mb-8 px-4 lg:px-0">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] mb-4">Active Now</h3>
        <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2">
          {contacts.filter(c => isUserOnline(c.id)).map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col items-center gap-2.5 flex-shrink-0 group cursor-pointer"
            >
              <div className="relative">
                <div 
                  className="w-16 h-16 rounded-[24px] bg-white p-0.5 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-all duration-300 overflow-hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUserClick?.(contact.id);
                  }}
                >
                  <div className="w-full h-full rounded-[20px] overflow-hidden">
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50"><UserIcon className="w-7 h-7" /></div>
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full border-[3px] border-white bg-emerald-500 shadow-sm" />
              </div>
              <span 
                className="text-[10px] font-bold text-gray-900 max-w-[64px] truncate group-hover:text-emerald-600 transition-colors"
                onClick={() => {
                  setActiveChat(contact);
                  fetchMessages(contact.id);
                }}
              >
                {contact.full_name?.split(' ')[0] || contact.username}
              </span>
            </div>
          ))}
          {contacts.filter(c => isUserOnline(c.id)).length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl w-full">
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">No active users</p>
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6 px-4 lg:px-0">
        <button 
          onClick={() => setActiveTab('chats')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all relative",
            activeTab === 'chats' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
          )}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Chats
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all relative",
            activeTab === 'requests' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
          )}
        >
          <Inbox className="w-3.5 h-3.5" />
          Requests
        </button>
        <button 
          onClick={() => setActiveTab('archived')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all relative",
            activeTab === 'archived' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
          )}
        >
          <Archive className="w-3.5 h-3.5" />
          Archived
        </button>
      </div>

      <div className="relative mb-8 px-4 lg:px-0 group">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-[20px] text-sm focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 lg:px-0">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] mb-4">Recent Messages</h3>
        <div className="space-y-2">
          {contacts
            .filter(c => 
              c.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
              c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((contact) => (
              <button
                key={contact.id}
                onClick={() => {
                  setActiveChat(contact);
                  fetchMessages(contact.id);
                }}
                className="w-full flex items-center gap-4 p-4 hover:bg-white hover:shadow-xl hover:shadow-gray-200/50 rounded-[24px] transition-all duration-300 group border border-transparent hover:border-gray-100"
              >
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-gray-50 group-hover:border-emerald-500/30 transition-all">
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50"><UserIcon className="w-6 h-6" /></div>
                    )}
                  </div>
                  {isUserOnline(contact.id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors flex items-center gap-1">
                      {contact.full_name || contact.username}
                      {contact.is_verified && <VerificationBadge size="sm" />}
                    </h4>
                    {lastMessages[contact.id] && (
                      <span className="text-[10px] font-medium text-gray-400">
                        {formatDate(lastMessages[contact.id].created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 truncate font-medium flex items-center gap-1 flex-1">
                      {lastMessages[contact.id] ? (
                        <>
                          {lastMessages[contact.id].sender_id === user?.id && (
                            <span className="text-emerald-500">You: </span>
                          )}
                          {lastMessages[contact.id].media_type === 'image' ? 'Sent an image' : 
                           lastMessages[contact.id].media_type === 'audio' ? 'Sent a voice message' :
                           lastMessages[contact.id].content}
                        </>
                      ) : (
                        isUserOnline(contact.id) ? 'Active now' : 'Tap to open chat'
                      )}
                    </p>
                    {unreadCounts[contact.id] > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm shadow-emerald-500/20">
                        {unreadCounts[contact.id]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
