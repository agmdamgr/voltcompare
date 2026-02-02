
import { GoogleGenAI } from "@google/genai";
import { EnergyReading, Tariff } from "../types";

export const analyzeUsageWithGemini = async (
  readings: EnergyReading[],
  tariffs: Tariff[],
  location: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepare a summary to stay within token limits
  const totalKWh = readings.reduce((sum, r) => sum + r.value, 0);
  const hourBuckets = new Array(24).fill(0);
  readings.forEach(r => {
    hourBuckets[r.timestamp.getHours()] += r.value;
  });

  // Calculate percentage of usage in standard peak hours (4-9 PM)
  const peakUsage = hourBuckets.slice(16, 21).reduce((a, b) => a + b, 0);
  const peakPercent = (peakUsage / totalKWh) * 100;

  const prompt = `
    Analyze this electricity usage data for a user in ${location}.
    Total Usage: ${totalKWh.toFixed(2)} kWh over ${Math.round(readings.length / 96)} days.
    Hourly breakdown (kWh sums for hours 0-23): ${JSON.stringify(hourBuckets)}
    Peak Usage (4 PM - 9 PM): ${peakPercent.toFixed(1)}% of total energy.
    
    Available Tariffs:
    ${tariffs.map(t => `${t.name}: ${t.description} (Fixed: $${t.fixedMonthlyCharge}/mo)`).join('\n')}
    
    TASKS:
    1. HABIT PROFILE: Briefly summarize their consumption habits.
    2. PLAN IDENTIFICATION: Identify which plan they are LIKELY on now (e.g., EV signature on EV2-A or flat profile on E-1).
    3. SAVINGS OPPORTUNITIES (BEST BANG FOR THE BUCK): 
       Identify specific high-impact actions. For example:
       - "Shift [X] kWh from [Peak Hour] to [Off-Peak Hour] to save $[Y] per month."
       - Focus on "Quick Wins" like moving dishwasher, laundry, or EV charging.
       - Calculate a rough "Opportunity Cost" of their current habits.
    
    Format the response with clear headers and bullet points. Use a professional yet encouraging tone.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Unable to generate analysis at this time.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error communicating with the AI analyst. Please try again later.";
  }
};
