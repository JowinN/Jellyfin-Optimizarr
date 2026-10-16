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
  Cpu,
  Zap,
} from "lucide-react";
import { EncodingJob } from "../types";
import { useSSE } from "../context/SSEContext";
import { api } from "../api";

export const QueuePage: React.FC = () => {
  const [jobs, setJobs] = useState<EncodingJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const [counts, setCounts] = useState({
    all: 0,
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0,
  });
  const { liveJobProgress } = useSSE();

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const data = await api.getQueueJobs(statusFilter || undefined);
      setJobs(data);

      // Fetch all to update tab counts
      if (statusFilter === "") {
        const running = data.filter((j) => j.status === "running").length;
        const pending = data.filter((j) => j.status === "pending").length;
        const completed = data.filter((j) => j.status === "completed").length;
        const failed = data.filter((j) => j.status === "failed").length;
        setCounts({
          all: data.length,
          running,
          pending,
          completed,
          failed,
        });
      }
    } catch (e) {
      console.error("Error fetching queue jobs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
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
    if (confirm("Cancel this encoding job? The original media file will remain completely untouched.")) {
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
    if (confirm("Remove this job record from the queue?")) {
      try {
        await api.deleteJob(jobId);
        fetchJobs();
      } catch (e: any) {
        alert("Failed to remove job: " + e.message);
      }
    }
  };

  const handleClearAll = async () => {
    if (
      confirm(
        "Are you sure you want to clear ALL pending and completed jobs from the queue? Running encodes will be safely stopped and files preserved."
      )
    ) {
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

  const filterTabs = [
    { id: "", label: "All Jobs", count: counts.all },
    { id: "running", label: "Active", count: counts.running },
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "completed", label: "Completed", count: counts.completed },
    { id: "failed", label: "Failed", count: counts.failed },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Queue & Workload Fleet</h1>
          <p className="page-subtitle">
            Distributed background transcoding pipeline with live telemetry and process isolation
          </p>
        </div>

        <div className="page-actions">
          <button onClick={handlePauseResume} className="btn btn-secondary btn-sm">
            {isQueuePaused ? <Play size={15} color="var(--accent-emerald)" /> : <Pause size={15} />}
            {isQueuePaused ? "Resume Pipeline" : "Pause Pipeline"}
          </button>
          <button
            onClick={handleClearCompleted}
            className="btn btn-secondary btn-sm"
            title="Purge completed, failed, and cancelled jobs"
          >
            <Trash2 size={15} /> Clear History
          </button>
          {jobs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn btn-danger btn-sm"
              title="Purge all queue records"
            >
              <XCircle size={15} /> Clear All
            </button>
          )}
          <button
            onClick={fetchJobs}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
            title="Refresh queue status"
          >
            <RefreshCw size={15} className={isLoading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Modern Segmented Filter Tabs */}
      <div className="segmented-tabs">
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`segmented-tab ${isActive ? "active" : ""}`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && <span className="segmented-tab-count">{tab.count}</span>}
            </button>
          );
        })}
      </div>

      {/* Desktop Queue Table */}
      <div className="table-wrapper desktop-only">
        <table>
          <thead>
            <tr>
              <th style={{ width: "90px" }}>Job ID</th>
              <th style={{ width: "130px" }}>Status</th>
              <th>Source Media File</th>
              <th style={{ width: "220px" }}>Progress / Telemetry</th>
              <th style={{ width: "110px" }}>Original</th>
              <th style={{ width: "160px" }}>Optimized / Savings</th>
              <th style={{ width: "120px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3.5rem 1rem", color: "var(--text-muted)" }}>
                  <ListOrdered size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
                  <div>Queue is currently empty for this filter.</div>
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const live = liveJobProgress[job.id];
                const pct = live ? live.progress : job.progress_percent;
                const speed = live ? live.speed : job.current_speed;
                const fps = live ? live.fps : job.current_fps;
                const isRunning = job.status === "running";
                const isGpu =
                  job.assigned_node_id === "windows-node" ||
                  job.encoder_used?.includes("nvenc") ||
                  job.encoder_used?.includes("qsv");

                return (
                  <tr key={job.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.82rem",
                          color: "var(--accent-purple-light)",
                          fontWeight: 700,
                        }}
                      >
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
                              : "badge-amber"
                          }`}
                        >
                          {job.status === "running" && <Activity size={12} className="spin" />}
                          {job.status === "completed" && <CheckCircle size={12} />}
                          {job.status === "failed" && <AlertCircle size={12} />}
                          {job.status}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                          {job.stage}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          maxWidth: "340px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--text-primary)",
                        }}
                        title={job.source_path}
                      >
                        {job.source_path.split("/").pop()}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          marginTop: "0.25rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{job.replacement_mode === "safe_backup" ? "Safe Backup" : "In-Place"}</span>
                        {job.assigned_node_name && (
                          <span
                            className="badge"
                            style={{
                              fontSize: "0.66rem",
                              padding: "1px 6px",
                              background: isGpu ? "rgba(16, 185, 129, 0.15)" : "rgba(6, 182, 212, 0.15)",
                              color: isGpu ? "#34d399" : "#38bdf8",
                              border: `1px solid ${isGpu ? "rgba(16, 185, 129, 0.3)" : "rgba(6, 182, 212, 0.3)"}`,
                            }}
                          >
                            {isGpu ? <Zap size={10} /> : <Cpu size={10} />}
                            {job.assigned_node_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {isRunning ? (
                        <div style={{ width: "200px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.76rem",
                              marginBottom: "0.25rem",
                            }}
                          >
                            <strong style={{ color: "var(--accent-purple-light)" }}>{pct.toFixed(1)}%</strong>
                            <span style={{ color: "var(--text-secondary)" }}>
                              {speed ? `${speed.toFixed(1)}x` : ""} {fps ? `(${Math.round(fps)} fps)` : ""}
                            </span>
                          </div>
                          <div className="progress-container" style={{ height: "6px" }}>
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ) : job.status === "completed" ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            color: "var(--accent-emerald)",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle size={15} /> Validated Output
                        </div>
                      ) : job.status === "failed" ? (
                        <div
                          style={{ color: "var(--accent-rose)", fontSize: "0.75rem", maxWidth: "200px" }}
                          title={job.error_message || ""}
                        >
                          <AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} />
                          {job.error_message?.slice(0, 45)}...
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Queued in backlog</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                      {formatBytes(job.source_size_bytes)}
                    </td>
                    <td>
                      {job.status === "completed" ? (
                        <div>
                          <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                            {formatBytes(job.output_size_bytes)}
                          </strong>
                          <div style={{ color: "var(--accent-emerald)", fontSize: "0.76rem", fontWeight: 600 }}>
                            Saved {job.savings_percent}% ({formatBytes(job.savings_bytes)})
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>--</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                        {(job.status === "running" || job.status === "pending") && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="btn btn-danger btn-sm btn-icon"
                            title="Cancel Job"
                          >
                            <XCircle size={15} />
                          </button>
                        )}
                        {job.status === "failed" && (
                          <>
                            <button
                              onClick={() => handleRetry(job.id)}
                              className="btn btn-secondary btn-sm btn-icon"
                              title="Retry Job"
                            >
                              <RotateCcw size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteJob(job.id)}
                              className="btn btn-danger btn-sm btn-icon"
                              title="Delete Record"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {(job.status === "completed" || job.status === "cancelled") && (
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="btn btn-secondary btn-sm btn-icon"
                            title="Remove from List"
                          >
                            <Trash2 size={15} />
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
            Queue is empty for this filter.
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
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.82rem",
                        color: "var(--accent-purple-light)",
                        fontWeight: 700,
                      }}
                    >
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
                          : "badge-amber"
                      }`}
                      style={{ fontSize: "0.68rem" }}
                    >
                      {job.status}
                    </span>
                    <span style={{ fontSize: "0.725rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                      {job.stage}
                    </span>
                  </div>
                </div>

                <div className="mobile-data-card-title">{job.source_path.split("/").pop()}</div>

                {isRunning && (
                  <div style={{ width: "100%", margin: "0.25rem 0" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.76rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "var(--accent-purple-light)" }}>
                        {pct.toFixed(1)}%
                      </span>
                      <span>{speed ? `${speed.toFixed(2)}x` : ""}</span>
                    </div>
                    <div className="progress-container" style={{ height: "6px" }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                {job.status === "completed" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      color: "var(--accent-emerald)",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle size={15} /> Saved {job.savings_percent}% ({formatBytes(job.savings_bytes)})
                  </div>
                )}

                {job.status === "failed" && (
                  <div
                    style={{ color: "var(--accent-rose)", fontSize: "0.75rem" }}
                    title={job.error_message || ""}
                  >
                    <AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} />
                    {job.error_message || "Encoding failed"}
                  </div>
                )}

                <div className="mobile-data-card-meta">
                  <span>Size: {formatBytes(job.source_size_bytes)}</span>
                  {job.output_size_bytes > 0 && <span>➜ {formatBytes(job.output_size_bytes)}</span>}
                  {job.assigned_node_name && (
                    <span className="badge badge-purple" style={{ fontSize: "0.66rem", padding: "1px 6px" }}>
                      {job.assigned_node_name}
                    </span>
                  )}
                </div>

                <div className="mobile-data-card-actions">
                  {(job.status === "running" || job.status === "pending") && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="btn btn-danger btn-sm"
                      style={{ flex: "1 1 auto" }}
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                  {job.status === "failed" && (
                    <>
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: "1 1 auto" }}
                      >
                        <RotateCcw size={14} /> Retry
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="btn btn-danger btn-sm"
                        style={{ flex: "1 1 auto" }}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </>
                  )}
                  {(job.status === "completed" || job.status === "cancelled") && (
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: "1 1 auto" }}
                    >
                      <Trash2 size={14} /> Remove
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
