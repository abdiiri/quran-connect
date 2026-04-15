import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface User {
  id: string;
  name: string;
  role: "learner" | "teacher" | "admin";
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);

  // Set user online status
  useEffect(() => {
    if (!user) return;
    
    const setOnline = (online: boolean) => {
      supabase
        .from("app_users")
        .update({ is_online: online })
        .eq("user_id", user.id)
        .then(() => {});
    };

    setOnline(true);

    const handleBeforeUnload = () => setOnline(false);
    const handleVisibilityChange = () => {
      setOnline(!document.hidden);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      setOnline(false);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    const stored = localStorage.getItem("quran_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User;
        setUserState(parsed);
        // Fetch latest role from DB
        supabase
          .from("app_users")
          .select("role")
          .eq("user_id", parsed.id)
          .single()
          .then(({ data }) => {
            if (data && data.role !== parsed.role) {
              const updated = { ...parsed, role: data.role as "learner" | "teacher" | "admin" };
              setUserState(updated);
              localStorage.setItem("quran_user", JSON.stringify(updated));
            }
          });
      } catch {
        localStorage.removeItem("quran_user");
      }
    }
  }, []);

  const setUser = (u: User | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem("quran_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("quran_user");
    }
  };

  const logout = () => setUser(null);

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};
