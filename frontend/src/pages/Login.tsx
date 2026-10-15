import React, { useState } from "react";
import { HardDrive, Lock, User, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsSubmitting(true);
      const res = await api.login({ username, password });
      login(res.username, res.access_token, {
        id: 1,
        username: res.username,
        is_admin: res.is_admin,
      });
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem" }}>
      <div className="card" style={{ maxWidth: "420px", width: "100%", padding: "clamp(1.5rem, 5vw, 2.5rem)" }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "var(--gradient-brand)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 25px rgba(168, 85, 247, 0.4)",
            marginBottom: "1rem",
          }}>
            <HardDrive size={30} color="#fff" />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Jellyfin Optimizer</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Sign in to manage media compression
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(244, 63, 94, 0.15)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem",
            color: "#f87171",
            fontSize: "0.85rem",
            marginBottom: "1.5rem",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Username
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                style={{ paddingLeft: "2.25rem" }}
                required
              />
              <User size={16} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </div>

          <div style={{ marginBottom: "1.75rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{ paddingLeft: "2.25rem" }}
                required
              />
              <Lock size={16} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.75rem" }}
          >
            {isSubmitting ? "Authenticating..." : "Sign In"} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
