export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  workplace: string | null;
  address: string | null;
  school: string | null;
  updated_at?: string;
  is_verified?: boolean;
  role?: 'admin' | 'user';
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type?: 'image' | 'video' | null;
  post_type?: 'post' | 'reel';
  privacy?: 'public' | 'friends' | 'private';
  feeling?: string | null;
  tagged_users?: string[];
  created_at: string;
  profiles?: Profile;
  reactions_count?: number;
  comments_count?: number;
  shares_count?: number;
  saves_count?: number;
}

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: Profile;
  parent_id?: string | null;
}

export interface Connection {
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  image_url: string;
  expires_at: string;
  created_at: string;
  profiles?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'document' | 'audio' | 'call' | null;
  call_duration?: number | null;
  created_at: string;
  is_read: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  cover_url: string | null;
  avatar_url: string | null;
  created_at: string;
  created_by: string;
  privacy: 'public' | 'private';
  members_count?: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow' | 'message' | 'announcement';
  post_id?: string;
  is_read: boolean;
  created_at: string;
  profiles?: Profile;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_id: string;
  target_type: 'user' | 'post' | 'comment';
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  reporter?: Profile;
  target_user?: Profile;
  target_post?: Post;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  target_role?: 'all' | 'admin' | 'user';
}
