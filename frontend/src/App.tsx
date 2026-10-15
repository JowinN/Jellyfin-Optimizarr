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
import { X, AlertCircle, CheckCircle, Info, Menu, HardDrive, LayoutDashboard, Film, Sparkles, ListOrdered, Sliders } from "lucide-react";

export const App: React.FC = () => {
  const { token, needsSetup, isLoading } = useAuth();
  const { notifications, dismissNotification, isConnected } = useSSE();

  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [profiles, setProfiles] = useState<EncodingProfile[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Modals state
  const [selectedMediaDetail, setSelectedMediaDetail] = useState<MediaItem | null>(null);
  const [dryRunPlan, setDryRunPlan] = useState<DryRunPlan | null>(null);
  const [dryRunProfileId, setDryRunProfileId] = useState<number>(1);

  const fetchProfiles = async () => {
    if (token) {
      try {
        const data = await api.getProfiles();
        setProfiles(data);
      } catch (e) {
        console.error("Failed to fetch profiles:", e);
      }
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [token]);

  const handleOpenDryRun = async (mediaOrId: MediaItem | number, profileId: number) => {
    const mediaId = typeof mediaOrId === "number" ? mediaOrId : mediaOrId.id;
    try {
      const plan = await api.getDryRun(mediaId, profileId);
      setDryRunPlan(plan);
      setDryRunProfileId(profileId);
    } catch (e: any) {
      alert("Failed to calculate dry run: " + e.message);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--accent-purple-light)", fontWeight: 600 }}>Loading Jellyfin Optimizer...</div>
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "var(--gradient-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 12px rgba(168, 85, 247, 0.4)",
          }}>
            <HardDrive size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.02em" }}>Optimizer</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem" }}>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: isConnected ? "var(--accent-emerald)" : "var(--accent-rose)",
              display: "inline-block",
              boxShadow: isConnected ? "0 0 6px var(--accent-emerald)" : "none",
            }} />
            <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>{isConnected ? "Live" : "Offline"}</span>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ padding: "0.45rem", borderRadius: "8px" }}
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Sidebar / Mobile Drawer Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
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
          <ProfilesPage profiles={profiles} onRefreshProfiles={fetchProfiles} />
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
          <span>Home</span>
        </button>
        <button
          className={`mobile-bottom-tab ${currentTab === "media" ? "active" : ""}`}
          onClick={() => setCurrentTab("media")}
        >
          <Film size={18} />
          <span>Media</span>
        </button>
        <button
          className={`mobile-bottom-tab ${currentTab === "recommendations" ? "active" : ""}`}
          onClick={() => setCurrentTab("recommendations")}
        >
          <Sparkles size={18} />
          <span>Savings</span>
        </button>
        <button
          className={`mobile-bottom-tab ${currentTab === "queue" ? "active" : ""}`}
          onClick={() => setCurrentTab("queue")}
        >
          <ListOrdered size={18} />
          <span>Queue</span>
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
          }}
        />
      )}

      {/* Floating Real-Time Notifications Container */}
      <div className="notifications-container">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="card"
            style={{
              padding: "0.85rem 1rem",
              border: `1px solid ${n.priority === "high" ? "rgba(244, 63, 94, 0.4)" : "rgba(168, 85, 247, 0.4)"}`,
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              background: "rgba(15, 23, 42, 0.95)",
            }}
          >
            <div style={{ display: "flex", gap: "0.6rem" }}>
              {n.priority === "high" ? (
                <AlertCircle size={18} color="var(--accent-rose)" style={{ marginTop: "2px", flexShrink: 0 }} />
              ) : (
                <CheckCircle size={18} color="var(--accent-emerald)" style={{ marginTop: "2px", flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{n.title}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {n.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => dismissNotification(n.id)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginLeft: "0.5rem" }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
