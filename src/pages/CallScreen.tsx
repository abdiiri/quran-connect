import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Signal, SignalLow, SignalMedium, SignalZero } from "lucide-react";
import InCallQuiz from "@/components/InCallQuiz";
import { ConnectionQuality } from "@/hooks/useWebRTC";

const attachStreamToElement = async (
  element: HTMLMediaElement | null,
  stream: MediaStream | null,
) => {
  if (!element) return;

  if (element.srcObject !== stream) {
    element.srcObject = stream;
  }

  if (!stream) return;

  try {
    await element.play();
  } catch {
    // Ignore autoplay rejections; the active call UI gives the browser another chance on interaction.
  }
};

const qualityConfig: Record<ConnectionQuality, { icon: typeof Signal; color: string; label: string }> = {
  excellent: { icon: Signal, color: "text-green-400", label: "Excellent" },
  good: { icon: Signal, color: "text-green-300", label: "Good" },
  fair: { icon: SignalMedium, color: "text-yellow-400", label: "Fair" },
  poor: { icon: SignalLow, color: "text-red-400", label: "Poor" },
  unknown: { icon: SignalZero, color: "text-primary-foreground/40", label: "Connecting" },
};

const CallScreen = () => {
  const navigate = useNavigate();
  const { callState, endCall, toggleMute, toggleCamera, connectionQuality } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status, callType, remoteUserId, remoteName, isMuted, isCameraOff, remoteCameraOff, localStream, remoteStream } = callState;

  // Call duration timer
  useEffect(() => {
    if (status === "connected") {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (status === "idle") {
      navigate("/call");
    }
  }, [status, navigate]);

  useEffect(() => {
    void attachStreamToElement(localVideoRef.current, localStream);
  }, [localStream]);

  useEffect(() => {
    void attachStreamToElement(remoteVideoRef.current, remoteStream);
    void attachStreamToElement(remoteAudioRef.current, remoteStream);
  }, [remoteStream, remoteCameraOff]);

  const handleEndCall = () => {
    endCall();
    navigate("/call");
  };

  const displayName = remoteName || `User ${remoteUserId}`;

  return (
    <div className="min-h-screen bg-foreground flex flex-col relative">
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      {/* Remote video (full area) */}
      {callType === "video" && remoteStream && !remoteCameraOff && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Remote camera off - show avatar */}
      {callType === "video" && remoteCameraOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground">
          <div className="w-32 h-32 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground text-4xl font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Local video (small overlay) - always mounted to preserve srcObject */}
      {callType === "video" && localStream && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute top-6 right-6 w-28 h-40 object-cover rounded-2xl border-2 border-primary-foreground/30 z-10 ${isCameraOff ? "hidden" : ""}`}
        />
      )}

      {/* Local camera off - show small avatar */}
      {callType === "video" && isCameraOff && (
        <div className="absolute top-6 right-6 w-28 h-40 rounded-2xl border-2 border-primary-foreground/30 z-10 bg-muted flex items-center justify-center">
          <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">You</span>
          </div>
        </div>
      )}

      {/* Content overlay */}
      <div className="flex-1 flex flex-col items-center justify-between relative z-10">
        {/* Top info */}
        <div className="text-center pt-14 animate-fade-in">
          <div className="w-20 h-20 rounded-full gradient-primary mx-auto flex items-center justify-center mb-3">
            <span className="text-primary-foreground text-2xl font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <h2 className="text-primary-foreground text-xl font-semibold">{displayName}</h2>
          <p className="text-primary-foreground/60 text-sm mt-1">
            {status === "calling" ? (
              <span className="flex items-center justify-center gap-1">
                Calling<span className="animate-pulse">...</span>
              </span>
            ) : status === "connected" ? (
              formatDuration(callDuration)
            ) : (
              status
            )}
          </p>
          {/* Connection quality indicator */}
          {status === "connected" && (() => {
            const qc = qualityConfig[connectionQuality];
            const QIcon = qc.icon;
            return (
              <div className={`flex items-center justify-center gap-1 mt-1 ${qc.color}`}>
                <QIcon className="w-4 h-4" />
                <span className="text-xs">{qc.label}</span>
              </div>
            );
          })()}
        </div>

        {/* Middle section: audio pulse OR quiz */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Audio pulse for audio calls */}
          {callType === "audio" && status === "connected" && (
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center">
                <Mic className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-ring" />
            </div>
          )}

          {/* Quiz section - inline between avatar and controls */}
          {status === "connected" && <InCallQuiz />}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 pb-8 animate-fade-in">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-destructive" : "bg-primary-foreground/20"}`}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-primary-foreground" /> : <Mic className="w-6 h-6 text-primary-foreground" />}
          </button>

          {callType === "video" && (
            <button
              onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isCameraOff ? "bg-destructive" : "bg-primary-foreground/20"}`}
            >
              {isCameraOff ? <VideoOff className="w-6 h-6 text-primary-foreground" /> : <Video className="w-6 h-6 text-primary-foreground" />}
            </button>
          )}

          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all"
          >
            <PhoneOff className="w-7 h-7 text-destructive-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallScreen;
