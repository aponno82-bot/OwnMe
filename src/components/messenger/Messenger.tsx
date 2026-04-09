import React, { useState, useEffect, useRef } from 'react';
import { Search, MoreHorizontal, MessageCircle, Send, User as UserIcon, Phone, Video, Paperclip, Image as ImageIcon, FileText, Mic, X, Loader2, PhoneIncoming, PhoneOutgoing, PhoneOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { Message, Profile } from '../../types';
import { toast } from 'sonner';
import { usePresence } from '../../lib/usePresence';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { sendBrowserNotification } from '../../lib/notifications';

interface MessengerProps {
  initialContactId?: string | null;
}

export default function Messenger({ initialContactId }: MessengerProps) {
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
  const [isCalling, setIsCalling] = useState<'audio' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ from: Profile, type: 'audio' | 'video' } | null>(null);
  
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
    
    const channel = supabase
      .channel(`messages:${user.id}:${instanceId.current}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${user.id}` 
      }, (payload) => {
        const msg = payload.new as Message;
        const currentActiveChat = activeChatRef.current;
        
        if (msg.media_type === 'call' && msg.content === 'START_CALL') {
          fetchCallerProfile(msg.sender_id, msg.media_url as 'audio' | 'video');
          return;
        }

        if (currentActiveChat && msg.sender_id === currentActiveChat.id) {
          setMessages(prev => [...prev, msg]);
          markAsRead(msg.id);
        } else {
          // Send browser notification
          fetchProfileForNotification(msg.sender_id, msg.content);
          toast.info(`New message from someone`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function fetchProfileForNotification(userId: string, content: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      sendBrowserNotification(`Message from ${data.full_name || data.username}`, {
        body: content,
        icon: data.avatar_url || '/favicon.ico'
      });
    }
  }

  async function fetchCallerProfile(userId: string, type: 'audio' | 'video') {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setIncomingCall({ from: data, type });
    }
  }

  async function markAsRead(messageId: string) {
    await supabase.from('messages').update({ is_read: true }).eq('id', messageId);
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

  async function fetchMessages(contactId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
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
      if (error) throw error;
      setMessages(prev => [...prev, data]);
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
      if (error) throw error;
      
      setMessages(prev => [...prev, data]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    const messageObj = {
      sender_id: user.id,
      receiver_id: activeChat.id,
      content: newMessage.trim(),
    };

    const { data, error } = await supabase.from('messages').insert(messageObj).select().single();
    if (error) {
      toast.error('Failed to send message');
    } else {
      setMessages(prev => [...prev, data]);
      setNewMessage('');
    }
  };

  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended' | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<any>(null);

  const startCall = async (type: 'audio' | 'video') => {
    if (!activeChat || !user) return;
    setIsCalling(type);
    setCallStatus('ringing');
    
    // Send a signaling message
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeChat.id,
      content: 'START_CALL',
      media_type: 'call',
      media_url: type
    });
  };

  const acceptCall = () => {
    setCallStatus('connected');
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const endCall = () => {
    setIsCalling(null);
    setIncomingCall(null);
    setCallStatus(null);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
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
        <video src={msg.media_url!} controls className="rounded-lg max-w-full h-auto" />
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
        <div className="flex items-center gap-3 py-1 min-w-[200px]">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <audio src={msg.media_url!} controls className="h-8 flex-1" />
        </div>
      );
    }
    return msg.content;
  };

  if (activeChat) {
    return (
      <div className="flex flex-col h-full bg-white rounded-[24px] overflow-hidden border border-gray-100 shadow-sm relative">
        {/* Call UI Overlays */}
        <AnimatePresence>
          {(isCalling || incomingCall) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-emerald-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-white p-8"
            >
              <div className="w-24 h-24 rounded-full bg-white/10 p-1 mb-6 animate-pulse">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/20">
                  {(isCalling ? activeChat : incomingCall?.from)?.avatar_url ? (
                    <img src={(isCalling ? activeChat : incomingCall?.from)!.avatar_url!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-800 text-2xl font-bold">
                      {(isCalling ? activeChat : incomingCall?.from)!.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              
              <h2 className="text-2xl font-bold mb-2">
                {(isCalling ? activeChat : incomingCall?.from)!.full_name || (isCalling ? activeChat : incomingCall?.from)!.username}
              </h2>
              
              <div className="text-emerald-200 mb-12 flex flex-col items-center gap-2">
                {callStatus === 'connected' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="font-mono text-xl">{formatDuration(callDuration)}</span>
                    </div>
                    <span className="text-xs uppercase tracking-widest opacity-60">Connected</span>
                  </>
                ) : (
                  <p className="animate-bounce">
                    {isCalling ? `Calling (${isCalling})...` : `Incoming ${incomingCall?.type} call...`}
                  </p>
                )}
              </div>

              <div className="flex gap-8">
                {incomingCall && callStatus !== 'connected' && (
                  <button 
                    onClick={acceptCall}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-emerald-500/20"
                  >
                    {incomingCall.type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                  </button>
                )}
                <button 
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-400 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-rose-500/20"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col h-full relative">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-gray-50 rounded-full">
                <MoreHorizontal className="w-5 h-5 rotate-90" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100">
                {activeChat.avatar_url ? (
                  <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                    {activeChat.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">{activeChat.full_name || activeChat.username}</h4>
                <p className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  isUserOnline(activeChat.id) ? "text-emerald-500" : "text-gray-400"
                )}>
                  {isUserOnline(activeChat.id) ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => startCall('audio')} className="p-2 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button onClick={() => startCall('video')} className="p-2 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors">
                <Video className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-50 text-gray-500 rounded-xl transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-gray-50/30">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div className={cn(
                    "p-3 rounded-2xl text-sm shadow-sm",
                    msg.sender_id === user?.id 
                      ? 'bg-emerald-500 text-white rounded-tr-none' 
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                  )}>
                    {renderMessageContent(msg)}
                  </div>
                  <span className={cn(
                    "text-[9px] font-medium",
                    msg.sender_id === user?.id ? "text-right text-gray-400" : "text-left text-gray-400"
                  )}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>
              </div>
            ))}
            {uploading && (
              <div className="flex justify-end">
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl rounded-tr-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-bold">Uploading...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-50 bg-white shrink-0">
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
                    className="p-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-gray-50 text-gray-400 rounded-xl transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors disabled:opacity-50">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <button 
                    type="button" 
                    onClick={startRecording}
                    className="p-2 hover:bg-gray-50 text-gray-400 rounded-xl transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
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
            <button
              key={contact.id}
              onClick={() => {
                setActiveChat(contact);
                fetchMessages(contact.id);
              }}
              className="flex flex-col items-center gap-2 flex-shrink-0 group"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gray-100 p-0.5 border-2 border-emerald-500 group-hover:scale-105 transition-transform">
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
              <span className="text-[10px] font-bold text-gray-700 max-w-[60px] truncate">{contact.full_name?.split(' ')[0] || contact.username}</span>
            </button>
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
            <button
              key={contact.id}
              onClick={() => {
                setActiveChat(contact);
                fetchMessages(contact.id);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-all group text-left"
            >
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden border border-gray-100">
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
                  <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">{contact.full_name || contact.username}</h4>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {isUserOnline(contact.id) ? 'Active' : 'Away'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">Click to start chatting</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
