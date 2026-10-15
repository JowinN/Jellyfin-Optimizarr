import React from "react";
import { Play, XCircle, Gauge, Clock, Activity } from "lucide-react";
import { EncodingJob } from "../types";
import { useSSE } from "../context/SSEContext";
import { api } from "../api";

interface ActiveJobsBannerProps {
  activeJob: EncodingJob | null;
  onJobCancelled?: () => void;
}

export const ActiveJobsBanner: React.FC<ActiveJobsBannerProps> = ({ activeJob, onJobCancelled }) => {
  const { liveJobProgress } = useSSE();

  if (!activeJob) return null;

  const live = liveJobProgress[activeJob.id];
  const progressPct = live ? live.progress : activeJob.progress_percent;
  const fps = live ? live.fps : activeJob.current_fps;
  const speed = live ? live.speed : activeJob.current_speed;
  const etaSeconds = live ? live.eta_seconds : activeJob.eta_seconds;

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0) return "Calculating...";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  const handleCancel = async () => {
    if (confirm("Are you sure you want to stop this encode? The original file will remain completely untouched.")) {
      try {
        await api.cancelJob(activeJob.id);
        if (onJobCancelled) onJobCancelled();
      } catch (err: any) {
        alert("Failed to cancel job: " + err.message);
      }
    }
  };

  return (
    <div
      className="card animate-pulse-glow"
      style={{
        marginBottom: "2rem",
        border: "1px solid rgba(168, 85, 247, 0.4)",
        background: "linear-gradient(135deg, rgba(24, 18, 43, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.65rem", marginBottom: "0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0, flex: "1 1 240px" }}>
          <span className="badge badge-purple" style={{ padding: "0.3rem 0.6rem", flexShrink: 0 }}>
            <Activity size={14} /> Stage: {activeJob.stage.toUpperCase()}
          </span>
          <span style={{ fontWeight: 600, fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={activeJob.source_path.split("/").pop()}>
            {activeJob.source_path.split("/").pop()}
          </span>
        </div>
        <button onClick={handleCancel} className="btn btn-danger btn-sm" style={{ flexShrink: 0 }}>
          <XCircle size={15} /> Cancel Encode
        </button>
      </div>

      {/* Progress Bar */}
      <div className="progress-container" style={{ height: "10px", marginBottom: "0.85rem" }}>
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Live Telemetry Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Progress:</span>{" "}
          <strong style={{ color: "var(--accent-purple-light)" }}>{progressPct.toFixed(1)}%</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Gauge size={14} color="var(--accent-cyan)" />
          <span>Speed: <strong style={{ color: "#fff" }}>{speed ? `${speed.toFixed(2)}x` : "1.0x"}</strong></span>
        </div>
        <div>
          <span>Framerate: <strong style={{ color: "#fff" }}>{fps ? `${Math.round(fps)} fps` : "--"}</strong></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Clock size={14} color="var(--accent-amber)" />
          <span>Est. Remaining: <strong style={{ color: "var(--accent-amber)" }}>{formatEta(etaSeconds)}</strong></span>
        </div>
      </div>
    </div>
  );
};
