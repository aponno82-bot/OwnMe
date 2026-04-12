import { Home, Compass, Bell, MessageSquare, User, PlayCircle, Shield, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/useAuth';

interface BottomNavProps {
  onNavigate: (page: any) => void;
  currentPage: string;
  onOpenMenu: () => void;
}

export default function BottomNav({ onNavigate, currentPage, onOpenMenu }: BottomNavProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const items = [
    { id: 'feed', icon: Home, label: 'Home' },
    { id: 'reels', icon: PlayCircle, label: 'Reels' },
    { id: 'messages', icon: MessageSquare, label: 'Chat' },
    { id: 'notifications', icon: Bell, label: 'Alerts' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-100 z-50 px-2 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all active:scale-95",
            currentPage === item.id ? "text-emerald-500" : "text-gray-400"
          )}
        >
          <item.icon className={cn("w-5 h-5", currentPage === item.id && "fill-emerald-500/10")} />
          <span className="text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
        </button>
      ))}
      
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-gray-400 transition-all active:scale-95"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[9px] font-bold uppercase tracking-tight">Menu</span>
      </button>
    </div>
  );
}
