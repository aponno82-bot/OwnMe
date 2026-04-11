import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreHorizontal, MessageCircle, Send, User as UserIcon, Phone, Video, Paperclip, Image as ImageIcon, FileText, Mic, X, Loader2, PhoneIncoming, PhoneOutgoing, PhoneOff, ChevronLeft, ShieldAlert, VolumeX, Check, CheckCheck, Trash2, Shield, Ban, MessageSquare, Heart, Smile, VideoOff, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { Message, Profile, Connection } from '../../types';
import { toast } from 'sonner';
import { usePresence } from '../../lib/usePresence';
import { cn, formatDate } from '../../lib/utils';
import VerificationBadge from '../VerificationBadge';
import { motion, AnimatePresence } from 'motion/react';
import { sendBrowserNotification } from '../../lib/notifications';
import { createNotification } from '../../services/notificationService';
import VoicePlayer from './VoicePlayer';
import VideoPlayer from './VideoPlayer';
import CallModal from './CallModal';

interface MessengerProps {
  initialContactId?: string | null;
  onUserClick?: (userId: string) => void;
}

export default function Messenger({ initialContactId, onUserClick }: MessengerProps) {
  const { user, profile } = useAuth();
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
    if (!user) return;
    
    fetchContacts();
    fetchConnections();
    
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
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted');
    if (data) setConnections(data);
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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchProfileForNotification(userId: string, content: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      sendBrowserNotification(`Message from ${data.full_name || data.username}`, {
        body: content,
        icon: data.avatar_url || '/favicon.ico'
      });
    }
  }

  async function markAsRead(messageId: string) {
    await supabase.from('messages').update({ 
      is_read: true,
      seen_at: new Date().toISOString()
    }).eq('id', messageId);
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
      .select('sender_id, receiver_id, created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent messages:', error);
      return;
    }

    const contactIds = new Set<string>();
    recentMessages?.forEach(msg => {
      if (msg.sender_id !== user.id) contactIds.add(msg.sender_id);
      if (msg.receiver_id !== user.id) contactIds.add(msg.receiver_id);
    });

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
        setContacts(sortedProfiles);
      }
    } else {
      // Fallback to some suggested contacts if no messages yet
      const { data: suggested } = await supabase.from('profiles').select('*').limit(10);
      if (suggested) setContacts(suggested.filter(p => p.id !== user.id));
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
          .update({ is_read: true, seen_at: new Date().toISOString() })
          .in('id', unreadIds);
      }
    }
  }

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'voice_message.webm', { type: 'audio/webm' });
        await uploadVoiceMessage(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
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

    const isFollowing = connections.some(c => c.sender_id === user.id && c.receiver_id === activeChat.id);
    
    const messageObj = {
      sender_id: user.id,
      receiver_id: activeChat.id,
      content: newMessage.trim(),
      reply_to_id: replyingTo?.id || null
    };

    const { data, error } = await supabase.from('messages').insert(messageObj).select().single();
    if (error) {
      console.error('Send message error:', error);
      toast.error(`Failed to send message: ${error.message}`);
    } else {
      // Removed optimistic update: setMessages(prev => [...prev, data]);
      setNewMessage('');
      setReplyingTo(null);
      setIsTyping(false);
      // Keep focus on input for mobile keyboard
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 0);
      
      // Send notification
      if (activeChat) {
        await createNotification(activeChat.id, user.id, 'message');
      }
    }
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChat || !user) return;
    
    // Dispatch global event
    window.dispatchEvent(new CustomEvent('start-call', { 
      detail: { contact: activeChat, type } 
    }));
  };

  // acceptCall and endCall removed as they are handled globally

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

    const { error } = await supabase
      .from('messages')
      .update({ reactions: updatedReactions })
      .eq('id', messageId);

    if (error) {
      toast.error('Failed to react');
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
    if (msg.media_type === 'call') {
      return (
        <div className="flex items-center gap-2 py-1">
          {msg.media_url === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          <span className="text-xs font-bold">
            {msg.sender_id === user?.id ? 'Outgoing' : 'Incoming'} {msg.media_url} call
          </span>
        </div>
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
      <div className="flex flex-col h-full bg-white lg:rounded-[32px] overflow-hidden border border-gray-100 shadow-premium relative h-[100svh] lg:h-full">
        <div className="flex flex-col h-full relative">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between glass sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-gray-50 rounded-full text-gray-500 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              {isSearchingChat ? (
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Search in chat..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="bg-gray-50 border-none rounded-xl px-3 py-1.5 text-sm outline-none w-32 lg:w-48"
                  />
                  <button onClick={() => { setIsSearchingChat(false); setChatSearchQuery(''); }} className="p-1 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => onUserClick?.(activeChat.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100 group-hover:border-emerald-500 transition-all">
                    {activeChat.avatar_url ? (
                      <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                        {activeChat.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1">
                      {activeChat.full_name || activeChat.username}
                      {activeChat.is_verified && <VerificationBadge size="sm" />}
                    </h4>
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      (isUserOnline(activeChat.id) && isMutualFollow(activeChat.id)) ? "text-emerald-500" : "text-gray-400"
                    )}>
                      {(isUserOnline(activeChat.id) && isMutualFollow(activeChat.id)) ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!isSearchingChat && (
                <button onClick={() => setIsSearchingChat(true)} className="p-2 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors">
                  <Search className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => startCall('audio')} className="p-2 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button onClick={() => startCall('video')} className="p-2 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors">
                <Video className="w-5 h-5" />
              </button>
              <div className="relative" ref={headerMenuRef}>
                <button 
                  onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                  className="p-2 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {isHeaderMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50"
                    >
                      <button 
                        onClick={() => {
                          toast.success('Chat muted');
                          setIsHeaderMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <VolumeX className="w-4 h-4" />
                        Mute Notifications
                      </button>
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
                        className="w-full px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear Chat
                      </button>
                      <button 
                        onClick={() => {
                          toast.error('User blocked');
                          setIsHeaderMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        Block User
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-gray-50/30 relative">
            {isBlocked || isBlockingMe ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <ShieldAlert className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-900">
                  {isBlocked ? 'You have blocked this user' : 'You are blocked'}
                </h3>
                <p className="text-sm text-gray-500 max-w-[200px]">
                  {isBlocked ? 'Unblock them to send messages.' : 'You cannot send messages to this user.'}
                </p>
              </div>
            ) : (
              <>
                {messages
                  .filter(m => m.content.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                  .map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className="flex flex-col gap-1 max-w-[80%]">
                      {msg.reply_to_id && (
                        <div className={cn(
                          "text-[10px] px-3 py-1 bg-gray-100 rounded-t-xl border-l-2 border-emerald-500 text-gray-500 truncate",
                          msg.sender_id === user?.id ? "mr-2" : "ml-2"
                        )}>
                          Replying to: {messages.find(m => m.id === msg.reply_to_id)?.content || 'Media'}
                        </div>
                      )}
                      <div className="relative group/msg">
                        <div className={cn(
                          "p-3 rounded-2xl text-sm shadow-sm relative",
                          msg.sender_id === user?.id 
                            ? 'bg-emerald-500 text-white rounded-tr-none' 
                            : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                        )}>
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
                                  onClick={() => handleReact(msg.id, emoji)}
                                  className="bg-white border border-gray-100 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1"
                                >
                                  <span>{emoji}</span>
                                  <span className="font-bold text-gray-500">{(uids as string[]).length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Message Actions (Hover) */}
                        <div className={cn(
                          "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10",
                          msg.sender_id === user?.id ? "-left-24" : "-right-24"
                        )}>
                          <button 
                            onClick={() => setReplyingTo(msg)}
                            className="p-1.5 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-emerald-500 shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => setForwardingMessage(msg)}
                            className="p-1.5 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-blue-500 shadow-sm"
                            title="Forward"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {msg.sender_id === user?.id && (
                            <button 
                              onClick={async () => {
                                if (confirm('Delete this message?')) {
                                  const { error } = await supabase.from('messages').delete().eq('id', msg.id);
                                  if (error) toast.error('Failed to delete');
                                  else setMessages(prev => prev.filter(m => m.id !== msg.id));
                                }
                              }}
                              className="p-1.5 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-rose-500 shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="relative group/reactions">
                            <button className="p-1.5 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-rose-500 shadow-sm">
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-gray-100 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/reactions:opacity-100 transition-all pointer-events-none group-hover/reactions:pointer-events-auto">
                              {['❤️', '🔥', '😂', '😮', '😢', '👏'].map(emoji => (
                                <button 
                                  key={emoji}
                                  onClick={() => handleReact(msg.id, emoji)}
                                  className="hover:scale-125 transition-transform p-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5",
                        msg.sender_id === user?.id ? "justify-end" : "justify-start"
                      )}>
                        <span className="text-[9px] font-medium text-gray-400">
                          {formatDate(msg.created_at)}
                        </span>
                        {msg.sender_id === user?.id && (
                          <div className="flex items-center gap-1">
                            {msg.is_read ? (
                              <>
                                <span className="text-[8px] font-bold text-emerald-500 uppercase">Seen</span>
                                <CheckCheck className="w-3 h-3 text-emerald-500" />
                              </>
                            ) : msg.is_delivered ? (
                              <CheckCheck className="w-3 h-3 text-gray-300" />
                            ) : (
                              <Check className="w-3 h-3 text-gray-300" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-sm">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {activeChat.full_name || activeChat.username} is typing...
                      </span>
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
              </>
            )}
            
            <AnimatePresence>
              {showScrollBottom && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 p-3 bg-white border border-gray-100 rounded-full shadow-lg text-emerald-500 hover:bg-gray-50 transition-all z-20"
                >
                  <ChevronLeft className="w-5 h-5 -rotate-90" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {!isBlocked && !isBlockingMe && (
            <div className="shrink-0">
              {replyingTo && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
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
              
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-50 glass">
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <div className="flex-1 flex items-center gap-4 px-4 py-2 bg-rose-50 rounded-2xl">
                      <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-rose-600 flex-1">Recording... {formatDuration(recordingDuration)}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsRecording(false);
                          clearInterval(timerRef.current);
                          mediaRecorderRef.current?.stop();
                          audioChunksRef.current = [];
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button 
                        type="button" 
                        onClick={stopRecording}
                        className="p-3 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 hover:bg-gray-50 text-gray-400 rounded-xl transition-all active:scale-90"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className={cn(
                            "p-2.5 hover:bg-gray-50 rounded-xl transition-all active:scale-90",
                            showEmojiPicker ? "text-emerald-500 bg-emerald-50" : "text-gray-400"
                          )}
                        >
                          <Smile className="w-5 h-5" />
                        </button>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
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
                          className="w-full pl-6 pr-12 py-3.5 bg-gray-50 border-none rounded-[24px] text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                        {newMessage.trim() && (
                          <button 
                            type="submit" 
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:bg-emerald-50 rounded-full transition-all active:scale-90"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      {!newMessage.trim() && (
                        <button 
                          type="button" 
                          onClick={startRecording}
                          className="p-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
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
            </div>
          )}
      </div>

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
    </div>
  );
}

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Messenger</h2>
        <button className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Active Users Horizontal List */}
      <div className="mb-6">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Active Now</h3>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {contacts.filter(c => isUserOnline(c.id)).map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col items-center gap-2 flex-shrink-0 group cursor-pointer"
            >
              <div className="relative">
                <div 
                  className="w-14 h-14 rounded-full bg-gray-100 p-0.5 border-2 border-emerald-500 group-hover:scale-105 transition-transform overflow-hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUserClick?.(contact.id);
                  }}
                >
                  <div className="w-full h-full rounded-full overflow-hidden">
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-white"><UserIcon className="w-6 h-6" /></div>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <span 
                className="text-[10px] font-bold text-gray-700 max-w-[60px] truncate hover:text-emerald-600 transition-colors"
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
            <p className="text-xs text-gray-400 font-medium py-2">No active users</p>
          )}
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-2xl text-xs focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Messages</h3>
        <div className="space-y-1">
          {contacts
            .filter(c => 
              c.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
              c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((contact) => (
            <div
              key={contact.id}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-all group text-left cursor-pointer"
              onClick={() => {
                setActiveChat(contact);
                fetchMessages(contact.id);
              }}
            >
              <div className="relative flex-shrink-0">
                <div 
                  className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden border border-gray-100 hover:border-emerald-500 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUserClick?.(contact.id);
                  }}
                >
                  {contact.avatar_url ? (
                    <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><UserIcon className="w-6 h-6" /></div>
                  )}
                </div>
                <div className={cn(
                  "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
                  isUserOnline(contact.id) ? "bg-emerald-500" : "bg-gray-300"
                )} />
              </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors flex items-center gap-1">
                      {contact.full_name || contact.username}
                      {contact.is_verified && <VerificationBadge size="sm" />}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {isUserOnline(contact.id) ? 'Active' : 'Away'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">Click to start chatting</p>
                </div>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
