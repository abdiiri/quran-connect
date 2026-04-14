import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache for TURN credentials
let cachedCredential: { apiKey: string; expiresAt: number } | null = null;
let cachedIceServers: RTCIceServer[] | null = null;

const CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes (credentials expire in 60 min, refresh early)
const CREDENTIAL_EXPIRY_SECONDS = 3600; // 1 hour

async function getOrCreateCredential(secretKey: string): Promise<{ apiKey: string; iceServers: RTCIceServer[] }> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedCredential && cachedIceServers && now < cachedCredential.expiresAt) {
    console.log("Returning cached TURN credentials");
    return { apiKey: cachedCredential.apiKey, iceServers: cachedIceServers };
  }

  console.log("Creating new TURN credential...");

  // Create a new credential
  const createResponse = await fetch(
    `https://noorify.metered.live/api/v1/turn/credential?secretKey=${secretKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "lovable-cached",
        expiryInSeconds: CREDENTIAL_EXPIRY_SECONDS,
      }),
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Metered create credential error [${createResponse.status}]: ${await createResponse.text()}`);
  }

  const credential = await createResponse.json();

  // Fetch ICE servers with the new apiKey
  const response = await fetch(
    `https://noorify.metered.live/api/v1/turn/credentials?apiKey=${credential.apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Metered API error [${response.status}]: ${await response.text()}`);
  }

  const iceServers = await response.json();

  // Cache the results
  cachedCredential = {
    apiKey: credential.apiKey,
    expiresAt: now + CACHE_TTL_MS,
  };
  cachedIceServers = iceServers;

  return { apiKey: credential.apiKey, iceServers };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const METERED_SECRET_KEY = Deno.env.get("METERED_API_KEY");
    if (!METERED_SECRET_KEY) {
      throw new Error("METERED_API_KEY is not configured");
    }

    const { iceServers } = await getOrCreateCredential(METERED_SECRET_KEY);

    return new Response(JSON.stringify({ iceServers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching TURN credentials:", error);
    // Clear cache on error so next request retries
    cachedCredential = null;
    cachedIceServers = null;
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
