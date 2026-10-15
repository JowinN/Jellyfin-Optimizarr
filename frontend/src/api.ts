import {
  MediaItem,
  EncodingProfile,
  EncodingJob,
  RollbackRecord,
  AnalyticsOverview,
  ServerSettings,
  DryRunPlan,
  ClusterNode,
  AutomationRule,
  AutomationRuleCreate,
  AutomationRuleUpdate,
  AutomationSeries,
  AutomationLibrary,
  AutomationEvaluateResult,
} from "./types";

const BASE_URL = "/api";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("jmo_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errorDetail = "An unexpected error occurred";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return {} as T;
}

export const api = {
  // Auth
  getAuthStatus: () => request<{ needs_setup: boolean }>("/auth/status"),
  setup: (data: any) => request<any>("/auth/setup", { method: "POST", body: JSON.stringify(data) }),
  login: (data: any) => request<any>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => request<any>("/auth/me"),
  changePassword: (data: any) => request<any>("/auth/change-password", { method: "POST", body: JSON.stringify(data) }),

  // Media
  getMediaList: (params: Record<string, any>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        query.append(k, String(v));
      }
    });
    return request<{ items: MediaItem[]; total: number; page: number; page_size: number; total_pages: number }>(
      `/media?${query.toString()}`
    );
  },
  getMediaDetail: (id: number) => request<MediaItem>(`/media/${id}`),
  triggerScan: (data: { force_rescan: boolean; libraries?: string[] }) =>
    request<{ message: string; is_scanning: boolean }>("/media/scan", { method: "POST", body: JSON.stringify(data) }),
  getScanStatus: () => request<any>("/media/scan/status"),
  cancelScan: () => request<any>("/media/scan/cancel", { method: "POST" }),
  pruneMedia: () => request<{ message: string; pruned_count: number }>("/media/prune", { method: "POST" }),

  // Profiles
  getProfiles: () => request<EncodingProfile[]>("/profiles"),
  getProfile: (id: number) => request<EncodingProfile>(`/profiles/${id}`),
  createProfile: (data: any) => request<EncodingProfile>("/profiles", { method: "POST", body: JSON.stringify(data) }),
  updateProfile: (id: number, data: any) => request<EncodingProfile>(`/profiles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProfile: (id: number) => request<any>(`/profiles/${id}`, { method: "DELETE" }),
  restoreDefaultProfiles: () => request<EncodingProfile[]>("/profiles/restore-defaults", { method: "POST" }),

  // Queue
  getQueueJobs: (statusFilter?: string) =>
    request<EncodingJob[]>(`/queue${statusFilter ? `?status_filter=${statusFilter}` : ""}`),
  enqueueJob: (data: { media_item_id: number; profile_id: number; replacement_mode?: string; priority?: number }) =>
    request<EncodingJob>("/queue", { method: "POST", body: JSON.stringify(data) }),
  enqueueBatch: (data: { media_item_ids: number[]; profile_id: number; replacement_mode?: string }) =>
    request<EncodingJob[]>("/queue/batch", { method: "POST", body: JSON.stringify(data) }),
  cancelJob: (id: number) => request<any>(`/queue/${id}/cancel`, { method: "POST" }),
  deleteJob: (id: number) => request<any>(`/queue/${id}`, { method: "DELETE" }),
  retryJob: (id: number) => request<any>(`/queue/${id}/retry`, { method: "POST" }),
  pauseQueue: () => request<any>("/queue/pause", { method: "POST" }),
  resumeQueue: () => request<any>("/queue/resume", { method: "POST" }),
  clearCompleted: () => request<any>("/queue/completed", { method: "DELETE" }),
  clearAllJobs: () => request<any>("/queue/clear-all", { method: "POST" }),

  // Recommendations & Dry-run
  getRecommendations: (params?: { library?: string; min_mb_per_minute?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.library) q.append("library", params.library);
    if (params?.min_mb_per_minute) q.append("min_mb_per_minute", String(params.min_mb_per_minute));
    if (params?.limit) q.append("limit", String(params.limit));
    return request<any[]>(`/recommendations?${q.toString()}`);
  },
  getDryRun: (media_item_id: number, profile_id: number) =>
    request<DryRunPlan>(`/recommendations/dry-run?media_item_id=${media_item_id}&profile_id=${profile_id}`, { method: "POST" }),

  // Rollback
  getRollbackRecords: () => request<RollbackRecord[]>("/rollback"),
  restoreRollback: (record_id: number) =>
    request<{ success: boolean; message: string }>("/rollback/restore", { method: "POST", body: JSON.stringify({ record_id, confirm: true }) }),
  purgeBackup: (record_id: number) => request<any>(`/rollback/${record_id}`, { method: "DELETE" }),
  restoreAllRollbacks: () =>
    request<{ message: string; restored_count: number; failed_count: number; errors: string[] }>("/rollback/restore-all", { method: "POST" }),
  purgeAllBackups: () =>
    request<{ message: string; purged_count: number; reclaimed_bytes: number }>("/rollback/purge-all", { method: "POST" }),

  // Analytics
  getAnalyticsOverview: () => request<AnalyticsOverview>("/analytics/overview"),
  getExportCsvUrl: () => `${BASE_URL}/analytics/export/csv`,

  // Settings & Diagnostics
  getSettings: () => request<ServerSettings>("/settings"),
  updateSettings: (data: any) => request<ServerSettings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  testJellyfin: (data: { url: string; api_key: string }) => request<any>("/settings/jellyfin/test", { method: "POST", body: JSON.stringify(data) }),
  getJellyfinLibraries: () => request<any[]>("/settings/jellyfin/libraries"),
  getDiagnostics: () => request<any>("/settings/diagnostics"),
  getHardwareDiagnostics: () => request<any>("/hardware/diagnostics"),
  getNodes: () => request<ClusterNode[]>("/nodes"),

  // Automation & Scheduled Optimization
  getAutomationRules: () => request<AutomationRule[]>("/automation/rules"),
  createAutomationRule: (data: AutomationRuleCreate) =>
    request<AutomationRule>("/automation/rules", { method: "POST", body: JSON.stringify(data) }),
  updateAutomationRule: (id: number, data: AutomationRuleUpdate) =>
    request<AutomationRule>(`/automation/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAutomationRule: (id: number) =>
    request<{ message: string }>(`/automation/rules/${id}`, { method: "DELETE" }),
  runAutomationRule: (id: number) =>
    request<AutomationEvaluateResult>(`/automation/rules/${id}/run`, { method: "POST" }),
  evaluateAllAutomation: () =>
    request<AutomationEvaluateResult[]>("/automation/evaluate", { method: "POST" }),
  getAutomationSeries: () => request<AutomationSeries[]>("/automation/series"),
  getAutomationLibraries: () => request<AutomationLibrary[]>("/automation/libraries"),
};
