import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const SYNTHETIC_DOMAIN = "noorify.local";

const usernameToEmail = (name: string) =>
  `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}@${SYNTHETIC_DOMAIN}`;

const generateUniqueId = async (): Promise<string> => {
  for (let i = 0; i < 10; i++) {
    const id = Math.floor(100000 + Math.random() * 900000).toString();
    const { data } = await supabase
      .from("app_users")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();
    if (!data) return id;
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const Onboarding = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Name must be at least 2 characters");
      return false;
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
      toast.error("Name can only contain letters, numbers, spaces, _ and -");
      return false;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    const trimmedName = name.trim();
    const email = usernameToEmail(trimmedName);

    try {
      // 1. Check name availability up front for a friendlier error
      const { data: existing } = await supabase
        .from("app_users")
        .select("user_id")
        .ilike("name", trimmedName)
        .maybeSingle();
      if (existing) {
        toast.error("That name is already taken. Try another or sign in.");
        setLoading(false);
        return;
      }

      // 2. Sign up with synthetic email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/home` },
      });
      if (authError || !authData.user) {
        toast.error(authError?.message || "Could not create account");
        setLoading(false);
        return;
      }

      // 3. Create app_users profile row
      const userId = await generateUniqueId();
      const { error: insertError } = await supabase.from("app_users").insert({
        user_id: userId,
        name: trimmedName,
        role: "learner",
        is_online: true,
        auth_user_id: authData.user.id,
      });
      if (insertError) {
        toast.error("Could not create profile: " + insertError.message);
        setLoading(false);
        return;
      }

      toast.success(`Welcome, ${trimmedName}! Your ID is ${userId}`);
      navigate("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    const email = usernameToEmail(name);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Wrong name or password");
      return;
    }
    navigate("/home");
  };

  const submit = mode === "signup" ? handleSignUp : handleSignIn;

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
          {/* Tab toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 mb-6 bg-muted rounded-xl">
            <button
              onClick={() => setMode("signin")}
              className={`py-2 rounded-lg font-medium transition-all ${
                mode === "signin" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`py-2 rounded-lg font-medium transition-all ${
                mode === "signup" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <label className="block text-sm font-medium text-foreground mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aisha"
            autoComplete="username"
            className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />

          <label className="block text-sm font-medium text-foreground mb-1 mt-4">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="At least 6 characters"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={submit}
            disabled={!name.trim() || !password || loading}
            className="w-full mt-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
              ? "Create Account ✨"
              : "Sign In"}
          </button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            {mode === "signup"
              ? "Choose a memorable name — it’s how you sign in on any device."
              : "Same name & password you used to sign up."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
