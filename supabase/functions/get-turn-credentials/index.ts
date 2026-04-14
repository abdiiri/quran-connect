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
    const METERED_API_KEY = Deno.env.get("METERED_API_KEY");
    if (!METERED_API_KEY) {
      throw new Error("METERED_API_KEY is not configured");
    }

    const response = await fetch(
      `https://lovable.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
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
