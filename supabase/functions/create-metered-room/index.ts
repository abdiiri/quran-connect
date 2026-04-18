import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_NAME = "noorify";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SECRET_KEY = Deno.env.get("METERED_API_KEY");
    if (!SECRET_KEY) throw new Error("METERED_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const roomName: string | undefined = body?.roomName;

    // Try to create the room. If it already exists Metered returns 400 — that's fine, we reuse it.
    const createRes = await fetch(
      `https://${APP_NAME}.metered.live/api/v1/room?secretKey=${SECRET_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          // Auto-cleanup empty rooms after 5 min so we don't hit limits
          autoJoin: false,
          enableScreenShare: true,
          enableChat: false,
        }),
      }
    );

    let finalRoomName = roomName;
    if (createRes.ok) {
      const data = await createRes.json();
      finalRoomName = data.roomName || roomName;
    } else {
      // Room may already exist; that's OK — proceed with the requested name
      const errText = await createRes.text();
      console.log(`Room create response [${createRes.status}]: ${errText}`);
      if (!finalRoomName) {
        throw new Error(`Could not create room: ${errText}`);
      }
    }

    const roomURL = `${APP_NAME}.metered.live/${finalRoomName}`;
    return new Response(JSON.stringify({ roomURL, roomName: finalRoomName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-metered-room error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
