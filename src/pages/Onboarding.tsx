import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";

const generateUniqueId = async (): Promise<string> => {
  for (let i = 0; i < 10; i++) {
    const id = Math.floor(100000 + Math.random() * 900000).toString();
    const { data } = await supabase
      .from("app_users")
      .select("user_id")
      .eq("user_id", id)
      .single();
    if (!data) return id;
  }
  // Fallback - extremely unlikely collision
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const Onboarding = () => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const userId = await generateUniqueId();
      const user = { id visitorId, name: name.trim(), role: "learner" as const };

      // Save to database
      await supabase.from("app_users").insert({
        user_id: userId,
        name: name.trim(),
        role: "learner",
        is_online: true,
      });

      const user = { id: userId, name: name.trim(), role: "learner" as const };
      setUser(user);
      navigate("/home");
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-primary">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-foreground/20 mb-4">
            <BookOpen className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground mb-2">Quran Learning</h1>
          <p className="text-primary-foreground/80 text-lg">Begin your journey with Arabic</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">What's your name?</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-lg"
            autoFocus
          />
          <button
            onClick={handleStart}
            disabled={!name.trim() || loading}
            className="w-full mt-4 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up…" : "Start Learning ✨"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
