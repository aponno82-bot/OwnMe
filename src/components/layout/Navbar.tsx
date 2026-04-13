import { Search, User, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { useBadges } from '../../lib/useBadges';
import { cn } from '../../lib/utils';

interface NavbarProps {
  onNavigate: (page: any) => void;
  currentPage: string;
}

export default function Navbar({ onNavigate, currentPage }: NavbarProps) {
  const { profile } = useAuth();
  const { unreadNotifications, unreadMessages } = useBadges();

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 glass z-50">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => onNavigate('feed')}
        >
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all group-active:scale-90">
            <span className="text-white font-bold text-xl">O</span>
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:block group-hover:text-emerald-600 transition-colors">OwnMe</span>
        </div>

        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search people, groups, events..."
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none focus:bg-white"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div 
            className="flex items-center gap-3 pl-2 sm:pl-4 cursor-pointer group"
            onClick={() => onNavigate('profile')}
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                {profile?.full_name || profile?.username || 'User'}
              </p>
              {profile?.is_premium && (
                <p className="text-[10px] text-amber-500 uppercase tracking-wider font-bold">Premium Member</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden group-hover:border-emerald-500 transition-all">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <User className="w-6 h-6" />
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={() => supabase.auth.signOut()}
            className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
