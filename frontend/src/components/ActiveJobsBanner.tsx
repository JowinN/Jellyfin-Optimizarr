import React from "react";
import { Play, XCircle, Gauge, Clock, Activity, Cpu, HardDrive, Zap } from "lucide-react";
import { EncodingJob } from "../types";
import { useSSE } from "../context/SSEContext";
import { api } from "../api";

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
        if (onJobCancelled) onJobCancelled();
      } catch (err: any) {
        alert("Failed to cancel job: " + err.message);
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
              border: "1px solid rgba(139, 92, 246, 0.4)",
              background:
                "linear-gradient(135deg, rgba(22, 18, 42, 0.92) 0%, rgba(13, 18, 31, 0.95) 100%)",
              boxShadow: "0 8px 30px rgba(139, 92, 246, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  minWidth: 0,
                  flex: "1 1 280px",
                }}
              >
                <span
                  className="badge badge-purple"
                  style={{
                    padding: "0.3rem 0.65rem",
                    flexShrink: 0,
                    fontWeight: 700,
                  }}
                >
                  <Activity size={14} className="spin" /> Job #{job.id} • {job.stage.toUpperCase()}
                </span>

                {job.assigned_node_name && (
                  <span
                    className="badge"
                    style={{
                      background: isGpu ? "rgba(16, 185, 129, 0.15)" : "rgba(6, 182, 212, 0.15)",
                      color: isGpu ? "#34d399" : "#38bdf8",
                      border: `1px solid ${isGpu ? "rgba(16, 185, 129, 0.3)" : "rgba(6, 182, 212, 0.3)"}`,
                      fontSize: "0.7rem",
                    }}
                  >
                    {isGpu ? <Zap size={12} /> : <Cpu size={12} />}
                    {job.assigned_node_name}
                  </span>
                )}

                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.94rem",
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
              >
                <XCircle size={15} /> Cancel Encode
              </button>
            </div>

            {/* Shimmer Progress Bar */}
            <div className="progress-container" style={{ height: "10px", marginBottom: "0.85rem" }}>
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>

            {/* Live Telemetry Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.85rem",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                paddingTop: "0.2rem",
              }}
            >
              <div>
                <span style={{ color: "var(--text-muted)" }}>Progress: </span>
                <strong style={{ color: "var(--accent-purple-light)", fontSize: "0.9rem" }}>
                  {progressPct.toFixed(1)}%
                </strong>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Gauge size={14} color="var(--accent-cyan)" />
                <span>
                  Speed:{" "}
                  <strong style={{ color: "#fff" }}>
                    {speed ? `${speed.toFixed(2)}x` : "1.0x"}
                  </strong>
                </span>
              </div>

              <div>
                <span>
                  Framerate:{" "}
                  <strong style={{ color: "#fff" }}>
                    {fps ? `${Math.round(fps)} fps` : "--"}
                  </strong>
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Clock size={14} color="var(--accent-amber)" />
                <span>
                  ETA:{" "}
                  <strong style={{ color: "var(--accent-amber)" }}>
                    {formatEta(etaSeconds)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
