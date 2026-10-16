import React, { useState, useEffect } from "react";
import { Sparkles, Play, CheckSquare, Square, RefreshCw, Calculator, TrendingDown } from "lucide-react";
import { EncodingProfile } from "../types";
import { useToast } from "../context/ToastContext";
import { api } from "../api";

interface RecommendationsProps {
  profiles: EncodingProfile[];
  onOpenDryRun: (mediaId: number, profileId: number) => void;
  onNavigateToQueue: () => void;
}

export const Recommendations: React.FC<RecommendationsProps> = ({
  profiles,
  onOpenDryRun,
  onNavigateToQueue,
}) => {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [libraryFilter, setLibraryFilter] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<number>(profiles[0]?.id || 1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isQueueing, setIsQueueing] = useState(false);

  const fetchCandidates = async () => {
    try {
      setIsLoading(true);
      const res = await api.getRecommendations({
        library: libraryFilter || undefined,
      });
      setCandidates(res);
      setSelectedIds([]);
    } catch (e) {
      console.error("Error fetching recommendations:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [libraryFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map((c) => c.media_item_id));
    }
  };

  const handleQueueBatch = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsQueueing(true);
      await api.enqueueBatch({
        media_item_ids: selectedIds,
        profile_id: selectedProfileId,
        replacement_mode: "replace_with_backup",
      });
      toast.success(`Queued ${selectedIds.length} candidate files for optimization!`, "Candidates Queued");
      onNavigateToQueue();
    } catch (err: any) {
      toast.error("Error queueing candidates: " + err.message, "Queue Error");
    } finally {
      setIsQueueing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSelectedSavings = candidates
    .filter((c) => selectedIds.includes(c.media_item_id))
    .reduce((acc, c) => acc + (c.estimated_saved_bytes || 0), 0);

  return (
    <div>
      {/* Responsive Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Smart Storage Optimization</h1>
          <p className="page-subtitle">
            Automated analysis detecting bloated bitrates, legacy codecs, and high-yield compression opportunities
          </p>
        </div>
        <div className="page-actions">
          <button onClick={fetchCandidates} className="btn btn-secondary btn-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Rescan Candidates
          </button>
        </div>
      </div>

      {/* Control Banner */}
      <div className="card" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", flex: "1 1 auto" }}>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Target Library</label>
            <select
              className="input"
              value={libraryFilter}
              onChange={(e) => setLibraryFilter(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">All Libraries</option>
              <option value="movies">Movies</option>
              <option value="tv">TV Shows</option>
              <option value="anime">Anime</option>
            </select>
          </div>

          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>Encoding Profile</label>
            <select
              className="input"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(Number(e.target.value))}
              style={{ width: "100%" }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.is_preset ? "(Preset)" : ""}</option>
              ))}
            </select>
          </div>

          {candidates.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-end", flex: "0 0 auto" }}>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="btn btn-secondary btn-sm"
                style={{ minHeight: "38px" }}
              >
                {selectedIds.length === candidates.length ? (
                  <>
                    <CheckSquare size={15} color="var(--accent-purple-light)" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square size={15} /> Select All ({candidates.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", flex: "1 1 auto", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Projected Storage Yield</div>
              <strong style={{ fontSize: "1.1rem", color: "var(--accent-emerald)" }}>
                ~{formatBytes(totalSelectedSavings)}
              </strong>
            </div>
            <button
              onClick={handleQueueBatch}
              disabled={isQueueing}
              className="btn btn-primary btn-sm"
              style={{ flex: "1 1 auto" }}
            >
              <Play size={16} /> {isQueueing ? "Queueing..." : `Queue ${selectedIds.length} Files`}
            </button>
          </div>
        )}
      </div>

      {/* Candidates Table (Desktop View) */}
      <div className="table-wrapper desktop-only">
        <table>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <button onClick={toggleSelectAll} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  {selectedIds.length === candidates.length && candidates.length > 0 ? (
                    <CheckSquare size={16} color="var(--accent-purple-light)" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th>Candidate File</th>
              <th>Library</th>
              <th>Codec / Res</th>
              <th>Current Size</th>
              <th>Density (MB/m)</th>
              <th>Est. Savings</th>
              <th>Recommendation Rationale</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No high-yield candidates found. Your media library is already efficiently encoded!
                </td>
              </tr>
            ) : (
              candidates.map((cand) => (
                <tr key={cand.media_item_id}>
                  <td>
                    <button onClick={() => toggleSelect(cand.media_item_id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                      {selectedIds.includes(cand.media_item_id) ? (
                        <CheckSquare size={16} color="var(--accent-purple-light)" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cand.filename}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-purple" style={{ textTransform: "capitalize" }}>
                      {cand.library}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-cyan">{cand.resolution}</span>{" "}
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{cand.video_codec.toUpperCase()}</span>
                  </td>
                  <td>
                    <strong>{formatBytes(cand.current_size_bytes)}</strong>
                  </td>
                  <td>
                    <span className="badge badge-amber">{cand.mb_per_minute} MB/m</span>
                  </td>
                  <td>
                    <div style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>
                      ~{formatBytes(cand.estimated_saved_bytes)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      ({cand.estimated_savings_percent}%)
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", maxWidth: "280px" }}>
                      {cand.reasons.join(" ")}
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => onOpenDryRun(cand.media_item_id, selectedProfileId)}
                      className="btn btn-secondary btn-sm"
                      title="Preview Dry Run"
                    >
                      <Calculator size={14} /> Dry Run
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Candidate Cards View */}
      <div className="mobile-only mobile-data-cards">
        {candidates.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
            No high-yield candidates found. Your media library is already efficiently encoded!
          </div>
        ) : (
          candidates.map((cand) => (
            <div key={cand.media_item_id} className="mobile-data-card">
              <div className="mobile-data-card-header">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", minWidth: 0, flex: 1 }}>
                  <button onClick={() => toggleSelect(cand.media_item_id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", marginTop: "1px" }}>
                    {selectedIds.includes(cand.media_item_id) ? <CheckSquare size={18} color="var(--accent-purple-light)" /> : <Square size={18} />}
                  </button>
                  <div className="mobile-data-card-title">{cand.filename}</div>
                </div>
                <span className="badge badge-emerald" style={{ fontSize: "0.7rem", flexShrink: 0 }}>
                  Save ~{cand.estimated_savings_percent}%
                </span>
              </div>

              <div className="mobile-data-card-meta">
                <span className="badge badge-purple" style={{ textTransform: "capitalize" }}>{cand.library}</span>
                <span className="badge badge-cyan">{cand.resolution}</span>
                <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>{cand.video_codec.toUpperCase()}</span>
                <span className="badge badge-amber">{cand.mb_per_minute} MB/m</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span>Current: <strong style={{ color: "var(--text-primary)" }}>{formatBytes(cand.current_size_bytes)}</strong></span>
                <span>Savings: <strong style={{ color: "var(--accent-emerald)" }}>~{formatBytes(cand.estimated_saved_bytes)}</strong></span>
              </div>

              {cand.reasons && cand.reasons.length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "rgba(15, 23, 42, 0.4)", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}>
                  💡 {cand.reasons.join(" ")}
                </div>
              )}

              <div className="mobile-data-card-actions">
                <button
                  onClick={() => onOpenDryRun(cand.media_item_id, selectedProfileId)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", minHeight: "36px" }}
                >
                  <Calculator size={14} /> Preview Dry Run Plan
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
