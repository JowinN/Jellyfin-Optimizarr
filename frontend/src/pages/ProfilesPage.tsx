import React, { useState } from "react";
import { Sliders, Plus, Edit2, Trash2, Shield, CheckCircle, RotateCcw, Zap, Cpu, Sparkles } from "lucide-react";
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
      ? `Delete built-in preset '${name}'? You can restore default presets anytime.`
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
    if (confirm("Restore all missing built-in default encoding presets?")) {
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
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Encoding Profiles & Codecs</h1>
          <p className="page-subtitle">
            Configure target bitrates, SVT-AV1 CPU presets, NVIDIA NVENC hardware acceleration, and audio preservation rules
          </p>
        </div>
        <div className="page-actions">
          <button
            onClick={handleRestoreDefaults}
            disabled={isRestoring}
            className="btn btn-secondary btn-sm"
            title="Restore missing factory default presets"
          >
            <RotateCcw size={15} className={isRestoring ? "spin" : ""} />
            {isRestoring ? "Restoring..." : "Restore Defaults"}
          </button>
          <button onClick={handleOpenCreate} className="btn btn-primary btn-sm">
            <Plus size={16} /> Create Custom Profile
          </button>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid-cards">
        {profiles.map((p) => {
          const isGpu =
            p.name.toLowerCase().includes("gpu") ||
            p.name.toLowerCase().includes("nvenc") ||
            p.video_codec.toLowerCase().includes("nvenc");

          return (
            <div
              key={p.id}
              className="card card-interactive"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: p.is_preset
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(139, 92, 246, 0.35)",
                background: "rgba(22, 30, 49, 0.55)",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    marginBottom: "0.65rem",
                  }}
                >
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {p.name}
                  </h3>
                  {p.is_preset ? (
                    <span className="badge badge-purple" style={{ fontSize: "0.66rem", flexShrink: 0 }}>
                      <Shield size={11} /> Factory Preset
                    </span>
                  ) : (
                    <span className="badge badge-cyan" style={{ fontSize: "0.66rem", flexShrink: 0 }}>
                      <Sparkles size={11} /> Custom
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    marginBottom: "1rem",
                    minHeight: "2.4rem",
                    lineHeight: 1.4,
                  }}
                >
                  {p.description || "Custom target profile"}
                </p>

                {/* Configuration Specs Pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                  <span
                    className="badge"
                    style={{
                      background: isGpu ? "rgba(16, 185, 129, 0.15)" : "rgba(6, 182, 212, 0.15)",
                      color: isGpu ? "#34d399" : "#38bdf8",
                      border: `1px solid ${isGpu ? "rgba(16, 185, 129, 0.3)" : "rgba(6, 182, 212, 0.3)"}`,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                    }}
                  >
                    {isGpu ? <Zap size={11} /> : <Cpu size={11} />}
                    {isGpu ? "GPU HWACCEL" : "CPU EFFICIENCY"}
                  </span>

                  <span className="badge badge-purple" style={{ fontSize: "0.68rem" }}>
                    {p.video_codec.toUpperCase()}
                  </span>

                  {p.target_mb_per_minute > 0 ? (
                    <span
                      className="badge badge-emerald"
                      style={{
                        fontWeight: 700,
                        fontSize: "0.68rem",
                        background: "rgba(16, 185, 129, 0.2)",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                      }}
                    >
                      🎯 {p.target_mb_per_minute} MB/min (~{Math.round((p.target_mb_per_minute * 120 / 1024) * 10) / 10} GB / 2hr)
                    </span>
                  ) : (
                    <span className="badge badge-cyan" style={{ fontSize: "0.68rem" }}>
                      CRF {p.crf}
                    </span>
                  )}

                  {p.max_height > 0 && (
                    <span className="badge" style={{ fontSize: "0.68rem", background: "rgba(255, 255, 255, 0.06)", color: "var(--text-secondary)" }}>
                      Max {p.max_height}p
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  paddingTop: "0.85rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="btn btn-secondary btn-sm"
                  title="Configure profile arguments"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id, p.name, p.is_preset)}
                  className="btn btn-danger btn-sm btn-icon"
                  title="Delete profile"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Profile Modal Editor */}
      {isEditorOpen && (
        <ProfileEditorModal
          profile={selectedProfile}
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => {
            setIsEditorOpen(false);
            onRefreshProfiles();
          }}
        />
      )}
    </div>
  );
};
