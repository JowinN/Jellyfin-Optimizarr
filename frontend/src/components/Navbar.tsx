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
  HardDrive,
  CalendarClock,
  X,
  Radio,
  Server,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSSE } from "../context/SSEContext";

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  activeQueueCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  isOpen = false,
  onClose,
  activeQueueCount = 0,
}) => {
  const { user, logout } = useAuth();
  const { isConnected, scanProgress } = useSSE();

  const navSections = [
    {
      title: "OPERATIONS",
      items: [
        { id: "dashboard", label: "Overview", icon: LayoutDashboard },
        {
          id: "queue",
          label: "Queue & Fleet",
          icon: ListOrdered,
          badge: activeQueueCount > 0 ? activeQueueCount : undefined,
        },
      ],
    },
    {
      title: "MEDIA INTELLIGENCE",
      items: [
        { id: "media", label: "Media Library", icon: Film },
        { id: "recommendations", label: "Smart Savings", icon: Sparkles },
      ],
    },
    {
      title: "AUTOMATION & CODECS",
      items: [
        { id: "automation", label: "Automation Rules", icon: CalendarClock },
        { id: "profiles", label: "Encoding Presets", icon: Sliders },
        { id: "rollback", label: "Backups & Safety", icon: History },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        { id: "analytics", label: "Analytics", icon: BarChart3 },
        { id: "settings", label: "Settings", icon: SettingsIcon },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div
          style={{
            padding: "1.25rem 1.35rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "var(--gradient-brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 16px rgba(139, 92, 246, 0.45)",
                flexShrink: 0,
              }}
            >
              <Zap size={20} color="#fff" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1.02rem",
                  letterSpacing: "-0.025em",
                  color: "#fff",
                  lineHeight: 1.2,
                }}
              >
                Optimizarr
              </div>
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                }}
              >
                Media Engine v1.0
              </div>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary btn-icon mobile-only"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Live Cluster Sync Status Pill */}
        <div
          style={{
            padding: "0.65rem 1.25rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.74rem",
            background: "rgba(15, 23, 42, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <span className="pulse-radar">
              <span
                className="pulse-radar-dot"
                style={{
                  backgroundColor: isConnected ? "var(--accent-emerald)" : "var(--accent-rose)",
                }}
              />
              {isConnected && <span className="pulse-radar-ring" />}
            </span>
            <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
              {isConnected ? "Cluster Connected" : "Connecting..."}
            </span>
          </div>

          {scanProgress.is_scanning ? (
            <span
              className="badge badge-purple"
              style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem" }}
            >
              Scanning...
            </span>
          ) : (
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Ready</span>
          )}
        </div>

        {/* Grouped Navigation Links */}
        <nav className="sidebar-nav-container">
          {navSections.map((sec) => (
            <div key={sec.title} style={{ marginBottom: "0.4rem" }}>
              <div className="nav-section-title">{sec.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose?.();
                      }}
                      className={`nav-link-btn ${isActive ? "active" : ""}`}
                    >
                      <div className="nav-link-content">
                        <Icon
                          size={18}
                          color={isActive ? "var(--accent-purple-light)" : "var(--text-secondary)"}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="nav-badge-pill">{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Operator Footer */}
        <div
          style={{
            padding: "0.95rem 1.25rem",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(10, 15, 26, 0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.82rem",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {(user?.username || "A").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.username || "Admin"}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                Server Operator
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="btn btn-secondary btn-icon"
            style={{ borderRadius: "8px" }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
};
