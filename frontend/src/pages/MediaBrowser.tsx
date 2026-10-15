import React, { useState, useEffect } from "react";
import { Search, Filter, Play, Eye, CheckSquare, Square, RefreshCw, Trash2, FolderSync } from "lucide-react";
import { MediaItem, EncodingProfile } from "../types";
import { api } from "../api";

interface MediaBrowserProps {
  profiles: EncodingProfile[];
  onOpenDetail: (media: MediaItem) => void;
  onOpenDryRun: (media: MediaItem, profileId: number) => void;
}

export const MediaBrowser: React.FC<MediaBrowserProps> = ({
  profiles,
  onOpenDetail,
  onOpenDryRun,
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [library, setLibrary] = useState("");
  const [videoCodec, setVideoCodec] = useState("");
  const [resolution, setResolution] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("mb_per_minute");

  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchProfileId, setBatchProfileId] = useState<number>(profiles[0]?.id || 1);
  const [isBatchQueueing, setIsBatchQueueing] = useState(false);

  const fetchMedia = async () => {
    try {
      setIsLoading(true);
      const res = await api.getMediaList({
        search,
        library: library || undefined,
        video_codec: videoCodec || undefined,
        resolution: resolution || undefined,
        optimization_status: status || undefined,
        sort_by: sortBy,
        sort_desc: true,
        page,
        page_size: pageSize,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error("Error fetching media:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [page, library, videoCodec, resolution, status, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMedia();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleBatchQueue = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBatchQueueing(true);
      await api.enqueueBatch({
        media_item_ids: selectedIds,
        profile_id: batchProfileId,
        replacement_mode: "replace_with_backup",
      });
      alert(`Queued ${selectedIds.length} media items for optimization!`);
      setSelectedIds([]);
      fetchMedia();
    } catch (err: any) {
      alert("Error queueing batch: " + err.message);
    } finally {
      setIsBatchQueueing(false);
    }
  };

  const handlePruneMissing = async () => {
    try {
      const res = await api.pruneMedia();
      alert(`Pruned ${res.pruned_count} missing media files from library database.`);
      fetchMedia();
    } catch (e: any) {
      alert("Error pruning missing files: " + e.message);
    }
  };

  const handleRescan = async () => {
    try {
      await api.triggerScan({ force_rescan: false });
      alert("Library scan started in background. Missing/deleted files will be pruned automatically.");
      setTimeout(fetchMedia, 3000);
    } catch (e: any) {
      alert("Error starting scan: " + e.message);
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
          <h1 className="page-title">Media Browser</h1>
          <p className="page-subtitle">
            Explore technical stream metadata, audio channels, and storage efficiency
          </p>
        </div>
        <div className="page-actions">
          <button onClick={handlePruneMissing} className="btn btn-secondary btn-sm" title="Remove records for files no longer on disk">
            <Trash2 size={16} /> Prune Missing
          </button>
          <button onClick={handleRescan} className="btn btn-secondary btn-sm" title="Scan libraries for new, changed or removed files">
            <FolderSync size={16} /> Rescan Libraries
          </button>
          <button onClick={fetchMedia} className="btn btn-secondary btn-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: "1.25rem" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <input
              type="text"
              placeholder="Search filename, title, or series..."
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "2.25rem" }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
          </div>
          <button type="submit" className="btn btn-secondary" style={{ flexShrink: 0 }}>Search</button>
        </form>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "0.75rem" }}>
          <select className="input" value={library} onChange={(e) => { setLibrary(e.target.value); setPage(1); }}>
            <option value="">All Libraries</option>
            <option value="movies">Movies</option>
            <option value="tv">TV Shows</option>
            <option value="anime">Anime</option>
          </select>

          <select className="input" value={videoCodec} onChange={(e) => { setVideoCodec(e.target.value); setPage(1); }}>
            <option value="">All Codecs</option>
            <option value="h264">H.264 / AVC</option>
            <option value="hevc">H.265 / HEVC</option>
            <option value="av1">AV1</option>
            <option value="mpeg2video">MPEG-2</option>
            <option value="vc1">VC-1</option>
          </select>

          <select className="input" value={resolution} onChange={(e) => { setResolution(e.target.value); setPage(1); }}>
            <option value="">All Resolutions</option>
            <option value="4K">4K (2160p)</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>

          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="unoptimized">Unoptimized</option>
            <option value="optimized">Optimized</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>

          <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="mb_per_minute">Highest MB/min</option>
            <option value="size_bytes">Largest File Size</option>
            <option value="duration_seconds">Longest Duration</option>
            <option value="filename">Filename</option>
          </select>

          {items.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="btn btn-secondary btn-sm"
              style={{ minHeight: "38px" }}
            >
              {selectedIds.length === items.length ? (
                <>
                  <CheckSquare size={15} color="var(--accent-purple-light)" /> Deselect Page
                </>
              ) : (
                <>
                  <Square size={15} /> Select Page ({items.length})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Batch Selection Banner */}
      {selectedIds.length > 0 && (
        <div style={{
          background: "rgba(168, 85, 247, 0.15)",
          border: "1px solid rgba(168, 85, 247, 0.4)",
          borderRadius: "var(--radius-md)",
          padding: "0.85rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            {selectedIds.length} media item{selectedIds.length > 1 ? "s" : ""} selected
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", width: "100%", maxWidth: "450px" }}>
            <select
              className="input"
              value={batchProfileId}
              onChange={(e) => setBatchProfileId(Number(e.target.value))}
              style={{ minWidth: "min(100%, 180px)", flex: "1 1 auto" }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleBatchQueue}
              disabled={isBatchQueueing}
              className="btn btn-primary btn-sm"
              style={{ flex: "1 1 auto" }}
            >
              <Play size={14} /> {isBatchQueueing ? "Queueing..." : "Queue Selected"}
            </button>
          </div>
        </div>
      )}

      {/* Media Items Table (Desktop View) */}
      <div className="table-wrapper desktop-only">
        <table>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <button onClick={toggleSelectAll} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  {selectedIds.length === items.length && items.length > 0 ? <CheckSquare size={16} color="var(--accent-purple-light)" /> : <Square size={16} />}
                </button>
              </th>
              <th>Media Title / Filename</th>
              <th>Library</th>
              <th>Video / Format</th>
              <th>Audio Tracks</th>
              <th>Size / Duration</th>
              <th>Density (MB/m)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  No media files found matching the selected filters.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button onClick={() => toggleSelect(item.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                      {selectedIds.includes(item.id) ? <CheckSquare size={16} color="var(--accent-purple-light)" /> : <Square size={16} />}
                    </button>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title || item.filename}
                    </div>
                    {item.series_name && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {item.series_name} S{item.season_number}E{item.episode_number}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-purple" style={{ textTransform: "capitalize" }}>
                      {item.library}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                      <span className="badge badge-cyan">{item.resolution}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{item.video_codec.toUpperCase()}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem" }}>
                      <strong>{item.audio_tracks_count} trk</strong> ({item.audio_languages})
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem" }}>
                      <strong>{formatBytes(item.size_bytes)}</strong>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        {Math.round(item.duration_seconds / 60)} min
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        item.mb_per_minute > 35 ? "badge-amber" : item.mb_per_minute > 25 ? "badge-purple" : "badge-emerald"
                      }`}
                    >
                      {item.mb_per_minute} MB/m
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        item.optimization_status === "optimized"
                          ? "badge-emerald"
                          : item.optimization_status === "processing"
                          ? "badge-cyan"
                          : item.optimization_status === "queued"
                          ? "badge-purple"
                          : item.optimization_status === "failed"
                          ? "badge-rose"
                          : "badge-amber"
                      }`}
                    >
                      {item.optimization_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        onClick={() => onOpenDetail(item)}
                        className="btn btn-secondary btn-sm"
                        title="View Streams & Metadata"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => onOpenDryRun(item, batchProfileId)}
                        className="btn btn-primary btn-sm"
                        title="Dry Run & Queue"
                      >
                        <Play size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Shown on small screens) */}
      <div className="mobile-only mobile-data-cards">
        {items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
            No media files found matching the selected filters.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="mobile-data-card">
              <div className="mobile-data-card-header">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", minWidth: 0, flex: 1 }}>
                  <button onClick={() => toggleSelect(item.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", marginTop: "1px" }}>
                    {selectedIds.includes(item.id) ? <CheckSquare size={18} color="var(--accent-purple-light)" /> : <Square size={18} />}
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div className="mobile-data-card-title">{item.title || item.filename}</div>
                    {item.series_name && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        {item.series_name} S{item.season_number}E{item.episode_number}
                      </div>
                    )}
                  </div>
                </div>
                <span className={`badge ${
                  item.optimization_status === "optimized" ? "badge-emerald" :
                  item.optimization_status === "processing" ? "badge-cyan" :
                  item.optimization_status === "queued" ? "badge-purple" :
                  item.optimization_status === "failed" ? "badge-rose" : "badge-amber"
                }`} style={{ fontSize: "0.68rem", flexShrink: 0 }}>
                  {item.optimization_status}
                </span>
              </div>

              <div className="mobile-data-card-meta">
                <span className="badge badge-purple" style={{ textTransform: "capitalize" }}>{item.library}</span>
                <span className="badge badge-cyan">{item.resolution}</span>
                <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>{item.video_codec.toUpperCase()}</span>
                {item.is_hdr && <span className="badge badge-amber">{item.hdr_format || "HDR"}</span>}
                <span className="badge badge-amber">{item.mb_per_minute} MB/m</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <span>Size: <strong style={{ color: "var(--text-primary)" }}>{formatBytes(item.size_bytes)}</strong></span>
                <span>Duration: <strong style={{ color: "var(--text-primary)" }}>{Math.round(item.duration_seconds / 60)} min</strong></span>
              </div>

              <div className="mobile-data-card-actions">
                <button
                  onClick={() => onOpenDetail(item)}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: "1 1 auto", minHeight: "36px" }}
                >
                  <Eye size={14} /> Details
                </button>
                <button
                  onClick={() => onOpenDryRun(item, batchProfileId)}
                  className="btn btn-primary btn-sm"
                  style={{ flex: "1 1 auto", minHeight: "36px" }}
                >
                  <Play size={14} /> Dry Run
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Showing {items.length} of {total} files
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span style={{ display: "flex", alignItems: "center", padding: "0 0.5rem", fontSize: "0.85rem" }}>
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * pageSize >= total}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
