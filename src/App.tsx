import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/useAuth';
import { Toaster } from 'sonner';
import { requestNotificationPermission } from './lib/notifications';
import AuthForm from './components/auth/AuthForm';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Feed from './components/feed/Feed';
import Messenger from './components/messenger/Messenger';
import BottomNav from './components/layout/BottomNav';
import PostPage from './components/feed/PostPage';
import ProfilePage from './components/profile/ProfilePage';
import NotificationCenter from './components/notifications/NotificationCenter';
import Explore from './components/explore/Explore';
import Groups from './components/groups/Groups';
import Reels from './components/reels/Reels';
import Settings from './components/settings/Settings';
import AdminPanel from './components/admin/AdminPanel';
import TrendingHashtags from './components/explore/TrendingHashtags';
import HashtagFeed from './components/explore/HashtagFeed';
import CallModal from './components/messenger/CallModal';
import { Users, Calendar } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Profile } from './types';

export default function App() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);

  // Global Call State
  const [isCalling, setIsCalling] = useState<'audio' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ from: Profile; type: 'audio' | 'video' } | null>(null);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended' | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [activeCallContact, setActiveCallContact] = useState<Profile | null>(null);
  const callTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`global-calls:${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, async (payload) => {
        const msg = payload.new;
        if (msg.media_type === 'call') {
          if (msg.content === 'START_CALL') {
            const { data: caller } = await supabase.from('profiles').select('*').eq('id', msg.sender_id).single();
            if (caller) {
              setIncomingCall({ from: caller, type: msg.media_url as 'audio' | 'video' });
              setActiveCallContact(caller);
              setCallStatus('ringing');
            }
          } else if (msg.content === 'END_CALL') {
            setCallStatus('ended');
            clearInterval(callTimerRef.current);
            setTimeout(() => {
              setIncomingCall(null);
              setIsCalling(null);
              setCallStatus(null);
              setActiveCallContact(null);
              setCallDuration(0);
            }, 2000);
          } else if (msg.content === 'ACCEPT_CALL') {
            setCallStatus('connected');
            setCallDuration(0);
            clearInterval(callTimerRef.current);
            callTimerRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);
          }
        }
      })
      .subscribe();

    // Listen for local start-call events
    const handleStartCall = (e: any) => {
      const { contact, type } = e.detail;
      setIsCalling(type);
      setActiveCallContact(contact);
      setCallStatus('ringing');
      
      supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: contact.id,
        content: 'START_CALL',
        media_type: 'call',
        media_url: type,
        is_read: false
      });
    };

    window.addEventListener('start-call', handleStartCall);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('start-call', handleStartCall);
      clearInterval(callTimerRef.current);
    };
  }, [user]);

  const handleAcceptCall = async () => {
    if (!incomingCall || !user) return;
    
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: incomingCall.from.id,
      content: 'ACCEPT_CALL',
      media_type: 'call',
      is_read: false
    });

    setCallStatus('connected');
    setIsCalling(incomingCall.type);
    setCallDuration(0);
    clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleEndCall = async () => {
    if (!user || !activeCallContact) return;
    
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: activeCallContact.id,
      content: 'END_CALL',
      media_type: 'call',
      is_read: false
    });

    setCallStatus('ended');
    clearInterval(callTimerRef.current);
    setTimeout(() => {
      setIsCalling(null);
      setIncomingCall(null);
      setCallStatus(null);
      setActiveCallContact(null);
      setCallDuration(0);
    }, 2000);
  };

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);

    if (notification.type === 'message') {
      navigate(`/messages/${notification.actor_id}`);
    } else if (notification.type === 'follow') {
      navigate(`/profile/${notification.actor_id}`);
    } else if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    }
  };

  useEffect(() => {
    requestNotificationPermission();
    if (user) {
      // Request camera and microphone permissions
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(err => {
          console.log('Media permissions denied or not available:', err);
        });
    }
  }, [user]);

  const handleNavigate = (page: string, id?: string) => {
    if (page === 'feed') navigate('/');
    else if (page === 'profile') navigate(`/profile/${id || user?.id}`);
    else if (page === 'explore') navigate('/explore');
    else if (page === 'notifications') navigate('/notifications');
    else if (page === 'messages') navigate(id ? `/messages/${id}` : '/messages');
    else if (page === 'reels') navigate('/reels');
    else if (page === 'hashtag') navigate(`/hashtag/${id}`);
    else if (page === 'groups') navigate('/groups');
    else if (page === 'settings') navigate('/settings');
    else if (page === 'admin') navigate('/admin');
    else if (page === 'post') navigate(`/post/${id}`);
    else if (page === 'events') navigate('/events');
    
    window.scrollTo(0, 0);
  };

  // Get current page from location for Navbar/Sidebar highlighting
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/') return 'feed';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/explore')) return 'explore';
    if (path.startsWith('/notifications')) return 'notifications';
    if (path.startsWith('/messages')) return 'messages';
    if (path.startsWith('/reels')) return 'reels';
    if (path.startsWith('/hashtag')) return 'hashtag';
    if (path.startsWith('/groups')) return 'groups';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/post')) return 'post';
    if (path.startsWith('/events')) return 'events';
    return 'feed';
  };

  const currentPage = getCurrentPage();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthForm />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar onNavigate={handleNavigate} currentPage={currentPage} />
      
      <main className="flex-1 container mx-auto px-4 py-6 lg:py-8 mt-[72px] mb-[80px] lg:mb-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Navigation */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 h-[calc(100vh-120px)]">
            <Sidebar onNavigate={handleNavigate} currentPage={currentPage} />
          </aside>

          {/* Main Content */}
          <section className="col-span-1 lg:col-span-6">
            <Routes>
              <Route path="/" element={
                <Feed 
                  onUserClick={(id) => handleNavigate('profile', id)} 
                  onHashtagClick={(tag) => handleNavigate('hashtag', tag)}
                  onPostClick={(id) => handleNavigate('post', id)}
                  highlightPostId={highlightPostId}
                />
              } />
              <Route path="/reels" element={<Reels onUserClick={(id) => handleNavigate('profile', id)} />} />
              <Route path="/post/:postId" element={<PostPage />} />
              <Route path="/hashtag/:hashtag" element={<HashtagFeedWrapper onNavigate={handleNavigate} />} />
              <Route path="/profile/:userId" element={<ProfilePageWrapper onNavigate={handleNavigate} />} />
              <Route path="/profile" element={<ProfilePageWrapper onNavigate={handleNavigate} />} />
              <Route path="/messages/:contactId" element={<MessengerWrapper onUserClick={(id) => handleNavigate('profile', id)} />} />
              <Route path="/messages" element={<MessengerWrapper onUserClick={(id) => handleNavigate('profile', id)} />} />
              <Route path="/explore" element={
                <Explore 
                  onUserClick={(id) => handleNavigate('profile', id)} 
                  onHashtagClick={(tag) => handleNavigate('hashtag', tag)}
                  onPostClick={(id) => handleNavigate('post', id)}
                />
              } />
              <Route path="/notifications" element={
                <NotificationCenter 
                  onUserClick={(id) => handleNavigate('profile', id)} 
                  onNotificationClick={handleNotificationClick}
                />
              } />
              <Route path="/groups" element={<Groups />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/events" element={
                <div className="card-premium p-12 text-center">
                  <Calendar className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Events</h2>
                  <p className="text-gray-500">Upcoming events feature is coming soon!</p>
                </div>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </section>

          {/* Right Sidebar - Messenger/Activity */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 h-[calc(100vh-120px)] overflow-y-auto no-scrollbar">
            <TrendingHashtags onHashtagClick={(tag) => handleNavigate('hashtag', tag)} />
            <Messenger />
          </aside>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav onNavigate={handleNavigate} currentPage={currentPage} />
      
      <AnimatePresence>
        {(isCalling || incomingCall) && activeCallContact && (
          <CallModal 
            type={isCalling || incomingCall?.type || 'audio'}
            status={callStatus || 'ringing'}
            contact={activeCallContact}
            isIncoming={!!incomingCall && !isCalling}
            onEnd={handleEndCall}
            onAccept={handleAcceptCall}
          />
        )}
      </AnimatePresence>

      <Toaster position="top-right" richColors />
    </div>
  );
}

// Wrapper components to handle URL parameters
import { useParams } from 'react-router-dom';

function HashtagFeedWrapper({ onNavigate }: { onNavigate: (page: string, id?: string) => void }) {
  const { hashtag } = useParams();
  return (
    <HashtagFeed 
      hashtag={hashtag!} 
      onBack={() => onNavigate('feed')}
      onUserClick={(id) => onNavigate('profile', id)}
      onHashtagClick={(tag) => onNavigate('hashtag', tag)}
      onPostClick={(id) => onNavigate('post', id)}
    />
  );
}

function ProfilePageWrapper({ onNavigate }: { onNavigate: (page: string, id?: string) => void }) {
  const { userId } = useParams();
  const { user } = useAuth();
  return (
    <ProfilePage 
      userId={userId || user?.id || ''} 
      onNavigate={onNavigate}
    />
  );
}

function MessengerWrapper({ onUserClick }: { onUserClick: (userId: string) => void }) {
  const { contactId } = useParams();
  return (
    <div className="fixed inset-0 top-[72px] bottom-[80px] lg:static lg:h-[calc(100vh-120px)] z-40 bg-white">
      <Messenger 
        initialContactId={contactId} 
        onUserClick={onUserClick}
      />
    </div>
  );
}
