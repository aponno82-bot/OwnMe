import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Hash, Loader2 } from 'lucide-react';

interface TrendingHashtagsProps {
  onHashtagClick: (hashtag: string) => void;
}

export default function TrendingHashtags({ onHashtagClick }: TrendingHashtagsProps) {
  const [trending, setTrending] = useState<{ name: string, count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, []);

  async function fetchTrending() {
    try {
      // Algorithm: Count posts per hashtag in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('post_hashtags')
        .select(`
          hashtag_id,
          hashtags (name),
          posts!inner (created_at)
        `)
        .gte('posts.created_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      // Aggregate counts
      const counts: Record<string, number> = {};
      data?.forEach((item: any) => {
        const name = item.hashtags?.name;
        if (name) {
          counts[name] = (counts[name] || 0) + 1;
        }
      });

      const sorted = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTrending(sorted);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;
  if (trending.length === 0) return null;

  return (
    <div className="card-premium p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-bold text-gray-900">Trending Now</h3>
      </div>
      <div className="space-y-3">
        {trending.map((tag) => (
          <button
            key={tag.name}
            onClick={() => onHashtagClick(tag.name)}
            className="flex items-center justify-between w-full group"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-50 rounded-lg group-hover:bg-emerald-50 transition-colors">
                <Hash className="w-3 h-3 text-gray-400 group-hover:text-emerald-500" />
              </div>
              <span className="text-xs font-bold text-gray-700 group-hover:text-emerald-600 transition-colors">
                #{tag.name}
              </span>
            </div>
            <span className="text-[10px] font-medium text-gray-400">
              {tag.count} posts
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
