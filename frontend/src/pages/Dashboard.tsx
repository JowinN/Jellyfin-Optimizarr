import React, { useState, useEffect } from "react";
import {
  HardDrive,
  Film,
  Sparkles,
  ListOrdered,
  RefreshCw,
  TrendingDown,
  ShieldAlert,
  ArrowUpRight,
  Database,
  Server,
  Cpu,
  Monitor,
  Zap,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { AnalyticsOverview, EncodingJob, MediaItem, ClusterNode } from "../types";
import { ActiveJobsBanner } from "../components/ActiveJobsBanner";
import { api } from "../api";

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onOpenMediaDetail: (media: MediaItem) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onOpenMediaDetail }) => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [activeJobs, setActiveJobs] = useState<EncodingJob[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const [ovData, queueData, recsData, nodesData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getQueueJobs("running"),
        api.getRecommendations({ limit: 5 }),
        api.getNodes(),
      ]);
      setOverview(ovData);
      setActiveJobs(queueData);
      setCandidates(recsData);
      setNodes(nodesData);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerScan = async () => {
    try {
      setIsScanning(true);
      await api.triggerScan({ force_rescan: false });
      alert("Library scan started in background. New files and storage changes will sync automatically.");
      setTimeout(fetchDashboardData, 3000);
    } catch (e: any) {
      alert("Scan trigger error: " + e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div>
      {/* Header bar */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cluster Overview</h1>
          <p className="page-subtitle">
            Distributed storage optimization, multi-node compute telemetry, and lossless backup safety
          </p>
        </div>
        <div className="page-actions">
          <button
            onClick={handleTriggerScan}
            disabled={isScanning}
            className="btn btn-secondary"
            title="Scan libraries for new media"
          >
            <RefreshCw size={16} className={isScanning ? "spin" : ""} />
            {isScanning ? "Scanning..." : "Scan Media Libraries"}
          </button>
          <button onClick={() => onNavigate("recommendations")} className="btn btn-primary">
            <Sparkles size={16} /> Smart Reclaim
          </button>
        </div>
      </div>

      {/* Multi-Node Active Encoding Banner */}
      <ActiveJobsBanner activeJobs={activeJobs} onJobCancelled={fetchDashboardData} />

      {/* Key Metrics KPI Grid */}
      <div className="grid-kpi">
        {/* Gross Reclaimed Space */}
        <div className="card kpi-card card-interactive" onClick={() => onNavigate("analytics")}>
          <div>
            <div className="kpi-card-header">
              <span className="kpi-card-title">Gross Reclaimed</span>
              <TrendingDown size={18} color="var(--accent-purple-light)" />
            </div>
            <div className="kpi-card-value" style={{ color: "var(--accent-purple-light)" }}>
              {overview ? formatBytes(overview.realized_savings_bytes) : "--"}
            </div>
          </div>
          <div className="kpi-card-footer">
            <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>
              {overview?.average_compression_ratio || 0}% average
            </span>{" "}
            compression ratio
          </div>
        </div>

        {/* Net Savings After Backups */}
        <div className="card kpi-card card-interactive" onClick={() => onNavigate("rollback")}>
          <div>
            <div className="kpi-card-header">
              <span className="kpi-card-title">Net Space Reclaimed</span>
              <HardDrive size={18} color="var(--accent-emerald)" />
            </div>
            <div className="kpi-card-value" style={{ color: "var(--accent-emerald)" }}>
              {overview ? formatBytes(overview.net_savings_bytes) : "--"}
            </div>
          </div>
          <div className="kpi-card-footer">
            Safety backups:{" "}
            <strong style={{ color: "var(--text-secondary)" }}>
              {overview ? formatBytes(overview.backup_usage_bytes) : "0 GB"}
            </strong>
          </div>
        </div>

        {/* Total Scanned Media */}
        <div className="card kpi-card card-interactive" onClick={() => onNavigate("media")}>
          <div>
            <div className="kpi-card-header">
              <span className="kpi-card-title">Scanned Library</span>
              <Film size={18} color="var(--accent-cyan)" />
            </div>
            <div className="kpi-card-value" style={{ color: "#fff" }}>
              {overview?.total_files || 0}
            </div>
          </div>
          <div className="kpi-card-footer">
            Total disk footprint:{" "}
            <strong style={{ color: "var(--text-secondary)" }}>
              {overview ? formatBytes(overview.total_library_bytes) : "--"}
            </strong>
          </div>
        </div>

        {/* Optimized vs Backlog */}
        <div className="card kpi-card card-interactive" onClick={() => onNavigate("queue")}>
          <div>
            <div className="kpi-card-header">
              <span className="kpi-card-title">Optimized Backlog</span>
              <Database size={18} color="var(--accent-amber)" />
            </div>
            <div className="kpi-card-value" style={{ color: "var(--accent-amber)" }}>
              {overview?.total_optimized_count || 0}{" "}
              <span style={{ fontSize: "1rem", color: "var(--text-muted)", fontWeight: 500 }}>
                / {overview?.pending_optimization_count || 0} left
              </span>
            </div>
          </div>
          <div className="kpi-card-footer">
            Estimated pending yield:{" "}
            <strong style={{ color: "var(--accent-amber)" }}>
              ~{overview ? formatBytes(overview.estimated_pending_savings_bytes) : "--"}
            </strong>
          </div>
        </div>
      </div>

      {/* Distributed Transcoding Fleet Card */}
      <div
        className="card"
        style={{
          marginBottom: "2rem",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          background: "rgba(13, 18, 31, 0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                color: "var(--text-primary)",
              }}
            >
              <Server size={20} color="var(--accent-purple-light)" /> Distributed Transcoding Fleet
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              Active compute nodes sharing the media compression workload across the local network
            </p>
          </div>
          <span
            className="badge badge-purple"
            style={{ fontSize: "0.74rem", padding: "0.3rem 0.75rem", flexShrink: 0 }}
          >
            {nodes.filter((n) => n.status === "online").length} of {nodes.length} Compute Nodes Online
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "1rem",
          }}
        >
          {nodes.map((node) => {
            const isOnline = node.status === "online";
            const isBusy = Boolean(node.current_job_id);

            return (
              <div
                key={node.node_id}
                style={{
                  background: "rgba(22, 30, 49, 0.65)",
                  border: isBusy
                    ? "1px solid rgba(139, 92, 246, 0.45)"
                    : isOnline
                    ? "1px solid rgba(16, 185, 129, 0.25)"
                    : "1px solid rgba(244, 63, 94, 0.25)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  minWidth: 0,
                  boxShadow: isBusy ? "0 4px 20px rgba(139, 92, 246, 0.15)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0, flex: 1 }}>
                    {node.is_primary ? (
                      <Server size={20} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                    ) : (
                      <Monitor size={20} color="var(--accent-purple-light)" style={{ flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.94rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {node.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {node.os_info} {node.is_primary && "• Primary Host"}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`badge ${
                      isBusy
                        ? "badge-purple"
                        : isOnline
                        ? "badge-emerald"
                        : "badge-rose"
                    }`}
                    style={{ fontSize: "0.7rem", flexShrink: 0 }}
                  >
                    {isBusy ? (
                      <>
                        <Activity size={12} className="spin" /> Busy
                      </>
                    ) : isOnline ? (
                      <>
                        <CheckCircle2 size={12} /> Online
                      </>
                    ) : (
                      "Offline"
                    )}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <Cpu size={14} color="var(--accent-amber)" />
                    <span>
                      {node.cpu_model} ({node.cpu_cores} cores)
                    </span>
                  </div>
                  {node.gpu_model && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <Zap size={14} color="var(--accent-emerald)" />
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                        {node.gpu_model} (Hardware Acceleration)
                      </span>
                    </div>
                  )}
                </div>

                {node.supported_encoders && node.supported_encoders.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {node.supported_encoders.map((enc) => (
                      <span
                        key={enc}
                        className="badge"
                        style={{
                          fontSize: "0.64rem",
                          padding: "2px 6px",
                          background: "rgba(15, 23, 42, 0.8)",
                          color: "#cbd5e1",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        {enc}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    fontSize: "0.74rem",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    paddingTop: "0.55rem",
                    marginTop: "0.2rem",
                  }}
                >
                  {node.current_job_id ? (
                    <span style={{ color: "var(--accent-purple-light)", fontWeight: 700 }}>
                      ⚡ Actively encoding Job #{node.current_job_id}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>
                      Status: {isOnline ? "Idle • Ready for queue assignments" : "Disconnected"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Library Breakdown & Candidate Highlights */}
      <div className="grid-split">
        {/* Library Storage Breakdown */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                minWidth: 0,
              }}
            >
              <Film size={18} color="var(--accent-cyan)" /> Library Storage Breakdown
            </h2>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {overview?.libraries.length || 0} Managed Folders
            </span>
          </div>

          {!overview || overview.libraries.length === 0 ? (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "0.88rem",
                padding: "2rem 0",
                textAlign: "center",
              }}
            >
              No libraries detected. Run a scan to index your Jellyfin files.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {overview.libraries.map((lib) => {
                const optPercent =
                  lib.total_files > 0 ? (lib.optimized_files / lib.total_files) * 100 : 0;
                return (
                  <div
                    key={lib.library}
                    style={{
                      background: "rgba(22, 30, 49, 0.5)",
                      padding: "1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                        <span
                          className="badge badge-purple"
                          style={{ textTransform: "capitalize", flexShrink: 0, fontWeight: 700 }}
                        >
                          {lib.library}
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                          {lib.total_files} files
                        </span>
                      </div>
                      <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>
                        {formatBytes(lib.total_source_bytes)}
                      </strong>
                    </div>

                    <div className="progress-container" style={{ height: "7px" }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${optPercent}%`,
                          background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.76rem",
                        color: "var(--text-muted)",
                        marginTop: "0.45rem",
                      }}
                    >
                      <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>
                        {lib.optimized_files} optimized ({optPercent.toFixed(0)}%)
                      </span>
                      <span>{lib.total_files - lib.optimized_files} pending</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* High-Yield Candidate Highlights */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                minWidth: 0,
              }}
            >
              <Sparkles size={18} color="var(--accent-purple-light)" /> High-Payoff Candidates
            </h2>
            <button
              onClick={() => onNavigate("recommendations")}
              className="btn btn-secondary btn-sm"
            >
              View All <ArrowUpRight size={13} />
            </button>
          </div>

          {candidates.length === 0 ? (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "0.88rem",
                padding: "2rem 0",
                textAlign: "center",
              }}
            >
              No bloated media candidates detected. Library is well-optimized!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {candidates.map((cand) => (
                <div
                  key={cand.media_item_id}
                  style={{
                    background: "rgba(22, 30, 49, 0.5)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.85rem 1rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    transition: "border-color 0.15s ease, transform 0.15s ease",
                  }}
                  className="card-interactive"
                  onClick={() => onNavigate("recommendations")}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {cand.filename}
                    </div>
                    <span
                      className="badge badge-emerald"
                      style={{ fontSize: "0.7rem", flexShrink: 0, fontWeight: 700 }}
                    >
                      Save ~{cand.estimated_savings_percent}%
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span
                      className="badge badge-cyan"
                      style={{ fontSize: "0.68rem", padding: "1px 6px" }}
                    >
                      {cand.resolution}
                    </span>
                    <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>
                      {cand.mb_per_minute} MB/min
                    </span>
                    <span>•</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      Reclaim ~{formatBytes(cand.estimated_saved_bytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
