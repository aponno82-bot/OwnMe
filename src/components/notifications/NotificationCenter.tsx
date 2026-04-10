import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { Notification } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import { Bell, Heart, MessageCircle, UserPlus, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sendBrowserNotification } from '../../lib/notifications';

interface NotificationCenterProps {
  onUserClick?: (userId: string) => void;
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationCenter({ onUserClick, onNotificationClick }: NotificationCenterProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}` 
      }, (payload) => {
        fetchNewNotificationWithProfile(payload.new.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles:actor_id (*)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) setNotifications(data);
    setLoading(false);
  }

  async function fetchNewNotificationWithProfile(id: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*, profiles:actor_id (*)')
      .eq('id', id)
      .single();
    
    if (data) {
      setNotifications(prev => {
        if (prev.some(n => n.id === data.id)) return prev;
        return [data, ...prev];
      });
      sendBrowserNotification('New Notification', {
        body: getMessage(data),
        icon: data.profiles?.avatar_url || '/favicon.ico'
      });
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-rose-500 fill-current" />;
      case 'comment': return <MessageCircle className="w-4 h-4 text-emerald-500" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-amber-500" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const getMessage = (notification: Notification) => {
    const name = notification.profiles?.full_name || notification.profiles?.username || 'Someone';
    switch (notification.type) {
      case 'like': return `${name} liked your post`;
      case 'comment': return `${name} commented on your post`;
      case 'follow': return `${name} started following you`;
      case 'message': return `${name} sent you a message`;
      default: return 'New notification';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-50 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full uppercase">
          {notifications.filter(n => !n.is_read).length} New
        </span>
      </div>

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => onNotificationClick?.(notification)}
              className={cn(
                "flex items-center gap-4 p-3 rounded-2xl transition-all hover:bg-gray-50 cursor-pointer group",
                !notification.is_read && "bg-emerald-50/30"
              )}
            >
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden border border-gray-100">
                  {notification.profiles?.avatar_url ? (
                    <img src={notification.profiles.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                      {notification.profiles?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-50">
                  {getIcon(notification.type)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 line-clamp-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (notification.actor_id) onUserClick?.(notification.actor_id);
                    }}
                    className="font-bold text-gray-900 hover:text-emerald-600 transition-colors"
                  >
                    {notification.profiles?.full_name || notification.profiles?.username}
                  </button>
                  {' '}{getMessage(notification).replace(notification.profiles?.full_name || notification.profiles?.username || '', '').trim()}
                </p>
                <span className="text-[10px] text-gray-400 font-medium">{formatDate(notification.created_at)}</span>
              </div>

              {!notification.is_read && (
                <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {notifications.length === 0 && (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
