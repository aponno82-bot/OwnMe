import { GoogleGenAI, Type } from "@google/genai";
import { Post, Profile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getAIFeedRecommendations(posts: Post[], userProfile: Profile | null): Promise<{ posts: Post[], explanation: string }> {
  if (!posts.length) return { posts, explanation: '' };

  // Limit to top 20 latest posts to avoid hitting token/quota limits
  const postsToRank = posts.slice(0, 20);

  try {
    const prompt = `
      You are an AI social media algorithm. 
      User Profile: ${JSON.stringify(userProfile)}
      
      Available Posts (with hashtags):
      ${postsToRank.map(p => {
        const tags = p.content.match(/#[a-z0-9_]+/gi) || [];
        return `ID: ${p.id}, Content: ${p.content}, Tags: ${tags.join(', ')}`;
      }).join('\n')}
      
      Rank these posts based on:
      1. User's bio and interests.
      2. Trending topics (hashtags used multiple times).
      3. Content quality and relevance.
      
      Return the ranked IDs in order of relevance.
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
    
    // Sort posts based on rankedIds
    const rankedPosts = [...posts].sort((a, b) => {
      const indexA = rankedIds.indexOf(a.id);
      const indexB = rankedIds.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return { posts: rankedPosts, explanation: result.explanation };
  } catch (error: any) {
    // Check for quota exceeded error (429)
    const isQuotaExceeded = error?.message?.includes("429") || error?.status === 429 || JSON.stringify(error).includes("RESOURCE_EXHAUSTED");
    
    if (isQuotaExceeded) {
      // Don't log the full error to avoid cluttering console with expected quota issues
      console.warn("AI Feed: Gemini API quota exceeded. Falling back to standard feed.");
      return { 
        posts, 
        explanation: "AI ranking is temporarily unavailable (Quota Exceeded). Showing latest posts instead." 
      };
    }

    console.error("AI Feed Error:", error);
    return { posts, explanation: "Standard feed (AI ranking failed)" };
  }
}
