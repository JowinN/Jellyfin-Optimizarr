import React from "react";
import {
  LayoutDashboard,
  Film,
  ListOrdered,
  Sparkles,
  Sliders,
  History,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Radio,
  HardDrive,
  CalendarClock,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSSE } from "../context/SSEContext";

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const { isConnected, scanProgress } = useSSE();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "media", label: "Media Browser", icon: Film },
    { id: "recommendations", label: "Smart Savings", icon: Sparkles },
    { id: "queue", label: "Queue", icon: ListOrdered },
    { id: "automation", label: "Automation", icon: CalendarClock },
    { id: "profiles", label: "Profiles", icon: Sliders },
    { id: "rollback", label: "Rollback & Backups", icon: History },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "var(--gradient-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(168, 85, 247, 0.4)",
              flexShrink: 0,
            }}>
              <HardDrive size={20} color="#fff" />
            </div>
            <div className="logo-text">
              <div style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em" }}>Jellyfin Optimizer</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>v1.0 Production</div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm mobile-only"
              style={{ padding: "0.4rem", borderRadius: "8px" }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

      {/* SSE Connection & Scan Pill */}
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: isConnected ? "var(--accent-emerald)" : "var(--accent-rose)",
            display: "inline-block",
            boxShadow: isConnected ? "0 0 8px var(--accent-emerald)" : "none",
          }} />
          <span style={{ color: "var(--text-secondary)" }}>{isConnected ? "Live Sync" : "Connecting"}</span>
        </div>
        {scanProgress.is_scanning && (
          <span className="badge badge-purple" style={{ fontSize: "0.65rem" }}>
            Scanning...
          </span>
        )}
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onClose?.();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.65rem 0.85rem",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: isActive ? "rgba(168, 85, 247, 0.15)" : "transparent",
                color: isActive ? "#c084fc" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                borderLeft: isActive ? "3px solid #a855f7" : "3px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon size={18} />
              <span className="nav-text">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="logo-text" style={{ overflow: "hidden" }}>
          <div style={{ fontSize: "0.825rem", fontWeight: 600 }}>{user?.username || "Admin"}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Server Operator</div>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="btn btn-secondary btn-sm"
          style={{ padding: "0.4rem" }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
    </>
  );
};
