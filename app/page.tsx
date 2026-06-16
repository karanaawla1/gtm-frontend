"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type DecisionType = "hire" | "ad_spend" | "vendor" | "tool";
type MetricType = "revenue" | "pipeline" | "churn";
type Recommendation = "SCALE" | "KILL" | "MONITOR" | "MAINTAIN" | "NO_DATA";
type Page = "dashboard" | "decisions" | "analysis" | "add-decision" | "add-outcome" | "csv";

interface Decision {
  id: string;
  type: DecisionType;
  owner: string;
  cost_amount: number;
  description?: string;
  status: string;
  date: string;
}

interface Analysis {
  decision_id: string;
  roi: number;
  confidence: number;
  recommendation: Recommendation;
  outcome_count: number;
  explanation?: string;
  weighted_revenue?: number;
  from_cache?: boolean;
}

interface Summary {
  total_decisions: number;
  scale_worthy: number;
  need_action: number;
  avg_roi: number;
  recent_decisions: (Decision & { roi?: number; recommendation?: Recommendation })[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://gtm-decision-tracker-production.up.railway.app";

const DECISION_TYPES: DecisionType[] = ["hire", "ad_spend", "vendor", "tool"];
const METRIC_TYPES: MetricType[] = ["revenue", "pipeline", "churn"];

const TYPE_META: Record<DecisionType, { icon: string; color: string; bg: string; label: string }> = {
  hire:     { icon: "👤", color: "#a78bfa", bg: "rgba(167,139,250,0.1)",  label: "Hire" },
  ad_spend: { icon: "📣", color: "#fb923c", bg: "rgba(251,146,60,0.1)",   label: "Ad Spend" },
  vendor:   { icon: "🤝", color: "#34d399", bg: "rgba(52,211,153,0.1)",   label: "Vendor" },
  tool:     { icon: "🔧", color: "#60a5fa", bg: "rgba(96,165,250,0.1)",   label: "Tool" },
};

const REC_META: Record<Recommendation, { icon: string; label: string; color: string; bg: string }> = {
  SCALE:    { icon: "↑", label: "Scale",    color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  KILL:     { icon: "✕", label: "Kill",     color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  MONITOR:  { icon: "◎", label: "Monitor",  color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  MAINTAIN: { icon: "→", label: "Maintain", color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
  NO_DATA:  { icon: "—", label: "No data",  color: "#4b5563", bg: "rgba(75,85,99,0.1)" },
};

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard",     label: "Overview",     icon: "ti-layout-dashboard" },
  { id: "decisions",     label: "Decisions",    icon: "ti-list-details" },
  { id: "analysis",      label: "Analysis",     icon: "ti-chart-dots-3" },
  { id: "add-decision",  label: "Add Decision", icon: "ti-circle-plus" },
  { id: "add-outcome",   label: "Add Outcome",  icon: "ti-link" },
  { id: "csv",           label: "Import CSV",   icon: "ti-upload" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtROI = (n: number) => `${n.toFixed(2)}x`;

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ─── Tokens (CSS-in-JS) ───────────────────────────────────────────────────────

const T = {
  bg:        "#0a0a0f",
  surface:   "#111118",
  surfaceHi: "#16161f",
  border:    "rgba(255,255,255,0.07)",
  borderHi:  "rgba(255,255,255,0.12)",
  accent:    "#6d5bf7",
  accentHi:  "#8b7cf8",
  text:      "#f0f0f5",
  textMid:   "#a0a0b8",
  textLow:   "#545468",
  radius:    12,
  radiusSm:  8,
};

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 40 }}>
      <div style={{
        width: size, height: size,
        border: `2px solid ${T.border}`,
        borderTopColor: T.accent,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
    </div>
  );
}

function RecBadge({ rec }: { rec: Recommendation }) {
  const m = REC_META[rec] ?? REC_META.NO_DATA;
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}26`,
      padding: "3px 10px", borderRadius: 100,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
      display: "inline-flex", alignItems: "center", gap: 5,
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 10 }}>{m.icon}</span>
      {m.label}
    </span>
  );
}

function TypePill({ type }: { type: DecisionType }) {
  const m = TYPE_META[type] ?? { icon: "?", color: T.textLow, bg: "transparent", label: type };
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}26`,
      padding: "3px 10px", borderRadius: 100,
      fontSize: 11, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      <span>{m.icon}</span> {m.label}
    </span>
  );
}

function KpiCard({ value, label, sub, color, icon }: {
  value: string; label: string; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: "20px 22px", flex: 1, minWidth: 150,
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      {icon && (
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: color ?? T.textMid, marginBottom: 8 }} aria-hidden />
      )}
      <div style={{
        fontSize: 26, fontWeight: 700,
        color: color ?? T.text,
        letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: T.textMid, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.textLow, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.radius, overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: "10px 16px", textAlign: "left",
      fontSize: 11, fontWeight: 600, color: T.textLow,
      letterSpacing: "0.06em", textTransform: "uppercase",
      borderBottom: `1px solid ${T.border}`,
      background: T.surfaceHi,
    }}>
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td style={{
      padding: "12px 16px",
      fontSize: 13, color: muted ? T.textLow : T.textMid,
      borderBottom: `1px solid ${T.border}`,
      verticalAlign: "middle",
    }}>
      {children}
    </td>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 11, color: T.textLow, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>
        {children}
      </span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: T.surfaceHi, border: `1px solid ${T.borderHi}`,
  borderRadius: T.radiusSm, padding: "9px 12px",
  color: T.text, fontSize: 14, outline: "none",
  width: "100%", boxSizing: "border-box",
  transition: "border-color 0.15s",
};

function FInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldLabel>
      {label}
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...inputStyle, borderColor: focused ? T.accent : T.borderHi, ...props.style }}
      />
    </FieldLabel>
  );
}

function FSelect({ label, options, valueLabels, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string; options: string[]; valueLabels?: Record<string, string>;
}) {
  return (
    <FieldLabel>
      {label}
      <select {...props} style={{ ...inputStyle, cursor: "pointer" }}>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: T.surface }}>
            {valueLabels?.[o] ?? o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

function Btn({
  children, variant = "primary", style: s, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "subtle" }) {
  const vs: Record<string, React.CSSProperties> = {
    primary: { background: T.accent, color: "#fff", border: "none" },
    ghost:   { background: "transparent", color: T.textMid, border: `1px solid ${T.border}` },
    danger:  { background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" },
    subtle:  { background: T.surfaceHi, color: T.textMid, border: `1px solid ${T.border}` },
  };
  return (
    <button {...props} style={{
      ...vs[variant],
      padding: "8px 16px", borderRadius: T.radiusSm,
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      transition: "opacity 0.15s, background 0.15s",
      opacity: props.disabled ? 0.4 : 1,
      pointerEvents: props.disabled ? "none" : "auto",
      ...s,
    }}>
      {children}
    </button>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{title}</span>
      {action}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <i className="ti ti-inbox" style={{ fontSize: 32, color: T.textLow, display: "block", marginBottom: 12 }} aria-hidden />
      <span style={{ fontSize: 13, color: T.textLow }}>{message}</span>
    </div>
  );
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 999,
      background: T.surfaceHi, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${T.accent}`,
      borderRadius: T.radiusSm, padding: "12px 16px",
      fontSize: 13, color: T.text,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <i className="ti ti-check" style={{ color: "#34d399", fontSize: 16 }} aria-hidden />
      {msg}
      <button onClick={onClose} style={{ background: "none", border: "none", color: T.textLow, cursor: "pointer", marginLeft: 8, fontSize: 14 }}>✕</button>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardPage({ goTo }: { goTo: (p: Page) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkAnalysis, setBulkAnalysis] = useState<Analysis[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<Summary>("/api/decisions/summary").catch(() => null),
      apiFetch<Analysis[]>("/api/decisions/bulk-analysis").catch(() => []),
    ]).then(([s, b]) => {
      if (s) setSummary(s);
      if (b) setBulkAnalysis(Array.isArray(b) ? b : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;
  if (!summary) return <div style={{ color: "#f87171", padding: 20 }}>Could not load dashboard.</div>;

  const chartData = bulkAnalysis
    .filter(a => a.roi > 0)
    .slice(0, 8)
    .map((a, i) => ({ name: `D${i + 1}`, roi: parseFloat(a.roi.toFixed(2)), rec: a.recommendation }));

  const recColors: Record<Recommendation, string> = {
    SCALE: "#34d399", MAINTAIN: "#818cf8", MONITOR: "#fbbf24", KILL: "#f87171", NO_DATA: "#4b5563"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard value={String(summary.total_decisions)} label="Total decisions" sub="All time" icon="ti-layers-linked" />
        <KpiCard value={String(summary.scale_worthy)} label="Scale worthy" sub="ROI › 3x + confidence" color="#34d399" icon="ti-trending-up" />
        <KpiCard value={String(summary.need_action)} label="Need action" sub="Low ROI confirmed" color="#f87171" icon="ti-alert-triangle" />
        <KpiCard value={`${(summary.avg_roi ?? 0).toFixed(2)}x`} label="Avg weighted ROI" sub="Time-decay adjusted" color={T.accentHi} icon="ti-chart-line" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* ROI Chart */}
        {chartData.length > 0 && (
          <TableWrap>
            <SectionHead title="ROI by decision" />
            <div style={{ padding: "16px 8px 8px" }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: T.textMid }}
                    itemStyle={{ color: T.text }}
                  />
                  <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={recColors[entry.rec] ?? T.accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TableWrap>
        )}

        {/* Recommendation breakdown */}
        <TableWrap>
          <SectionHead title="Recommendation breakdown" />
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {(["SCALE", "MAINTAIN", "MONITOR", "KILL", "NO_DATA"] as Recommendation[]).map(rec => {
              const count = bulkAnalysis.filter(a => a.recommendation === rec).length;
              const total = bulkAnalysis.length || 1;
              const pct = Math.round((count / total) * 100);
              const m = REC_META[rec];
              return (
                <div key={rec}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: T.textMid, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: m.color }}>{m.icon}</span> {m.label}
                    </span>
                    <span style={{ fontSize: 12, color: T.textLow }}>{count}</span>
                  </div>
                  <div style={{ background: T.surfaceHi, borderRadius: 4, height: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: 4, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </TableWrap>
      </div>

      {/* Recent decisions table */}
      <TableWrap>
        <SectionHead
          title="Recent decisions"
          action={
            <button onClick={() => goTo("decisions")} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
              View all →
            </button>
          }
        />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Type</Th>
              <Th>Owner</Th>
              <Th>Cost</Th>
              <Th>ROI</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {(summary.recent_decisions ?? []).map((d) => (
              <tr key={d.id} style={{ cursor: "default" }}>
                <Td><TypePill type={d.type} /></Td>
                <Td>{d.owner}</Td>
                <Td muted>{fmt(d.cost_amount)}</Td>
                <Td>
                  <span style={{ color: d.roi ? T.accentHi : T.textLow, fontWeight: d.roi ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
                    {d.roi ? fmtROI(d.roi) : "—"}
                  </span>
                </Td>
                <Td><RecBadge rec={(d.recommendation as Recommendation) ?? "NO_DATA"} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!summary.recent_decisions || summary.recent_decisions.length === 0) && (
          <EmptyState message="No decisions yet — add your first one" />
        )}
      </TableWrap>
    </div>
  );
}

// ─── Decisions list ───────────────────────────────────────────────────────────

function DecisionsPage({ goTo }: { goTo: (p: Page) => void }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), page_size: "15" });
      if (filterType) p.set("type", filterType);
      if (search) p.set("search", search);
      const data = await apiFetch<{ items: Decision[]; pagination: { total_pages: number } }>(`/api/decisions/?${p}`);
      setDecisions(data.items ?? []);
      setTotalPages(data.pagination?.total_pages ?? 1);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, filterType, search]);

  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    if (!confirm("Delete this decision and all its outcomes?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/decisions/${id}`, { method: "DELETE" });
      setDecisions(prev => prev.filter(d => d.id !== id));
      setToast("Decision deleted");
    } catch { alert("Delete failed."); }
    finally { setDeleting(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <FInput label="Search" placeholder="Search owner or description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div style={{ minWidth: 140 }}>
          <FSelect label="Type" options={["", ...DECISION_TYPES]} valueLabels={{ "": "All types", hire: "Hire", ad_spend: "Ad Spend", vendor: "Vendor", tool: "Tool" }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} />
        </div>
        <Btn variant="subtle" onClick={() => goTo("add-decision")}>
          <i className="ti ti-plus" aria-hidden /> New
        </Btn>
      </div>

      <TableWrap>
        {loading ? <Spinner /> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Owner</Th>
                <Th>Cost</Th>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {decisions.map(d => (
                <tr key={d.id} style={{ transition: "background 0.1s" }}
                  onMouseOver={e => (e.currentTarget.style.background = T.surfaceHi)}
                  onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Td><TypePill type={d.type} /></Td>
                  <Td>{d.owner}</Td>
                  <Td muted>{fmt(d.cost_amount)}</Td>
                  <Td muted>{new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Td>
                  <Td muted>
                    <span style={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.description || "—"}
                    </span>
                  </Td>
                  <Td>
                    <Btn variant="danger" style={{ padding: "4px 12px", fontSize: 12 }} disabled={deleting === d.id} onClick={() => del(d.id)}>
                      {deleting === d.id ? "…" : <><i className="ti ti-trash" aria-hidden /> Delete</>}
                    </Btn>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && decisions.length === 0 && <EmptyState message="No decisions found" />}
      </TableWrap>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <Btn variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "6px 14px" }}>
            <i className="ti ti-chevron-left" aria-hidden />
          </Btn>
          <span style={{ fontSize: 12, color: T.textLow }}>Page {page} of {totalPages}</span>
          <Btn variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: "6px 14px" }}>
            <i className="ti ti-chevron-right" aria-hidden />
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── Analysis ────────────────────────────────────────────────────────────────

function AnalysisPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [outcomes, setOutcomes] = useState<{ metric_type: string; value: number; date: string }[]>([]);

  useEffect(() => {
    apiFetch<{ items: Decision[] }>("/api/decisions/?page_size=100")
      .then(d => setDecisions(d.items ?? []))
      .catch(() => {});
  }, []);

  const run = async () => {
    if (!selectedId) return;
    setLoading(true);
    setAnalysis(null);
    setOutcomes([]);
    try {
      const [a, o] = await Promise.all([
        apiFetch<Analysis>(`/api/decisions/${selectedId}/analysis`),
        apiFetch<{ metric_type: string; value: number; date: string }[]>(`/api/outcomes/${selectedId}`).catch(() => []),
      ]);
      setAnalysis(a);
      setOutcomes(Array.isArray(o) ? o : []);
    } catch { alert("Analysis failed."); }
    finally { setLoading(false); }
  };

  const chosen = decisions.find(d => d.id === selectedId);
  const rec = analysis ? REC_META[analysis.recommendation] ?? REC_META.NO_DATA : null;

  const chartData = outcomes.map(o => ({
    date: new Date(o.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    value: o.value,
    type: o.metric_type,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <FSelect
            label="Select decision"
            options={["", ...decisions.map(d => d.id)]}
            valueLabels={Object.fromEntries([["", "Choose a decision…"], ...decisions.map(d => [d.id, `[${d.type.replace("_", " ")}] ${d.owner} — ${fmt(d.cost_amount)}`])])}
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setAnalysis(null); }}
          />
        </div>
        <Btn onClick={run} disabled={!selectedId || loading}>
          {loading ? "Running…" : <><i className="ti ti-chart-dots-3" aria-hidden /> Analyse</>}
        </Btn>
      </div>

      {loading && <Spinner />}

      {analysis && rec && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Hero rec card */}
          <div style={{
            background: `${rec.color}0d`, border: `1px solid ${rec.color}26`,
            borderRadius: T.radius, padding: "24px 28px",
            display: "flex", gap: 20, alignItems: "center",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: T.radius,
              background: rec.bg, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 22, color: rec.color, flexShrink: 0,
              border: `1px solid ${rec.color}33`,
            }}>
              {rec.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: rec.color, letterSpacing: "-0.02em" }}>
                {rec.label}
              </div>
              {analysis.explanation && (
                <div style={{ fontSize: 13, color: T.textMid, marginTop: 5, maxWidth: 500, lineHeight: 1.6 }}>
                  {analysis.explanation}
                </div>
              )}
              {chosen && (
                <div style={{ fontSize: 12, color: T.textLow, marginTop: 6 }}>
                  {chosen.owner} · {chosen.type.replace("_", " ")} · {fmt(chosen.cost_amount)}
                </div>
              )}
            </div>
          </div>

          {/* Metric cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <KpiCard value={fmtROI(analysis.roi)} label="ROI" sub="Weighted by time decay" color={T.accentHi} />
            <KpiCard value={`${(analysis.confidence * 100).toFixed(0)}%`} label="Confidence" sub="Based on outcome count + consistency" color="#34d399" />
            <KpiCard value={String(analysis.outcome_count)} label="Linked outcomes" />
            {analysis.weighted_revenue !== undefined && (
              <KpiCard value={fmt(analysis.weighted_revenue)} label="Weighted revenue" color="#fbbf24" />
            )}
          </div>

          {/* Outcomes timeline */}
          {chartData.length > 0 && (
            <TableWrap>
              <SectionHead title="Outcome timeline" />
              <div style={{ padding: "16px 8px 8px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="date" tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} width={60}
                      tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [fmt(v), "Value"]}
                    />
                    <Line type="monotone" dataKey="value" stroke={T.accent} strokeWidth={2} dot={{ fill: T.accent, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TableWrap>
          )}

          {analysis.from_cache && (
            <div style={{ fontSize: 11, color: T.textLow, display: "flex", alignItems: "center", gap: 5 }}>
              <i className="ti ti-bolt" style={{ fontSize: 12 }} aria-hidden /> Served from cache
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Decision ─────────────────────────────────────────────────────────────

function AddDecisionPage({ goTo }: { goTo: (p: Page) => void }) {
  const [form, setForm] = useState({ type: "hire" as DecisionType, owner: "", cost_amount: "", date: new Date().toISOString().split("T")[0], description: "" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.owner.trim() || !form.cost_amount) return alert("Owner and cost are required.");
    setLoading(true);
    try {
      await apiFetch("/api/decisions/", {
        method: "POST",
        body: JSON.stringify({ ...form, cost_amount: parseFloat(form.cost_amount) }),
      });
      setToast("Decision created successfully");
      setForm({ type: "hire", owner: "", cost_amount: "", date: new Date().toISOString().split("T")[0], description: "" });
      setTimeout(() => goTo("decisions"), 1400);
    } catch { alert("Failed to create decision."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <FSelect label="Type" options={DECISION_TYPES} value={form.type} onChange={e => set("type", e.target.value)} />
        <FInput label="Owner" placeholder="e.g. Sales Team" value={form.owner} onChange={e => set("owner", e.target.value)} />
        <FInput label="Cost (USD)" type="number" placeholder="50000" value={form.cost_amount} onChange={e => set("cost_amount", e.target.value)} />
        <FInput label="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        <FInput label="Description (optional)" placeholder="What was this spend for?" value={form.description} onChange={e => set("description", e.target.value)} />
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <Btn onClick={submit} disabled={loading}>
            {loading ? "Saving…" : <><i className="ti ti-check" aria-hidden /> Add Decision</>}
          </Btn>
          <Btn variant="ghost" onClick={() => goTo("decisions")}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Add Outcome ──────────────────────────────────────────────────────────────

function AddOutcomePage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [form, setForm] = useState({ decision_id: "", metric_type: "revenue" as MetricType, value: "", date: new Date().toISOString().split("T")[0], source: "manual" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    apiFetch<{ items: Decision[] }>("/api/decisions/?page_size=100")
      .then(d => setDecisions(d.items ?? []))
      .catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.decision_id || !form.value) return alert("Decision and value are required.");
    setLoading(true);
    try {
      await apiFetch("/api/outcomes/", {
        method: "POST",
        body: JSON.stringify({ ...form, value: parseFloat(form.value) }),
      });
      setToast("Outcome linked successfully");
      setForm(f => ({ ...f, value: "" }));
    } catch { alert("Failed to add outcome."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <FSelect
          label="Decision"
          options={["", ...decisions.map(d => d.id)]}
          valueLabels={Object.fromEntries([["", "Select a decision…"], ...decisions.map(d => [d.id, `[${d.type.replace("_", " ")}] ${d.owner} — ${fmt(d.cost_amount)}`])])}
          value={form.decision_id}
          onChange={e => set("decision_id", e.target.value)}
        />
        <FSelect label="Metric type" options={METRIC_TYPES} value={form.metric_type} onChange={e => set("metric_type", e.target.value)} />
        <FInput label="Value (USD)" type="number" placeholder="120000" value={form.value} onChange={e => set("value", e.target.value)} />
        <FInput label="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        <div style={{ paddingTop: 4 }}>
          <Btn onClick={submit} disabled={loading}>
            {loading ? "Saving…" : <><i className="ti ti-link" aria-hidden /> Link Outcome</>}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Upload ───────────────────────────────────────────────────────────────

function CSVPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/decisions/upload-csv`, { method: "POST", body: fd });
      const json = await res.json();
      setResult(json.result);
    } catch { alert("Upload failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 500, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${file ? T.accent : T.border}`,
          borderRadius: T.radius, padding: "40px 24px", textAlign: "center", cursor: "pointer",
          background: file ? `${T.accent}08` : T.surface,
          transition: "all 0.2s",
        }}
      >
        <i className={`ti ${file ? "ti-file-check" : "ti-upload"}`} style={{ fontSize: 28, color: file ? T.accent : T.textLow, display: "block", marginBottom: 10 }} aria-hidden />
        <div style={{ fontSize: 13, color: file ? T.text : T.textMid, fontWeight: file ? 500 : 400 }}>
          {file ? file.name : "Click to select a CSV file"}
        </div>
        {!file && <div style={{ fontSize: 11, color: T.textLow, marginTop: 4 }}>or drag and drop</div>}
        <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>

      {/* Format guide */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 16 }}>
        <div style={{ fontSize: 10, color: T.textLow, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>EXPECTED FORMAT</div>
        <code style={{ fontSize: 12, color: T.textMid, fontFamily: "monospace", lineHeight: 1.8, display: "block" }}>
          type,date,owner,cost_amount,description<br />
          hire,2024-01-10,Sales Team,75000,SDR hire<br />
          ad_spend,2024-01-15,Marketing,40000,LinkedIn Q1
        </code>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={upload} disabled={!file || loading}>
          {loading ? "Uploading…" : <><i className="ti ti-cloud-upload" aria-hidden /> Upload</>}
        </Btn>
        {file && <Btn variant="ghost" onClick={() => { setFile(null); setResult(null); }}>Clear</Btn>}
      </div>

      {result && (
        <div style={{
          background: result.failed === 0 ? "rgba(52,211,153,0.07)" : "rgba(251,191,36,0.07)",
          border: `1px solid ${result.failed === 0 ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
          borderRadius: T.radiusSm, padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#34d399" }}>
            {result.success} decisions imported
            {result.failed > 0 && <span style={{ color: "#fbbf24" }}>, {result.failed} failed</span>}
          </div>
          {result.errors?.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: "#f87171", marginTop: 5 }}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  const PAGE_TITLES: Record<Page, { title: string; sub: string }> = {
    dashboard:      { title: "Overview",      sub: "GTM performance at a glance" },
    decisions:      { title: "Decisions",     sub: "All logged GTM spends" },
    analysis:       { title: "Analysis",      sub: "ROI & recommendation per decision" },
    "add-decision": { title: "New Decision",  sub: "Log a GTM spend" },
    "add-outcome":  { title: "New Outcome",   sub: "Link revenue to a decision" },
    csv:            { title: "Import CSV",    sub: "Bulk import decisions" },
  };

  const pt = PAGE_TITLES[page];

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${T.bg}; color: ${T.text}; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; height: 100%; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        input, select { color-scheme: dark; }
        input:focus, select:focus { border-color: ${T.accent} !important; box-shadow: 0 0 0 3px ${T.accent}22 !important; outline: none; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* ── Sidebar ── */}
        <aside style={{
          width: 216, flexShrink: 0,
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column",
          padding: "0 0 16px",
          overflowY: "auto",
        }}>
          {/* Logo */}
          <div style={{ padding: "20px 18px 18px", borderBottom: `1px solid ${T.border}`, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: T.accent,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0,
              }}>G</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>GTM Tracker</div>
                <div style={{ fontSize: 10, color: T.textLow, letterSpacing: "0.03em" }}>Attribution Engine</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 10px" }}>
            {NAV_ITEMS.map(n => {
              const active = page === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px", borderRadius: T.radiusSm,
                    border: "none",
                    background: active ? `${T.accent}1a` : "transparent",
                    color: active ? T.accentHi : T.textLow,
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.12s",
                    width: "100%",
                  }}
                  onMouseOver={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.textMid; }}
                  onMouseOut={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.textLow; }}
                >
                  <i className={`ti ${n.icon}`} style={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
                  {n.label}
                </button>
              );
            })}
          </nav>

          {/* Bottom hint */}
          <div style={{ marginTop: "auto", padding: "12px 18px 0", borderTop: `1px solid ${T.border}`, marginLeft: 0 }}>
            <div style={{ fontSize: 11, color: T.textLow, lineHeight: 1.6 }}>
              Decisions → Outcomes → ROI
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
          {/* Header */}
          <header style={{
            padding: "14px 28px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: T.surface, flexShrink: 0,
          }}>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{pt.title}</h1>
              <p style={{ fontSize: 12, color: T.textLow, marginTop: 1 }}>{pt.sub}</p>
            </div>
            {page !== "add-decision" && (
              <Btn onClick={() => setPage("add-decision")} style={{ fontSize: 12, padding: "7px 14px" }}>
                <i className="ti ti-plus" aria-hidden /> New Decision
              </Btn>
            )}
          </header>

          {/* Page content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {page === "dashboard"     && <DashboardPage goTo={setPage} />}
            {page === "decisions"     && <DecisionsPage goTo={setPage} />}
            {page === "analysis"      && <AnalysisPage />}
            {page === "add-decision"  && <AddDecisionPage goTo={setPage} />}
            {page === "add-outcome"   && <AddOutcomePage />}
            {page === "csv"           && <CSVPage />}
          </div>
        </main>
      </div>
    </>
  );
}