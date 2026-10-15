import React, { useState, useEffect } from "react";
import {
  ListOrdered,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  XCircle,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { EncodingJob } from "../types";
import { useSSE } from "../context/SSEContext";
import { api } from "../api";

export const QueuePage: React.FC = () => {
  const [jobs, setJobs] = useState<EncodingJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const { liveJobProgress } = useSSE();

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const data = await api.getQueueJobs(statusFilter || undefined);
      setJobs(data);
    } catch (e) {
      console.error("Error fetching queue jobs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 6000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handlePauseResume = async () => {
    try {
      if (isQueuePaused) {
        await api.resumeQueue();
        setIsQueuePaused(false);
      } else {
        await api.pauseQueue();
        setIsQueuePaused(true);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleCancel = async (jobId: number) => {
    if (confirm("Cancel this encoding job? The original file will not be affected.")) {
      try {
        await api.cancelJob(jobId);
        fetchJobs();
      } catch (e: any) {
        alert("Failed to cancel: " + e.message);
      }
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      await api.retryJob(jobId);
      fetchJobs();
    } catch (e: any) {
      alert("Failed to retry: " + e.message);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await api.clearCompleted();
      fetchJobs();
    } catch (e: any) {
      alert("Failed to clear completed: " + e.message);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (confirm("Remove this job from the queue?")) {
      try {
        await api.deleteJob(jobId);
        fetchJobs();
      } catch (e: any) {
        alert("Failed to remove job: " + e.message);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear ALL jobs from the queue? Any running encode will be stopped and items reset.")) {
      try {
        await api.clearAllJobs();
        fetchJobs();
      } catch (e: any) {
        alert("Failed to clear queue: " + e.message);
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Responsive Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Queue Management</h1>
          <p className="page-subtitle">
            Persistent background processing with process isolation and live telemetry
          </p>
        </div>

        <div className="page-actions">
          <button onClick={handlePauseResume} className="btn btn-secondary btn-sm">
            {isQueuePaused ? <Play size={16} /> : <Pause size={16} />}
            {isQueuePaused ? "Resume Queue" : "Pause Queue"}
          </button>
          <button onClick={handleClearCompleted} className="btn btn-secondary btn-sm" title="Clear completed, failed and cancelled jobs">
            <Trash2 size={16} /> Clear History
          </button>
          {jobs.length > 0 && (
            <button onClick={handleClearAll} className="btn btn-danger btn-sm" title="Clear all jobs and reset queue">
              <XCircle size={16} /> Clear All
            </button>
          )}
          <button onClick={fetchJobs} disabled={isLoading} className="btn btn-secondary btn-sm" title="Refresh">
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs (Horizontal Swipeable on Mobile) */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {[
          { id: "", label: "All Jobs" },
          { id: "running", label: "Running" },
          { id: "pending", label: "Pending" },
          { id: "completed", label: "Completed" },
          { id: "failed", label: "Failed" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`btn btn-sm ${statusFilter === tab.id ? "btn-primary" : "btn-secondary"}`}
            style={{ flexShrink: 0 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Table (Desktop View) */}
      <div className="table-wrapper desktop-only">
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Status & Stage</th>
              <th>Source Media File</th>
              <th>Progress / Telemetry</th>
              <th>Source Size</th>
              <th>Output / Savings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  Queue is empty. Select files from Media Browser or Smart Recommendations to optimize.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const live = liveJobProgress[job.id];
                const pct = live ? live.progress : job.progress_percent;
                const speed = live ? live.speed : job.current_speed;
                const isRunning = job.status === "running";

                return (
                  <tr key={job.id}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        #{job.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <span
                          className={`badge ${
                            job.status === "completed"
                              ? "badge-emerald"
                              : job.status === "running"
                              ? "badge-cyan"
                              : job.status === "failed"
                              ? "badge-rose"
                              : "badge-purple"
                          }`}
                        >
                          {job.status}
                        </span>
                        <span style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                          {job.stage}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.source_path.split("/").pop()}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexWrap: "wrap" }}>
                        <span>Mode: {job.replacement_mode}</span>
                        {job.assigned_node_name && (
                          <span
                            className="badge"
                            style={{
                              fontSize: "0.65rem",
                              padding: "1px 6px",
                              background: job.assigned_node_id === "local" ? "rgba(56, 189, 248, 0.15)" : "rgba(168, 85, 247, 0.15)",
                              color: job.assigned_node_id === "local" ? "#38bdf8" : "#c084fc",
                            }}
                          >
                            {job.assigned_node_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {isRunning ? (
                        <div style={{ width: "180px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                            <span>{pct.toFixed(1)}%</span>
                            <span>{speed ? `${speed.toFixed(2)}x` : ""}</span>
                          </div>
                          <div className="progress-container" style={{ height: "6px" }}>
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ) : job.status === "completed" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--accent-emerald)", fontSize: "0.85rem" }}>
                          <CheckCircle size={15} /> 100% Validated
                        </div>
                      ) : job.status === "failed" ? (
                        <div style={{ color: "var(--accent-rose)", fontSize: "0.75rem", maxWidth: "200px" }} title={job.error_message || ""}>
                          <AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} />
                          {job.error_message?.slice(0, 50)}...
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Pending</span>
                      )}
                    </td>
                    <td>{formatBytes(job.source_size_bytes)}</td>
                    <td>
                      {job.status === "completed" ? (
                        <div>
                          <strong>{formatBytes(job.output_size_bytes)}</strong>
                          <div style={{ color: "var(--accent-emerald)", fontSize: "0.75rem" }}>
                            Saved {job.savings_percent}% ({formatBytes(job.savings_bytes)})
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>--</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {(job.status === "running" || job.status === "pending") && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="btn btn-danger btn-sm"
                            title="Cancel Job"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        {job.status === "failed" && (
                          <>
                            <button
                              onClick={() => handleRetry(job.id)}
                              className="btn btn-secondary btn-sm"
                              title="Retry Job"
                            >
                              <RotateCcw size={14} /> Retry
                            </button>
                            <button
                              onClick={() => handleDeleteJob(job.id)}
                              className="btn btn-danger btn-sm"
                              title="Remove Job"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {(job.status === "completed" || job.status === "cancelled") && (
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="btn btn-secondary btn-sm"
                            title="Remove from List"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Queue Cards View */}
      <div className="mobile-only mobile-data-cards">
        {jobs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
            Queue is empty. Select files from Media Browser or Smart Recommendations to optimize.
          </div>
        ) : (
          jobs.map((job) => {
            const live = liveJobProgress[job.id];
            const pct = live ? live.progress : job.progress_percent;
            const speed = live ? live.speed : job.current_speed;
            const isRunning = job.status === "running";

            return (
              <div key={job.id} className="mobile-data-card">
                <div className="mobile-data-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      #{job.id}
                    </span>
                    <span
                      className={`badge ${
                        job.status === "completed"
                          ? "badge-emerald"
                          : job.status === "running"
                          ? "badge-cyan"
                          : job.status === "failed"
                          ? "badge-rose"
                          : "badge-purple"
                      }`}
                      style={{ fontSize: "0.68rem" }}
                    >
                      {job.status}
                    </span>
                    <span style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                      {job.stage}
                    </span>
                  </div>
                </div>

                <div className="mobile-data-card-title">
                  {job.source_path.split("/").pop()}
                </div>

                {/* Progress bar if running */}
                {isRunning && (
                  <div style={{ width: "100%", margin: "0.25rem 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, color: "var(--accent-purple-light)" }}>{pct.toFixed(1)}%</span>
                      <span>{speed ? `${speed.toFixed(2)}x` : ""}</span>
                    </div>
                    <div className="progress-container" style={{ height: "6px" }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {job.status === "completed" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--accent-emerald)", fontSize: "0.82rem" }}>
                    <CheckCircle size={15} /> Validated • Saved {job.savings_percent}% ({formatBytes(job.savings_bytes)})
                  </div>
                )}

                {job.status === "failed" && (
                  <div style={{ color: "var(--accent-rose)", fontSize: "0.75rem" }} title={job.error_message || ""}>
                    <AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} />
                    {job.error_message || "Encoding failed"}
                  </div>
                )}

                {/* Meta details */}
                <div className="mobile-data-card-meta">
                  <span>Size: {formatBytes(job.source_size_bytes)}</span>
                  {job.output_size_bytes > 0 && <span>➜ {formatBytes(job.output_size_bytes)}</span>}
                  <span>Mode: {job.replacement_mode}</span>
                  {job.assigned_node_name && (
                    <span
                      className="badge"
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 6px",
                        background: job.assigned_node_id === "local" ? "rgba(56, 189, 248, 0.15)" : "rgba(168, 85, 247, 0.15)",
                        color: job.assigned_node_id === "local" ? "#38bdf8" : "#c084fc",
                      }}
                    >
                      {job.assigned_node_name}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mobile-data-card-actions">
                  {(job.status === "running" || job.status === "pending") && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="btn btn-danger btn-sm"
                      style={{ flex: "1 1 auto", minHeight: "36px" }}
                    >
                      <XCircle size={14} /> Cancel Job
                    </button>
                  )}
                  {job.status === "failed" && (
                    <>
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: "1 1 auto", minHeight: "36px" }}
                      >
                        <RotateCcw size={14} /> Retry
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="btn btn-danger btn-sm"
                        style={{ flex: "1 1 auto", minHeight: "36px" }}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </>
                  )}
                  {(job.status === "completed" || job.status === "cancelled") && (
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: "1 1 auto", minHeight: "36px" }}
                    >
                      <Trash2 size={14} /> Remove from List
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
