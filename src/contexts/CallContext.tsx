import React, { createContext, useContext, ReactNode } from "react";
import { useMeteredCall, CallStatus, CallType, QuizLetter, ConnectionQuality, PeerStatus } from "@/hooks/useMeteredCall";

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
    roomURL: string;
  };
  incomingCall: { callerId: string; callerName: string; callType: CallType; roomURL: string } | null;
  quizLetter: QuizLetter | null;
  connectionQuality: ConnectionQuality;
  peerStatus: PeerStatus;
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
  const call = useMeteredCall();
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>;
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
};
