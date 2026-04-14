import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";
export type CallType = "audio" | "video";

interface CallState {
  status: CallStatus;
  callType: CallType;
  remoteUserId: string;
  remoteName: string;
  isMuted: boolean;
  isCameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

interface IncomingCall {
  callerId: string;
  callerName: string;
  callType: CallType;
}

export interface QuizLetter {
  letter: string;
  name: string;
  transliteration: string;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export const useWebRTC = () => {
  const { user } = useUser();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSet = useRef(false);

  const [callState, setCallState] = useState<CallState>({
    status: "idle",
    callType: "audio",
    remoteUserId: "",
    remoteName: "",
    isMuted: false,
    isCameraOff: false,
    localStream: null,
    remoteStream: null,
  });

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [quizLetter, setQuizLetter] = useState<QuizLetter | null>(null);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    remoteDescSet.current = false;
    iceCandidateQueue.current = [];
    setQuizLetter(null);
    setCallState({
      status: "idle",
      callType: "audio",
      remoteUserId: "",
      remoteName: "",
      isMuted: false,
      isCameraOff: false,
      localStream: null,
      remoteStream: null,
    });
  }, []);

  const getMedia = async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    localStreamRef.current = stream;
    setCallState((s) => ({ ...s, localStream: stream }));
    return stream;
  };

  const flushIceCandidates = async (pc: RTCPeerConnection) => {
    for (const candidate of iceCandidateQueue.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Failed to add queued ICE candidate", e);
      }
    }
    iceCandidateQueue.current = [];
  };

  const addIceCandidate = async (pc: RTCPeerConnection, candidate: RTCIceCandidateInit) => {
    if (remoteDescSet.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Failed to add ICE candidate", e);
      }
    } else {
      iceCandidateQueue.current.push(candidate);
    }
  };

  const createPeerConnection = (signalingChannel: ReturnType<typeof supabase.channel>) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signalingChannel.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: e.candidate.toJSON(), from: user!.id },
        });
      }
    };

    pc.ontrack = (e) => {
      setCallState((s) => ({ ...s, remoteStream: e.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallState((s) => ({ ...s, status: "connected" }));
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        cleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallState((s) => ({ ...s, status: "connected" }));
      }
    };

    pcRef.current = pc;
    return pc;
  };

  const getChannelName = (id1: string, id2: string) => {
    const ids = [id1, id2].sort();
    return `call-${ids[0]}-${ids[1]}`;
  };

  // ── CALLER FLOW ──
  const startCall = useCallback(
    async (targetId: string, type: CallType) => {
      if (!user) return;

      setCallState((s) => ({
        ...s,
        status: "calling",
        callType: type,
        remoteUserId: targetId,
      }));

      const stream = await getMedia(type);
      const channelName = getChannelName(user.id, targetId);
      const ch = supabase.channel(channelName);
      channelRef.current = ch;
      const pc = createPeerConnection(ch);

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Listen for answer
      ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === targetId) {
          console.log("Received answer from", targetId);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          remoteDescSet.current = true;
          await flushIceCandidates(pc);
        }
      });

      // Listen for ICE candidates
      ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === targetId && payload.candidate) {
          await addIceCandidate(pc, payload.candidate);
        }
      });

      // Listen for reject
      ch.on("broadcast", { event: "reject" }, ({ payload }) => {
        if (payload.from === targetId) cleanup();
      });

      // Listen for hangup
      ch.on("broadcast", { event: "hangup" }, ({ payload }) => {
        if (payload.from === targetId) cleanup();
      });

      // Listen for quiz letters
      ch.on("broadcast", { event: "quiz-letter" }, ({ payload }) => {
        if (payload.from === targetId) {
          setQuizLetter(payload.letter);
        }
      });

      // Subscribe, then create and send offer
      await ch.subscribe((status) => {
        console.log("Caller channel status:", status);
      });

      // Small delay to ensure channel is ready
      await new Promise((r) => setTimeout(r, 500));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send to the shared call channel
      ch.send({
        type: "broadcast",
        event: "offer",
        payload: {
          offer,
          from: user.id,
          callerName: user.name,
          callType: type,
        },
      });

      // Also notify target's personal channel
      const targetCh = supabase.channel(`user-${targetId}`);
      await targetCh.subscribe();
      await new Promise((r) => setTimeout(r, 300));
      targetCh.send({
        type: "broadcast",
        event: "incoming-call",
        payload: {
          offer,
          from: user.id,
          callerName: user.name,
          callType: type,
        },
      });
      setTimeout(() => supabase.removeChannel(targetCh), 3000);
    },
    [user, cleanup]
  );

  // ── RECEIVER FLOW ──
  const acceptCall = useCallback(
    async () => {
      if (!incomingCall || !user) return;
      const { callerId, callType } = incomingCall;
      const offer = pendingOfferRef.current;
      if (!offer) {
        console.error("No pending offer to accept");
        return;
      }

      setCallState((s) => ({
        ...s,
        status: "connected",
        callType,
        remoteUserId: callerId,
        remoteName: incomingCall.callerName,
      }));
      setIncomingCall(null);

      const stream = await getMedia(callType);
      const channelName = getChannelName(user.id, callerId);
      const ch = supabase.channel(channelName);
      channelRef.current = ch;
      const pc = createPeerConnection(ch);

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Listen for ICE candidates from caller
      ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === callerId && payload.candidate) {
          await addIceCandidate(pc, payload.candidate);
        }
      });

      // Listen for hangup
      ch.on("broadcast", { event: "hangup" }, ({ payload }) => {
        if (payload.from === callerId) cleanup();
      });

      // Listen for quiz letters
      ch.on("broadcast", { event: "quiz-letter" }, ({ payload }) => {
        if (payload.from === callerId) {
          setQuizLetter(payload.letter);
        }
      });

      // Subscribe first, then set descriptions
      await ch.subscribe((status) => {
        console.log("Receiver channel status:", status);
      });
      await new Promise((r) => setTimeout(r, 500));

      // Set remote description (the offer), create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescSet.current = true;
      await flushIceCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      ch.send({
        type: "broadcast",
        event: "answer",
        payload: { answer, from: user.id },
      });

      pendingOfferRef.current = null;
    },
    [incomingCall, user, cleanup]
  );

  const rejectCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    const channelName = getChannelName(user.id, incomingCall.callerId);
    const ch = supabase.channel(channelName);
    await ch.subscribe();
    await new Promise((r) => setTimeout(r, 300));
    ch.send({
      type: "broadcast",
      event: "reject",
      payload: { from: user.id },
    });
    setTimeout(() => supabase.removeChannel(ch), 1000);
    pendingOfferRef.current = null;
    setIncomingCall(null);
  }, [incomingCall, user]);

  const endCall = useCallback(() => {
    if (user) {
      // If we're still calling (not yet connected), also notify the target's personal channel
      if (callState.status === "calling" && callState.remoteUserId) {
        const targetCh = supabase.channel(`user-${callState.remoteUserId}-cancel`);
        targetCh.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            targetCh.send({
              type: "broadcast",
              event: "call-cancelled",
              payload: { from: user.id },
            });
            setTimeout(() => supabase.removeChannel(targetCh), 1000);
          }
        });
      }
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "hangup",
          payload: { from: user.id },
        });
      }
    }
    cleanup();
  }, [cleanup, user, callState.status, callState.remoteUserId]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCallState((s) => ({ ...s, isMuted: !s.isMuted }));
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCallState((s) => ({ ...s, isCameraOff: !s.isCameraOff }));
  }, []);

  const sendQuizLetter = useCallback((letter: QuizLetter) => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: "broadcast",
        event: "quiz-letter",
        payload: { letter, from: user.id },
      });
      // Also show it locally for the teacher
      setQuizLetter(letter);
    }
  }, [user]);

  // Listen for incoming calls on personal channel
  useEffect(() => {
    if (!user) return;

    const listenChannel = supabase.channel(`user-${user.id}`);
    const cancelChannel = supabase.channel(`user-${user.id}-cancel`);

    listenChannel.on("broadcast", { event: "incoming-call" }, ({ payload }) => {
      if (callState.status !== "idle") return;
      console.log("Incoming call from", payload.from);
      pendingOfferRef.current = payload.offer;
      setIncomingCall({
        callerId: payload.from,
        callerName: payload.callerName,
        callType: payload.callType,
      });
    });

    cancelChannel.on("broadcast", { event: "call-cancelled" }, ({ payload }) => {
      // If we have an incoming call from this caller, dismiss it
      setIncomingCall((prev) => {
        if (prev && prev.callerId === payload.from) {
          pendingOfferRef.current = null;
          return null;
        }
        return prev;
      });
    });

    listenChannel.subscribe((status) => {
      console.log("Personal channel status:", status);
    });
    cancelChannel.subscribe();

    return () => {
      supabase.removeChannel(listenChannel);
      supabase.removeChannel(cancelChannel);
    };
  }, [user, callState.status]);

  return {
    callState,
    incomingCall,
    quizLetter,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    sendQuizLetter,
  };
};
