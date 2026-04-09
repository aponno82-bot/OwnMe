import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useConnections(targetUserId?: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && targetUserId) {
      checkFollowing();
    }
  }, [user, targetUserId]);

  async function checkFollowing() {
    if (!user || !targetUserId) return;
    
    const { data } = await supabase
      .from('connections')
      .select('*')
      .eq('sender_id', user.id)
      .eq('receiver_id', targetUserId)
      .eq('status', 'accepted')
      .single();
    
    setIsFollowing(!!data);
  }

  async function toggleFollow() {
    if (!user || !targetUserId) {
      toast.error('Please sign in to follow users');
      return;
    }

    setLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('connections')
          .delete()
          .eq('sender_id', user.id)
          .eq('receiver_id', targetUserId);
        
        if (error) throw error;
        setIsFollowing(false);
        toast.success('Unfollowed user');
      } else {
        const { error } = await supabase
          .from('connections')
          .insert({
            sender_id: user.id,
            receiver_id: targetUserId,
            status: 'accepted' // For simplicity in this demo, we auto-accept
          });
        
        if (error) throw error;
        setIsFollowing(true);
        toast.success('Following user');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return { isFollowing, toggleFollow, loading };
}
