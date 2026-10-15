import React, { useState } from "react";
import { HardDrive, Server, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export const SetupWizard: React.FC = () => {
  const { login } = useAuth();
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [jellyfinUrl, setJellyfinUrl] = useState("http://jellyfin:8096");
  const [jellyfinApiKey, setJellyfinApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminPassword.length < 8) {
      setError("Admin password must be at least 8 characters long.");
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.setup({
        admin_username: adminUsername,
        admin_password: adminPassword,
        jellyfin_url: jellyfinUrl,
        jellyfin_api_key: jellyfinApiKey,
      });

      login(res.username, res.access_token, {
        id: 1,
        username: res.username,
        is_admin: true,
      });
    } catch (err: any) {
      setError(err.message || "Setup failed. Check backend connectivity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem" }}>
      <div className="card" style={{ maxWidth: "540px", width: "100%", padding: "clamp(1.5rem, 5vw, 2.5rem)" }}>
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
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>Welcome to Jellyfin Optimizer</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            First-Run Deployment Setup Wizard
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
          {/* Admin Account */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem", color: "var(--accent-purple-light)" }}>
              <Shield size={16} /> Administrator Account
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                  Username
                </label>
                <input
                  type="text"
                  className="input"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                />
              </div>
              <div className="grid-two-col" style={{ gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                    Password
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Jellyfin Connection */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem", color: "var(--accent-cyan)" }}>
              <Server size={16} /> Jellyfin Connection
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                  Jellyfin URL (Docker network)
                </label>
                <input
                  type="text"
                  className="input"
                  value={jellyfinUrl}
                  onChange={(e) => setJellyfinUrl(e.target.value)}
                  placeholder="http://jellyfin:8096"
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                  API Key (Generate in Jellyfin Dashboard &rarr; Advanced &rarr; API Keys)
                </label>
                <input
                  type="password"
                  className="input"
                  value={jellyfinApiKey}
                  onChange={(e) => setJellyfinApiKey(e.target.value)}
                  placeholder="Optional (can be configured later)"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.75rem" }}
          >
            {isSubmitting ? "Initializing..." : "Complete Setup & Launch Dashboard"} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
