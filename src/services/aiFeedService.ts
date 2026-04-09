import { GoogleGenAI, Type } from "@google/genai";
import { Post, Profile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getAIFeedRecommendations(posts: Post[], userProfile: Profile | null): Promise<{ posts: Post[], explanation: string }> {
  if (!posts.length) return { posts, explanation: '' };

  // 1. Calculate Trending Score (Non-AI Fallback)
  const trendingScores = new Map<string, number>();
  const hashtagCounts = new Map<string, number>();
  
  posts.forEach(p => {
    const tags = p.content.match(/#[a-z0-9_]+/gi) || [];
    tags.forEach(tag => hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1));
  });

  posts.forEach(p => {
    let score = 0;
    const tags = p.content.match(/#[a-z0-9_]+/gi) || [];
    tags.forEach(tag => {
      score += (hashtagCounts.get(tag) || 0) * 2; // Hashtag popularity
    });
    
    // Recency boost (newer posts get higher base score)
    const hoursOld = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 24 - hoursOld); 
    
    trendingScores.set(p.id, score);
  });

  // Limit to top 20 latest posts to avoid hitting token/quota limits
  const postsToRank = posts.slice(0, 20);

  try {
    const prompt = `
      You are an advanced social media recommendation algorithm for "OwnMe".
      
      User Context:
      - Name: ${userProfile?.full_name || 'User'}
      - Bio: ${userProfile?.bio || 'No bio'}
      - Interests: Based on their bio and profile.
      
      Available Posts to Rank:
      ${postsToRank.map(p => {
        const tags = p.content.match(/#[a-z0-9_]+/gi) || [];
        return `[ID: ${p.id}] "${p.content.substring(0, 100)}..." | Tags: ${tags.join(', ')}`;
      }).join('\n')}
      
      Ranking Criteria:
      1. PERSONALIZATION: Prioritize posts that match the user's bio/interests.
      2. ENGAGEMENT: Prioritize posts with popular hashtags.
      3. QUALITY: Prioritize meaningful content over spam.
      4. VARIETY: Ensure a mix of topics.
      
      Output Format:
      {
        "rankedIds": ["id1", "id2", ...],
        "explanation": "A short, friendly sentence explaining why these posts were chosen for this specific user."
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rankedIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            explanation: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    const rankedIds = result.rankedIds || [];
    
    const rankedPosts = [...posts].sort((a, b) => {
      const indexA = rankedIds.indexOf(a.id);
      const indexB = rankedIds.indexOf(b.id);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // Fallback to trending score if AI didn't rank it
      return (trendingScores.get(b.id) || 0) - (trendingScores.get(a.id) || 0);
    });

    return { posts: rankedPosts, explanation: result.explanation };
  } catch (error: any) {
    const isQuotaExceeded = error?.message?.includes("429") || error?.status === 429 || JSON.stringify(error).includes("RESOURCE_EXHAUSTED");
    
    // Sort by trending score as fallback
    const trendingPosts = [...posts].sort((a, b) => (trendingScores.get(b.id) || 0) - (trendingScores.get(a.id) || 0));

    if (isQuotaExceeded) {
      return { 
        posts: trendingPosts, 
        explanation: "AI is resting. Showing trending posts based on hashtag popularity!" 
      };
    }

    return { posts: trendingPosts, explanation: "Showing trending posts for you." };
  }
}
