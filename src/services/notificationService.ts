import { supabase } from '../lib/supabase';
import { sendBrowserNotification } from '../lib/notifications';

export type NotificationType = 'like' | 'comment' | 'follow' | 'message' | 'announcement' | 'group_invite' | 'group_post' | 'tag_request';

export async function createNotification(
  userId: string,
  actorId: string,
  type: NotificationType,
  postId?: string,
  metadata?: any
) {
  if (userId === actorId) return; // Don't notify self

  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        actor_id: actorId,
        type,
        post_id: postId,
        is_read: false
      })
      .select('*, profiles:actor_id(*)')
      .single();

    if (error) throw error;

    // Send browser notification
    if (notification) {
      const actorName = notification.profiles?.full_name || notification.profiles?.username || 'Someone';
      let title = 'New Notification';
      let body = '';

      switch (type) {
        case 'like':
          body = `${actorName} liked your post`;
          break;
        case 'comment':
          body = `${actorName} commented on your post`;
          break;
        case 'follow':
          body = `${actorName} started following you`;
          break;
        case 'message':
          body = `${actorName} sent you a message`;
          break;
        case 'announcement':
          body = `New announcement: ${metadata?.title || 'Check it out'}`;
          break;
        case 'group_post':
          body = `${actorName} posted in a group you're in`;
          break;
        case 'tag_request':
          body = `${actorName} tagged you in a post. Approval required.`;
          break;
      }

      sendBrowserNotification(title, { body });
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
