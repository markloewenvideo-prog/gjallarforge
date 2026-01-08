import { GoogleGenAI, Type } from "@google/genai";

// Ensure you have GEMINI_API_KEY in your server .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });

export async function generateCampaignEnemies(numWeeks: number) {
    const prompt = `You are a master RPG world-builder. Generate a chronological sequence of ${numWeeks} fantasy monsters for a fitness-based RPG campaign.
    Return the list as a JSON array of objects with 'name' and 'description' keys.`;

    try {
        console.log("[GEMINI] Requesting content for", numWeeks, "weeks...");

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Gemini Timeout")), 15000)
        );

        const apiPromise = ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                        required: ["name", "description"]
                    }
                }
            }
        });

        const response = await Promise.race([apiPromise, timeoutPromise]) as any;
        console.log("[GEMINI] Response received.");

        const text = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text);

        if (!text) {
            console.error("[GEMINI] No text in response:", JSON.stringify(response));
            throw new Error("Empty Gemini response");
        }

        return JSON.parse(text);

    } catch (e) {
        console.error("Gemini API Error:", e);
        // Robust Fallback 
        return Array.from({ length: numWeeks }, (_, i) => ({
            name: `Monster ${i + 1}`,
            description: "A shadowy foe blocks your path."
        }));
    }
}
