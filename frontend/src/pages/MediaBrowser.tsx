import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Play,
  Eye,
  CheckSquare,
  Square,
  RefreshCw,
  Trash2,
  FolderSync,
  Film,
  Tv,
  Layers,
  Sparkles,
  Sliders,
  X,
  ArrowUpDown,
} from "lucide-react";
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
  const [sortDesc, setSortDesc] = useState(true);

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
        sort_desc: sortDesc,
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
  }, [page, library, videoCodec, resolution, status, sortBy, sortDesc]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMedia();
  };

  const handleClearFilters = () => {
    setSearch("");
    setLibrary("");
    setVideoCodec("");
    setResolution("");
    setStatus("");
    setSortBy("mb_per_minute");
    setSortDesc(true);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search || library || videoCodec || resolution || status || sortBy !== "mb_per_minute"
  );

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
        replacement_mode: "safe_backup",
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
      alert(`Pruned ${res.pruned_count} missing media records from database.`);
      fetchMedia();
    } catch (e: any) {
      alert("Error pruning missing files: " + e.message);
    }
  };

  const handleRescan = async () => {
    try {
      await api.triggerScan({ force_rescan: false });
      alert("Library scan started in background. New files and storage changes will sync automatically.");
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

  const totalPages = Math.ceil(total / pageSize) || 1;

  const libraryTabs = [
    { id: "", label: "All Media", icon: Layers },
    { id: "movies", label: "Movies", icon: Film },
    { id: "tv", label: "TV Shows", icon: Tv },
    { id: "anime", label: "Anime", icon: Sparkles },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Media Library Browser</h1>
          <p className="page-subtitle">
            Inspect stream bitrates, codec profiles, video resolutions, and identify high-payoff compression targets
          </p>
        </div>
        <div className="page-actions">
          <button
            onClick={handlePruneMissing}
            className="btn btn-secondary btn-sm"
            title="Clean database records for deleted files"
          >
            <Trash2 size={15} /> Prune Missing
          </button>
          <button
            onClick={handleRescan}
            className="btn btn-secondary btn-sm"
            title="Scan file storage for changes"
          >
            <FolderSync size={15} /> Rescan Storage
          </button>
          <button onClick={fetchMedia} className="btn btn-secondary btn-sm">
            <RefreshCw size={15} className={isLoading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Library Pill Switcher */}
      <div className="segmented-tabs" style={{ marginBottom: "1rem" }}>
        {libraryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = library === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setLibrary(tab.id);
                setPage(1);
              }}
              className={`segmented-tab ${isActive ? "active" : ""}`}
            >
              <Icon size={15} color={isActive ? "var(--accent-purple-light)" : "var(--text-secondary)"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: "1.15rem 1.25rem" }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "0.85rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <input
              type="text"
              placeholder="Search filename, movie title, or series..."
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "2.35rem" }}
            />
            <Search
              size={16}
              color="var(--text-muted)"
              style={{
                position: "absolute",
                left: "0.85rem",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
            Search
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn btn-secondary"
              style={{ flexShrink: 0 }}
            >
              Reset Filters
            </button>
          )}
        </form>

        {/* Filter Dropdown Controls */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
            gap: "0.65rem",
          }}
        >
          <select
            className="input"
            value={videoCodec}
            onChange={(e) => {
              setVideoCodec(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Codecs</option>
            <option value="h264">H.264 / AVC</option>
            <option value="hevc">H.265 / HEVC</option>
            <option value="av1">AV1</option>
            <option value="mpeg2video">MPEG-2</option>
            <option value="vc1">VC-1</option>
          </select>

          <select
            className="input"
            value={resolution}
            onChange={(e) => {
              setResolution(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Resolutions</option>
            <option value="4K">4K (2160p)</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>

          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="unoptimized">Unoptimized</option>
            <option value="optimized">Optimized</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>

          <select
            className="input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="mb_per_minute">Highest MB/min</option>
            <option value="size_bytes">Largest File Size</option>
            <option value="duration_seconds">Longest Duration</option>
            <option value="filename">Filename (A-Z)</option>
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

      {/* Floating Batch Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "rgba(13, 18, 31, 0.96)",
            border: "1px solid var(--accent-purple-light)",
            boxShadow: "0 12px 35px rgba(0, 0, 0, 0.8), 0 0 25px rgba(139, 92, 246, 0.35)",
            borderRadius: "var(--radius-md)",
            padding: "0.85rem 1.35rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            maxWidth: "600px",
            width: "calc(100% - 2rem)",
            animation: "scaleUp 0.2s ease",
          }}
        >
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff", flex: 1 }}>
            {selectedIds.length} item{selectedIds.length > 1 ? "s" : ""} selected
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <select
              className="input"
              value={batchProfileId}
              onChange={(e) => setBatchProfileId(Number(e.target.value))}
              style={{ width: "auto", minWidth: "160px", padding: "0.45rem 0.75rem", fontSize: "0.8rem" }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleBatchQueue}
              disabled={isBatchQueueing}
              className="btn btn-primary btn-sm"
            >
              <Sparkles size={14} />
              <span>{isBatchQueueing ? "Queueing..." : "Queue Batch"}</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="btn btn-secondary btn-sm btn-icon"
              title="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop Media Table */}
      <div className="table-wrapper desktop-only">
        <table>
          <thead>
            <tr>
              <th style={{ width: "45px" }}></th>
              <th>Media Title / File</th>
              <th style={{ width: "110px" }}>Library</th>
              <th style={{ width: "160px" }}>Video Specs</th>
              <th style={{ width: "110px" }}>Size</th>
              <th style={{ width: "130px" }}>Efficiency</th>
              <th style={{ width: "110px" }}>Status</th>
              <th style={{ width: "130px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3.5rem 1rem", color: "var(--text-muted)" }}>
                  <Film size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
                  <div>No media files match your search criteria.</div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isHeavy = item.mb_per_minute > 20;

                return (
                  <tr key={item.id} style={{ background: isSelected ? "rgba(139, 92, 246, 0.08)" : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent-purple)" }}
                      />
                    </td>
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          maxWidth: "360px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                        }}
                        onClick={() => onOpenDetail(item)}
                        title={item.filename}
                      >
                        {item.filename}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                        {item.audio_codecs?.toUpperCase() || "AUDIO"} • {item.container_format?.toUpperCase() || "MEDIA"}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-purple" style={{ textTransform: "capitalize", fontSize: "0.68rem" }}>
                        {item.library}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                        <span className="badge badge-cyan" style={{ fontSize: "0.68rem" }}>
                          {item.resolution || "Unknown"}
                        </span>
                        <span className="badge" style={{ fontSize: "0.68rem", background: "rgba(255, 255, 255, 0.06)", color: "var(--text-secondary)" }}>
                          {item.video_codec?.toUpperCase() || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                      {formatBytes(item.size_bytes)}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: isHeavy ? "var(--accent-rose)" : "var(--accent-amber)",
                          }}
                        >
                          {item.mb_per_minute} MB/min
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {Math.round(item.duration_seconds / 60)} mins
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.optimization_status === "optimized"
                            ? "badge-emerald"
                            : item.optimization_status === "queued"
                            ? "badge-cyan"
                            : item.optimization_status === "failed"
                            ? "badge-rose"
                            : "badge-amber"
                        }`}
                        style={{ fontSize: "0.68rem" }}
                      >
                        {item.optimization_status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                        <button
                          onClick={() => onOpenDetail(item)}
                          className="btn btn-secondary btn-sm btn-icon"
                          title="Inspect Metadata"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => onOpenDryRun(item, batchProfileId)}
                          className="btn btn-secondary btn-sm btn-icon"
                          title="Simulate Dry Run"
                        >
                          <Play size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1.25rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Showing {items.length} of {total} total media files (Page {page} of {totalPages})
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
