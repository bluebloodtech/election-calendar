/**
 * Server-only. Reads a screenshot with Google Gemini vision to pull out a
 * market's title/name only.
 *
 * Returns null (instead of throwing) when GEMINI_API_KEY is not
 * configured or the model can't read the image — uploads must keep
 * working either way; this is an enhancement, not a gate.
 */

export interface ExtractedMarketName {
  name: string;
}

// Flash: cheapest vision-capable Gemini tier — this is simple text reading
// off a screenshot, and the client is explicitly cost-sensitive.
const MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * Master Command Center drop zone: reads the market's title off a
 * screenshot, so dropping one there can create a new row without typing
 * the name by hand.
 */
export async function extractMarketName(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg"
): Promise<ExtractedMarketName | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
              {
                text: "Read only the title/heading of this page or market. Return an empty string if no title is visible.",
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "The page/market's title as shown, or empty string if unreadable" },
            },
            required: ["name"],
          },
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as ExtractedMarketName;
    return { name: String(parsed.name ?? "") };
  } catch {
    return null;
  }
}
