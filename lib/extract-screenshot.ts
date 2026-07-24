/**
 * Server-only. Reads a Kalshi screenshot with Google Gemini vision.
 *
 * Both exports return null (instead of throwing) when GEMINI_API_KEY is
 * not configured or the model can't read the image — uploads must keep
 * working either way; the AI read is an enhancement, not a gate.
 */

export interface ExtractedStanding {
  leader: string;
  price: string;
  volume: string;
}

export interface ExtractedMarketOverview extends ExtractedStanding {
  name: string;
}

const PLACE_LABEL: Record<string, string> = {
  first: "1st place (the market leader)",
  second: "2nd place",
  third: "3rd place",
};

// Flash: cheapest vision-capable Gemini tier — this is simple text/number
// reading off a screenshot, and the client is explicitly cost-sensitive.
const MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function readImage<T>(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg",
  prompt: string,
  schema: Record<string, unknown>
): Promise<T | null> {
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
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Per-day calendar drop: reads the standing for one placement (1st/2nd/3rd). */
export async function extractStanding(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg",
  place: string
): Promise<ExtractedStanding | null> {
  const parsed = await readImage<ExtractedStanding>(
    imageBase64,
    mediaType,
    `This is a screenshot of a Kalshi prediction-market page. Read the standing for ${PLACE_LABEL[place] ?? place} and return the candidate name, price, and volume exactly as displayed. Use empty strings for anything not visible.`,
    {
      type: "object",
      properties: {
        leader: { type: "string", description: "Candidate/outcome name in this placement, or empty string if unreadable" },
        price: { type: "string", description: 'Price as shown, e.g. "$0.68" or "68¢", or empty string' },
        volume: { type: "string", description: 'Volume as shown, e.g. "$1.2M" or "$45K", or empty string' },
      },
      required: ["leader", "price", "volume"],
    }
  );
  if (!parsed) return null;
  return {
    leader: String(parsed.leader ?? ""),
    price: String(parsed.price ?? ""),
    volume: String(parsed.volume ?? ""),
  };
}

/**
 * Master Command Center drop zone: reads the market's name plus its current
 * leader/price/volume off one overview screenshot, so dropping a screenshot
 * there can create a whole new row in one step instead of typing the name
 * and then filling in the calendar separately.
 */
export async function extractMarketOverview(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg"
): Promise<ExtractedMarketOverview | null> {
  const parsed = await readImage<ExtractedMarketOverview>(
    imageBase64,
    mediaType,
    "This is a screenshot of a Kalshi prediction-market page. Return the market's title/name, its current 1st-place leader, the leader's price, and the market's volume, exactly as displayed. Use empty strings for anything not visible.",
    {
      type: "object",
      properties: {
        name: { type: "string", description: "The market's title/name as shown, or empty string if unreadable" },
        leader: { type: "string", description: "Current 1st-place candidate/outcome name, or empty string if unreadable" },
        price: { type: "string", description: 'Price as shown, e.g. "$0.68" or "68¢", or empty string' },
        volume: { type: "string", description: 'Volume as shown, e.g. "$1.2M" or "$45K", or empty string' },
      },
      required: ["name", "leader", "price", "volume"],
    }
  );
  if (!parsed) return null;
  return {
    name: String(parsed.name ?? ""),
    leader: String(parsed.leader ?? ""),
    price: String(parsed.price ?? ""),
    volume: String(parsed.volume ?? ""),
  };
}
