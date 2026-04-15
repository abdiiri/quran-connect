import { useRef, useState, useCallback, useEffect } from "react";
import Peer, { MediaConnection, DataConnection } from "peerjs";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";
export type CallType = "audio" | "video";
export type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "unknown";
export type PeerStatus = "connecting" | "connected" | "disconnected" | "error";

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

// Convert app user ID (6 digits) to a PeerJS-safe ID
const toPeerId = (userId: string) => `noorify-${userId}`;

export const useWebRTC = () => {
  const { user } = useUser();
  const peerRef = useRef<Peer | null>(null);
  const mediaConnRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Supabase channels for call signaling (ring/reject/cancel only)
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
  const [peerStatus, setPeerStatus] = useState<PeerStatus>("disconnected");

  // Pending incoming call metadata (stored so acceptCall can use it)
  const pendingIncomingMeta = useRef<{ callType: CallType; callerName: string } | null>(null);

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
    mediaConnRef.current?.close();
    mediaConnRef.current = null;
    dataConnRef.current?.close();
    dataConnRef.current = null;
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
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

  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;
    conn.on("data", (data: unknown) => {
      const msg = data as { type: string; [key: string]: unknown };
      if (msg.type === "camera-toggle") {
        setCallState((s) => ({ ...s, remoteCameraOff: msg.isCameraOff as boolean }));
      } else if (msg.type === "quiz-letter") {
        setQuizLetter(msg.letter as QuizLetter);
      } else if (msg.type === "hangup") {
        cleanup();
      }
    });
    conn.on("close", () => {
      cleanup();
    });
  }, [cleanup]);

  const setupMediaConnection = useCallback((call: MediaConnection) => {
    mediaConnRef.current = call;
    call.on("stream", (remoteStream) => {
      console.log("Got remote stream");
      setCallState((s) => ({ ...s, remoteStream, status: "connected" }));
    });
    call.on("close", () => {
      cleanup();
    });
    call.on("error", (err) => {
      console.error("Media connection error:", err);
      cleanup();
    });
  }, [cleanup]);

  const startStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      const pc = mediaConnRef.current?.peerConnection as RTCPeerConnection | undefined;
      if (!pc || pc.connectionState !== "connected") return;
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
  }, []);

  // Fetch TURN credentials and create PeerJS peer
  const initPeer = useCallback(async (peerId: string) => {
    setPeerStatus("connecting");

    // Fetch TURN servers from edge function
    let iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    try {
      const { data, error } = await supabase.functions.invoke("get-turn-credentials");
      if (!error && data?.iceServers) {
        iceServers = [...iceServers, ...data.iceServers];
        console.log("TURN servers loaded:", data.iceServers.length, "servers");
      } else {
        console.warn("Failed to fetch TURN credentials, using STUN only:", error);
      }
    } catch (err) {
      console.warn("TURN credential fetch error, using STUN only:", err);
    }

    const peer = new Peer(peerId, {
      debug: 2,
      config: { iceServers },
    });
    peerRef.current = peer;

    const setupPeerEvents = (p: Peer) => {
      p.on("open", (id) => {
        console.log("PeerJS connected with ID:", id);
        setPeerStatus("connected");
      });

      p.on("error", (err) => {
        console.error("PeerJS error:", err.type, err.message);
        setPeerStatus("error");
        if (err.type === "unavailable-id") {
          console.log("Peer ID taken, retrying...");
          p.destroy();
          setPeerStatus("connecting");
          const retryPeer = new Peer(`${peerId}-${Date.now()}`, {
            debug: 2,
            config: { iceServers },
          });
          setupPeerEvents(retryPeer);
          peerRef.current = retryPeer;
      }
      });

      p.on("disconnected", () => {
        console.log("PeerJS disconnected, attempting reconnect...");
        setPeerStatus("disconnected");
        try { p.reconnect(); } catch { /* ignore */ }
      });

      p.on("close", () => {
        setPeerStatus("disconnected");
      });

      // Handle incoming media calls
      p.on("call", (call) => {
        console.log("Incoming PeerJS media call from:", call.peer);
        const meta = call.metadata as { callType: CallType; callerName: string; callerId: string } | undefined;
        mediaConnRef.current = call;
        pendingIncomingMeta.current = {
          callType: meta?.callType || "audio",
          callerName: meta?.callerName || "Unknown",
        };
        const callerAppId = meta?.callerId || call.peer.replace("noorify-", "").split("-")[0];
        setIncomingCall({
          callerId: callerAppId,
          callerName: meta?.callerName || `User ${callerAppId}`,
          callType: meta?.callType || "audio",
        });
      });

      // Handle incoming data connections
      p.on("connection", (conn) => {
        console.log("Incoming PeerJS data connection from:", conn.peer);
        setupDataConnection(conn);
      });
    };

    setupPeerEvents(peer);

    // Listen on Supabase for call cancellations
    const cancelChannel = supabase.channel(`user-${user.id}-cancel`);
    cancelChannel.on("broadcast", { event: "call-cancelled" }, ({ payload }) => {
      setIncomingCall((prev) => {
        if (prev && prev.callerId === payload.from) {
          mediaConnRef.current?.close();
          mediaConnRef.current = null;
          pendingIncomingMeta.current = null;
          return null;
        }
        return prev;
      });
    });
    cancelChannel.subscribe();

    return () => {
      console.log("Destroying PeerJS peer");
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      setPeerStatus("disconnected");
      supabase.removeChannel(cancelChannel);
    };
  }, [user, setupDataConnection]);

  // ── Initialize PeerJS ──
  useEffect(() => {
    if (!user) return;
    const peerId = toPeerId(user.id);
    console.log("Creating PeerJS peer:", peerId);
    initPeer(peerId);
  }, [user, initPeer]);

  // ── CALLER FLOW ──
  const startCall = useCallback(
    async (targetId: string, type: CallType) => {
      if (!user || !peerRef.current) return;

      const peer = peerRef.current;
      const targetPeerId = toPeerId(targetId);

      setCallState((s) => ({
        ...s,
        status: "calling",
        callType: type,
        remoteUserId: targetId,
      }));

      const stream = await getMedia(type);

      // Call the remote peer via PeerJS (handles all WebRTC signaling)
      console.log("Calling peer:", targetPeerId);
      const call = peer.call(targetPeerId, stream, {
        metadata: {
          callType: type,
          callerName: user.name,
          callerId: user.id,
        },
      });

      setupMediaConnection(call);

      // Open a data channel for in-call messages (camera toggle, quiz, hangup)
      const dataConn = peer.connect(targetPeerId, {
        metadata: { callerName: user.name, callerId: user.id },
      });
      setupDataConnection(dataConn);

      // Also send a notification via Supabase so the receiver knows who's calling
      // (in case they need the notification before PeerJS connects)
      const notifyCh = supabase.channel(`user-${targetId}-notify-${Date.now()}`);
      notifyCh.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Channel subscribed but we don't need Supabase for signaling anymore
          setTimeout(() => supabase.removeChannel(notifyCh), 2000);
        }
      });

      // Start stats polling when connected
      call.on("stream", () => {
        if (callingTimeoutRef.current) {
          clearTimeout(callingTimeoutRef.current);
          callingTimeoutRef.current = null;
        }
        startStatsPolling();
      });

      // Auto-cancel after 30 seconds
      callingTimeoutRef.current = setTimeout(() => {
        console.log("Call auto-cancelled after 30s timeout");
        setCallState((prev) => {
          if (prev.status === "calling") {
            // Notify the target that the call was cancelled
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
    [user, cleanup, setupMediaConnection, setupDataConnection, startStatsPolling]
  );

  // ── RECEIVER FLOW ──
  const acceptCall = useCallback(
    async () => {
      if (!incomingCall || !user) return;
      const { callerId, callType } = incomingCall;

      const pendingCall = mediaConnRef.current;
      if (!pendingCall) {
        console.error("No pending media connection to answer");
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

      // Answer the PeerJS call with our local stream
      pendingCall.answer(stream);
      setupMediaConnection(pendingCall);

      pendingCall.on("stream", () => {
        startStatsPolling();
      });

      pendingIncomingMeta.current = null;
    },
    [incomingCall, user, setupMediaConnection, startStatsPolling]
  );

  const rejectCall = useCallback(() => {
    if (!incomingCall || !user) return;
    // Close the pending media connection
    mediaConnRef.current?.close();
    mediaConnRef.current = null;
    pendingIncomingMeta.current = null;
    setIncomingCall(null);
  }, [incomingCall, user]);

  const endCall = useCallback(() => {
    // Send hangup via data channel before closing
    if (dataConnRef.current?.open) {
      try {
        dataConnRef.current.send({ type: "hangup" });
      } catch { /* ignore */ }
    }
    if (user && callState.status === "calling" && callState.remoteUserId) {
      const cancelCh = supabase.channel(`user-${callState.remoteUserId}-cancel`);
      cancelCh.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          cancelCh.send({
            type: "broadcast",
            event: "call-cancelled",
            payload: { from: user.id },
          });
          setTimeout(() => supabase.removeChannel(cancelCh), 1000);
        }
      });
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
    if (dataConnRef.current?.open) {
      dataConnRef.current.send({ type: "camera-toggle", isCameraOff: newCameraOff });
    }
  }, [callState.isCameraOff]);

  const sendQuizLetter = useCallback((letter: QuizLetter) => {
    if (dataConnRef.current?.open) {
      dataConnRef.current.send({ type: "quiz-letter", letter });
    }
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
