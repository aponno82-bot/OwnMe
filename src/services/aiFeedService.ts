import { GoogleGenAI, Type } from "@google/genai";
import { Post, Profile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getAIFeedRecommendations(posts: Post[], userProfile: Profile | null): Promise<{ posts: Post[], explanation: string }> {
  if (!posts.length) return { posts, explanation: '' };

  // 1. Calculate Dynamic Trending Score (Non-AI Fallback)
  const trendingScores = new Map<string, number>();
  const hashtagCounts = new Map<string, number>();
  
  posts.forEach(p => {
    const tags = p.content.match(/#[a-z0-9_]+/gi) || [];
    tags.forEach(tag => hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1));
  });

  posts.forEach(p => {
    let score = 0;
    const tags = p.content.match(/#[a-z0-9_]+/gi) || [];
    
    // Hashtag popularity weight
    tags.forEach(tag => {
      score += (hashtagCounts.get(tag) || 0) * 1.5;
    });
    
    // Recency boost (exponential decay)
    const hoursOld = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 50 * Math.exp(-hoursOld / 12)); // Strong boost for first 12 hours
    
    // Interaction weight (if available)
    score += (p.reactions_count || 0) * 5;
    score += (p.comments_count || 0) * 10;
    
    // Personalization boost (Workplace/School match)
    if (userProfile) {
      if (p.profiles?.workplace && userProfile.workplace && p.profiles.workplace === userProfile.workplace) score += 30;
      if (p.profiles?.school && userProfile.school && p.profiles.school === userProfile.school) score += 20;
      if (p.profiles?.address && userProfile.address && p.profiles.address === userProfile.address) score += 15;
    }

    // Random discovery factor (5-10% variance)
    score *= (0.9 + Math.random() * 0.2);
    
    trendingScores.set(p.id, score);
  });

  // Limit to top 30 posts for AI ranking to ensure variety
  const postsToRank = posts.slice(0, 30);

  try {
    const prompt = `
      You are a dynamic recommendation engine for "OwnMe".
      
      User Profile:
      - Name: ${userProfile?.full_name || 'User'}
      - Bio: ${userProfile?.bio || 'No bio'}
      - Workplace: ${userProfile?.workplace || 'Not specified'}
      - School: ${userProfile?.school || 'Not specified'}
      
      Available Posts:
      ${postsToRank.map(p => {
        const tags = p.content.match(/#[a-z0-9_]+/gi) || [];
        return `[ID: ${p.id}] Author: ${p.profiles?.username} | Content: "${p.content.substring(0, 120)}" | Tags: ${tags.join(', ')}`;
      }).join('\n')}
      
      Task:
      Rank these posts to create a "For You" feed. 
      Prioritize:
      1. Shared context (same workplace/school).
      2. Interests mentioned in the user's bio.
      3. High-quality, engaging content.
      4. Freshness and variety.
      
      Output JSON:
      {
        "rankedIds": ["id1", "id2", ...],
        "explanation": "A short, engaging sentence about why this feed is special for them today."
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
