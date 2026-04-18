import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { useUser } from "@/contexts/UserContext";
import { PhoneOff } from "lucide-react";

// Metered Embed SDK loader
const METERED_SDK_URL = "https://cdn.metered.ca/sdk/frame/1.4.3/sdk-frame.min.js";

declare global {
  interface Window {
    MeteredFrame?: new () => {
      init: (opts: Record<string, unknown>, el: HTMLElement) => void;
      on?: (event: string, cb: (...args: unknown[]) => void) => void;
      destroy?: () => void;
    };
  }
}

const loadMeteredSDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.MeteredFrame) return resolve();
    const existing = document.querySelector(`script[src="${METERED_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = METERED_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Metered SDK failed to load"));
    document.head.appendChild(script);
  });
};

const CallScreen = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { callState, endCall } = useCall();
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<ReturnType<NonNullable<typeof window.MeteredFrame>> | null>(null);

  const { status, remoteUserId, remoteName, roomURL, callType } = callState;
  const displayName = remoteName || `User ${remoteUserId}`;

  // Bounce back to /call if there's no active call
  useEffect(() => {
    if (status === "idle") navigate("/call");
  }, [status, navigate]);

  // Initialize the Metered frame when we have a roomURL and we're connected/calling
  useEffect(() => {
    if (!roomURL || !containerRef.current) return;
    // Only mount the iframe once we're connected (both sides agreed) — for caller, that means accept received.
    // For receiver, status is connected immediately on accept.
    if (status !== "connected") return;

    let cancelled = false;

    loadMeteredSDK()
      .then(() => {
        if (cancelled || !window.MeteredFrame || !containerRef.current) return;
        const frame = new window.MeteredFrame();
        frame.init(
          {
            roomURL,
            name: user?.name || "Guest",
            autoJoin: true,
            joinVideoOn: callType === "video",
            joinAudioOn: true,
            showInviteBox: false,
            disableChat: true,
            width: "100%",
            height: "100%",
          },
          containerRef.current
        );
        frameRef.current = frame;

        // Listen for the participant leaving the call
        frame.on?.("leftMeeting", () => {
          endCall();
        });
      })
      .catch((err) => {
        console.error("Metered init error:", err);
      });

    return () => {
      cancelled = true;
      try {
        frameRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
      frameRef.current = null;
    };
  }, [roomURL, status, user?.name, callType, endCall]);

  const handleEndCall = () => {
    endCall();
    navigate("/call");
  };

  return (
    <div className="min-h-screen bg-foreground flex flex-col relative">
      {/* Calling state — waiting for receiver to answer */}
      {status === "calling" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-fade-in">
          <div className="relative mx-auto w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-ring" />
            <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-ring [animation-delay:0.5s]" />
            <div className="relative w-28 h-28 rounded-full gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground text-3xl font-bold">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          <h2 className="text-primary-foreground text-2xl font-semibold">{displayName}</h2>
          <p className="text-primary-foreground/60 text-sm mt-2">
            Calling<span className="animate-pulse">...</span>
          </p>

          <button
            onClick={handleEndCall}
            className="mt-12 w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all"
            aria-label="Cancel call"
          >
            <PhoneOff className="w-7 h-7 text-destructive-foreground" />
          </button>
        </div>
      )}

      {/* Connected — Metered iframe handles all media + controls */}
      {status === "connected" && (
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        </div>
      )}
    </div>
  );
};

export default CallScreen;
