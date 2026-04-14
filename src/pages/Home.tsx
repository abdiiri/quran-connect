import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { BookOpen, Phone, User, Copy, Check, GraduationCap, Mic, Palette } from "lucide-react";
import { useState } from "react";

const Home = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const copyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cards = [
    { title: "Start Learning", desc: "Arabic alphabet & pronunciation", icon: BookOpen, path: "/learn", color: "gradient-primary" },
    { title: "Join Call", desc: "Connect with a teacher or peer", icon: Phone, path: "/call", color: "gradient-gold" },
    { title: "Profile", desc: "View your details", icon: User, path: "/profile", color: "bg-muted" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-primary p-6 pb-12 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <p className="text-primary-foreground/70 text-sm">Assalamu Alaikum</p>
          <h1 className="text-2xl font-bold text-primary-foreground">Hello, {user.name} 👋</h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="bg-primary-foreground/20 text-primary-foreground text-xs px-3 py-1 rounded-full font-medium capitalize">
              {user.role}
            </span>
            <button
              onClick={copyId}
              className="flex items-center gap-1.5 bg-primary-foreground/20 text-primary-foreground text-xs px-3 py-1 rounded-full font-mono hover:bg-primary-foreground/30 transition-colors"
            >
              ID: {user.id}
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4 pb-8">
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={() => navigate(card.path)}
            className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:shadow-md transition-all animate-fade-in"
          >
            <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center shrink-0`}>
              <card.icon className={`w-6 h-6 ${card.color === "bg-muted" ? "text-foreground" : "text-primary-foreground"}`} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.desc}</p>
            </div>
          </button>
        ))}

        {user.role === "learner" && (
          <button
            onClick={() => navigate("/coloring")}
            className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:shadow-md transition-all border-2 border-accent"
          >
            <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center shrink-0">
              <Palette className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Color the Letters</h3>
              <p className="text-sm text-muted-foreground">Draw & color Arabic alphabets</p>
            </div>
          </button>
        )}

        {user.role === "teacher" && (
          <button
            onClick={() => navigate("/call")}
            className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:shadow-md transition-all border-2 border-accent"
          >
            <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Start Teaching Session</h3>
              <p className="text-sm text-muted-foreground">Connect with learners</p>
            </div>
          </button>
        )}

        {user.role === "admin" && (
          <button
            onClick={() => navigate("/admin/recording")}
            className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:shadow-md transition-all border-2 border-accent"
          >
            <div className="w-12 h-12 rounded-xl bg-destructive flex items-center justify-center shrink-0">
              <Mic className="w-6 h-6 text-destructive-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Record Pronunciations</h3>
              <p className="text-sm text-muted-foreground">Record audio for alphabet letters</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;
