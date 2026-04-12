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
import MobileSidebar from './components/layout/MobileSidebar';
import { Users, Calendar } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Profile } from './types';
import { cn } from './lib/utils';

export default function App() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const isMessengerPage = currentPage === 'messages';
  const isInboxPage = isMessengerPage && location.pathname.split('/').filter(Boolean).length > 1;

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
      {!isMessengerPage && <Navbar onNavigate={handleNavigate} currentPage={currentPage} />}
      
      <main className={cn(
        "flex-1 container mx-auto px-4 py-6 lg:py-8 lg:mb-0",
        !isMessengerPage ? "mt-[72px] mb-14" : "mt-0 mb-0 lg:mt-[72px]"
      )}>
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
              <Route path="/messages/:contactId" element={<MessengerWrapper onUserClick={(id) => handleNavigate('profile', id)} onNavigate={handleNavigate} />} />
              <Route path="/messages" element={<MessengerWrapper onUserClick={(id) => handleNavigate('profile', id)} onNavigate={handleNavigate} />} />
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
            <Messenger onNavigate={handleNavigate} />
          </aside>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {!isMessengerPage && (
        <BottomNav 
          onNavigate={handleNavigate} 
          currentPage={currentPage} 
          onOpenMenu={() => setIsMobileMenuOpen(true)}
        />
      )}

      <MobileSidebar 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onNavigate={handleNavigate}
        currentPage={currentPage}
      />
      
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

function MessengerWrapper({ onUserClick, onNavigate }: { onUserClick: (userId: string) => void, onNavigate: (page: string, params?: any) => void }) {
  const { contactId } = useParams();
  return (
    <div className="fixed inset-0 lg:static lg:h-[calc(100vh-120px)] z-40 bg-white">
      <Messenger 
        initialContactId={contactId} 
        onUserClick={onUserClick}
        onNavigate={onNavigate}
      />
    </div>
  );
}
