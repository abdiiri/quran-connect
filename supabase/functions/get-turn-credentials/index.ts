import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const METERED_SECRET_KEY = Deno.env.get("METERED_API_KEY");
    if (!METERED_SECRET_KEY) {
      throw new Error("METERED_API_KEY is not configured");
    }

    // Create a temporary TURN credential using the Secret Key
    const createResponse = await fetch(
      `https://noorify.metered.live/api/v1/turn/credential?secretKey=${METERED_SECRET_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "lovable-temp",
          expiryInSeconds: 3600,
        }),
      }
    );

    if (!createResponse.ok) {
      throw new Error(`Metered create credential error [${createResponse.status}]: ${await createResponse.text()}`);
    }

    const credential = await createResponse.json();

    // Now fetch TURN server credentials using the created apiKey
    const response = await fetch(
      `https://noorify.metered.live/api/v1/turn/credentials?apiKey=${credential.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Metered API error [${response.status}]: ${await response.text()}`);
    }

    const iceServers = await response.json();

    return new Response(JSON.stringify({ iceServers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching TURN credentials:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
