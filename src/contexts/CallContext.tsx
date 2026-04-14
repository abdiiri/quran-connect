import React, { createContext, useContext, ReactNode } from "react";
import { useWebRTC, CallStatus, CallType, QuizLetter } from "@/hooks/useWebRTC";

interface CallContextType {
  callState: {
    status: CallStatus;
    callType: CallType;
    remoteUserId: string;
    remoteName: string;
    isMuted: boolean;
    isCameraOff: boolean;
    remoteCameraOff: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
  };
  incomingCall: { callerId: string; callerName: string; callType: CallType } | null;
  quizLetter: QuizLetter | null;
  startCall: (targetId: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  sendQuizLetter: (letter: QuizLetter) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const webrtc = useWebRTC();

  return (
    <CallContext.Provider value={webrtc}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
};
