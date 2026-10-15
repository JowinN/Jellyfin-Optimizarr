import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  needsSetup: boolean;
  isLoading: boolean;
  login: (username: string, token: string, user: User) => void;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("jmo_token"));
  const [user, setUser] = useState<User | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const statusRes = await api.getAuthStatus();
      setNeedsSetup(statusRes.needs_setup);

      if (!statusRes.needs_setup && token) {
        try {
          const me = await api.getMe();
          setUser(me);
        } catch {
          logout();
        }
      }
    } catch (e) {
      console.error("Auth status check failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, [token]);

  const login = (_username: string, newToken: string, userData: User) => {
    localStorage.setItem("jmo_token", newToken);
    setToken(newToken);
    setUser(userData);
    setNeedsSetup(false);
  };

  const logout = () => {
    localStorage.removeItem("jmo_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, needsSetup, isLoading, login, logout, checkAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
