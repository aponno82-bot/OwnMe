import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

interface BadgeContextType {
  unreadNotifications: number;
  unreadMessages: number;
  refreshNotifications: () => void;
  refreshMessages: () => void;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('Badge Realtime (Notifications):', payload);
          fetchUnreadCounts();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          console.log('Badge Realtime (Messages - Inbound):', payload);
          fetchUnreadCounts();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${user.id}`
        }, (payload) => {
          console.log('Badge Realtime (Messages - Outbound):', payload);
          fetchUnreadCounts();
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
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [user?.id]);

  function fetchUnreadCounts() {
    console.log('Triggering badge refresh (debounced)...');
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    
    refreshTimeoutRef.current = setTimeout(async () => {
      if (!user) return;
      console.log('Executing badge refresh...');
      await Promise.all([
        fetchUnreadNotifications(),
        fetchUnreadMessages()
      ]);
    }, 300);
  }

  async function fetchUnreadNotifications() {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        console.log(`Unread notifications count for ${user.id}:`, count);
        setUnreadNotifications(count || 0);
      } else {
        console.error('Error fetching unread notifications:', error);
      }
    } catch (err) {
      console.error('Exception in fetchUnreadNotifications:', err);
    }
  }

  async function fetchUnreadMessages() {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        console.log(`Unread messages count for ${user.id}:`, count);
        setUnreadMessages(count || 0);
      } else {
        console.error('Error fetching unread messages:', error);
      }
    } catch (err) {
      console.error('Exception in fetchUnreadMessages:', err);
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
