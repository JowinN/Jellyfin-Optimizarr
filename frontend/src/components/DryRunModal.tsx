import React, { useState } from "react";
import { X, CheckCircle, AlertTriangle, Terminal, HardDrive, ArrowRight, Play } from "lucide-react";
import { DryRunPlan } from "../types";
import { api } from "../api";
import { useToast } from "../context/ToastContext";

interface DryRunModalProps {
  plan: DryRunPlan | null;
  profileId: number;
  onClose: () => void;
  onJobEnqueued: () => void;
}

export const DryRunModal: React.FC<DryRunModalProps> = ({
  plan,
  profileId,
  onClose,
  onJobEnqueued,
}) => {
  if (!plan) return null;
  const { toast } = useToast();

  const [showArgs, setShowArgs] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleConfirm = async () => {
    try {
      setIsQueueing(true);
      await api.enqueueJob({
        media_item_id: plan.media_item_id,
        profile_id: profileId,
        replacement_mode: "replace_with_backup",
      });
      toast.success("Job added to persistent queue!");
      onJobEnqueued();
      onClose();
    } catch (err: any) {
      toast.error("Failed to queue job: " + err.message);
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="badge badge-emerald">Dry Run Simulation</span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Optimization Projection</h2>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "0.4rem" }}>
            <X size={18} />
          </button>
        </div>

        {/* Source vs Target Visualizer */}
        <div className="card" style={{ marginBottom: "1.5rem", background: "rgba(30, 41, 59, 0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "1rem", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Current File Size</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {formatBytes(plan.source_size_bytes)}
              </div>
            </div>
            <ArrowRight size={24} color="var(--accent-purple-light)" />
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Projected Size</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                ~{formatBytes(plan.estimated_output_size_bytes)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Storage Reclaimed</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent-emerald)" }}>
                {plan.estimated_savings_percent}% ({formatBytes(plan.estimated_savings_bytes)})
              </div>
            </div>
          </div>
        </div>

        {/* Technical Safety Pre-flight */}
        <div className="grid-two-col" style={{ marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <HardDrive size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Required Workspace</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              ~{formatBytes(plan.required_work_space_bytes)} free space required on temporary directory.
            </div>
          </div>

          <div className="card" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <CheckCircle size={16} color="var(--accent-emerald)" />
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Safety Protocol</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Recoverable backup will be retained in <code>/backups</code>.
            </div>
          </div>
        </div>

        {/* Potential Risk Warnings */}
        {plan.potential_risks.length > 0 && (
          <div style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "1rem",
            marginBottom: "1.5rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--accent-amber)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.4rem" }}>
              <AlertTriangle size={16} /> Attention: Review Plan Considerations
            </div>
            <ul style={{ paddingLeft: "1.25rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {plan.potential_risks.map((risk, idx) => (
                <li key={idx}>{risk}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Collapsible FFmpeg Command Preview */}
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            onClick={() => setShowArgs(!showArgs)}
            className="btn btn-secondary btn-sm"
            style={{ width: "100%", justifyContent: "space-between", marginBottom: "0.5rem" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Terminal size={14} /> View Structured FFmpeg Command Arguments
            </span>
            <span>{showArgs ? "Hide" : "Show"}</span>
          </button>

          {showArgs && (
            <pre style={{
              background: "#080c14",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "0.85rem",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono)",
              color: "#38bdf8",
              maxHeight: "180px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}>
              {plan.proposed_ffmpeg_args.join(" ")}
            </pre>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.75rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: "1 1 auto", minHeight: "38px" }}>
            Close
          </button>
          <button
            onClick={handleConfirm}
            disabled={isQueueing}
            className="btn btn-primary"
            style={{ flex: "1 1 auto", minHeight: "38px" }}
          >
            <Play size={16} /> {isQueueing ? "Queueing..." : "Approve & Add to Queue"}
          </button>
        </div>
      </div>
    </div>
  );
};
