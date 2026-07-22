import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only. Reads a Kalshi screenshot with Claude vision and pulls out the
 * candidate/leader name, price, and volume shown for the given placement.
 *
 * Returns null (instead of throwing) when ANTHROPIC_API_KEY is not configured
 * or the model can't read the image — uploads must keep working either way;
 * the AI read is an enhancement, not a gate.
 */

export interface ExtractedStanding {
  leader: string;
  price: string;
  volume: string;
}

const PLACE_LABEL: Record<string, string> = {
  first: "1st place (the market leader)",
  second: "2nd place",
  third: "3rd place",
};

export async function extractStanding(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg",
  place: string
): Promise<ExtractedStanding | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    // Haiku: cheapest vision-capable model — this is simple text/number
    // reading off a screenshot, and the client is explicitly cost-sensitive.
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              leader: {
                type: "string",
                description: "Candidate/outcome name in this placement, or empty string if unreadable",
              },
              price: {
                type: "string",
                description: "Price as shown, e.g. \"$0.68\" or \"68¢\", or empty string",
              },
              volume: {
                type: "string",
                description: "Volume as shown, e.g. \"$1.2M\" or \"$45K\", or empty string",
              },
            },
            required: ["leader", "price", "volume"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text: `This is a screenshot of a Kalshi prediction-market page. Read the standing for ${PLACE_LABEL[place] ?? place} and return the candidate name, price, and volume exactly as displayed. Use empty strings for anything not visible.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return null;
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const parsed = JSON.parse(block.text) as ExtractedStanding;
    return {
      leader: String(parsed.leader ?? ""),
      price: String(parsed.price ?? ""),
      volume: String(parsed.volume ?? ""),
    };
  } catch {
    return null;
  }
}
