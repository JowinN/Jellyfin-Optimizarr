import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { useSSE } from "./context/SSEContext";
import { Navbar } from "./components/Navbar";
import { Dashboard } from "./pages/Dashboard";
import { MediaBrowser } from "./pages/MediaBrowser";
import { Recommendations } from "./pages/Recommendations";
import { QueuePage } from "./pages/QueuePage";
import { AutomationPage } from "./pages/AutomationPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { RollbackPage } from "./pages/RollbackPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupWizard } from "./pages/SetupWizard";
import { Login } from "./pages/Login";
import { MediaDetailModal } from "./components/MediaDetailModal";
import { DryRunModal } from "./components/DryRunModal";
import { MediaItem, EncodingProfile, DryRunPlan } from "./types";
import { api } from "./api";
import { useToast } from "./context/ToastContext";
import {
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Menu,
  Zap,
  LayoutDashboard,
  Film,
  Sparkles,
  ListOrdered,
  CalendarClock,
} from "lucide-react";

export const App: React.FC = () => {
  const { toast } = useToast();
  const { token, needsSetup, isLoading } = useAuth();
  const { notifications, dismissNotification, isConnected } = useSSE();

  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [profiles, setProfiles] = useState<EncodingProfile[]>([]);
  const [activeQueueCount, setActiveQueueCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Modals state
  const [selectedMediaDetail, setSelectedMediaDetail] = useState<MediaItem | null>(null);
  const [dryRunPlan, setDryRunPlan] = useState<DryRunPlan | null>(null);
  const [dryRunProfileId, setDryRunProfileId] = useState<number>(1);

  const fetchAppData = async () => {
    if (token) {
      try {
        const [profData, runningJobs, pendingJobs] = await Promise.all([
          api.getProfiles(),
          api.getQueueJobs("running").catch(() => []),
          api.getQueueJobs("pending").catch(() => []),
        ]);
        setProfiles(profData);
        setActiveQueueCount(runningJobs.length + pendingJobs.length);
      } catch (e) {
        console.error("Failed to fetch app data:", e);
      }
    }
  };

  useEffect(() => {
    fetchAppData();
    const interval = setInterval(fetchAppData, 12000);
    return () => clearInterval(interval);
  }, [token]);

  const handleOpenDryRun = async (mediaOrId: MediaItem | number, profileId: number) => {
    const mediaId = typeof mediaOrId === "number" ? mediaOrId : mediaOrId.id;
    try {
      const plan = await api.getDryRun(mediaId, profileId);
      setDryRunPlan(plan);
      setDryRunProfileId(profileId);
    } catch (e: any) {
      toast.error("Failed to calculate dry run: " + e.message);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "var(--gradient-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 25px rgba(139, 92, 246, 0.5)",
            animation: "pulseGlow 2s infinite ease-in-out",
          }}>
            <Zap size={24} color="#fff" />
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: 500 }}>
            Initializing Jellyfin Optimizarr...
          </div>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupWizard />;
  }

  if (!token) {
    return <Login />;
  }

  return (
    <div className="app-container">
      {/* Mobile Top App Header */}
      <header className="mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "var(--gradient-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 12px rgba(139, 92, 246, 0.4)",
            }}
          >
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.98rem", letterSpacing: "-0.02em", color: "#fff" }}>
              Optimizarr
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="pulse-radar">
              <span
                className="pulse-radar-dot"
                style={{
                  width: "7px",
                  height: "7px",
                  backgroundColor: isConnected ? "var(--accent-emerald)" : "var(--accent-rose)",
                }}
              />
              {isConnected && <span className="pulse-radar-ring" />}
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="btn btn-secondary btn-icon"
            style={{ borderRadius: "8px", padding: "0.45rem" }}
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeQueueCount={activeQueueCount}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {currentTab === "dashboard" && (
          <Dashboard
            onNavigate={setCurrentTab}
            onOpenMediaDetail={setSelectedMediaDetail}
          />
        )}
        {currentTab === "media" && (
          <MediaBrowser
            profiles={profiles}
            onOpenDetail={setSelectedMediaDetail}
            onOpenDryRun={(media, profId) => handleOpenDryRun(media, profId)}
          />
        )}
        {currentTab === "recommendations" && (
          <Recommendations
            profiles={profiles}
            onOpenDryRun={(id, profId) => handleOpenDryRun(id, profId)}
            onNavigateToQueue={() => setCurrentTab("queue")}
          />
        )}
        {currentTab === "queue" && <QueuePage />}
        {currentTab === "automation" && (
          <AutomationPage
            profiles={profiles}
            onNavigateToQueue={() => setCurrentTab("queue")}
          />
        )}
        {currentTab === "profiles" && (
          <ProfilesPage profiles={profiles} onRefreshProfiles={fetchAppData} />
        )}
        {currentTab === "rollback" && <RollbackPage />}
        {currentTab === "analytics" && <AnalyticsPage />}
        {currentTab === "settings" && <SettingsPage />}
      </main>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-bottom-tab ${currentTab === "dashboard" ? "active" : ""}`}
          onClick={() => setCurrentTab("dashboard")}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>
        <button
          className={`mobile-bottom-tab ${currentTab === "queue" ? "active" : ""}`}
          onClick={() => setCurrentTab("queue")}
        >
          <ListOrdered size={18} />
          <span>Queue</span>
        </button>
        <button
          className={`mobile-bottom-tab ${currentTab === "media" ? "active" : ""}`}
          onClick={() => setCurrentTab("media")}
        >
          <Film size={18} />
          <span>Library</span>
        </button>
        <button
          className={`mobile-bottom-tab ${currentTab === "automation" ? "active" : ""}`}
          onClick={() => setCurrentTab("automation")}
        >
          <CalendarClock size={18} />
          <span>Auto</span>
        </button>
        <button
          className="mobile-bottom-tab"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu size={18} />
          <span>More</span>
        </button>
      </nav>

      {/* Media Inspection Detail Modal */}
      {selectedMediaDetail && (
        <MediaDetailModal
          media={selectedMediaDetail}
          profiles={profiles}
          onClose={() => setSelectedMediaDetail(null)}
          onDryRunRequested={(media, profId) => {
            setSelectedMediaDetail(null);
            handleOpenDryRun(media, profId);
          }}
          onJobEnqueued={() => {
            setCurrentTab("queue");
            fetchAppData();
          }}
        />
      )}

      {/* Dry Run Simulation Modal */}
      {dryRunPlan && (
        <DryRunModal
          plan={dryRunPlan}
          profileId={dryRunProfileId}
          onClose={() => setDryRunPlan(null)}
          onJobEnqueued={() => {
            setCurrentTab("queue");
            fetchAppData();
          }}
        />
      )}

      {/* Floating Notifications Stack */}
      <div className="notifications-container">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="card"
            style={{
              padding: "0.95rem 1.15rem",
              border: `1px solid ${
                n.priority === "high"
                  ? "rgba(244, 63, 94, 0.45)"
                  : "rgba(139, 92, 246, 0.4)"
              }`,
              boxShadow: "0 14px 35px rgba(0, 0, 0, 0.65)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              background: "rgba(13, 18, 31, 0.95)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ display: "flex", gap: "0.75rem", minWidth: 0, flex: 1 }}>
              {n.priority === "high" ? (
                <AlertCircle
                  size={19}
                  color="var(--accent-rose)"
                  style={{ marginTop: "2px", flexShrink: 0 }}
                />
              ) : (
                <CheckCircle
                  size={19}
                  color="var(--accent-emerald)"
                  style={{ marginTop: "2px", flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)" }}>
                  {n.title}
                </div>
                <div
                  style={{
                    fontSize: "0.76rem",
                    color: "var(--text-secondary)",
                    marginTop: "2px",
                    lineHeight: 1.35,
                  }}
                >
                  {n.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => dismissNotification(n.id)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "0.2rem",
                marginLeft: "0.5rem",
              }}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
