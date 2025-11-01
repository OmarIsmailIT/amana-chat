// app/api/ably-token/route.ts
import Ably from "ably";

export async function GET() {
  if (!process.env.ABLY_API_KEY) {
    return new Response(JSON.stringify({ error: "ABLY_API_KEY not set" }), {
      status: 500,
    });
  }

  try {
    const client = new Ably.Rest(process.env.ABLY_API_KEY);

    const tokenRequest = await client.auth.createTokenRequest({
      clientId: "amana-chat-user-" + Math.floor(Math.random() * 10000),
    });

    return new Response(JSON.stringify(tokenRequest), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Ably token error:", err);
    return new Response(JSON.stringify({ error: "Failed to create token" }), {
      status: 500,
    });
  }
}