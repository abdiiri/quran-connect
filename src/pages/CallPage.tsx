import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { ArrowLeft, Phone, Video } from "lucide-react";
import { toast } from "sonner";

const CallPage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [targetId, setTargetId] = useState("");

  const startCall = (type: "audio" | "video") => {
    if (!targetId.trim() || targetId.length !== 6) {
      toast.error("Please enter a valid 6-digit User ID");
      return;
    }
    if (targetId === user?.id) {
      toast.error("You cannot call yourself");
      return;
    }
    navigate(`/call-screen?target=${targetId}&type=${type}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary p-4 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="text-primary-foreground p-2 -ml-2 hover:bg-primary-foreground/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">Start a Call</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 animate-fade-in">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Enter User ID</h2>
          <p className="text-sm text-muted-foreground mb-4">Ask for the 6-digit ID of the person you want to call</p>
          <input
            type="text"
            maxLength={6}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 482913"
            className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-center text-2xl font-mono tracking-[0.3em]"
          />

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={() => startCall("audio")}
              className="flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-primary-foreground font-medium hover:opacity-90 transition-all"
            >
              <Phone className="w-5 h-5" /> Audio Call
            </button>
            <button
              onClick={() => startCall("video")}
              className="flex items-center justify-center gap-2 py-3 rounded-xl gradient-gold text-primary-foreground font-medium hover:opacity-90 transition-all"
            >
              <Video className="w-5 h-5" /> Video Call
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">Your ID: <span className="font-mono font-semibold text-foreground">{user?.id}</span></p>
          <p className="text-xs text-muted-foreground mt-1">Share this ID with others so they can call you</p>
        </div>
      </div>
    </div>
  );
};

export default CallPage;
