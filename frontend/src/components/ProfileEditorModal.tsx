import React, { useState } from "react";
import { X, Save, Sliders, Shield, Percent, Youtube, Info, Target, Sparkles } from "lucide-react";
import { EncodingProfile } from "../types";
import { api } from "../api";
import { useToast } from "../context/ToastContext";

interface ProfileEditorModalProps {
  profile?: EncodingProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({
  profile,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const isEditing = Boolean(profile && profile.id);

  const [formData, setFormData] = useState({
    name: profile?.name || "Custom Profile",
    description: profile?.description || "User-defined custom compression profile",
    video_codec: profile?.video_codec || "hevc",
    rate_control_mode: profile?.rate_control_mode || "crf",
    crf: profile?.crf !== undefined ? profile.crf : 21.0,
    target_bitrate_kbps: profile?.target_bitrate_kbps || 0,
    target_mb_per_minute: profile?.target_mb_per_minute !== undefined ? profile.target_mb_per_minute : 0.0,
    scale_down_percent: profile?.scale_down_percent !== undefined ? profile.scale_down_percent : 0,
    encoder_preset: profile?.encoder_preset || "medium",
    pixel_format: profile?.pixel_format || "yuv420p10le",
    resolution_mode: profile?.resolution_mode || "original",
    audio_policy: profile?.audio_policy || "copy_all",
    preferred_audio_codec: profile?.preferred_audio_codec || "copy",
    audio_bitrate_kbps: profile?.audio_bitrate_kbps || 192,
    subtitle_policy: profile?.subtitle_policy || "copy_all",
    preserve_hdr: profile?.preserve_hdr !== undefined ? profile.preserve_hdr : true,
    hdr_to_sdr_tonemap: profile?.hdr_to_sdr_tonemap || false,
    hwaccel_type: profile?.hwaccel_type || "auto",
    preferred_node_id: profile?.preferred_node_id || "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: string, value: any) => {
    if (field === "video_codec" && value === "youtube") {
      setFormData((prev) => ({
        ...prev,
        video_codec: "youtube",
        preferred_audio_codec: "opus",
        audio_policy: "transcode_all",
        audio_bitrate_kbps: 128,
        scale_down_percent: prev.scale_down_percent === 0 && prev.target_mb_per_minute === 0 ? 50 : prev.scale_down_percent,
        rate_control_mode: "target_bitrate",
      }));
      return;
    }
    if (field === "video_codec" && value === "av1") {
      setFormData((prev) => ({
        ...prev,
        video_codec: "av1",
        preferred_audio_codec: "opus",
        audio_policy: "transcode_all",
        audio_bitrate_kbps: 96,
        target_mb_per_minute: prev.target_mb_per_minute === 0 ? 8.5 : prev.target_mb_per_minute,
        resolution_mode: prev.resolution_mode === "original" ? "720p" : prev.resolution_mode,
        rate_control_mode: "target_bitrate",
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const payload = {
        ...formData,
        preferred_node_id: formData.preferred_node_id || null,
      };
      if (isEditing && profile) {
        await api.updateProfile(profile.id, payload);
      } else {
        await api.createProfile(payload);
      }
      toast.success(isEditing ? "Profile updated successfully!" : "Profile created successfully!");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Error saving profile: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sliders size={20} color="var(--accent-purple-light)" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {isEditing ? `Edit Profile: ${profile?.name}` : "Create Encoding Profile"}
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "0.4rem" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* General Info */}
          <div className="grid-two-col" style={{ gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                Profile Name
              </label>
              <input
                type="text"
                className="input"
                value={formData.name}
                disabled={profile?.is_preset}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                Target Resolution Limit
              </label>
              <select
                className="input"
                value={formData.resolution_mode}
                onChange={(e) => handleChange("resolution_mode", e.target.value)}
              >
                <option value="original">Keep Original Resolution (No upscale)</option>
                <option value="2160p">Max 4K (2160p)</option>
                <option value="1440p">Max 1440p</option>
                <option value="1080p">Max 1080p</option>
                <option value="720p">Max 720p</option>
                <option value="480p">Max 480p</option>
              </select>
            </div>
          </div>

          {/* Smart Target Size Budget (MB / Minute) */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem", border: "1px solid rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Target size={18} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-emerald)" }}>
                  Smart Target Size Budget (MB / Minute)
                </h3>
              </div>
              <span className="badge badge-emerald" style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                {formData.target_mb_per_minute > 0 ? `${formData.target_mb_per_minute} MB/min Target` : "Off (CRF Mode)"}
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Strict size constraint: every item encoded with this profile will strictly match this size budget regardless of source file size. At <strong>8.5 MB/min</strong>, a 2-hour movie strictly becomes <strong>~1 GB</strong>.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ flex: "1 1 200px" }}>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  className="input"
                  placeholder="e.g. 8.5"
                  value={formData.target_mb_per_minute || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    handleChange("target_mb_per_minute", val);
                    if (val > 0) {
                      handleChange("rate_control_mode", "target_bitrate");
                    }
                  }}
                  style={{ fontWeight: 700, fontSize: "1rem" }}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    handleChange("target_mb_per_minute", 8.5);
                    handleChange("resolution_mode", "720p");
                    handleChange("video_codec", "av1");
                    handleChange("preferred_audio_codec", "opus");
                    handleChange("audio_bitrate_kbps", 96);
                    handleChange("rate_control_mode", "target_bitrate");
                  }}
                  className={`btn btn-sm ${formData.target_mb_per_minute === 8.5 ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.75rem" }}
                >
                  🎯 8.5 MB/min (1 GB / 2hr)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("target_mb_per_minute", 12.0)}
                  className={`btn btn-sm ${formData.target_mb_per_minute === 12.0 ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.75rem" }}
                >
                  12 MB/min (~1.4 GB)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("target_mb_per_minute", 15.0)}
                  className={`btn btn-sm ${formData.target_mb_per_minute === 15.0 ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.75rem" }}
                >
                  15 MB/min (~1.8 GB)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("target_mb_per_minute", 0)}
                  className={`btn btn-sm ${formData.target_mb_per_minute === 0 ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.75rem" }}
                >
                  Clear (CRF Mode)
                </button>
              </div>
            </div>

            {formData.target_mb_per_minute > 0 ? (
              <div style={{ background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px", padding: "0.75rem", border: "1px solid rgba(16, 185, 129, 0.25)", fontSize: "0.78rem" }}>
                <div style={{ fontWeight: 700, color: "var(--accent-emerald)", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Sparkles size={14} />
                  <span>Dynamic Adaptation Projection:</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", color: "var(--text-secondary)" }}>
                  <div>🎬 2-hr Movie: <strong style={{ color: "var(--text-primary)" }}>{((formData.target_mb_per_minute * 120) / 1024).toFixed(2)} GB</strong> (~{Math.round(formData.target_mb_per_minute * 120)} MB)</div>
                  <div>📺 45-min Episode: <strong style={{ color: "var(--text-primary)" }}>{Math.round(formData.target_mb_per_minute * 45)} MB</strong></div>
                  <div>⚡ 24-min Anime/TV: <strong style={{ color: "var(--text-primary)" }}>{Math.round(formData.target_mb_per_minute * 24)} MB</strong></div>
                  <div>📡 Total Bitrate: <strong style={{ color: "var(--text-primary)" }}>~{Math.round((formData.target_mb_per_minute * 1024 * 1024 * 8) / 60000)} kbps</strong> (Video: ~{Math.max(100, Math.round((formData.target_mb_per_minute * 1024 * 1024 * 8) / 60000) - (formData.audio_bitrate_kbps || 96))}k + Audio: {formData.audio_bitrate_kbps || 96}k)</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Target File Size Scale-Down Slider */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem", border: "1px solid rgba(168, 85, 247, 0.35)", background: "rgba(168, 85, 247, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Percent size={18} color="var(--accent-purple-light)" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-purple-light)" }}>
                  Target File Size Scale-Down (%)
                </h3>
              </div>
              <span className="badge badge-purple" style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                {formData.scale_down_percent}% Scale Down
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Decide how much percentage to scale down the file size (0 to 100). When set to <strong>50%</strong>, the output will be approximately <strong>half the size</strong> of the original file.
            </p>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={formData.scale_down_percent}
              onChange={(e) => handleChange("scale_down_percent", parseInt(e.target.value) || 0)}
              style={{ width: "100%", accentColor: "var(--accent-purple-light)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.4rem" }}>
              <span>0% (No reduction)</span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "0.825rem",
                  color: formData.scale_down_percent === 50
                    ? "var(--accent-emerald)"
                    : formData.scale_down_percent === 0
                    ? "var(--text-muted)"
                    : "var(--accent-cyan)",
                }}
              >
                {formData.scale_down_percent === 0
                  ? "Off (Disabled)"
                  : formData.scale_down_percent === 50
                  ? "🎯 Exactly 50% (Half Size of Original File)"
                  : `Target: ~${100 - formData.scale_down_percent}% of original file (${formData.scale_down_percent}% smaller)`}
              </span>
              <span>100% (Max reduction)</span>
            </div>
          </div>

          {/* Video Codec & Quality Controls */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--accent-purple-light)" }}>
              Video Settings
            </h3>
            <div className="grid-two-col" style={{ gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Video Codec / Preset
                </label>
                <select
                  className="input"
                  value={formData.video_codec}
                  onChange={(e) => handleChange("video_codec", e.target.value)}
                >
                  <option value="hevc">H.265 / HEVC (Recommended)</option>
                  <option value="youtube">📺 YouTube Preset (GPU / AV1 Video + Opus Audio - Max Space Efficient)</option>
                  <option value="av1">AV1 (Next-Gen High Efficiency)</option>
                  <option value="h264">H.264 / AVC (Broad Compatibility)</option>
                  <option value="copy">Stream Copy (Remux without re-encoding)</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Encoding Speed Preset
                </label>
                <select
                  className="input"
                  value={formData.encoder_preset}
                  onChange={(e) => handleChange("encoder_preset", e.target.value)}
                >
                  <option value="veryslow">Very Slow (Max efficiency)</option>
                  <option value="slow">Slow (High quality)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="fast">Fast</option>
                  <option value="faster">Faster (Lower CPU load)</option>
                </select>
              </div>
            </div>

            {formData.video_codec === "youtube" && (
              <div style={{ padding: "0.6rem 0.8rem", borderRadius: "8px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", marginBottom: "1rem", fontSize: "0.78rem", color: "#fca5a5", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Youtube size={16} />
                <span>
                  <strong>YouTube Space-Efficient Preset Active:</strong> Encodes video using <strong>GPU Hardware Acceleration (NVENC / VAAPI / AV1)</strong> and audio using <strong>Opus (libopus)</strong>, YouTube's state-of-the-art streaming standards.
                </span>
              </div>
            )}

            {formData.video_codec !== "copy" && formData.scale_down_percent === 0 && formData.target_mb_per_minute === 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem", fontSize: "0.825rem" }}>
                  <span>Constant Rate Factor (CRF): <strong>{formData.crf}</strong></span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {formData.crf <= 18 ? "Extremely High Quality" : formData.crf <= 22 ? "High Visual Fidelity" : formData.crf <= 25 ? "Balanced Storage" : "Aggressive Compression"}
                  </span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="32"
                  step="0.5"
                  value={formData.crf}
                  onChange={(e) => handleChange("crf", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent-purple-light)" }}
                />
              </div>
            )}
            {formData.target_mb_per_minute > 0 && (
              <div style={{ fontSize: "0.78rem", color: "var(--accent-emerald)", marginTop: "0.5rem" }}>
                ⚡ <strong>Dynamic Rate Control Active:</strong> Video bitrate and frame quantizers will dynamically adapt to strictly meet your <strong>{formData.target_mb_per_minute} MB/min</strong> target.
              </div>
            )}
          </div>

          {/* Audio & Hardware Acceleration Policy */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--accent-cyan)" }}>
              Audio & Hardware Acceleration
            </h3>
            <div className="grid-two-col" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Audio Stream Policy
                </label>
                <select
                  className="input"
                  value={formData.audio_policy}
                  onChange={(e) => handleChange("audio_policy", e.target.value)}
                >
                  <option value="copy_all">Preserve All Audio Tracks (Copy Without Re-encoding)</option>
                  <option value="keep_surround_add_aac">Keep Original Surround + Add Stereo AAC Track</option>
                  <option value="transcode_all">Transcode All Tracks (AAC/Opus for storage)</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  Hardware Acceleration
                </label>
                <select
                  className="input"
                  value={formData.hwaccel_type}
                  onChange={(e) => handleChange("hwaccel_type", e.target.value)}
                >
                  <option value="auto">Auto-Detect (Prefer GPU - NVENC / VAAPI / QSV)</option>
                  <option value="cuda">NVIDIA NVENC / CUDA (GPU Accelerated)</option>
                  <option value="nvenc">NVIDIA NVENC (GPU Accelerated)</option>
                  <option value="vaapi">Force VAAPI (/dev/dri)</option>
                  <option value="qsv">Force Intel Quick Sync</option>
                  <option value="cpu_only">CPU Software Only (libx265)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Distributed Fleet Routing */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem", border: "1px solid rgba(168, 85, 247, 0.25)" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--accent-purple-light)" }}>
              Preferred Processing Node (Fleet Routing)
            </h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Specify which computer in your transcoding cluster should handle jobs queued with this profile.
            </p>
            <div>
              <select
                className="input"
                value={formData.preferred_node_id}
                onChange={(e) => handleChange("preferred_node_id", e.target.value)}
                style={{ width: "100%", borderColor: formData.preferred_node_id ? "var(--accent-purple-light)" : undefined }}
              >
                <option value="">🔄 Automatic / Any Available Node (Fleet Auto-Balance)</option>
                <option value="windows-node">🖥️ Windows PC (Quadro K620 GPU - Dedicated Desktop Worker)</option>
                <option value="local">🐧 Ubuntu Server (Local CPU / iGPU)</option>
              </select>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.4rem" }}>
                {formData.preferred_node_id === "windows-node" ? (
                  <span style={{ color: "var(--accent-emerald)" }}>
                    ✓ Jobs will be strictly routed to your Windows PC worker running NVIDIA NVENC hardware acceleration.
                  </span>
                ) : formData.preferred_node_id === "local" ? (
                  <span style={{ color: "var(--accent-cyan)" }}>
                    ✓ Jobs will strictly run locally on the Ubuntu home server.
                  </span>
                ) : (
                  <span>
                    ✓ Jobs can be leased dynamically by either the Ubuntu server or the Windows worker depending on availability.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subtitles & HDR */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formData.preserve_hdr}
                onChange={(e) => handleChange("preserve_hdr", e.target.checked)}
                style={{ accentColor: "var(--accent-purple-light)" }}
              />
              Preserve HDR10 & Color Metadata
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formData.subtitle_policy === "copy_all"}
                onChange={(e) => handleChange("subtitle_policy", e.target.checked ? "copy_all" : "none")}
                style={{ accentColor: "var(--accent-purple-light)" }}
              />
              Preserve All Subtitle Tracks (SRT, ASS, PGS)
            </label>
          </div>

          {/* Form Actions */}
          <div className="page-actions" style={{ justifyContent: "flex-end", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              <Save size={16} /> {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
