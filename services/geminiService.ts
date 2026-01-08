
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateCampaignEnemies(numWeeks: number) {
  const prompt = `Generate a sequence of ${numWeeks} RPG fantasy enemies for a workout campaign. 
  The difficulty should increase each week. The final enemy (week ${numWeeks}) must be a Dragon.
  Provide a creative name and short description for each.
  
  Example structure:
  - Week 1: Slime, Goblins, etc.
  - Week ${numWeeks}: Ancient Red Dragon.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["name", "description"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return Array.from({ length: numWeeks }, (_, i) => ({
      name: i === numWeeks - 1 ? "The Ultimate Dragon" : `Enemy ${i + 1}`,
      description: "A generic but fearsome foe."
    }));
  }
}
