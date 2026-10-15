import React, { useState, useEffect } from "react";
import {
  CalendarClock,
  Sparkles,
  Play,
  Plus,
  Trash2,
  Edit2,
  Film,
  Tv,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  RefreshCw,
  HardDrive,
  Cpu,
  Sliders,
  Check,
  X,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  AutomationRule,
  AutomationRuleCreate,
  AutomationRuleUpdate,
  AutomationSeries,
  AutomationLibrary,
  EncodingProfile,
  ClusterNode,
} from "../types";
import { api } from "../api";
import { useSSE } from "../context/SSEContext";

interface AutomationPageProps {
  profiles: EncodingProfile[];
  onNavigateToQueue?: () => void;
}

export const AutomationPage: React.FC<AutomationPageProps> = ({
  profiles,
  onNavigateToQueue,
}) => {
  const { isConnected } = useSSE();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [seriesList, setSeriesList] = useState<AutomationSeries[]>([]);
  const [libraryList, setLibraryList] = useState<AutomationLibrary[]>([]);
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluatingAll, setIsEvaluatingAll] = useState<boolean>(false);
  const [runningRuleId, setRunningRuleId] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  // Form Fields
  const [formName, setFormName] = useState<string>("");
  const [formScopeType, setFormScopeType] = useState<"all" | "library" | "series">("series");
  const [formTargetLibrary, setFormTargetLibrary] = useState<string>("tv");
  const [formTargetSeriesName, setFormTargetSeriesName] = useState<string>("");
  const [formCustomSeriesInput, setFormCustomSeriesInput] = useState<string>("");
  const [formProfileId, setFormProfileId] = useState<number>(1);
  const [formAssignedNodeId, setFormAssignedNodeId] = useState<string>("windows-node");
  const [formReplacementMode, setFormReplacementMode] = useState<"safe_backup" | "in_place">("safe_backup");
  const [formPriority, setFormPriority] = useState<number>(5);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formAutoEncodeNew, setFormAutoEncodeNew] = useState<boolean>(true);
  const [formAutoEncodeExisting, setFormAutoEncodeExisting] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rulesData, seriesData, libData, nodesData] = await Promise.all([
        api.getAutomationRules(),
        api.getAutomationSeries().catch(() => []),
        api.getAutomationLibraries().catch(() => []),
        api.getNodes().catch(() => []),
      ]);
      setRules(rulesData);
      setSeriesList(seriesData);
      setLibraryList(libData);
      setNodes(nodesData);
    } catch (e) {
      console.error("Failed to load automation data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = (presetSeries?: string, presetScope?: "all" | "library" | "series") => {
    setEditingRule(null);
    const defaultScope = presetScope || (presetSeries ? "series" : "series");
    setFormScopeType(defaultScope);
    
    // Pick first series if available
    const initialSeries = presetSeries || (seriesList.length > 0 ? seriesList[0].series_name : "SpongeBob SquarePants");
    setFormTargetSeriesName(initialSeries);
    setFormCustomSeriesInput("");
    setFormTargetLibrary("tv");
    
    // Choose appropriate initial profile (prefer youtube space saver if exists)
    const ytProfile = profiles.find((p) => p.name.toLowerCase().includes("youtube"));
    setFormProfileId(ytProfile ? ytProfile.id : (profiles[0]?.id || 1));
    
    // Default node
    setFormAssignedNodeId("windows-node");
    setFormReplacementMode("safe_backup");
    setFormPriority(5);
    setFormIsActive(true);
    setFormAutoEncodeNew(true);
    setFormAutoEncodeExisting(true);

    if (defaultScope === "series") {
      setFormName(`Auto Encode ${initialSeries}`);
    } else if (defaultScope === "library") {
      setFormName("Auto Encode TV Library");
    } else {
      setFormName("Global Media Optimizer");
    }

    setIsModalOpen(true);
  };

  const openEditModal = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormScopeType(rule.scope_type);
    setFormTargetLibrary(rule.target_library || "tv");
    setFormTargetSeriesName(rule.target_series_name || "");
    setFormCustomSeriesInput("");
    setFormProfileId(rule.profile_id);
    setFormAssignedNodeId(rule.assigned_node_id || "windows-node");
    setFormReplacementMode(rule.replacement_mode as any);
    setFormPriority(rule.priority);
    setFormIsActive(rule.is_active);
    setFormAutoEncodeNew(rule.auto_encode_new);
    setFormAutoEncodeExisting(rule.auto_encode_existing);
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Please enter a rule name.");
      return;
    }

    const seriesFinal = formCustomSeriesInput.trim() || formTargetSeriesName;
    if (formScopeType === "series" && !seriesFinal) {
      alert("Please select or type a series name.");
      return;
    }

    setIsSaving(true);
    try {
      const selectedNode = nodes.find((n) => n.node_id === formAssignedNodeId);
      const assignedNodeName = selectedNode ? selectedNode.name : (formAssignedNodeId === "windows-node" ? "Windows PC (Quadro K620)" : "Ubuntu Server (Local)");

      if (editingRule) {
        const updatePayload: AutomationRuleUpdate = {
          name: formName.trim(),
          scope_type: formScopeType,
          target_library: formScopeType === "library" ? formTargetLibrary : undefined,
          target_series_name: formScopeType === "series" ? seriesFinal : undefined,
          profile_id: formProfileId,
          assigned_node_id: formAssignedNodeId,
          assigned_node_name: assignedNodeName,
          replacement_mode: formReplacementMode,
          priority: formPriority,
          is_active: formIsActive,
          auto_encode_new: formAutoEncodeNew,
          auto_encode_existing: formAutoEncodeExisting,
        };
        await api.updateAutomationRule(editingRule.id, updatePayload);
        setFeedbackMessage(`Updated rule "${formName}"`);
      } else {
        const createPayload: AutomationRuleCreate = {
          name: formName.trim(),
          scope_type: formScopeType,
          target_library: formScopeType === "library" ? formTargetLibrary : undefined,
          target_series_name: formScopeType === "series" ? seriesFinal : undefined,
          profile_id: formProfileId,
          assigned_node_id: formAssignedNodeId,
          assigned_node_name: assignedNodeName,
          replacement_mode: formReplacementMode,
          priority: formPriority,
          is_active: formIsActive,
          auto_encode_new: formAutoEncodeNew,
          auto_encode_existing: formAutoEncodeExisting,
        };
        const created = await api.createAutomationRule(createPayload);
        setFeedbackMessage(`Created automation rule "${created.name}"!`);
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert("Error saving rule: " + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRuleActive = async (rule: AutomationRule) => {
    try {
      await api.updateAutomationRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      );
    } catch (e: any) {
      alert("Failed to toggle rule: " + e.message);
    }
  };

  const handleDeleteRule = async (rule: AutomationRule) => {
    if (!confirm(`Are you sure you want to delete rule "${rule.name}"?`)) return;
    try {
      await api.deleteAutomationRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setFeedbackMessage(`Deleted rule "${rule.name}"`);
    } catch (e: any) {
      alert("Failed to delete rule: " + e.message);
    }
  };

  const handleRunRule = async (rule: AutomationRule) => {
    setRunningRuleId(rule.id);
    try {
      const res = await api.runAutomationRule(rule.id);
      setFeedbackMessage(res.message);
      await fetchData();
    } catch (e: any) {
      alert("Error executing rule: " + e.message);
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleEvaluateAll = async () => {
    setIsEvaluatingAll(true);
    try {
      const results = await api.evaluateAllAutomation();
      const totalQueued = results.reduce((acc, r) => acc + r.queued_jobs, 0);
      setFeedbackMessage(
        `Automated evaluation complete: ${totalQueued} new optimization job(s) queued across ${results.length} active rule(s).`
      );
      await fetchData();
    } catch (e: any) {
      alert("Error running evaluation: " + e.message);
    } finally {
      setIsEvaluatingAll(false);
    }
  };

  // Aggregated Stats
  const activeCount = rules.filter((r) => r.is_active).length;
  const totalMatched = rules.reduce((acc, r) => acc + (r.matched_count || 0), 0);
  const totalQueued = rules.reduce((acc, r) => acc + (r.queued_count || 0), 0);
  const totalCompleted = rules.reduce((acc, r) => acc + (r.completed_count || 0), 0);

  return (
    <div style={{ paddingBottom: "3rem" }}>
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            right: "24px",
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid var(--accent-purple-light)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            maxWidth: "420px",
            animation: "slideIn 0.3s ease",
          }}
        >
          <CheckCircle2 size={18} color="var(--accent-emerald)" />
          <span style={{ fontSize: "0.85rem", color: "var(--text-primary)", flex: 1 }}>
            {feedbackMessage}
          </span>
          <button
            onClick={() => setFeedbackMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <h1 className="page-title">Automated Scheduling</h1>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "var(--radius-full)",
                background: "rgba(168, 85, 247, 0.15)",
                color: "var(--accent-purple-light)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Auto Optimizer
            </span>
          </div>
          <p className="page-subtitle">
            Configure rules to automatically optimize media by series (e.g. SpongeBob, Pokémon),
            entire library, or all items. Existing unoptimized files and future incoming downloads
            are automatically scheduled and encoded.
          </p>
        </div>

        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={handleEvaluateAll}
            disabled={isEvaluatingAll || rules.length === 0}
            title="Evaluate all active rules and queue unoptimized items"
          >
            <RefreshCw size={15} className={isEvaluatingAll ? "spin" : ""} />
            <span>{isEvaluatingAll ? "Evaluating..." : "Evaluate All Rules"}</span>
          </button>

          <button className="btn btn-primary" onClick={() => openCreateModal()}>
            <Plus size={16} />
            <span>New Automation Rule</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid-kpi">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
              Active Rules
            </span>
            <CalendarClock size={16} color="var(--accent-purple-light)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>
            {activeCount} <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {rules.length} total</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Runs every 60s & on library scans
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
              Target Media in Scope
            </span>
            <Layers size={16} color="var(--accent-cyan)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
            {totalMatched}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Items covered across all rules
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
              Auto-Queued Jobs
            </span>
            <Zap size={16} color="var(--accent-amber)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-amber)" }}>
            {totalQueued}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Sent to encoding worker nodes
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
              Encoded & Optimized
            </span>
            <CheckCircle2 size={16} color="var(--accent-emerald)" />
          </div>
          <div className="kpi-value" style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
            {totalCompleted}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Completed successfully
          </div>
        </div>
      </div>

      {/* Rules List / Cards */}
      {isLoading ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <RefreshCw size={28} className="spin" style={{ color: "var(--accent-purple-light)", margin: "0 auto 1rem" }} />
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading automation rules...</div>
        </div>
      ) : rules.length === 0 ? (
        /* Empty State with Quick Presets */
        <div
          className="card"
          style={{
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)",
            border: "1px dashed rgba(168, 85, 247, 0.3)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "var(--gradient-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.4)",
            }}
          >
            <CalendarClock size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            No Automation Rules Configured
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", maxWidth: "540px", margin: "0 auto 1.5rem" }}>
            Set up an optimizer schedule once, and let Jellyfin Optimizer automatically encode both
            your existing backlog and any newly scanned episodes or movies in the background.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {seriesList.slice(0, 3).map((s) => (
              <button
                key={s.series_name}
                className="btn btn-secondary"
                onClick={() => openCreateModal(s.series_name, "series")}
                style={{ fontSize: "0.82rem", padding: "0.5rem 1rem" }}
              >
                <Tv size={14} color="var(--accent-purple-light)" />
                <span>Auto-Encode {s.series_name}</span>
                <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>({s.unoptimized_episodes} unoptimized)</span>
              </button>
            ))}
            <button
              className="btn btn-secondary"
              onClick={() => openCreateModal(undefined, "library")}
              style={{ fontSize: "0.82rem", padding: "0.5rem 1rem" }}
            >
              <Film size={14} color="var(--accent-cyan)" />
              <span>Auto-Encode All TV Shows</span>
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => openCreateModal()} style={{ padding: "0.65rem 1.75rem" }}>
            <Plus size={16} />
            <span>Create Custom Rule</span>
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {rules.map((rule) => {
            const isRunning = runningRuleId === rule.id;
            const completionPercent =
              rule.matched_count > 0 ? Math.round((rule.completed_count / rule.matched_count) * 100) : 0;

            return (
              <div
                key={rule.id}
                className="card card-interactive"
                style={{
                  padding: "1.25rem",
                  borderLeft: rule.is_active
                    ? "4px solid var(--accent-purple-light)"
                    : "4px solid var(--text-muted)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  {/* Left: Title & Scopes */}
                  <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {rule.name}
                      </h3>

                      {/* Scope Badge */}
                      {rule.scope_type === "all" && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "var(--radius-full)",
                            background: "rgba(6, 182, 212, 0.15)",
                            color: "var(--accent-cyan)",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontWeight: 600,
                          }}
                        >
                          <Layers size={12} /> All Library Items
                        </span>
                      )}

                      {rule.scope_type === "library" && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "var(--radius-full)",
                            background: "rgba(168, 85, 247, 0.15)",
                            color: "var(--accent-purple-light)",
                            border: "1px solid rgba(168, 85, 247, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          <Film size={12} /> Library: {rule.target_library}
                        </span>
                      )}

                      {rule.scope_type === "series" && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "var(--radius-full)",
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "var(--accent-emerald)",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontWeight: 600,
                          }}
                        >
                          <Tv size={12} /> Series: {rule.target_series_name}
                        </span>
                      )}

                      {/* Priority pill */}
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          padding: "0.1rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        Priority {rule.priority}
                      </span>
                    </div>

                    {/* Secondary tags */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.78rem" }}>
                      <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Sliders size={13} color="var(--accent-purple-light)" />
                        <strong>Profile:</strong> {rule.profile_name || `Profile #${rule.profile_id}`}
                        {rule.video_codec && (
                          <span style={{ opacity: 0.7, textTransform: "uppercase", fontSize: "0.7rem" }}>
                            ({rule.video_codec})
                          </span>
                        )}
                      </span>

                      <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Cpu size={13} color="var(--accent-cyan)" />
                        <strong>Node:</strong> {rule.assigned_node_name || rule.assigned_node_id || "Any Node"}
                      </span>

                      <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <HardDrive size={13} color="var(--accent-amber)" />
                        {rule.replacement_mode === "safe_backup" ? "Safe Backup" : "In-Place"}
                      </span>
                    </div>

                    {/* Mode Flags */}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                      {rule.auto_encode_new && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "0.1rem 0.45rem",
                            borderRadius: "4px",
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "var(--accent-emerald)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <Zap size={11} /> Auto-encodes upcoming newly added media
                        </span>
                      )}
                      {rule.auto_encode_existing && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "0.1rem 0.45rem",
                            borderRadius: "4px",
                            background: "rgba(6, 182, 212, 0.1)",
                            color: "var(--accent-cyan)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <Layers size={11} /> Auto-encodes previous / backlog media
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions & Active Toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Active toggle button */}
                    <button
                      className="btn"
                      onClick={() => handleToggleRuleActive(rule)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.75rem",
                        background: rule.is_active
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(255, 255, 255, 0.05)",
                        color: rule.is_active ? "var(--accent-emerald)" : "var(--text-muted)",
                        border: `1px solid ${rule.is_active ? "rgba(16, 185, 129, 0.4)" : "var(--border-color)"}`,
                      }}
                      title={rule.is_active ? "Click to pause schedule" : "Click to activate schedule"}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: rule.is_active ? "var(--accent-emerald)" : "var(--text-muted)",
                        }}
                      />
                      <span>{rule.is_active ? "Active" : "Paused"}</span>
                    </button>

                    {/* Run Now Trigger */}
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleRunRule(rule)}
                      disabled={isRunning || !rule.is_active}
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                      title="Run rule immediately to catch up any unoptimized items"
                    >
                      <Play size={13} className={isRunning ? "spin" : ""} color="var(--accent-purple-light)" />
                      <span>{isRunning ? "Running..." : "Run Catch-up"}</span>
                    </button>

                    {/* Edit */}
                    <button
                      className="btn btn-secondary"
                      onClick={() => openEditModal(rule)}
                      style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                      title="Edit rule"
                    >
                      <Edit2 size={13} />
                    </button>

                    {/* Delete */}
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDeleteRule(rule)}
                      style={{
                        padding: "0.35rem 0.6rem",
                        fontSize: "0.75rem",
                        color: "var(--accent-rose)",
                      }}
                      title="Delete rule"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress & Telemetry Bar */}
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.25)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.78rem" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Scope Total: </span>
                      <strong style={{ color: "var(--text-primary)" }}>{rule.matched_count} items</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Queued: </span>
                      <strong style={{ color: "var(--accent-amber)" }}>{rule.queued_count}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Completed: </span>
                      <strong style={{ color: "var(--accent-emerald)" }}>{rule.completed_count}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Last Run: </span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {rule.last_run_at ? new Date(rule.last_run_at).toLocaleString() : "Pending first run"}
                      </span>
                    </div>
                  </div>

                  {rule.matched_count > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: "160px" }}>
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "3px",
                          background: "rgba(255, 255, 255, 0.1)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${completionPercent}%`,
                            height: "100%",
                            background: "var(--gradient-brand)",
                            borderRadius: "3px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                        {completionPercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT RULE MODAL */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsModalOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100dvh",
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "1rem",
            boxSizing: "border-box",
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "640px",
              width: "100%",
              maxHeight: "88dvh",
              overflowY: "auto",
              position: "relative",
              zIndex: 100000,
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(168, 85, 247, 0.25)",
              padding: "1.75rem",
              boxSizing: "border-box",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <CalendarClock size={20} color="var(--accent-purple-light)" />
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                  {editingRule ? "Edit Automation Rule" : "Create Automation Rule"}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* 1. Rule Name */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Auto Encode SpongeBob to AV1"
                  required
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    fontSize: "0.88rem",
                  }}
                />
              </div>

              {/* 2. Scope Selection */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                  Target Optimization Scope *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormScopeType("series");
                      if (!formName || formName.startsWith("Auto")) {
                        setFormName(`Auto Encode ${formTargetSeriesName || "Series"}`);
                      }
                    }}
                    style={{
                      padding: "0.65rem 0.5rem",
                      borderRadius: "var(--radius-md)",
                      border: formScopeType === "series" ? "1px solid var(--accent-emerald)" : "1px solid var(--border-color)",
                      background: formScopeType === "series" ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      color: formScopeType === "series" ? "var(--accent-emerald)" : "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.3rem",
                      textAlign: "center",
                    }}
                  >
                    <Tv size={18} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Specific Series</span>
                    <span style={{ fontSize: "0.68rem", opacity: 0.7 }}>SpongeBob, Pokémon...</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormScopeType("library");
                      if (!formName || formName.startsWith("Auto")) {
                        setFormName(`Auto Encode ${formTargetLibrary.toUpperCase()} Library`);
                      }
                    }}
                    style={{
                      padding: "0.65rem 0.5rem",
                      borderRadius: "var(--radius-md)",
                      border: formScopeType === "library" ? "1px solid var(--accent-purple-light)" : "1px solid var(--border-color)",
                      background: formScopeType === "library" ? "rgba(168, 85, 247, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      color: formScopeType === "library" ? "var(--accent-purple-light)" : "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.3rem",
                      textAlign: "center",
                    }}
                  >
                    <Film size={18} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Specific Library</span>
                    <span style={{ fontSize: "0.68rem", opacity: 0.7 }}>TV, Movies, Anime</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormScopeType("all");
                      if (!formName || formName.startsWith("Auto")) {
                        setFormName("Global Media Optimizer (All Items)");
                      }
                    }}
                    style={{
                      padding: "0.65rem 0.5rem",
                      borderRadius: "var(--radius-md)",
                      border: formScopeType === "all" ? "1px solid var(--accent-cyan)" : "1px solid var(--border-color)",
                      background: formScopeType === "all" ? "rgba(6, 182, 212, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      color: formScopeType === "all" ? "var(--accent-cyan)" : "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.3rem",
                      textAlign: "center",
                    }}
                  >
                    <Layers size={18} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>All Media</span>
                    <span style={{ fontSize: "0.68rem", opacity: 0.7 }}>Every item in server</span>
                  </button>
                </div>
              </div>

              {/* Conditional: Series Dropdown / Selector */}
              {formScopeType === "series" && (
                <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "0.85rem", borderRadius: "var(--radius-md)" }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--accent-emerald)", marginBottom: "0.35rem" }}>
                    Select Series from Library *
                  </label>
                  <select
                    value={formTargetSeriesName}
                    onChange={(e) => {
                      setFormTargetSeriesName(e.target.value);
                      setFormCustomSeriesInput("");
                      if (!formName || formName.startsWith("Auto")) {
                        setFormName(`Auto Encode ${e.target.value}`);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {seriesList.length === 0 ? (
                      <option value="">No series detected in library</option>
                    ) : (
                      seriesList.map((s) => (
                        <option key={s.series_name} value={s.series_name}>
                          {s.series_name} — {s.total_episodes} episodes ({s.unoptimized_episodes} unoptimized)
                        </option>
                      ))
                    )}
                  </select>

                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    Or type custom series name:
                  </div>
                  <input
                    type="text"
                    value={formCustomSeriesInput}
                    onChange={(e) => {
                      setFormCustomSeriesInput(e.target.value);
                      if (e.target.value) {
                        setFormName(`Auto Encode ${e.target.value}`);
                      }
                    }}
                    placeholder="e.g. SpongeBob SquarePants, Pokémon, etc."
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.82rem",
                    }}
                  />
                </div>
              )}

              {/* Conditional: Library Selection */}
              {formScopeType === "library" && (
                <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "0.85rem", borderRadius: "var(--radius-md)" }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--accent-purple-light)", marginBottom: "0.35rem" }}>
                    Select Target Library *
                  </label>
                  <select
                    value={formTargetLibrary}
                    onChange={(e) => {
                      setFormTargetLibrary(e.target.value);
                      if (!formName || formName.startsWith("Auto")) {
                        setFormName(`Auto Encode ${e.target.value.toUpperCase()} Library`);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                    }}
                  >
                    <option value="tv">TV Shows (tv)</option>
                    <option value="movies">Movies (movies)</option>
                    <option value="anime">Anime (anime)</option>
                  </select>
                </div>
              )}

              {/* 3. Encoding Profile & Worker Node */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Encoding Profile *
                  </label>
                  <select
                    value={formProfileId}
                    onChange={(e) => setFormProfileId(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.video_codec.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Assigned Worker Node
                  </label>
                  <select
                    value={formAssignedNodeId}
                    onChange={(e) => setFormAssignedNodeId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <option value="windows-node">Windows PC (Quadro K620 GPU)</option>
                    <option value="local">Ubuntu Server (Local CPU/GPU)</option>
                    {nodes
                      .filter((n) => n.node_id !== "windows-node" && n.node_id !== "local")
                      .map((n) => (
                        <option key={n.node_id} value={n.node_id}>
                          {n.name} ({n.gpu_model || n.cpu_model})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 4. Replacement Mode & Priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Replacement Safety Mode
                  </label>
                  <select
                    value={formReplacementMode}
                    onChange={(e) => setFormReplacementMode(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <option value="safe_backup">Safe Backup (Keep original until verified)</option>
                    <option value="in_place">In-Place Replacement (Instant overwrite)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                    Job Priority (1-10)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              {/* 5. Behavior Checkboxes */}
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "0.85rem", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.65rem", cursor: "pointer", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={formAutoEncodeExisting}
                    onChange={(e) => setFormAutoEncodeExisting(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--accent-purple-light)" }}
                  />
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>Auto-encode previous & existing media</strong>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Immediately queues all current unoptimized episodes/movies matching this scope.
                    </div>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.65rem", cursor: "pointer", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={formAutoEncodeNew}
                    onChange={(e) => setFormAutoEncodeNew(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--accent-purple-light)" }}
                  />
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>Auto-encode upcoming newly added media</strong>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Whenever a library scan finds new items matching this rule, automatically queue them.
                    </div>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.65rem", cursor: "pointer", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--accent-purple-light)" }}
                  />
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>Active rule</strong>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Keep rule enabled for periodic checks and background processing.
                    </div>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingRule ? "Update Rule" : "Create & Queue Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
