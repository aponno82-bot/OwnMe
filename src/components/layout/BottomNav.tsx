import { Home, Compass, Bell, MessageSquare, User, PlayCircle, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/useAuth';

interface BottomNavProps {
  onNavigate: (page: any) => void;
  currentPage: string;
}

export default function BottomNav({ onNavigate, currentPage }: BottomNavProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const items = [
    { id: 'feed', icon: Home },
    { id: 'explore', icon: Compass },
    { id: 'reels', icon: PlayCircle },
    { id: 'messages', icon: MessageSquare },
    { id: 'profile', icon: User },
  ];

  if (isAdmin) {
    items.push({ id: 'admin', icon: Shield });
  }

  return (
    <div className="lg:hidden fixed bottom-6 left-6 right-6 h-20 glass rounded-[32px] z-50 px-6 flex items-center justify-between shadow-2xl">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={cn(
            "p-3 rounded-2xl transition-all active:scale-90",
            currentPage === item.id ? "text-emerald-500 bg-emerald-50 shadow-sm" : "text-gray-400 hover:bg-gray-50"
          )}
        >
          <item.icon className="w-6 h-6" />
        </button>
      ))}
    </div>
  );
}
