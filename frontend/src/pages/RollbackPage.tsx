import React, { useState, useEffect } from "react";
import { History, RotateCcw, Trash2, CheckCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { RollbackRecord } from "../types";
import { api } from "../api";
import { useToast } from "../context/ToastContext";

export const RollbackPage: React.FC = () => {
  const { toast } = useToast();
  const [records, setRecords] = useState<RollbackRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isRestoringAll, setIsRestoringAll] = useState(false);
  const [isPurgingAll, setIsPurgingAll] = useState(false);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const data = await api.getRollbackRecords();
      setRecords(data);
    } catch (e) {
      console.error("Error fetching rollback records:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleRestore = async (recordId: number, filename: string) => {
    if (confirm(`Restore original uncompressed media for '${filename}'? This will replace the optimized file with your safety backup.`)) {
      try {
        await api.restoreRollback(recordId);
        toast.success("Original file restored successfully!");
        fetchRecords();
      } catch (e: any) {
        toast.error("Rollback failed: " + e.message);
      }
    }
  };

  const handlePurge = async (recordId: number) => {
    if (confirm("Permanently delete this backup from disk? You will not be able to revert to the original uncompressed file.")) {
      try {
        await api.purgeBackup(recordId);
        toast.success("Backup purged from storage.");
        fetchRecords();
      } catch (e: any) {
        toast.error("Error purging backup: " + e.message);
      }
    }
  };

  const handleRestoreAll = async () => {
    const available = records.filter((r) => r.status === "available");
    if (available.length === 0) {
      toast.info("No available backups to restore.");
      return;
    }

    if (confirm(`⚠️ REVERT ALL BACKUPS?\n\nAre you sure you want to restore ALL ${available.length} media files back to their uncompressed originals?\n\nThis will replace all optimized files with their safety backups.`)) {
      try {
        setIsRestoringAll(true);
        const res = await api.restoreAllRollbacks();
        toast.success(res.message);
        fetchRecords();
      } catch (e: any) {
        toast.error("Bulk rollback failed: " + e.message);
      } finally {
        setIsRestoringAll(false);
      }
    }
  };

  const handlePurgeAll = async () => {
    const available = records.filter((r) => r.status === "available");
    if (available.length === 0) {
      toast.info("No available backups to prune.");
      return;
    }

    if (confirm(`🗑️ PURGE ALL SAFETY BACKUPS?\n\nAre you sure you want to permanently delete ALL ${available.length} safety backups (${formatBytes(totalBackupBytes)}) from disk?\n\n⚠️ WARNING: Once deleted, you will NOT be able to revert back to original uncompressed files.`)) {
      try {
        setIsPurgingAll(true);
        const res = await api.purgeAllBackups();
        toast.success(res.message);
        fetchRecords();
      } catch (e: any) {
        toast.error("Bulk purge failed: " + e.message);
      } finally {
        setIsPurgingAll(false);
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const availableRecords = records.filter((r) => r.status === "available");
  const totalBackupBytes = availableRecords.reduce((acc, r) => acc + r.original_size_bytes, 0);

  return (
    <div>
      {/* Responsive Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Rollback & Backups</h1>
          <p className="page-subtitle">
            Reversible media management: restore originals anytime or reclaim backup disk space
          </p>
        </div>

        <div className="page-actions">
          {availableRecords.length > 0 && (
            <>
              <button
                onClick={handleRestoreAll}
                disabled={isRestoringAll || isPurgingAll}
                className="btn btn-secondary btn-sm"
                title="Restore all optimized media back to uncompressed originals"
              >
                <RotateCcw size={15} />
                {isRestoringAll ? "Restoring All..." : `Rollback Everything (${availableRecords.length})`}
              </button>

              <button
                onClick={handlePurgeAll}
                disabled={isRestoringAll || isPurgingAll}
                className="btn btn-danger btn-sm"
                title="Permanently delete all backup files from disk"
              >
                <Trash2 size={15} />
                {isPurgingAll ? "Pruning All..." : `Prune Everything (${formatBytes(totalBackupBytes)})`}
              </button>
            </>
          )}

          <button onClick={fetchRecords} disabled={isLoading} className="btn btn-secondary btn-sm" title="Refresh">
            <History size={15} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Safety Info Banner */}
      <div className="card" style={{ marginBottom: "1.5rem", background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: "1 1 260px" }}>
            <ShieldCheck size={28} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Zero-Risk Media Guarantee</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Every replaced file preserves a bit-exact backup in <code>/backups</code>. Restore or purge anytime.
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "1 1 auto" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Backup Space Used</div>
            <strong style={{ fontSize: "1.2rem", color: "var(--accent-emerald)" }}>
              {formatBytes(totalBackupBytes)}
            </strong>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              {availableRecords.length} active backup{availableRecords.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {availableRecords.length > 0 && (
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(16, 185, 129, 0.2)" }}>
            <button
              onClick={handleRestoreAll}
              disabled={isRestoringAll || isPurgingAll}
              className="btn btn-secondary btn-sm"
              style={{ flex: "1 1 auto", minHeight: "36px" }}
            >
              <RotateCcw size={14} /> {isRestoringAll ? "Rolling Back..." : `Rollback All ${availableRecords.length} Media Files`}
            </button>
            <button
              onClick={handlePurgeAll}
              disabled={isRestoringAll || isPurgingAll}
              className="btn btn-danger btn-sm"
              style={{ flex: "1 1 auto", minHeight: "36px" }}
            >
              <Trash2 size={14} /> {isPurgingAll ? "Pruning..." : `Prune Everything (${formatBytes(totalBackupBytes)})`}
            </button>
          </div>
        )}
      </div>

      {/* Rollback Records Table (Desktop View) */}
      <div className="table-wrapper desktop-only">
        <table>
          <thead>
            <tr>
              <th>Target Media File</th>
              <th>Status</th>
              <th>Original Size</th>
              <th>Optimized Size</th>
              <th>Saved Space</th>
              <th>Backup Location</th>
              <th>Date Replaced</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No backup records found. Replaced media will appear here with one-click restore options.
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const filename = r.original_path.split("/").pop() || "media";
                const saved = r.original_size_bytes - r.optimized_size_bytes;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {filename}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          r.status === "available"
                            ? "badge-emerald"
                            : r.status === "restored"
                            ? "badge-purple"
                            : "badge-rose"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td>{formatBytes(r.original_size_bytes)}</td>
                    <td>{formatBytes(r.optimized_size_bytes)}</td>
                    <td>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>
                        {formatBytes(saved)}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.backup_path}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {r.status === "available" && (
                          <>
                            <button
                              onClick={() => handleRestore(r.id, filename)}
                              className="btn btn-secondary btn-sm"
                              title="Restore Original File"
                            >
                              <RotateCcw size={14} /> Restore
                            </button>
                            <button
                              onClick={() => handlePurge(r.id)}
                              className="btn btn-danger btn-sm"
                              title="Purge Backup"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {r.status === "restored" && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Restored</span>
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

      {/* Mobile Backup Cards View */}
      <div className="mobile-only mobile-data-cards">
        {records.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
            No backup records found. Replaced media will appear here with one-click restore options.
          </div>
        ) : (
          records.map((r) => {
            const filename = r.original_path.split("/").pop() || "media";
            const saved = r.original_size_bytes - r.optimized_size_bytes;

            return (
              <div key={r.id} className="mobile-data-card">
                <div className="mobile-data-card-header">
                  <div className="mobile-data-card-title">{filename}</div>
                  <span
                    className={`badge ${
                      r.status === "available"
                        ? "badge-emerald"
                        : r.status === "restored"
                        ? "badge-purple"
                        : "badge-rose"
                    }`}
                    style={{ fontSize: "0.68rem", flexShrink: 0 }}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="mobile-data-card-meta">
                  <span>Original: <strong>{formatBytes(r.original_size_bytes)}</strong></span>
                  <span>➜ Optimized: <strong>{formatBytes(r.optimized_size_bytes)}</strong></span>
                  <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>Saved: {formatBytes(saved)}</span>
                </div>

                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
                  Backup: {r.backup_path}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  Replaced on {new Date(r.created_at).toLocaleDateString()}
                </div>

                <div className="mobile-data-card-actions">
                  {r.status === "available" && (
                    <>
                      <button
                        onClick={() => handleRestore(r.id, filename)}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: "1 1 auto", minHeight: "36px" }}
                      >
                        <RotateCcw size={14} /> Restore Original
                      </button>
                      <button
                        onClick={() => handlePurge(r.id)}
                        className="btn btn-danger btn-sm"
                        style={{ minHeight: "36px", padding: "0 0.8rem" }}
                        title="Purge Backup"
                      >
                        <Trash2 size={14} /> Purge
                      </button>
                    </>
                  )}
                  {r.status === "restored" && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Original Restored</span>
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
