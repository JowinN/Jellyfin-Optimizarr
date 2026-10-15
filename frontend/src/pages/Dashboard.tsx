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
  const [activeJob, setActiveJob] = useState<EncodingJob | null>(null);
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
      setActiveJob(queueData.length > 0 ? queueData[0] : null);
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
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerScan = async () => {
    try {
      setIsScanning(true);
      await api.triggerScan({ force_rescan: false });
      alert("Library scan started in background. Files will appear automatically.");
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
      {/* Responsive Header bar */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Optimizer Overview</h1>
          <p className="page-subtitle">
            Real-time home server storage compression & media safety monitor
          </p>
        </div>
        <div className="page-actions">
          <button onClick={handleTriggerScan} disabled={isScanning} className="btn btn-secondary">
            <RefreshCw size={16} className={isScanning ? "animate-spin" : ""} />
            {isScanning ? "Scanning..." : "Scan Libraries"}
          </button>
          <button onClick={() => onNavigate("recommendations")} className="btn btn-primary">
            <Sparkles size={16} /> Smart Reclaim
          </button>
        </div>
      </div>

      {/* Active Encoding Telemetry Card */}
      <ActiveJobsBanner activeJob={activeJob} onJobCancelled={fetchDashboardData} />

      {/* Responsive Key Metrics Cards Grid */}
      <div className="grid-kpi">
        {/* Realized Gross Savings */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>GROSS SAVED</span>
            <TrendingDown size={18} color="var(--accent-purple-light)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-purple-light)" }}>
            {overview ? formatBytes(overview.realized_savings_bytes) : "--"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Avg: {overview?.average_compression_ratio || 0}%
          </div>
        </div>

        {/* Net Savings After Backups */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>NET RECLAIMED</span>
            <HardDrive size={18} color="var(--accent-emerald)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
            {overview ? formatBytes(overview.net_savings_bytes) : "--"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Safety backups: {overview ? formatBytes(overview.backup_usage_bytes) : "0 GB"}
          </div>
        </div>

        {/* Total Scanned Library */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>SCANNED MEDIA</span>
            <Film size={18} color="var(--accent-cyan)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff" }}>
            {overview?.total_files || 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Total: {overview ? formatBytes(overview.total_library_bytes) : "--"}
          </div>
        </div>

        {/* Optimized vs Pending */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>OPTIMIZED</span>
            <Database size={18} color="var(--accent-amber)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-amber)" }}>
            {overview?.total_optimized_count || 0} <span style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>/ {overview?.pending_optimization_count || 0}</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Yield: ~{overview ? formatBytes(overview.estimated_pending_savings_bytes) : "--"}
          </div>
        </div>
      </div>

      {/* Distributed Transcoding Cluster Fleet */}
      <div className="card" style={{ marginBottom: "2rem", border: "1px solid rgba(99, 102, 241, 0.2)", background: "rgba(15, 23, 42, 0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ minWidth: 0, flex: "1 1 200px" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Server size={18} color="var(--accent-purple-light)" /> Distributed Transcoding Fleet
            </h2>
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              Active compute nodes sharing the media compression workload across the local network
            </p>
          </div>
          <span className="badge badge-purple" style={{ fontSize: "0.72rem", flexShrink: 0 }}>
            {nodes.filter((n) => n.status === "online").length} of {nodes.length} Online
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: "0.75rem" }}>
          {nodes.map((node) => (
            <div
              key={node.node_id}
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: node.status === "online" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(244, 63, 94, 0.2)",
                borderRadius: "var(--radius-md)",
                padding: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0, flex: 1 }}>
                  {node.is_primary ? (
                    <Server size={18} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                  ) : (
                    <Monitor size={18} color="var(--accent-purple-light)" style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {node.os_info} {node.is_primary && "• Primary Host"}
                    </div>
                  </div>
                </div>
                <span className={`badge ${node.status === "online" ? "badge-emerald" : "badge-rose"}`} style={{ fontSize: "0.68rem", flexShrink: 0 }}>
                  {node.status}
                </span>
              </div>

              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Cpu size={13} color="var(--accent-amber)" />
                  <span>{node.cpu_model} ({node.cpu_cores} cores)</span>
                </div>
                {node.gpu_model && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <HardDrive size={13} color="var(--accent-emerald)" />
                    <span>{node.gpu_model}</span>
                  </div>
                )}
              </div>

              {node.supported_encoders && node.supported_encoders.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.1rem" }}>
                  {node.supported_encoders.map((enc) => (
                    <span
                      key={enc}
                      className="badge"
                      style={{ fontSize: "0.62rem", padding: "1px 5px", background: "rgba(51, 65, 85, 0.8)", color: "#cbd5e1" }}
                    >
                      {enc}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "0.4rem", marginTop: "0.2rem" }}>
                {node.current_job_id ? (
                  <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>Processing Job #{node.current_job_id}</span>
                ) : (
                  <span>State: {node.status === "online" ? "Idle • Ready for queue" : "Disconnected"}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Library Breakdown & Candidate Highlights */}
      <div className="grid-split">
        {/* Library Storage Breakdown */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
              <Film size={18} color="var(--accent-cyan)" /> Library Storage Breakdown
            </h2>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {overview?.libraries.length || 0} Libraries
            </span>
          </div>

          {(!overview || overview.libraries.length === 0) ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1.5rem 0", textAlign: "center" }}>
              No libraries detected. Run a scan to discover your Jellyfin libraries.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {overview.libraries.map((lib) => {
                const optPercent = lib.total_files > 0 ? (lib.optimized_files / lib.total_files) * 100 : 0;
                return (
                  <div key={lib.library} style={{ background: "rgba(30, 41, 59, 0.4)", padding: "0.85rem", borderRadius: "var(--radius-md)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.4rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                        <span className="badge badge-purple" style={{ textTransform: "capitalize", flexShrink: 0 }}>{lib.library}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{lib.total_files} files</span>
                      </div>
                      <strong style={{ fontSize: "0.92rem", color: "var(--text-primary)" }}>{formatBytes(lib.total_source_bytes)}</strong>
                    </div>
                    <div className="progress-container" style={{ height: "6px" }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${optPercent}%`,
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                      <span style={{ color: "var(--accent-emerald)" }}>{lib.optimized_files} optimized ({optPercent.toFixed(0)}%)</span>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
              <Sparkles size={18} color="var(--accent-purple-light)" /> High-Payoff Candidates
            </h2>
            <button onClick={() => onNavigate("recommendations")} className="btn btn-secondary btn-sm" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}>
              View All <ArrowUpRight size={13} />
            </button>
          </div>

          {candidates.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1.5rem 0", textAlign: "center" }}>
              No heavy optimization candidates detected. Run a scan to discover media.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {candidates.map((cand) => (
                <div
                  key={cand.media_item_id}
                  style={{
                    background: "rgba(30, 41, 59, 0.45)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.75rem 0.85rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    transition: "border-color 0.15s ease, background 0.15s ease",
                  }}
                  onClick={() => onNavigate("recommendations")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                      {cand.filename}
                    </div>
                    <span className="badge badge-emerald" style={{ fontSize: "0.68rem", flexShrink: 0 }}>
                      Save ~{cand.estimated_savings_percent}%
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", fontSize: "0.74rem", color: "var(--text-secondary)", flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge badge-cyan" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>{cand.resolution}</span>
                    <span style={{ color: "var(--accent-amber)" }}>{cand.mb_per_minute} MB/min</span>
                    <span>•</span>
                    <span style={{ color: "var(--text-primary)" }}>Save ~{formatBytes(cand.estimated_saved_bytes)}</span>
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
