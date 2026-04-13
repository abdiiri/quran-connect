import { useCall } from "@/contexts/CallContext";
import { Phone, PhoneOff, Video } from "lucide-react";

const IncomingCallOverlay = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/90 flex items-center justify-center p-6">
      <div className="text-center animate-scale-in">
        {/* Pulse animation */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-ring" />
          <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-ring [animation-delay:0.5s]" />
          <div className="relative w-24 h-24 rounded-full gradient-primary flex items-center justify-center">
            {incomingCall.callType === "video" ? (
              <Video className="w-10 h-10 text-primary-foreground" />
            ) : (
              <Phone className="w-10 h-10 text-primary-foreground" />
            )}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-primary-foreground mb-1">
          {incomingCall.callerName}
        </h2>
        <p className="text-primary-foreground/60 text-sm mb-1">
          ID: {incomingCall.callerId}
        </p>
        <p className="text-primary-foreground/60 text-sm mb-8">
          Incoming {incomingCall.callType} call…
        </p>

        <div className="flex items-center justify-center gap-8">
          <button
            onClick={rejectCall}
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all"
          >
            <PhoneOff className="w-7 h-7 text-destructive-foreground" />
          </button>
          <button
            onClick={acceptCall}
            className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center hover:opacity-90 transition-all"
          >
            <Phone className="w-7 h-7 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallOverlay;
