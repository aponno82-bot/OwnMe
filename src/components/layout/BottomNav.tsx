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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 px-6 flex items-center justify-between">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={cn(
            "p-3 rounded-2xl transition-all active:scale-90",
            currentPage === item.id ? "text-emerald-500 bg-emerald-50" : "text-gray-400"
          )}
        >
          <item.icon className="w-6 h-6" />
        </button>
      ))}
    </div>
  );
}
