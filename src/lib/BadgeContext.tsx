import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';

interface BadgeContextType {
  unreadNotifications: number;
  unreadMessages: number;
  refreshNotifications: (optimisticCount?: number) => void;
  refreshMessages: (optimisticCount?: number) => void;
}

const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        setUnreadNotifications(count || 0);
      }
    } catch (err) {
      console.error('Fetch Notifications Error:', err);
    }
  }, [user?.id]);

  const fetchUnreadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        setUnreadMessages(count || 0);
      }
    } catch (err) {
      console.error('Fetch Messages Error:', err);
    }
  }, [user?.id]);

  const fetchUnreadCounts = useCallback((optNotifications?: number, optMessages?: number) => {
    if (optNotifications !== undefined) setUnreadNotifications(optNotifications);
    if (optMessages !== undefined) setUnreadMessages(optMessages);

    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    
    refreshTimeoutRef.current = setTimeout(async () => {
      if (!user) return;
      await Promise.all([
        fetchUnreadNotifications(),
        fetchUnreadMessages()
      ]);
    }, 100);
  }, [user?.id, fetchUnreadNotifications, fetchUnreadMessages]);

  const refreshNotifications = useCallback((count?: number) => fetchUnreadCounts(count, undefined), [fetchUnreadCounts]);
  const refreshMessages = useCallback((count?: number) => fetchUnreadCounts(undefined, count), [fetchUnreadCounts]);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }

    let channel: any;

    const subscribe = () => {
      if (channel) supabase.removeChannel(channel);

      channel = supabase
        .channel(`user-badges-${user.id}-${Math.random().toString(36).substring(7)}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => fetchUnreadCounts())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, () => fetchUnreadCounts())
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            const timer = setTimeout(subscribe, 5000);
            return () => clearTimeout(timer);
          }
        });
    };

    subscribe();
    fetchUnreadCounts();

    const handleRefresh = () => fetchUnreadCounts();
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('online', handleRefresh);
    const interval = setInterval(fetchUnreadCounts, 30000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('online', handleRefresh);
      clearInterval(interval);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [user?.id, fetchUnreadCounts]);

  return (
    <BadgeContext.Provider value={{ 
      unreadNotifications, 
      unreadMessages, 
      refreshNotifications,
      refreshMessages
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
