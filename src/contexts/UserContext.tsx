import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export interface User {
  id: string;            // 6-digit public ID
  name: string;
  role: "learner" | "teacher" | "admin";
  authUserId: string;    // Supabase auth.users.id
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const fetchProfile = async (authUserId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from("app_users")
    .select("user_id, name, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.user_id,
    name: data.name,
    role: data.role as "learner" | "teacher" | "admin",
    authUserId,
  };
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth changes — set up FIRST, then load existing session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setUser(null);
        return;
      }
      // Defer DB call to avoid deadlock inside auth callback
      setTimeout(() => {
        fetchProfile(newSession.user.id).then(setUser);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      if (existing) {
        fetchProfile(existing.user.id).then((p) => {
          setUser(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Online status tracking
  useEffect(() => {
    if (!user) return;

    const setOnline = (online: boolean) => {
      supabase.from("app_users").update({ is_online: online }).eq("user_id", user.id).then(() => {});
    };
    setOnline(true);

    const handleBeforeUnload = () => setOnline(false);
    const handleVisibilityChange = () => setOnline(!document.hidden);

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      setOnline(false);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    // Clear legacy localStorage from previous version
    localStorage.removeItem("quran_user");
  };

  return (
    <UserContext.Provider value={{ user, loading, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};
