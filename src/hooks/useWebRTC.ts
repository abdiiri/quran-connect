import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

interface RemoteCameraState {
  isCameraOff: boolean;
}

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";
export type CallType = "audio" | "video";
export type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "unknown";

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
  { urls: "stun:freeturn.net:5349" },
  {
    urls: "turn:freeturn.net:3478",
    username: "free",
    credential: "free",
  },
  {
    urls: "turns:freeturn.net:5349",
    username: "free",
    credential: "free",
  },
];

export const useWebRTC = () => {
  const { user } = useUser();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSet = useRef(false);

  const callingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  });

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [quizLetter, setQuizLetter] = useState<QuizLetter | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("unknown");

  const cleanup = useCallback(() => {
    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
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
    setConnectionQuality("unknown");
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

  const startStatsPolling = (pc: RTCPeerConnection) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (pc.connectionState !== "connected") return;
      try {
        const stats = await pc.getStats();
        let rtt = -1;
        let packetsLost = 0;
        let packetsReceived = 0;
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            rtt = report.currentRoundTripTime ?? -1;
          }
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            packetsLost = report.packetsLost ?? 0;
            packetsReceived = report.packetsReceived ?? 0;
          }
        });
        const lossRate = packetsReceived > 0 ? packetsLost / (packetsLost + packetsReceived) : 0;
        let quality: ConnectionQuality = "unknown";
        if (rtt >= 0) {
          if (rtt < 0.1 && lossRate < 0.01) quality = "excellent";
          else if (rtt < 0.2 && lossRate < 0.03) quality = "good";
          else if (rtt < 0.4 && lossRate < 0.08) quality = "fair";
          else quality = "poor";
        }
        setConnectionQuality(quality);
      } catch { /* ignore */ }
    }, 2000);
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
        if (callingTimeoutRef.current) {
          clearTimeout(callingTimeoutRef.current);
          callingTimeoutRef.current = null;
        }
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
          // Update status immediately - the other user has accepted
          setCallState((s) => ({ ...s, status: "connected", remoteName: payload.remoteName || s.remoteName }));
          if (callingTimeoutRef.current) {
            clearTimeout(callingTimeoutRef.current);
            callingTimeoutRef.current = null;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          remoteDescSet.current = true;
          await flushIceCandidates(pc);
          startStatsPolling(pc);
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

      // Listen for camera toggle
      ch.on("broadcast", { event: "camera-toggle" }, ({ payload }) => {
        if (payload.from === targetId) {
          setCallState((s) => ({ ...s, remoteCameraOff: payload.isCameraOff }));
        }
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

      // Auto-cancel after 30 seconds if not connected
      callingTimeoutRef.current = setTimeout(() => {
        console.log("Call auto-cancelled after 30s timeout");
        setCallState((prev) => {
          if (prev.status === "calling") {
            // Notify target about cancellation
            const cancelCh = supabase.channel(`user-${targetId}-cancel`);
            cancelCh.subscribe((s) => {
              if (s === "SUBSCRIBED") {
                cancelCh.send({
                  type: "broadcast",
                  event: "call-cancelled",
                  payload: { from: user!.id },
                });
                setTimeout(() => supabase.removeChannel(cancelCh), 1000);
              }
            });
            cleanup();
          }
          return prev;
        });
      }, 30000);
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

      // Listen for camera toggle
      ch.on("broadcast", { event: "camera-toggle" }, ({ payload }) => {
        if (payload.from === callerId) {
          setCallState((s) => ({ ...s, remoteCameraOff: payload.isCameraOff }));
        }
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
        payload: { answer, from: user.id, remoteName: user.name },
      });

      startStatsPolling(pc);
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
    const newCameraOff = !callState.isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !newCameraOff;
    });
    setCallState((s) => ({ ...s, isCameraOff: newCameraOff }));
    // Broadcast camera state to remote user
    if (channelRef.current && user) {
      channelRef.current.send({
        type: "broadcast",
        event: "camera-toggle",
        payload: { isCameraOff: newCameraOff, from: user.id },
      });
    }
  }, [callState.isCameraOff, user]);

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
    connectionQuality,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    sendQuizLetter,
  };
};
