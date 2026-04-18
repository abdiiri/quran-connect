import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { useUser } from "@/contexts/UserContext";
import { Mic, MicOff, Video, VideoOff, PhoneOff, RefreshCcw } from "lucide-react";
import InCallQuiz from "@/components/InCallQuiz";

// Metered JS SDK (gives us raw streams instead of an iframe UI)
const METERED_SDK_URL = "https://cdn.metered.ca/sdk/video/1.4.6/sdk.min.js";

interface MeteredParticipant {
  _id: string;
  name?: string;
}

interface RemoteTrackEvent {
  track: MediaStreamTrack;
  streamId?: string;
  participantSessionId?: string;
  type?: "video" | "audio";
  name?: string;
}

interface MeteredMeetingInstance {
  join: (opts: { roomURL: string; name?: string }) => Promise<unknown>;
  leaveMeeting: () => Promise<void>;
  startVideo: () => Promise<void>;
  stopVideo: () => Promise<void>;
  startAudio: () => Promise<void>;
  muteLocalAudio: () => Promise<void>;
  unmuteLocalAudio?: () => Promise<void>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  localVideoStream?: MediaStream | null;
  switchCamera?: () => Promise<void>;
  // legacy alt name
  startLocalVideo?: () => Promise<void>;
  stopLocalVideo?: () => Promise<void>;
}

declare global {
  interface Window {
    Metered?: { Meeting: new () => MeteredMeetingInstance };
  }
}

const loadMeteredSDK = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.Metered?.Meeting) return resolve();
    const existing = document.querySelector(`script[src="${METERED_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = METERED_SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Metered SDK failed to load"));
    document.head.appendChild(s);
  });

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const CallScreen = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { callState, endCall } = useCall();

  const meetingRef = useRef<MeteredMeetingInstance | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);
  const [remoteAudioActive, setRemoteAudioActive] = useState(false);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { status, remoteName, remoteUserId, roomURL, callType } = callState;
  const displayName = remoteName || `User ${remoteUserId}`;

  useEffect(() => {
    if (status === "idle") navigate("/call");
  }, [status, navigate]);

  // Initialize Metered meeting
  useEffect(() => {
    if (!roomURL || status !== "connected") return;

    let cancelled = false;
    setJoining(true);
    setError(null);

    loadMeteredSDK()
      .then(async () => {
        if (cancelled || !window.Metered?.Meeting) return;
        const meeting = new window.Metered.Meeting();
        meetingRef.current = meeting;

        const remoteStream = new MediaStream();
        const remoteAudioStream = new MediaStream();

        meeting.on("remoteTrackStarted", (...args: unknown[]) => {
          const evt = args[0] as RemoteTrackEvent;
          if (!evt?.track) return;
          if (evt.track.kind === "video") {
            remoteStream.getVideoTracks().forEach((t) => remoteStream.removeTrack(t));
            remoteStream.addTrack(evt.track);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play().catch(() => {});
            }
            setRemoteVideoActive(true);
          } else if (evt.track.kind === "audio") {
            remoteAudioStream.getAudioTracks().forEach((t) => remoteAudioStream.removeTrack(t));
            remoteAudioStream.addTrack(evt.track);
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteAudioStream;
              remoteAudioRef.current.play().catch(() => {});
            }
            setRemoteAudioActive(true);
          }
        });

        meeting.on("remoteTrackStopped", (...args: unknown[]) => {
          const evt = args[0] as RemoteTrackEvent;
          if (evt?.track?.kind === "video") setRemoteVideoActive(false);
          if (evt?.track?.kind === "audio") setRemoteAudioActive(false);
        });

        meeting.on("participantLeft", () => {
          setRemoteVideoActive(false);
          setRemoteAudioActive(false);
        });

        meeting.on("localTrackUpdated", () => {
          if (meeting.localVideoStream && localVideoRef.current) {
            localVideoRef.current.srcObject = meeting.localVideoStream;
            localVideoRef.current.play().catch(() => {});
          }
        });

        try {
          await meeting.join({
            roomURL,
            name: user?.name || "Guest",
          });
          if (cancelled) return;

          // Always start audio
          await meeting.startAudio().catch(() => {});

          // Start camera if it's a video call
          if (callType === "video") {
            await meeting.startVideo().catch(() => {});
            if (meeting.localVideoStream && localVideoRef.current) {
              localVideoRef.current.srcObject = meeting.localVideoStream;
              localVideoRef.current.play().catch(() => {});
            }
          } else {
            setVideoOn(false);
          }

          setJoining(false);
        } catch (err) {
          console.error("Metered join failed:", err);
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to join the call");
            setJoining(false);
          }
        }
      })
      .catch((err) => {
        console.error("Metered SDK load failed:", err);
        if (!cancelled) {
          setError("Could not load the call engine");
          setJoining(false);
        }
      });

    return () => {
      cancelled = true;
      try {
        meetingRef.current?.leaveMeeting?.().catch(() => {});
      } catch {
        /* ignore */
      }
      meetingRef.current = null;
    };
  }, [roomURL, status, user?.name, callType]);

  const toggleMic = async () => {
    const m = meetingRef.current;
    if (!m) return;
    try {
      if (audioOn) {
        await m.muteLocalAudio();
        setAudioOn(false);
      } else {
        if (m.unmuteLocalAudio) await m.unmuteLocalAudio();
        else await m.startAudio();
        setAudioOn(true);
      }
    } catch (e) {
      console.error("toggleMic failed", e);
    }
  };

  const toggleCam = async () => {
    const m = meetingRef.current;
    if (!m) return;
    try {
      if (videoOn) {
        await m.stopVideo();
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setVideoOn(false);
      } else {
        await m.startVideo();
        if (m.localVideoStream && localVideoRef.current) {
          localVideoRef.current.srcObject = m.localVideoStream;
          localVideoRef.current.play().catch(() => {});
        }
        setVideoOn(true);
      }
    } catch (e) {
      console.error("toggleCam failed", e);
    }
  };

  const flipCamera = async () => {
    const m = meetingRef.current;
    if (!m?.switchCamera) return;
    try {
      await m.switchCamera();
    } catch (e) {
      console.error("flipCamera failed", e);
    }
  };

  const handleEndCall = async () => {
    try {
      await meetingRef.current?.leaveMeeting?.();
    } catch {
      /* ignore */
    }
    endCall();
    navigate("/call");
  };

  return (
    <div className="min-h-screen bg-foreground flex flex-col relative overflow-hidden">
      {/* Hidden remote audio sink (always playing) */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Calling state */}
      {status === "calling" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-fade-in">
          <div className="relative mx-auto w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full gradient-primary animate-pulse opacity-60" />
            <div className="relative w-28 h-28 rounded-full gradient-primary flex items-center justify-center shadow-2xl">
              <span className="text-primary-foreground text-3xl font-bold">
                {initials(displayName)}
              </span>
            </div>
          </div>
          <h2 className="text-primary-foreground text-2xl font-semibold">{displayName}</h2>
          <p className="text-primary-foreground/60 text-sm mt-2">
            Calling<span className="animate-pulse">...</span>
          </p>
          <button
            onClick={handleEndCall}
            className="mt-12 w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all shadow-lg"
            aria-label="Cancel call"
          >
            <PhoneOff className="w-7 h-7 text-destructive-foreground" />
          </button>
        </div>
      )}

      {/* Connected — custom UI */}
      {status === "connected" && (
        <>
          {/* Remote video / avatar fills the screen */}
          <div className="absolute inset-0 bg-gradient-to-br from-foreground via-primary/20 to-foreground">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                remoteVideoActive && callType === "video" ? "opacity-100" : "opacity-0"
              }`}
            />
            {(!remoteVideoActive || callType === "audio") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 mb-4">
                  <div className="absolute inset-0 rounded-full gradient-primary animate-pulse opacity-40" />
                  <div className="relative w-32 h-32 rounded-full gradient-primary flex items-center justify-center shadow-2xl">
                    <span className="text-primary-foreground text-4xl font-bold">
                      {initials(displayName)}
                    </span>
                  </div>
                </div>
                <p className="text-primary-foreground/80 text-xs uppercase tracking-widest">
                  {callType === "audio" ? "Audio call" : "Camera off"}
                </p>
              </div>
            )}
          </div>

          {/* Top bar */}
          <div className="relative z-10 px-5 pt-5 pb-3 bg-gradient-to-b from-foreground/70 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-primary-foreground text-lg font-semibold leading-tight">
                  {displayName}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      remoteAudioActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  <span className="text-[11px] text-primary-foreground/60 uppercase tracking-wider">
                    {joining ? "Connecting" : remoteAudioActive ? "Connected" : "Waiting"}
                  </span>
                </div>
              </div>
              {callType === "video" && videoOn && (
                <button
                  onClick={flipCamera}
                  className="w-10 h-10 rounded-full bg-primary-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                  aria-label="Flip camera"
                >
                  <RefreshCcw className="w-4 h-4 text-primary-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Local self-view (PiP) */}
          {callType === "video" && (
            <div className="absolute top-20 right-4 z-20 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden shadow-2xl border border-primary-foreground/20 bg-foreground">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity ${
                  videoOn ? "opacity-100" : "opacity-0"
                }`}
              />
              {!videoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                  <VideoOff className="w-6 h-6 text-primary-foreground/60" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 right-1 text-[9px] text-primary-foreground/80 text-center bg-foreground/40 rounded px-1 py-0.5 backdrop-blur-sm">
                You
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom area: quiz overlay + controls */}
          <div className="relative z-10 pb-6 pt-4 bg-gradient-to-t from-foreground via-foreground/80 to-transparent">
            <InCallQuiz />

            <div className="flex items-center justify-center gap-4 mt-4 px-5">
              <button
                onClick={toggleMic}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  audioOn
                    ? "bg-primary-foreground/15 hover:bg-primary-foreground/25 backdrop-blur-md"
                    : "bg-destructive hover:opacity-90"
                }`}
                aria-label={audioOn ? "Mute" : "Unmute"}
              >
                {audioOn ? (
                  <Mic className="w-6 h-6 text-primary-foreground" />
                ) : (
                  <MicOff className="w-6 h-6 text-destructive-foreground" />
                )}
              </button>

              <button
                onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all shadow-xl"
                aria-label="End call"
              >
                <PhoneOff className="w-7 h-7 text-destructive-foreground" />
              </button>

              <button
                onClick={toggleCam}
                disabled={callType === "audio"}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  callType === "audio"
                    ? "bg-primary-foreground/5 cursor-not-allowed opacity-40"
                    : videoOn
                    ? "bg-primary-foreground/15 hover:bg-primary-foreground/25 backdrop-blur-md"
                    : "bg-destructive hover:opacity-90"
                }`}
                aria-label={videoOn ? "Turn camera off" : "Turn camera on"}
              >
                {videoOn ? (
                  <Video className="w-6 h-6 text-primary-foreground" />
                ) : (
                  <VideoOff className="w-6 h-6 text-destructive-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Joining / error overlays */}
          {joining && (
            <div className="absolute inset-0 z-30 bg-foreground/60 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground animate-spin mx-auto mb-3" />
                <p className="text-primary-foreground/80 text-sm">Connecting…</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-x-0 top-20 z-30 mx-auto max-w-sm px-4">
              <div className="bg-destructive text-destructive-foreground text-sm rounded-xl px-4 py-3 shadow-xl">
                {error}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CallScreen;
