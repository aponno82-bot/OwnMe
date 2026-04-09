import { Search, Bell, MessageCircle, User, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { cn } from '../../lib/utils';

interface NavbarProps {
  onNavigate: (page: any) => void;
  currentPage: string;
}

export default function Navbar({ onNavigate, currentPage }: NavbarProps) {
  const { profile } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate('feed')}
        >
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">O</span>
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:block">OwnMe</span>
        </div>

        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search people, groups, events..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => onNavigate('notifications')}
            className={cn(
              "p-2 rounded-full hover:bg-gray-50 transition-colors relative",
              currentPage === 'notifications' && "text-emerald-500 bg-emerald-50"
            )}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></span>
          </button>
          
          <div 
            className="flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-gray-100 cursor-pointer group"
            onClick={() => onNavigate('profile')}
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                {profile?.full_name || profile?.username || 'User'}
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Premium Member</p>
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
