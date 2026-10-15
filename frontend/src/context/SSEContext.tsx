import React, { createContext, useContext, useState, useEffect } from "react";

export interface ToastAlert {
  id: string;
  title: string;
  message: string;
  event_type: string;
  priority: string;
}

interface SSEContextType {
  isConnected: boolean;
  liveJobProgress: Record<number, { progress: number; fps: number; speed: number; eta_seconds: number }>;
  latestJobStatus: any;
  scanProgress: { is_scanning: boolean; library?: string; current_file?: string; scanned_count: number };
  notifications: ToastAlert[];
  dismissNotification: (id: string) => void;
}

const SSEContext = createContext<SSEContextType | undefined>(undefined);

export const SSEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [liveJobProgress, setLiveJobProgress] = useState<Record<number, any>>({});
  const [latestJobStatus, setLatestJobStatus] = useState<any>(null);
  const [scanProgress, setScanProgress] = useState<any>({ is_scanning: false, scanned_count: 0 });
  const [notifications, setNotifications] = useState<ToastAlert[]>([]);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource("/api/events");

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener("job_progress", (e) => {
        try {
          const data = JSON.parse(e.data);
          setLiveJobProgress((prev) => ({
            ...prev,
            [data.id]: data,
          }));
        } catch {}
      });

      eventSource.addEventListener("job_status", (e) => {
        try {
          const data = JSON.parse(e.data);
          setLatestJobStatus(data);
        } catch {}
      });

      eventSource.addEventListener("scan_progress", (e) => {
        try {
          const data = JSON.parse(e.data);
          setScanProgress({ is_scanning: true, ...data });
        } catch {}
      });

      eventSource.addEventListener("scan_finished", () => {
        setScanProgress({ is_scanning: false, scanned_count: 0 });
      });

      eventSource.addEventListener("notification", (e) => {
        try {
          const data = JSON.parse(e.data);
          const newAlert: ToastAlert = {
            id: Math.random().toString(36).substring(2, 9),
            title: data.title,
            message: data.message,
            event_type: data.event_type,
            priority: data.priority || "default",
          };
          setNotifications((prev) => [newAlert, ...prev.slice(0, 4)]);
        } catch {}
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        if (eventSource) {
          eventSource.close();
        }
        // Auto-reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <SSEContext.Provider
      value={{
        isConnected,
        liveJobProgress,
        latestJobStatus,
        scanProgress,
        notifications,
        dismissNotification,
      }}
    >
      {children}
    </SSEContext.Provider>
  );
};

export const useSSE = () => {
  const context = useContext(SSEContext);
  if (!context) throw new Error("useSSE must be used within an SSEProvider");
  return context;
};
