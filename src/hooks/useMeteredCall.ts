import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";
export type CallType = "audio" | "video";
export type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "unknown";
export type PeerStatus = "connecting" | "connected" | "disconnected" | "error";

export interface QuizLetter {
  letter: string;
  name: string;
  transliteration: string;
}

interface CallState {
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
}

interface IncomingCall {
  callerId: string;
  callerName: string;
  callType: CallType;
  roomURL: string;
}

const RING_TIMEOUT_MS = 30000;

export const useMeteredCall = () => {
  const { user } = useUser();

  const [callState, setCallState] = useState<CallState>({
    status: "idle",
    callType: "audio",
    remoteUserId: "",
    remoteName: "",
    isMuted: false,
    isCameraOff: false,
    remoteCameraOff: false,
    localStream: null,
    remoteStream: null,
    roomURL: "",
  });

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [quizLetter, setQuizLetter] = useState<QuizLetter | null>(null);
  const [connectionQuality] = useState<ConnectionQuality>("good");
  const [peerStatus, setPeerStatus] = useState<PeerStatus>("disconnected");

  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    setPeerStatus("connecting");

    const channel = supabase.channel(`user-${user.id}-ring`);

    channel.on("broadcast", { event: "ring" }, ({ payload }) => {
      const { callerId, callerName, callType, roomURL } = payload as {
        callerId: string; callerName: string; callType: CallType; roomURL: string;
      };
      console.log("Incoming ring from:", callerId, "room:", roomURL);
      setIncomingCall({ callerId, callerName, callType, roomURL });
    });

    channel.on("broadcast", { event: "cancel" }, ({ payload }) => {
      const { callerId } = payload as { callerId: string };
      setIncomingCall((prev) => (prev && prev.callerId === callerId ? null : prev));
    });

    channel.on("broadcast", { event: "reject" }, () => {
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
      setCallState((s) => (s.status === "calling" ? { ...s, status: "ended" } : s));
      setTimeout(() => {
        setCallState((s) => (s.status === "ended" ? { ...s, status: "idle", roomURL: "" } : s));
      }, 500);
    });

    channel.on("broadcast", { event: "accept" }, ({ payload }) => {
      const { roomURL, receiverName } = payload as { roomURL: string; receiverName: string };
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
      setCallState((s) =>
        s.status === "calling"
          ? { ...s, status: "connected", roomURL, remoteName: receiverName || s.remoteName }
          : s
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setPeerStatus("connected");
        ringChannelRef.current = channel;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setPeerStatus("error");
      }
    });

    return () => {
      supabase.removeChannel(channel);
      ringChannelRef.current = null;
      setPeerStatus("disconnected");
    };
  }, [user]);

  const sendToUser = useCallback(
    async (targetId: string, event: string, payload: Record<string, unknown>) => {
      const ch = supabase.channel(`user-${targetId}-ring`);
      await new Promise<void>((resolve) => {
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ch.send({ type: "broadcast", event, payload }).finally(() => {
              setTimeout(() => supabase.removeChannel(ch), 500);
              resolve();
            });
          }
        });
        setTimeout(() => resolve(), 3000);
      });
    },
    []
  );

  const startCall = useCallback(
    async (targetId: string, type: CallType) => {
      if (!user) return;

      const roomName = `call-${[user.id, targetId].sort().join("-")}-${Date.now().toString(36)}`;
      let roomURL = "";
      try {
        const { data, error } = await supabase.functions.invoke("create-metered-room", {
          body: { roomName },
        });
        if (error || !data?.roomURL) throw new Error(error?.message || "No room URL returned");
        roomURL = data.roomURL;
      } catch (err) {
        console.error("Failed to create Metered room:", err);
        return;
      }

      setCallState({
        status: "calling",
        callType: type,
        remoteUserId: targetId,
        remoteName: "",
        isMuted: false,
        isCameraOff: false,
        remoteCameraOff: false,
        localStream: null,
        remoteStream: null,
        roomURL,
      });

      await sendToUser(targetId, "ring", {
        callerId: user.id,
        callerName: user.name,
        callType: type,
        roomURL,
      });

      ringingTimeoutRef.current = setTimeout(() => {
        setCallState((prev) => {
          if (prev.status === "calling") {
            sendToUser(targetId, "cancel", { callerId: user.id });
            return { ...prev, status: "idle", roomURL: "" };
          }
          return prev;
        });
      }, RING_TIMEOUT_MS);
    },
    [user, sendToUser]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    const { callerId, callType, roomURL, callerName } = incomingCall;

    await sendToUser(callerId, "accept", { roomURL, receiverName: user.name });

    setCallState({
      status: "connected",
      callType,
      remoteUserId: callerId,
      remoteName: callerName,
      isMuted: false,
      isCameraOff: false,
      remoteCameraOff: false,
      localStream: null,
      remoteStream: null,
      roomURL,
    });
    setIncomingCall(null);
  }, [incomingCall, user, sendToUser]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    await sendToUser(incomingCall.callerId, "reject", { from: user.id });
    setIncomingCall(null);
  }, [incomingCall, user, sendToUser]);

  const endCall = useCallback(() => {
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
    if (user && callState.status === "calling" && callState.remoteUserId) {
      sendToUser(callState.remoteUserId, "cancel", { callerId: user.id });
    }
    setCallState({
      status: "idle",
      callType: "audio",
      remoteUserId: "",
      remoteName: "",
      isMuted: false,
      isCameraOff: false,
      remoteCameraOff: false,
      localStream: null,
      remoteStream: null,
      roomURL: "",
    });
    setQuizLetter(null);
  }, [user, callState.status, callState.remoteUserId, sendToUser]);

  const toggleMute = useCallback(() => {
    setCallState((s) => ({ ...s, isMuted: !s.isMuted }));
  }, []);

  const toggleCamera = useCallback(() => {
    setCallState((s) => ({ ...s, isCameraOff: !s.isCameraOff }));
  }, []);

  const sendQuizLetter = useCallback((letter: QuizLetter) => {
    setQuizLetter(letter);
  }, []);

  return {
    callState,
    incomingCall,
    quizLetter,
    connectionQuality,
    peerStatus,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    sendQuizLetter,
  };
};
