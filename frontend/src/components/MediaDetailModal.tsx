import React, { useState } from "react";
import { X, Film, Volume2, Subtitles, Play, Calculator, ShieldCheck } from "lucide-react";
import { MediaItem, EncodingProfile } from "../types";
import { api } from "../api";

interface MediaDetailModalProps {
  media: MediaItem | null;
  profiles: EncodingProfile[];
  onClose: () => void;
  onDryRunRequested: (media: MediaItem, profileId: number) => void;
  onJobEnqueued: () => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  media,
  profiles,
  onClose,
  onDryRunRequested,
  onJobEnqueued,
}) => {
  if (!media) return null;

  const [selectedProfileId, setSelectedProfileId] = useState<number>(
    profiles.length > 0 ? profiles[0].id : 1
  );
  const [isQueueing, setIsQueueing] = useState(false);

  const streams = media.streams_detail || {};
  const audioTracks = streams.audio || [];
  const subtitleTracks = streams.subtitles || [];

  const handleQueue = async () => {
    try {
      setIsQueueing(true);
      await api.enqueueJob({
        media_item_id: media.id,
        profile_id: selectedProfileId,
        replacement_mode: "replace_with_backup",
      });
      alert(`Queued '${media.filename}' for optimization!`);
      onJobEnqueued();
      onClose();
    } catch (err: any) {
      alert("Error queueing job: " + err.message);
    } finally {
      setIsQueueing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="badge badge-purple">{media.library}</span>
              <span className="badge badge-cyan">{media.resolution}</span>
              {media.is_hdr && <span className="badge badge-amber">{media.hdr_format || "HDR"}</span>}
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>{media.filename}</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {media.path}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "0.4rem" }}>
            <X size={18} />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "0.75rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Size</div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{formatBytes(media.size_bytes)}</div>
          </div>
          <div className="card" style={{ padding: "0.75rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Duration</div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{Math.round(media.duration_seconds / 60)} mins</div>
          </div>
          <div className="card" style={{ padding: "0.75rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Storage Density</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: media.mb_per_minute > 30 ? "var(--accent-amber)" : "var(--accent-emerald)" }}>
              {media.mb_per_minute} MB/m
            </div>
          </div>
          <div className="card" style={{ padding: "0.75rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Video Codec</div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{media.video_codec.toUpperCase()}</div>
          </div>
        </div>

        {/* Video Technical Details */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
            <Film size={16} color="var(--accent-purple-light)" /> Video Stream
          </h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Resolution</th>
                  <th>Bit Depth</th>
                  <th>Framerate</th>
                  <th>Color Space</th>
                  <th>Bitrate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{media.width} x {media.height}</td>
                  <td>{media.bit_depth}-bit</td>
                  <td>{media.fps} fps</td>
                  <td>{media.is_hdr ? `${media.hdr_format} (BT.2020)` : "BT.709 (SDR)"}</td>
                  <td>{media.bitrate_kbps > 0 ? `${media.bitrate_kbps} kbps` : "N/A"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Audio Streams Details */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
            <Volume2 size={16} color="var(--accent-cyan)" /> Preserved Audio Streams ({audioTracks.length})
          </h3>
          {audioTracks.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No audio streams detected.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Track</th>
                    <th>Language</th>
                    <th>Codec</th>
                    <th>Channels</th>
                    <th>Attributes</th>
                  </tr>
                </thead>
                <tbody>
                  {audioTracks.map((a, i) => (
                    <tr key={i}>
                      <td>#{i + 1}</td>
                      <td><span className="badge badge-purple">{a.language}</span></td>
                      <td>{a.codec.toUpperCase()}</td>
                      <td>{a.channel_layout || `${a.channels} ch`}</td>
                      <td>
                        {a.is_default && <span className="badge badge-emerald" style={{ marginRight: "4px" }}>Default</span>}
                        {a.is_commentary && <span className="badge badge-amber">Commentary</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Subtitle Streams Details */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
            <Subtitles size={16} color="var(--accent-emerald)" /> Preserved Subtitles ({subtitleTracks.length})
          </h3>
          {subtitleTracks.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No subtitle tracks found.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Track</th>
                    <th>Language</th>
                    <th>Format</th>
                    <th>Type</th>
                    <th>Dispositions</th>
                  </tr>
                </thead>
                <tbody>
                  {subtitleTracks.map((s, i) => (
                    <tr key={i}>
                      <td>#{i + 1}</td>
                      <td><span className="badge badge-cyan">{s.language}</span></td>
                      <td>{s.codec.toUpperCase()}</td>
                      <td>{s.is_bitmap ? "Bitmap (PGS/VobSub)" : "Text (SRT/ASS)"}</td>
                      <td>
                        {s.is_default && <span className="badge badge-emerald" style={{ marginRight: "4px" }}>Default</span>}
                        {s.is_forced && <span className="badge badge-rose">Forced</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: "1 1 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", flexShrink: 0 }}>Profile:</label>
              <select
                className="input"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                style={{ minWidth: "min(100%, 180px)", flex: "1 1 auto" }}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.is_preset ? "(Preset)" : ""}</option>
                ))}
              </select>
            </div>
            {(() => {
              const currentProf = profiles.find((p) => p.id === selectedProfileId);
              const node = currentProf?.preferred_node_id;
              return (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Routes to:{" "}
                  {node === "windows-node" ? (
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>🖥️ Windows PC (Quadro K620 GPU)</span>
                  ) : node === "local" ? (
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>🐧 Ubuntu Server (Local)</span>
                  ) : (
                    <span>🔄 Any Available Fleet Node</span>
                  )}
                </div>
              );
            })()}
          </div>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", flex: "1 1 auto", justifyContent: "flex-end" }}>
            <button
              onClick={() => onDryRunRequested(media, selectedProfileId)}
              className="btn btn-secondary btn-sm"
              style={{ flex: "1 1 auto", minHeight: "38px" }}
            >
              <Calculator size={16} /> Dry Run Plan
            </button>
            <button
              onClick={handleQueue}
              disabled={isQueueing}
              className="btn btn-primary btn-sm"
              style={{ flex: "1 1 auto", minHeight: "38px" }}
            >
              <Play size={16} /> {isQueueing ? "Queueing..." : "Queue Optimize"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
