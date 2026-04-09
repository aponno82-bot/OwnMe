import { useState, useEffect } from 'react';
import { useAuth } from './lib/useAuth';
import { Toaster } from 'sonner';
import AuthForm from './components/auth/AuthForm';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Feed from './components/feed/Feed';
import Messenger from './components/messenger/Messenger';
import BottomNav from './components/layout/BottomNav';
import ProfilePage from './components/profile/ProfilePage';
import NotificationCenter from './components/notifications/NotificationCenter';
import Explore from './components/explore/Explore';
import SuggestedUsers from './components/explore/SuggestedUsers';
import Groups from './components/groups/Groups';
import Reels from './components/reels/Reels';
import Settings from './components/settings/Settings';
import TrendingHashtags from './components/explore/TrendingHashtags';
import HashtagFeed from './components/explore/HashtagFeed';
import { Users, Calendar } from 'lucide-react';
import { requestNotificationPermission } from './lib/notifications';

export default function App() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<'feed' | 'profile' | 'explore' | 'notifications' | 'messages' | 'reels' | 'hashtag' | 'groups' | 'events' | 'settings'>('feed');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  const handleNavigate = (page: any, id?: string) => {
    setCurrentPage(page);
    if (page === 'profile') {
      setViewingUserId(id || user?.id || null);
    } else if (page === 'hashtag') {
      setActiveHashtag(id || null);
    } else if (page === 'messages') {
      setActiveChatUserId(id || null);
    } else {
      setViewingUserId(null);
      setActiveHashtag(null);
      setActiveChatUserId(null);
    }
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <AuthForm />
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Navbar onNavigate={handleNavigate} currentPage={currentPage} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Hidden on mobile */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 h-[calc(100vh-120px)]">
            <Sidebar onNavigate={handleNavigate} currentPage={currentPage} />
          </aside>

          {/* Main Content */}
          <section className="lg:col-span-6">
            {currentPage === 'feed' && (
              <Feed 
                onUserClick={(id) => handleNavigate('profile', id)} 
                onHashtagClick={(tag) => handleNavigate('hashtag', tag)}
              />
            )}
            {currentPage === 'reels' && <Reels onUserClick={(id) => handleNavigate('profile', id)} />}
            {currentPage === 'hashtag' && activeHashtag && (
              <HashtagFeed 
                hashtag={activeHashtag} 
                onBack={() => handleNavigate('feed')}
                onUserClick={(id) => handleNavigate('profile', id)}
                onHashtagClick={(tag) => handleNavigate('hashtag', tag)}
              />
            )}
            {currentPage === 'profile' && (
              <ProfilePage 
                userId={viewingUserId || user.id} 
                onNavigate={handleNavigate}
              />
            )}
            {currentPage === 'messages' && (
              <div className="fixed inset-0 top-[72px] bottom-[80px] lg:static lg:h-[calc(100vh-120px)] z-40 bg-white">
                <Messenger initialContactId={activeChatUserId} />
              </div>
            )}
            {currentPage === 'explore' && (
              <Explore 
                onUserClick={(id) => handleNavigate('profile', id)} 
                onHashtagClick={(tag) => handleNavigate('hashtag', tag)}
              />
            )}
            {currentPage === 'notifications' && <NotificationCenter onUserClick={(id) => handleNavigate('profile', id)} />}
            {currentPage === 'groups' && <Groups />}
            {currentPage === 'settings' && <Settings />}
            {currentPage === 'events' && (
              <div className="card-premium p-12 text-center">
                <Calendar className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Events</h2>
                <p className="text-gray-500">Upcoming events feature is coming soon!</p>
              </div>
            )}
          </section>

          {/* Right Sidebar - Messenger/Activity */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 h-[calc(100vh-120px)] overflow-y-auto no-scrollbar">
            <TrendingHashtags onHashtagClick={(tag) => handleNavigate('hashtag', tag)} />
            <SuggestedUsers onUserClick={(id) => id === 'explore' ? handleNavigate('explore') : handleNavigate('profile', id)} />
            <Messenger />
          </aside>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav onNavigate={handleNavigate} currentPage={currentPage} />
      
      <Toaster position="top-right" richColors />
    </div>
  );
}
