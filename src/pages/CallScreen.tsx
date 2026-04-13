import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const CallScreen = () => {
  const navigate = useNavigate();
  const { callState, endCall, toggleMute, toggleCamera } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { status, callType, remoteUserId, isMuted, isCameraOff, localStream, remoteStream } = callState;

  useEffect(() => {
    if (status === "idle") {
      navigate("/call");
    }
  }, [status, navigate]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleEndCall = () => {
    endCall();
    navigate("/call");
  };

  return (
    <div className="min-h-screen bg-foreground flex flex-col items-center justify-between relative">
      {/* Remote video (full screen) */}
      {callType === "video" && remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Local video (small overlay) */}
      {callType === "video" && localStream && !isCameraOff && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-6 right-6 w-32 h-44 object-cover rounded-2xl border-2 border-primary-foreground/30 z-10"
        />
      )}

      {/* Top info */}
      <div className="relative z-10 text-center pt-16 animate-fade-in">
        <div className="w-20 h-20 rounded-full gradient-primary mx-auto flex items-center justify-center mb-4">
          <span className="text-primary-foreground text-2xl font-bold">{remoteUserId.slice(0, 2)}</span>
        </div>
        <h2 className="text-primary-foreground text-xl font-semibold">User {remoteUserId}</h2>
        <p className="text-primary-foreground/60 text-sm mt-1">
          {status === "calling" ? (
            <span className="flex items-center justify-center gap-1">
              Calling<span className="animate-pulse">...</span>
            </span>
          ) : status === "connected" ? (
            `${callType === "video" ? "Video" : "Audio"} call connected`
          ) : (
            status
          )}
        </p>
      </div>

      {/* Audio-only pulse */}
      {(callType === "audio" || (callType === "video" && !remoteStream)) && status === "connected" && (
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="relative">
            <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center">
              <Mic className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-ring" />
          </div>
        </div>
      )}

      {/* Spacer for video calls */}
      {callType === "video" && remoteStream && <div className="flex-1" />}

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-6 pb-12 animate-fade-in">
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
  );
};

export default CallScreen;
