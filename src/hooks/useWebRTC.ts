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

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const useWebRTC = () => {
  const { user } = useUser();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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
  // Store the pending offer so we can use it when accepting
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
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
      if (pc.connectionState === "connected") {
        setCallState((s) => ({ ...s, status: "connected" }));
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  };

  const getSignalingChannel = (targetId: string) => {
    // Deterministic channel name so both peers join the same channel
    const ids = [user!.id, targetId].sort();
    const channelName = `call-${ids[0]}-${ids[1]}`;
    const ch = supabase.channel(channelName);
    channelRef.current = ch;
    return ch;
  };

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
      const ch = getSignalingChannel(targetId);
      const pc = createPeerConnection(ch);

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === targetId) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      });

      ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === targetId && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {}
        }
      });

      ch.on("broadcast", { event: "reject" }, ({ payload }) => {
        if (payload.from === targetId) {
          cleanup();
        }
      });

      await ch.subscribe();

      // Send the call offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

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
    },
    [user, cleanup]
  );

  const acceptCall = useCallback(
    async () => {
      if (!incomingCall || !user) return;
      const { callerId, callType } = incomingCall;

      setCallState((s) => ({
        ...s,
        status: "connected",
        callType,
        remoteUserId: callerId,
        remoteName: incomingCall.callerName,
      }));

      const stream = await getMedia(callType);
      const ch = getSignalingChannel(callerId);
      const pc = createPeerConnection(ch);

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === callerId && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {}
        }
      });

      // Use the stored offer
      const offer = pendingOfferRef.current;
      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ch.send({
          type: "broadcast",
          event: "answer",
          payload: { answer, from: user.id },
        });
      }

      pendingOfferRef.current = null;
      setIncomingCall(null);
    },
    [incomingCall, user, cleanup]
  );

  const rejectCall = useCallback(() => {
    if (!incomingCall || !user) return;
    const ch = getSignalingChannel(incomingCall.callerId);
    ch.subscribe().then(() => {
      ch.send({
        type: "broadcast",
        event: "reject",
        payload: { from: user.id },
      });
      setTimeout(() => supabase.removeChannel(ch), 1000);
    });
    pendingOfferRef.current = null;
    setIncomingCall(null);
  }, [incomingCall, user]);

  const endCall = useCallback(() => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: "broadcast",
        event: "hangup",
        payload: { from: user.id },
      });
    }
    cleanup();
  }, [cleanup, user]);

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

  // Listen for incoming calls on user's personal channel
  useEffect(() => {
    if (!user) return;

    const listenChannel = supabase.channel(`user-${user.id}`);

    listenChannel.on("broadcast", { event: "offer" }, ({ payload }) => {
      if (callState.status !== "idle") return; // already in a call
      pendingOfferRef.current = payload.offer;
      setIncomingCall({
        callerId: payload.from,
        callerName: payload.callerName,
        callType: payload.callType,
      });
    });

    listenChannel.subscribe();

    return () => {
      supabase.removeChannel(listenChannel);
    };
  }, [user, callState.status]);

  // Also broadcast the offer to the target user's personal channel
  const originalStartCall = startCall;
  const enhancedStartCall = useCallback(
    async (targetId: string, type: CallType) => {
      if (!user) return;

      setCallState((s) => ({
        ...s,
        status: "calling",
        callType: type,
        remoteUserId: targetId,
      }));

      const stream = await getMedia(type);
      const ch = getSignalingChannel(targetId);
      const pc = createPeerConnection(ch);

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.from === targetId) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      });

      ch.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.from === targetId && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {}
        }
      });

      ch.on("broadcast", { event: "reject" }, ({ payload }) => {
        if (payload.from === targetId) {
          cleanup();
        }
      });

      ch.on("broadcast", { event: "hangup" }, ({ payload }) => {
        if (payload.from === targetId) {
          cleanup();
        }
      });

      await ch.subscribe();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer on the shared channel
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

      // Also send to target's personal channel so they get notified
      const targetChannel = supabase.channel(`user-${targetId}`);
      await targetChannel.subscribe();
      targetChannel.send({
        type: "broadcast",
        event: "offer",
        payload: {
          offer,
          from: user.id,
          callerName: user.name,
          callType: type,
        },
      });
      setTimeout(() => supabase.removeChannel(targetChannel), 2000);
    },
    [user, cleanup]
  );

  return {
    callState,
    incomingCall,
    startCall: enhancedStartCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
};
