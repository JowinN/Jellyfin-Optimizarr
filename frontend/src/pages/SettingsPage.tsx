import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Server,
  Cpu,
  HardDrive,
  Bell,
  Save,
  CheckCircle,
  XCircle,
  Download,
  AlertTriangle,
  Palette,
  Sliders,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { ServerSettings } from "../types";
import { api } from "../api";
import { AppearanceSettings } from "../components/AppearanceSettings";
import { useToast } from "../context/ToastContext";

export const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "diagnostics">("general");
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [hwDiag, setHwDiag] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [jellyfinApiKey, setJellyfinApiKey] = useState("");
  const [minFreeSpaceGb, setMinFreeSpaceGb] = useState(15);
  const [maxConcurrentEncodes, setMaxConcurrentEncodes] = useState(1);
  const [ffmpegThreads, setFfmpegThreads] = useState(0);
  const [hwaccelMode, setHwaccelMode] = useState("auto");
  const [hwaccelFallbackCpu, setHwaccelFallbackCpu] = useState(true);
  const [ntfyEnabled, setNtfyEnabled] = useState(false);
  const [ntfyTopic, setNtfyTopic] = useState("");

  // Jellyfin Test State
  const [testingJellyfin, setTestingJellyfin] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchSettingsData = async () => {
    try {
      setIsLoading(true);
      const [s, h] = await Promise.all([
        api.getSettings(),
        api.getHardwareDiagnostics(),
      ]);
      setSettings(s);
      setHwDiag(h);

      setJellyfinUrl(s.jellyfin_url);
      setMinFreeSpaceGb(s.min_free_space_gb);
      setMaxConcurrentEncodes(s.max_concurrent_encodes);
      setFfmpegThreads(s.ffmpeg_threads);
      setHwaccelMode(s.hwaccel_mode);
      setHwaccelFallbackCpu(s.hwaccel_fallback_cpu);
      setNtfyEnabled(s.ntfy_enabled);
      setNtfyTopic(s.ntfy_topic || "");
    } catch (e) {
      console.error("Error fetching settings:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const handleTestJellyfin = async () => {
    try {
      setTestingJellyfin(true);
      setTestResult(null);
      const res = await api.testJellyfin({
        url: jellyfinUrl,
        api_key: jellyfinApiKey,
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, error_message: e.message });
    } finally {
      setTestingJellyfin(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await api.updateSettings({
        jellyfin_url: jellyfinUrl,
        jellyfin_api_key: jellyfinApiKey || undefined,
        min_free_space_gb: Number(minFreeSpaceGb),
        max_concurrent_encodes: Number(maxConcurrentEncodes),
        ffmpeg_threads: Number(ffmpegThreads),
        hwaccel_mode: hwaccelMode,
        hwaccel_fallback_cpu: hwaccelFallbackCpu,
        ntfy_enabled: ntfyEnabled,
        ntfy_topic: ntfyTopic,
      });
      setSettings(updated);
      toast.success("Settings successfully saved!");
    } catch (e: any) {
      toast.error("Error saving settings: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const diag = await api.getDiagnostics();
      const blob = new Blob([JSON.stringify(diag, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jellyfin_optimizer_diagnostics.json";
      a.click();
      toast.success("Diagnostic bundle downloaded");
    } catch (e: any) {
      toast.error("Error downloading diagnostics: " + e.message);
    }
  };

  return (
    <div>
      {/* Responsive Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & System Configuration</h1>
          <p className="page-subtitle">
            Configure Jellyfin connectivity, Material Design 3 visual appearance, hardware acceleration, and disk safety rules
          </p>
        </div>
        <div className="page-actions">
          <button onClick={handleExportDiagnostics} className="btn btn-secondary btn-sm">
            <Download size={16} /> Export Diagnostic Bundle
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="segmented-tabs" style={{ marginBottom: "1.75rem" }}>
        <button
          type="button"
          className={`segmented-tab ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          <Sliders size={15} /> General & Storage
        </button>
        <button
          type="button"
          className={`segmented-tab ${activeTab === "appearance" ? "active" : ""}`}
          onClick={() => setActiveTab("appearance")}
        >
          <Palette size={15} /> Appearance & Themes
        </button>
        <button
          type="button"
          className={`segmented-tab ${activeTab === "diagnostics" ? "active" : ""}`}
          onClick={() => setActiveTab("diagnostics")}
        >
          <Cpu size={15} /> Hardware & Diagnostics
        </button>
      </div>

      {/* TAB 1: APPEARANCE SETTINGS */}
      {activeTab === "appearance" && <AppearanceSettings />}

      {/* TAB 2: GENERAL SETTINGS */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveSettings}>
          {/* Jellyfin Server Connection */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Server size={18} color="var(--primary)" /> Jellyfin Server Connection
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Connected over internal network (<code>http://jellyfin:8096</code>). Used for metadata scanning and library refresh.
            </p>

            <div className="grid-two-col" style={{ marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Jellyfin Internal URL
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
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Jellyfin API Key
                </label>
                <input
                  type="password"
                  className="input"
                  value={jellyfinApiKey}
                  onChange={(e) => setJellyfinApiKey(e.target.value)}
                  placeholder={settings?.jellyfin_api_key_set ? "•••••••••••••••• (API Key Set)" : "Enter Jellyfin API Key"}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleTestJellyfin}
                disabled={testingJellyfin || !jellyfinUrl}
                className="btn btn-secondary btn-sm"
              >
                {testingJellyfin ? "Validating..." : "Test Connection"}
              </button>

              {testResult && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
                  {testResult.success ? (
                    <>
                      <CheckCircle size={16} color="var(--accent-emerald)" />
                      <span style={{ color: "var(--accent-emerald)" }}>
                        Connected to {testResult.server_name || "Jellyfin Server"} (v{testResult.version})
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} color="var(--accent-rose)" />
                      <span style={{ color: "var(--accent-rose)" }}>
                        Connection failed: {testResult.error_message || "Server unreachable"}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Worker & Storage Safety */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <HardDrive size={18} color="var(--accent-emerald)" /> Worker & Storage Constraints
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Guardrails to ensure encoding never starves disk space or freezes host system responsiveness.
            </p>

            <div className="grid-two-col">
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Max Concurrent Encodes (Host CPU/GPU)
                </label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  className="input"
                  value={maxConcurrentEncodes}
                  onChange={(e) => setMaxConcurrentEncodes(Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Minimum Free Storage Floor (GB)
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  className="input"
                  value={minFreeSpaceGb}
                  onChange={(e) => setMinFreeSpaceGb(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Bell size={18} color="var(--accent-amber)" /> Mobile & Desktop Notifications (ntfy.sh)
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Optional real-time alerts when large transcode jobs finish or disk space warnings trigger.
            </p>

            <div className="grid-two-col">
              <div style={{ display: "flex", alignItems: "center", paddingTop: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={ntfyEnabled}
                    onChange={(e) => setNtfyEnabled(e.target.checked)}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  Enable ntfy Push Notifications
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  ntfy Topic
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="my_jellyfin_optimizer_alerts"
                  value={ntfyTopic}
                  onChange={(e) => setNtfyTopic(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ width: "min(100%, 220px)", minHeight: "42px" }}>
              <Save size={16} /> {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: DIAGNOSTICS */}
      {activeTab === "diagnostics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Cpu size={18} color="var(--primary)" /> Host Hardware Acceleration Diagnostics
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Direct Rendering Infrastructure (/dev/dri) device verification and FFmpeg hardware encoder capabilities.
            </p>

            <div className="grid-two-col" style={{ marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Hardware Acceleration Mode
                </label>
                <select className="select" value={hwaccelMode} onChange={(e) => setHwaccelMode(e.target.value)}>
                  <option value="auto">Auto-Select Best Available</option>
                  <option value="vaapi">Force VAAPI (/dev/dri)</option>
                  <option value="qsv">Force Intel Quick Sync</option>
                  <option value="cpu">Force High-Performance CPU (libx265 / SVT-AV1)</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", paddingTop: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={hwaccelFallbackCpu}
                    onChange={(e) => setHwaccelFallbackCpu(e.target.checked)}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  Fallback to CPU if Hardware Encoder Fails
                </label>
              </div>
            </div>

            {/* Hardware Telemetry Summary */}
            {hwDiag && (
              <div style={{ background: "var(--bg-secondary)", padding: "1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", fontSize: "0.82rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>DRI Device Node:</span>{" "}
                    <strong>{hwDiag.dri_device_present ? "Present (/dev/dri)" : "Not Mapped"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>VAAPI Support:</span>{" "}
                    <strong style={{ color: hwDiag.vaapi_supported ? "var(--accent-emerald)" : "var(--accent-amber)" }}>
                      {hwDiag.vaapi_supported ? "Active & Functional" : "Unavailable"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Intel QSV:</span>{" "}
                    <strong style={{ color: hwDiag.qsv_supported ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                      {hwDiag.qsv_supported ? "Supported" : "Unavailable"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Active Encoder:</span>{" "}
                    <strong style={{ color: "var(--primary)" }}>{hwDiag.recommended_encoder}</strong>
                  </div>
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                  <strong>Detected Video Encoders:</strong> {hwDiag.available_video_encoders?.join(", ") || "None"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
