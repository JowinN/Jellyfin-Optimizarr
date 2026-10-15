import React, { useState } from "react";
import { Sliders, Plus, Edit2, Trash2, Shield, CheckCircle, RotateCcw, Youtube } from "lucide-react";
import { EncodingProfile } from "../types";
import { ProfileEditorModal } from "../components/ProfileEditorModal";
import { api } from "../api";

interface ProfilesPageProps {
  profiles: EncodingProfile[];
  onRefreshProfiles: () => void;
}

export const ProfilesPage: React.FC<ProfilesPageProps> = ({ profiles, onRefreshProfiles }) => {
  const [selectedProfile, setSelectedProfile] = useState<EncodingProfile | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleOpenCreate = () => {
    setSelectedProfile(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (p: EncodingProfile) => {
    setSelectedProfile(p);
    setIsEditorOpen(true);
  };

  const handleDelete = async (id: number, name: string, isPreset: boolean) => {
    const confirmMsg = isPreset
      ? `Delete built-in profile '${name}'? You can restore default presets anytime.`
      : `Delete custom profile '${name}'?`;

    if (confirm(confirmMsg)) {
      try {
        await api.deleteProfile(id);
        onRefreshProfiles();
      } catch (e: any) {
        alert("Error: " + e.message);
      }
    }
  };

  const handleRestoreDefaults = async () => {
    if (confirm("Restore all missing built-in default presets?")) {
      try {
        setIsRestoring(true);
        await api.restoreDefaultProfiles();
        onRefreshProfiles();
      } catch (e: any) {
        alert("Error restoring defaults: " + e.message);
      } finally {
        setIsRestoring(false);
      }
    }
  };

  return (
    <div>
      {/* Responsive Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Encoding Profiles</h1>
          <p className="page-subtitle">
            Granular quality presets, YouTube high-efficiency codec scaling, and hardware acceleration mappings
          </p>
        </div>
        <div className="page-actions">
          <button onClick={handleRestoreDefaults} disabled={isRestoring} className="btn btn-secondary btn-sm" title="Restore any deleted default presets">
            <RotateCcw size={15} /> {isRestoring ? "Restoring..." : "Restore Built-ins"}
          </button>
          <button onClick={handleOpenCreate} className="btn btn-primary btn-sm">
            <Plus size={16} /> Create Custom Profile
          </button>
        </div>
      </div>

      {/* Profiles Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "1rem" }}>
        {profiles.map((p) => (
          <div
            key={p.id}
            className="card card-interactive"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              border: p.is_preset ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(168, 85, 247, 0.3)",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{p.name}</h3>
                {p.is_preset ? (
                  <span className="badge badge-purple" style={{ fontSize: "0.65rem" }}>
                    <Shield size={12} /> Built-in
                  </span>
                ) : (
                  <span className="badge badge-cyan" style={{ fontSize: "0.65rem" }}>
                    Custom
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem", minHeight: "2.4rem" }}>
                {p.description || "Custom user profile"}
              </p>

              {/* Settings Pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                {p.video_codec === "youtube" ? (
                  <span className="badge badge-purple" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                    📺 YOUTUBE (GPU / AV1 + OPUS)
                  </span>
                ) : (
                  <span className="badge badge-cyan">{p.video_codec.toUpperCase()}</span>
                )}
                {p.target_mb_per_minute > 0 ? (
                  <span className="badge badge-emerald" style={{ fontWeight: 700, background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgba(16, 185, 129, 0.4)" }}>
                    🎯 {p.target_mb_per_minute} MB/min (~{Math.round((p.target_mb_per_minute * 120 / 1024) * 10) / 10}GB / 2hr)
                  </span>
                ) : p.scale_down_percent > 0 ? (
                  <span className="badge badge-emerald" style={{ fontWeight: 700 }}>
                    📉 {p.scale_down_percent}% Scale Down {p.scale_down_percent === 50 ? "(Half Size)" : ""}
                  </span>
                ) : (
                  p.video_codec !== "copy" && <span className="badge badge-purple">CRF {p.crf}</span>
                )}
                <span className="badge badge-emerald">{p.resolution_mode}</span>
                <span className="badge badge-amber">{p.audio_policy}</span>
                {p.preserve_hdr && <span className="badge badge-purple">HDR10</span>}
                {p.preferred_node_id === "windows-node" ? (
                  <span className="badge badge-emerald">🖥️ Windows (Quadro K620)</span>
                ) : p.preferred_node_id === "local" ? (
                  <span className="badge badge-cyan">🐧 Ubuntu Server</span>
                ) : (
                  <span className="badge badge-amber">🔄 Any Fleet Node</span>
                )}
              </div>

              {/* Technical breakdown */}
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
                <div>Target Node: <strong style={{ color: p.preferred_node_id === "windows-node" ? "var(--accent-emerald)" : p.preferred_node_id === "local" ? "var(--accent-cyan)" : "var(--text-primary)" }}>{p.preferred_node_id === "windows-node" ? "🖥️ Windows PC (Quadro K620 GPU)" : p.preferred_node_id === "local" ? "🐧 Ubuntu Server (Local)" : "🔄 Any Available Node"}</strong></div>
                <div>Audio: {p.preferred_audio_codec === "opus" || p.video_codec === "youtube" ? "Opus (High-Efficiency)" : p.audio_policy === "copy_all" ? "Lossless Stream Copy" : p.preferred_audio_codec.toUpperCase()}</div>
                <div>Subtitles: {p.subtitle_policy === "copy_all" ? "Preserve All (SRT/ASS/PGS)" : "None"}</div>
                <div>Hardware: {p.hwaccel_type.toUpperCase()}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-color)" }}>
              <button onClick={() => handleOpenEdit(p)} className="btn btn-secondary btn-sm" style={{ flex: "1 1 auto", minHeight: "36px" }}>
                <Edit2 size={13} /> Edit
              </button>
              <button onClick={() => handleDelete(p.id, p.name, p.is_preset)} className="btn btn-danger btn-sm" style={{ flex: "1 1 auto", minHeight: "36px" }} title={p.is_preset ? "Delete built-in preset" : "Delete custom profile"}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {isEditorOpen && (
        <ProfileEditorModal
          profile={selectedProfile}
          onClose={() => setIsEditorOpen(false)}
          onSaved={onRefreshProfiles}
        />
      )}
    </div>
  );
};
