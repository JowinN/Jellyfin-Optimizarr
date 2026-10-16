import React from "react";
import {
  Sun,
  Moon,
  Laptop,
  Palette,
  Layout,
  Maximize2,
  Minimize2,
  RotateCcw,
  Check,
  Zap,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  useTheme,
  ThemeMode,
  ThemePreset,
  InterfaceDensity,
  CornerStyle,
} from "../context/ThemeContext";

export const AppearanceSettings: React.FC = () => {
  const {
    mode,
    resolvedTheme,
    preset,
    density,
    corners,
    reducedMotion,
    setMode,
    setPreset,
    setDensity,
    setCorners,
    setReducedMotion,
    resetToDefaults,
  } = useTheme();

  const presets: { id: ThemePreset; name: string; desc: string; color: string; gradient: string }[] = [
    {
      id: "purple",
      name: "Material Purple",
      desc: "Vibrant high-contrast gradient inspired by modern media studios",
      color: "#8b5cf6",
      gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    },
    {
      id: "blue",
      name: "Material Blue",
      desc: "Enterprise-grade clarity with polished royal and sky blue accents",
      color: "#2563eb",
      gradient: "linear-gradient(135deg, #2563eb, #06b6d4)",
    },
    {
      id: "emerald",
      name: "Emerald Teal",
      desc: "Clean efficiency palette highlighting eco-friendly media savings",
      color: "#059669",
      gradient: "linear-gradient(135deg, #059669, #10b981)",
    },
    {
      id: "slate",
      name: "Slate Cyan",
      desc: "Technical precision theme with deep oceanic accents",
      color: "#0284c7",
      gradient: "linear-gradient(135deg, #0284c7, #38bdf8)",
    },
    {
      id: "monochrome",
      name: "Neutral Monochrome",
      desc: "Minimalist high-contrast greyscale with zero distraction",
      color: "#64748b",
      gradient: "linear-gradient(135deg, #475569, #94a3b8)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Theme Mode Selection */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-sm)",
              background: "var(--primary-container)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Palette size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Theme Mode
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Choose whether the application renders in light, dark, or synchronizes with your device
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.85rem",
          }}
        >
          {/* System Default */}
          <button
            type="button"
            onClick={() => setMode("system")}
            className={`btn ${mode === "system" ? "btn-primary" : "btn-secondary"}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "1rem",
              gap: "0.4rem",
              textAlign: "left",
              height: "auto",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <Laptop size={20} />
              {mode === "system" && <Check size={16} />}
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.92rem", marginTop: "0.25rem" }}>System Default</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.8 }}>
              Follows OS (Currently {resolvedTheme === "dark" ? "Dark" : "Light"})
            </div>
          </button>

          {/* Dark Mode */}
          <button
            type="button"
            onClick={() => setMode("dark")}
            className={`btn ${mode === "dark" ? "btn-primary" : "btn-secondary"}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "1rem",
              gap: "0.4rem",
              textAlign: "left",
              height: "auto",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <Moon size={20} />
              {mode === "dark" && <Check size={16} />}
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.92rem", marginTop: "0.25rem" }}>Dark Mode</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.8 }}>Low-glare OLED & night viewing</div>
          </button>

          {/* Light Mode */}
          <button
            type="button"
            onClick={() => setMode("light")}
            className={`btn ${mode === "light" ? "btn-primary" : "btn-secondary"}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "1rem",
              gap: "0.4rem",
              textAlign: "left",
              height: "auto",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <Sun size={20} />
              {mode === "light" && <Check size={16} />}
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.92rem", marginTop: "0.25rem" }}>Light Mode</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.8 }}>High-clarity daytime contrast</div>
          </button>
        </div>
      </div>

      {/* Preset Color Palettes */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-sm)",
              background: "var(--primary-container)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Color Preset
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Curated Material Design 3 palettes harmonized across charts, cards, buttons, and navigation
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.85rem",
          }}
        >
          {presets.map((p) => {
            const isSelected = preset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setPreset(p.id)}
                style={{
                  border: isSelected
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem",
                  cursor: "pointer",
                  background: isSelected
                    ? "var(--primary-container)"
                    : "var(--bg-card)",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: p.gradient,
                        boxShadow: isSelected ? `0 0 10px ${p.color}` : "none",
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                      {p.name}
                    </span>
                  </div>
                  {isSelected && <Check size={16} color="var(--primary)" />}
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {p.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Density & Surface Shape Customization */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {/* Interface Density */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
            <Layout size={18} color="var(--primary)" />
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Interface Density
            </h4>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.85rem" }}>
            Control component spacing and table row heights across all views
          </p>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setDensity("comfortable")}
              className={`btn ${density === "comfortable" ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1, padding: "0.6rem", justifyContent: "center", fontSize: "0.82rem" }}
            >
              <Maximize2 size={15} /> Comfortable
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={`btn ${density === "compact" ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1, padding: "0.6rem", justifyContent: "center", fontSize: "0.82rem" }}
            >
              <Minimize2 size={15} /> Compact
            </button>
          </div>
        </div>

        {/* Corner Style */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
            <Sliders size={18} color="var(--primary)" />
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Corner Radius Style
            </h4>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.85rem" }}>
            Configure curvature of cards, buttons, badges, and modals
          </p>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setCorners("rounded")}
              className={`btn ${corners === "rounded" ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1, padding: "0.6rem", justifyContent: "center", fontSize: "0.82rem" }}
            >
              Rounded (MD3)
            </button>
            <button
              type="button"
              onClick={() => setCorners("subtle")}
              className={`btn ${corners === "subtle" ? "btn-primary" : "btn-secondary"}`}
              style={{ flex: 1, padding: "0.6rem", justifyContent: "center", fontSize: "0.82rem" }}
            >
              Subtle (Sharp)
            </button>
          </div>
        </div>
      </div>

      {/* Live Interactive Preview */}
      <div className="card" style={{ border: "1px dashed var(--border-highlight)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Zap size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
              Live Theme Preview
            </span>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.75rem" }}
          >
            <RotateCcw size={14} /> Reset Defaults
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-sm">
              <Zap size={14} /> Primary Action
            </button>
            <button type="button" className="btn btn-secondary btn-sm">
              Secondary Action
            </button>
            <span className="badge badge-purple">Active Preset</span>
            <span className="badge badge-emerald">64.2% Saved</span>
            <span className="badge badge-cyan">AV1 + Opus</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Transcode Speed & Progress</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>82.4% (5.4x)</span>
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "var(--radius-full)",
                background: "rgba(128, 128, 128, 0.2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "82.4%",
                  height: "100%",
                  background: "var(--gradient-brand)",
                  borderRadius: "var(--radius-full)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
