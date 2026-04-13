import { Home, Compass, Bell, MessageSquare, Users, Flag, Calendar, Settings, User, PlayCircle, Shield, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/useAuth';
import { useBadges } from '../../lib/useBadges';

interface SidebarProps {
  onNavigate: (page: any) => void;
  currentPage: string;
}

export default function Sidebar({ onNavigate, currentPage }: SidebarProps) {
  const { profile } = useAuth();
  const { unreadNotifications, unreadMessages } = useBadges();
  const isAdmin = profile?.role === 'admin';

  const menuItems = [
    { id: 'feed', label: 'News Feed', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'reels', label: 'Reels', icon: PlayCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'admin', label: 'Admin Panel', icon: Shield });
  }

  const communityItems = [
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'events', label: 'Events', icon: Calendar },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 px-4">Menu</p>
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative",
                currentPage === item.id 
                  ? "bg-emerald-50 text-emerald-600" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                currentPage === item.id ? "text-emerald-600" : "text-gray-400 group-hover:text-gray-900"
              )} />
              <span className="font-medium">{item.label}</span>
              {item.id === 'profile' && profile?.is_premium && (
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              {currentPage === item.id && !item.badge && (
                <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 px-4">Communities</p>
        <div className="space-y-1">
          {communityItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group",
                currentPage === item.id 
                  ? "bg-emerald-50 text-emerald-600" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                currentPage === item.id ? "text-emerald-600" : "text-gray-400 group-hover:text-gray-900"
              )} />
              <span className="font-medium">{item.label}</span>
              {currentPage === item.id && (
                <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-8 border-t border-gray-100">
        <button 
          onClick={() => onNavigate('settings')}
          className={cn(
            "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group",
            currentPage === 'settings' 
              ? "bg-emerald-50 text-emerald-600" 
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <Settings className={cn(
            "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
            currentPage === 'settings' ? "text-emerald-600" : "text-gray-400 group-hover:text-gray-900"
          )} />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
