import { EnergyReading, Tariff } from "../types";

export const analyzeUsageWithClaude = async (
  readings: EnergyReading[],
  tariffs: Tariff[],
  location: string
): Promise<string> => {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return "AI analysis requires an Anthropic API key. Set VITE_ANTHROPIC_API_KEY in your environment. The rate comparison features work without it.";
  }

  // Prepare a summary to stay within token limits
  const totalKWh = readings.reduce((sum, r) => sum + r.value, 0);
  const hourBuckets = new Array(24).fill(0);
  readings.forEach(r => {
    hourBuckets[r.timestamp.getHours()] += r.value;
  });

  // Calculate percentage of usage in standard peak hours (4-9 PM)
  const peakUsage = hourBuckets.slice(16, 21).reduce((a, b) => a + b, 0);
  const peakPercent = (peakUsage / totalKWh) * 100;

  const prompt = `Analyze this electricity usage data for a user in ${location}.

Total Usage: ${totalKWh.toFixed(2)} kWh over ${Math.round(readings.length / 96)} days.
Hourly breakdown (kWh sums for hours 0-23): ${JSON.stringify(hourBuckets.map(v => Math.round(v)))}
Peak Usage (4 PM - 9 PM): ${peakPercent.toFixed(1)}% of total energy.

Available Tariffs:
${tariffs.map(t => `- ${t.name}: ${t.description} (Fixed: $${t.fixedMonthlyCharge}/mo)`).join('\n')}

Please provide:
1. **HABIT PROFILE**: Briefly summarize their consumption habits based on the hourly pattern.
2. **LIKELY CURRENT PLAN**: Which plan they are likely on now (e.g., EV signature overnight = EV2-A, flat profile = E-1).
3. **SAVINGS OPPORTUNITIES**:
   - Identify specific high-impact actions with estimated dollar savings
   - Example: "Shift X kWh from peak (4-9 PM) to off-peak to save $Y/month"
   - Focus on quick wins: dishwasher, laundry, EV charging timing

Keep the response concise and actionable. Use bullet points.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API Error:', error);
      return "Error communicating with Claude. Please check your API key.";
    }

    const data = await response.json();
    return data.content?.[0]?.text || "Unable to generate analysis at this time.";
  } catch (error) {
    console.error("Claude Analysis Error:", error);
    return "Error communicating with the AI analyst. Please try again later.";
  }
};
