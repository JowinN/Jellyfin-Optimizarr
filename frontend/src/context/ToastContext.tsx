import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, type, message, title };
    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (message: string, title?: string) => addToast("success", message, title),
    error: (message: string, title?: string) => addToast("error", message, title),
    info: (message: string, title?: string) => addToast("info", message, title),
    warning: (message: string, title?: string) => addToast("warning", message, title),
  };

  return (
    <ToastContext.Provider value={{ toast, dismissToast }}>
      {children}
      {/* Toast Notification Stack */}
      <div
        className="toast-stack"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          maxWidth: "min(92vw, 420px)",
          pointerEvents: "none",
        }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          let icon = <Info size={18} color="var(--primary)" />;
          let borderCol = "var(--border-color)";
          let bgContainer = "var(--bg-card)";
          if (t.type === "success") {
            icon = <CheckCircle2 size={18} color="var(--accent-emerald)" />;
            borderCol = "rgba(16, 185, 129, 0.35)";
          } else if (t.type === "error") {
            icon = <XCircle size={18} color="var(--accent-rose)" />;
            borderCol = "rgba(244, 63, 94, 0.4)";
          } else if (t.type === "warning") {
            icon = <AlertTriangle size={18} color="var(--accent-amber)" />;
            borderCol = "rgba(245, 158, 11, 0.4)";
          }

          return (
            <div
              key={t.id}
              className="card"
              style={{
                pointerEvents: "auto",
                padding: "0.85rem 1.15rem",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${borderCol}`,
                background: bgContainer,
                boxShadow: "var(--shadow-floating)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "0.75rem",
                animation: "pulseGlow 0.3s ease-out",
              }}
            >
              <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
                <div style={{ marginTop: "2px", flexShrink: 0 }}>{icon}</div>
                <div>
                  {t.title && (
                    <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)", marginBottom: "2px" }}>
                      {t.title}
                    </div>
                  )}
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {t.message}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="btn btn-secondary btn-icon"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "2px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  marginTop: "1px",
                }}
                aria-label="Dismiss toast"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
