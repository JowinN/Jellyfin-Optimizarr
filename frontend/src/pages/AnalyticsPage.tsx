import React, { useState, useEffect } from "react";
import { BarChart3, Download, TrendingDown, HardDrive, Clock, Film, PieChart } from "lucide-react";
import { AnalyticsOverview } from "../types";
import { api } from "../api";

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const ov = await api.getAnalyticsOverview();
        setData(ov);
      } catch (e) {
        console.error("Error fetching analytics:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(1)} GB`;
  };

  const handleDownloadCsv = () => {
    window.open(api.getExportCsvUrl(), "_blank");
  };

  return (
    <div>
      {/* Responsive Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Storage Analytics & Reports</h1>
          <p className="page-subtitle">
            Audit storage savings, compression throughput, and library codec distributions
          </p>
        </div>
        <div className="page-actions">
          <button onClick={handleDownloadCsv} className="btn btn-secondary btn-sm">
            <Download size={16} /> Export Report (CSV)
          </button>
        </div>
      </div>

      {/* Analytics KPI Cards Grid */}
      <div className="grid-kpi">
        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>GROSS STORAGE SAVED</div>
          <div className="kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-purple-light)" }}>
            {data ? formatBytes(data.realized_savings_bytes) : "--"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Average: {data?.average_compression_ratio || 0}% per file
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>ACTIVE BACKUP OVERHEAD</div>
          <div className="kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-amber)" }}>
            {data ? formatBytes(data.backup_usage_bytes) : "--"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Retained safety copies
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>NET DISK RECLAIMED</div>
          <div className="kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
            {data ? formatBytes(data.net_savings_bytes) : "--"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Real physical disk space gained
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>ENCODING THROUGHPUT</div>
          <div className="kpi-value" style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
            {data ? `${formatBytes(data.bytes_saved_per_hour)}/hr` : "--"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Storage reclaimed per encode hour
          </div>
        </div>
      </div>

      {/* Codec Distribution & Library Breakdown */}
      <div className="grid-two-col">
        {/* Codec Breakdown */}
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <PieChart size={18} color="var(--accent-purple-light)" /> Codec Distribution
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data?.codec_distribution.map((c) => {
              const totalItems = data.total_files || 1;
              const pct = ((c.count / totalItems) * 100).toFixed(1);
              return (
                <div key={c.codec} style={{ background: "rgba(30, 41, 59, 0.4)", padding: "0.85rem", borderRadius: "var(--radius-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className="badge badge-cyan">{c.codec.toUpperCase()}</span>
                      <span style={{ fontSize: "0.85rem" }}>{c.count} files ({pct}%)</span>
                    </div>
                    <strong>{formatBytes(c.total_size_bytes)}</strong>
                  </div>
                  <div className="progress-container" style={{ height: "4px" }}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Library Table */}
        <div className="card">
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Film size={18} color="var(--accent-cyan)" /> Library Optimization Status
          </h2>
          <div className="table-wrapper desktop-only" style={{ border: "none", background: "transparent" }}>
            <table>
              <thead>
                <tr>
                  <th>Library</th>
                  <th>Total Files</th>
                  <th>Optimized</th>
                  <th>Library Size</th>
                </tr>
              </thead>
              <tbody>
                {data?.libraries.map((l) => (
                  <tr key={l.library}>
                    <td>
                      <span className="badge badge-purple" style={{ textTransform: "capitalize" }}>
                        {l.library}
                      </span>
                    </td>
                    <td>{l.total_files}</td>
                    <td>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>
                        {l.optimized_files}
                      </span>{" "}
                      ({l.total_files > 0 ? Math.round((l.optimized_files / l.total_files) * 100) : 0}%)
                    </td>
                    <td>{formatBytes(l.total_source_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-only" style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {data?.libraries.map((l) => {
              const optPct = l.total_files > 0 ? Math.round((l.optimized_files / l.total_files) * 100) : 0;
              return (
                <div key={l.library} style={{ background: "rgba(30, 41, 59, 0.4)", padding: "0.75rem 0.85rem", borderRadius: "var(--radius-md)", border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span className="badge badge-purple" style={{ textTransform: "capitalize" }}>{l.library}</span>
                    <strong style={{ fontSize: "0.9rem" }}>{formatBytes(l.total_source_bytes)}</strong>
                  </div>
                  <div className="progress-container" style={{ height: "5px", margin: "0.35rem 0" }}>
                    <div className="progress-fill" style={{ width: `${optPct}%` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <span style={{ color: "var(--accent-emerald)" }}>{l.optimized_files} / {l.total_files} optimized ({optPct}%)</span>
                    <span>{l.total_files - l.optimized_files} pending</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
