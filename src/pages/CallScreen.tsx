import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const CallScreen = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useUser();
  const targetId = params.get("target") || "";
  const callType = params.get("type") || "audio";

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(callType === "audio");
  const [status, setStatus] = useState<"calling" | "connected">("calling");

  // Simulate connection after 2s
  useState(() => {
    const t = setTimeout(() => setStatus("connected"), 2000);
    return () => clearTimeout(t);
  });

  const endCall = () => navigate("/call");

  return (
    <div className="min-h-screen bg-foreground flex flex-col items-center justify-between p-6">
      {/* Top */}
      <div className="text-center pt-12 animate-fade-in">
        <div className="w-20 h-20 rounded-full gradient-primary mx-auto flex items-center justify-center mb-4">
          <span className="text-primary-foreground text-2xl font-bold">{targetId.slice(0, 2)}</span>
        </div>
        <h2 className="text-primary-foreground text-xl font-semibold">User {targetId}</h2>
        <p className="text-primary-foreground/60 text-sm mt-1">
          {status === "calling" ? (
            <span className="flex items-center justify-center gap-1">
              Calling
              <span className="animate-pulse">...</span>
            </span>
          ) : (
            `${callType === "video" ? "Video" : "Audio"} call connected`
          )}
        </p>
      </div>

      {/* Video placeholder */}
      {callType === "video" && !cameraOff && status === "connected" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-48 h-64 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Video className="w-10 h-10 text-primary-foreground/40" />
          </div>
        </div>
      )}

      {/* Pulse animation for audio call */}
      {(callType === "audio" || cameraOff) && status === "connected" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center">
              <Mic className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-ring" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6 pb-12 animate-fade-in">
        <button
          onClick={() => setMuted(!muted)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${muted ? "bg-destructive" : "bg-primary-foreground/20"}`}
        >
          {muted ? <MicOff className="w-6 h-6 text-primary-foreground" /> : <Mic className="w-6 h-6 text-primary-foreground" />}
        </button>

        {callType === "video" && (
          <button
            onClick={() => setCameraOff(!cameraOff)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${cameraOff ? "bg-destructive" : "bg-primary-foreground/20"}`}
          >
            {cameraOff ? <VideoOff className="w-6 h-6 text-primary-foreground" /> : <Video className="w-6 h-6 text-primary-foreground" />}
          </button>
        )}

        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all"
        >
          <PhoneOff className="w-7 h-7 text-destructive-foreground" />
        </button>
      </div>
    </div>
  );
};

export default CallScreen;
