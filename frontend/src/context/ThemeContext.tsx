import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ThemePreset = "purple" | "blue" | "emerald" | "slate" | "monochrome";
export type InterfaceDensity = "comfortable" | "compact";
export type CornerStyle = "rounded" | "subtle";

interface ThemeContextType {
  mode: ThemeMode;
  resolvedTheme: "light" | "dark";
  preset: ThemePreset;
  density: InterfaceDensity;
  corners: CornerStyle;
  reducedMotion: boolean;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  setDensity: (density: InterfaceDensity) => void;
  setCorners: (corners: CornerStyle) => void;
  setReducedMotion: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY_MODE = "jmo_theme_mode";
const STORAGE_KEY_PRESET = "jmo_theme_preset";
const STORAGE_KEY_DENSITY = "jmo_theme_density";
const STORAGE_KEY_CORNERS = "jmo_theme_corners";
const STORAGE_KEY_MOTION = "jmo_theme_reduced_motion";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) || "system";
  });

  const [preset, setPresetState] = useState<ThemePreset>(() => {
    return (localStorage.getItem(STORAGE_KEY_PRESET) as ThemePreset) || "purple";
  });

  const [density, setDensityState] = useState<InterfaceDensity>(() => {
    return (localStorage.getItem(STORAGE_KEY_DENSITY) as InterfaceDensity) || "comfortable";
  });

  const [corners, setCornersState] = useState<CornerStyle>(() => {
    return (localStorage.getItem(STORAGE_KEY_CORNERS) as CornerStyle) || "rounded";
  });

  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_MOTION) === "true";
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  });

  // Listen for OS system theme changes
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "light" | "dark" = mode === "system" ? (systemIsDark ? "dark" : "light") : mode;

  // Synchronize HTML data attributes and meta tags immediately
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-theme-mode", mode);
    root.setAttribute("data-preset", preset);
    root.setAttribute("data-density", density);
    root.setAttribute("data-corners", corners);
    root.setAttribute("data-reduced-motion", reducedMotion ? "true" : "false");

    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute("content", resolvedTheme);
    }
  }, [resolvedTheme, mode, preset, density, corners, reducedMotion]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY_MODE, newMode);
  };

  const setPreset = (newPreset: ThemePreset) => {
    setPresetState(newPreset);
    localStorage.setItem(STORAGE_KEY_PRESET, newPreset);
  };

  const setDensity = (newDensity: InterfaceDensity) => {
    setDensityState(newDensity);
    localStorage.setItem(STORAGE_KEY_DENSITY, newDensity);
  };

  const setCorners = (newCorners: CornerStyle) => {
    setCornersState(newCorners);
    localStorage.setItem(STORAGE_KEY_CORNERS, newCorners);
  };

  const setReducedMotion = (enabled: boolean) => {
    setReducedMotionState(enabled);
    localStorage.setItem(STORAGE_KEY_MOTION, enabled ? "true" : "false");
  };

  const resetToDefaults = () => {
    setMode("system");
    setPreset("purple");
    setDensity("comfortable");
    setCorners("rounded");
    setReducedMotion(false);
  };

  return (
    <ThemeContext.Provider
      value={{
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
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
