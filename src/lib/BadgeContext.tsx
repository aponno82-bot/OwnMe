import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

interface BadgeContextType {
  unreadNotifications: number;
  unreadMessages: number;
  refreshNotifications: () => Promise<void>;
  refreshMessages: () => Promise<void>;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    console.log('BadgeContext: User state changed:', user?.id);
    if (!user) {
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }

    let channel: any;

    const subscribe = () => {
      if (channel) supabase.removeChannel(channel);

      channel = supabase
        .channel(`user-badges-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications'
        }, (payload) => {
          console.log('Badge Realtime (Notifications):', payload);
          const data = payload.new || payload.old;
          if (data && (data as any).user_id === user.id) {
            fetchUnreadCounts();
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages'
        }, (payload) => {
          console.log('Badge Realtime (Messages):', payload);
          const data = payload.new || payload.old;
          if (data && ((data as any).receiver_id === user.id || (data as any).sender_id === user.id)) {
            fetchUnreadCounts();
          }
        })
        .subscribe((status) => {
          console.log(`Badge subscription status for ${user.id}:`, status);
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.error('Realtime channel error/closed. Retrying in 5s...');
            setTimeout(subscribe, 5000);
          }
        });
    };

    subscribe();
    fetchUnreadCounts();

    // Refresh when window gets focus or internet returns
    const handleRefresh = () => {
      console.log('Refreshing badges (focus/online)...');
      fetchUnreadCounts();
    };
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('online', handleRefresh);

    // Fallback interval every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('online', handleRefresh);
      clearInterval(interval);
    };
  }, [user?.id]);

  async function fetchUnreadCounts() {
    console.log('Triggering badge refresh...');
    // Add a small delay to ensure DB consistency after updates
    setTimeout(async () => {
      if (!user) return;
      await Promise.all([
        fetchUnreadNotifications(),
        fetchUnreadMessages()
      ]);
    }, 800);
  }

  async function fetchUnreadNotifications() {
    if (!user) return;
    const { data, count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: false }) // Get data too for debugging
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    if (!error) {
      console.log(`Unread notifications for ${user.id}:`, { count, data });
      setUnreadNotifications(count || 0);
    } else {
      console.error('Error fetching unread notifications:', error);
    }
  }

  async function fetchUnreadMessages() {
    if (!user) return;
    const { data, count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: false }) // Get data too for debugging
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    
    if (!error) {
      console.log(`Unread messages for ${user.id}:`, { count, data });
      setUnreadMessages(count || 0);
    } else {
      console.error('Error fetching unread messages:', error);
    }
  }

  return (
    <BadgeContext.Provider value={{ 
      unreadNotifications, 
      unreadMessages, 
      refreshNotifications: fetchUnreadCounts,
      refreshMessages: fetchUnreadCounts
    }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadges must be used within a BadgeProvider');
  }
  return context;
}
