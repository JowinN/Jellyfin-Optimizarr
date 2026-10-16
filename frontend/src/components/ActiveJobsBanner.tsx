import React from "react";
import { Play, XCircle, Gauge, Clock, Activity, Cpu, HardDrive, Zap } from "lucide-react";
import { EncodingJob } from "../types";
import { useSSE } from "../context/SSEContext";
import { api } from "../api";
import { useToast } from "../context/ToastContext";

interface ActiveJobsBannerProps {
  activeJobs?: EncodingJob[];
  activeJob?: EncodingJob | null;
  onJobCancelled?: () => void;
}

export const ActiveJobsBanner: React.FC<ActiveJobsBannerProps> = ({
  activeJobs,
  activeJob,
  onJobCancelled,
}) => {
  const { toast } = useToast();
  const { liveJobProgress } = useSSE();

  // Normalize to an array of jobs
  const jobsToRender: EncodingJob[] = activeJobs && activeJobs.length > 0
    ? activeJobs
    : activeJob
    ? [activeJob]
    : [];

  if (jobsToRender.length === 0) return null;

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0) return "Calculating...";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${s}s`;
  };

  const handleCancel = async (job: EncodingJob) => {
    if (
      confirm(
        `Are you sure you want to stop encoding Job #${job.id}? The original file remains completely untouched.`
      )
    ) {
      try {
        await api.cancelJob(job.id);
        toast.info(`Cancelled encoding Job #${job.id}`);
        if (onJobCancelled) onJobCancelled();
      } catch (err: any) {
        toast.error("Failed to cancel job: " + err.message);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
      {jobsToRender.map((job) => {
        const live = liveJobProgress[job.id];
        const progressPct = live ? live.progress : job.progress_percent;
        const fps = live ? live.fps : job.current_fps;
        const speed = live ? live.speed : job.current_speed;
        const etaSeconds = live ? live.eta_seconds : job.eta_seconds;
        const filename = job.source_path.split("/").pop() || "Media File";

        const isGpu =
          job.encoder_used?.includes("nvenc") ||
          job.encoder_used?.includes("qsv") ||
          job.encoder_used?.includes("vaapi") ||
          job.assigned_node_id === "windows-node";

        return (
          <div
            key={job.id}
            className="card animate-pulse-glow"
            style={{
              border: "1px solid var(--border-highlight)",
              background: "var(--surface-container)",
              boxShadow: "var(--shadow-floating)",
              marginBottom: "0.5rem",
            }}
          >
            {/* Top Bar: Badges, Filename & Cancel Action */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  minWidth: 0,
                  flex: "1 1 300px",
                }}
              >
                <span
                  className="badge badge-purple"
                  style={{
                    padding: "0.35rem 0.75rem",
                    flexShrink: 0,
                    fontWeight: 700,
                    fontSize: "0.78rem",
                  }}
                >
                  <Activity size={14} className="spin" /> Job #{job.id} • {job.stage.toUpperCase()}
                </span>

                {job.assigned_node_name && (
                  <span
                    className="badge"
                    style={{
                      background: isGpu ? "rgba(16, 185, 129, 0.15)" : "rgba(6, 182, 212, 0.15)",
                      color: isGpu ? "var(--accent-emerald)" : "var(--accent-cyan)",
                      border: `1px solid ${isGpu ? "rgba(16, 185, 129, 0.3)" : "rgba(6, 182, 212, 0.3)"}`,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                    }}
                  >
                    {isGpu ? <Zap size={12} /> : <Cpu size={12} />}
                    {job.assigned_node_name}
                  </span>
                )}

                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.98rem",
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={filename}
                >
                  {filename}
                </span>
              </div>

              <button
                onClick={() => handleCancel(job)}
                className="btn btn-danger btn-sm"
                style={{ flexShrink: 0 }}
                title="Safely stop encoding; media file remains untouched"
              >
                <XCircle size={15} /> Cancel Encode
              </button>
            </div>

            {/* High-Visibility Progress Bar Block */}
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.45rem",
                  fontSize: "0.84rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-secondary)" }}>
                  <div className="pulse-radar" style={{ width: "8px", height: "8px" }}>
                    <span className="pulse-radar-dot" style={{ background: "var(--accent-emerald)" }} />
                    <span className="pulse-radar-ring" style={{ borderColor: "var(--accent-emerald)" }} />
                  </div>
                  <span style={{ fontWeight: 600 }}>Active Transcode Progress</span>
                </div>
                <strong style={{ fontSize: "1.05rem", color: "var(--primary-light)", letterSpacing: "-0.01em" }}>
                  {progressPct.toFixed(1)}%
                </strong>
              </div>

              <div className="progress-container" style={{ height: "12px" }}>
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0.5, progressPct))}%` }}
                />
              </div>
            </div>

            {/* Live Telemetry Metric Tiles */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.75rem",
                fontSize: "0.82rem",
              }}
            >
              <div
                style={{
                  background: "var(--surface-container-high)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.55rem 0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Gauge size={16} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Speed</div>
                  <strong style={{ color: "var(--text-primary)", fontSize: "0.92rem" }}>
                    {speed ? `${speed.toFixed(2)}x` : "1.0x"}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface-container-high)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.55rem 0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Cpu size={16} color="var(--primary-light)" />
                <div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Framerate</div>
                  <strong style={{ color: "var(--text-primary)", fontSize: "0.92rem" }}>
                    {fps ? `${Math.round(fps)} fps` : "--"}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface-container-high)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.55rem 0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Clock size={16} color="var(--accent-amber)" />
                <div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>ETA Remaining</div>
                  <strong style={{ color: "var(--accent-amber)", fontSize: "0.92rem" }}>
                    {formatEta(etaSeconds)}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface-container-high)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.55rem 0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <HardDrive size={16} color="var(--accent-emerald)" />
                <div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Source Size</div>
                  <strong style={{ color: "var(--text-primary)", fontSize: "0.92rem" }}>
                    {job.source_size_bytes ? `${(job.source_size_bytes / (1024 * 1024)).toFixed(1)} MB` : "--"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
