"use client";

import {
  useState, useEffect, useCallback, useRef, createContext, useContext,
} from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell, PieChart, Pie,
} from "recharts";

// ─── Theme ────────────────────────────────────────────────────────────────────

const DARK = {
  bg: "#08080f",
  surface: "#0f0f18",
  surfaceHi: "#14141f",
  surfaceHov: "#1a1a28",
  border: "rgba(255,255,255,0.07)",
  borderHi: "rgba(255,255,255,0.13)",
  accent: "#6d5bf7",
  accentHi: "#8b7cf8",
  accentGlow: "rgba(109,91,247,0.25)",
  text: "#eeeef5",
  textMid: "#9898b8",
  textLow: "#50506a",
  radius: 12,
  radiusSm: 8,
  radiusXs: 6,
};

const LIGHT = {
  bg: "#f4f4f8",
  surface: "#ffffff",
  surfaceHi: "#f8f8fc",
  surfaceHov: "#f0f0f8",
  border: "rgba(0,0,0,0.08)",
  borderHi: "rgba(0,0,0,0.14)",
  accent: "#6d5bf7",
  accentHi: "#5548e0",
  accentGlow: "rgba(109,91,247,0.18)",
  text: "#111122",
  textMid: "#444466",
  textLow: "#9898b8",
  radius: 12,
  radiusSm: 8,
  radiusXs: 6,
};

type ThemeTokens = typeof DARK;
const ThemeCtx = createContext<{ T: ThemeTokens; dark: boolean; toggle: () => void }>({
  T: DARK, dark: true, toggle: () => {},
});
const useT = () => useContext(ThemeCtx);

// ─── Types ────────────────────────────────────────────────────────────────────

type DecisionType = "hire" | "ad_spend" | "vendor" | "tool";
type MetricType = "revenue" | "pipeline" | "churn";
type Recommendation = "SCALE" | "KILL" | "MONITOR" | "MAINTAIN" | "NO_DATA";
type Page = "dashboard" | "decisions" | "analysis" | "add-decision" | "add-outcome" | "csv";

interface Decision {
  id: string; type: DecisionType; owner: string;
  cost_amount: number; description?: string; status: string; date: string;
}
interface Analysis {
  decision_id: string; roi: number; confidence: number;
  recommendation: Recommendation; outcome_count: number;
  explanation?: string; weighted_revenue?: number; from_cache?: boolean;
}
interface Summary {
  total_decisions: number; scale_worthy: number; need_action: number; avg_roi: number;
  recent_decisions: (Decision & { roi?: number; recommendation?: Recommendation })[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://gtm-decision-tracker-production.up.railway.app";
const DECISION_TYPES: DecisionType[] = ["hire", "ad_spend", "vendor", "tool"];
const METRIC_TYPES: MetricType[] = ["revenue", "pipeline", "churn"];

const TYPE_META: Record<DecisionType, { icon: string; color: string; bg: string; label: string }> = {
  hire:     { icon: "👤", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Hire" },
  ad_spend: { icon: "📣", color: "#fb923c", bg: "rgba(251,146,60,0.12)",  label: "Ad Spend" },
  vendor:   { icon: "🤝", color: "#34d399", bg: "rgba(52,211,153,0.12)",  label: "Vendor" },
  tool:     { icon: "🔧", color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  label: "Tool" },
};

const REC_META: Record<Recommendation, { icon: string; label: string; color: string; bg: string; desc: string }> = {
  SCALE:    { icon: "↑", label: "Scale",    color: "#34d399", bg: "rgba(52,211,153,0.1)",  desc: "ROI > 3x, high confidence" },
  KILL:     { icon: "✕", label: "Kill",     color: "#f87171", bg: "rgba(248,113,113,0.1)", desc: "ROI < 0.5x, confirmed" },
  MONITOR:  { icon: "◎", label: "Monitor",  color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  desc: "Not enough data yet" },
  MAINTAIN: { icon: "→", label: "Maintain", color: "#818cf8", bg: "rgba(129,140,248,0.1)", desc: "Performing as expected" },
  NO_DATA:  { icon: "—", label: "No Data",  color: "#6b7280", bg: "rgba(107,114,128,0.1)", desc: "No outcomes linked" },
};

const NAV_ITEMS: { id: Page; label: string; icon: string; shortcut: string }[] = [
  { id: "dashboard",    label: "Overview",     icon: "⊞", shortcut: "G D" },
  { id: "decisions",    label: "Decisions",    icon: "≡", shortcut: "G L" },
  { id: "analysis",     label: "Analysis",     icon: "◉", shortcut: "G A" },
  { id: "add-decision", label: "Add Decision", icon: "+", shortcut: "G N" },
  { id: "add-outcome",  label: "Add Outcome",  icon: "①", shortcut: "G O" },
  { id: "csv",          label: "Import CSV",   icon: "↑", shortcut: "G I" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtROI = (n: number) => `${n.toFixed(2)}x`;

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function useCounter(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const v = useCounter(Math.round(value * Math.pow(10, decimals)), 1000);
  const display = decimals > 0 ? (v / Math.pow(10, decimals)).toFixed(decimals) : v;
  return <>{prefix}{display}{suffix}</>;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Spinner() {
  const { T } = useT();
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <div style={{
        width: 22, height: 22,
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
      border: `1px solid ${m.color}30`,
      padding: "3px 10px", borderRadius: 100,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
      display: "inline-flex", alignItems: "center", gap: 5,
      whiteSpace: "nowrap",
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function TypePill({ type }: { type: DecisionType }) {
  const m = TYPE_META[type] ?? { icon: "?", color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: type };
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}28`,
      padding: "3px 10px", borderRadius: 100,
      fontSize: 11, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function KpiCard({ value, label, sub, color, animated, suffix, prefix, decimals }: {
  value: number; label: string; sub?: string; color?: string;
  animated?: boolean; suffix?: string; prefix?: string; decimals?: number;
}) {
  const { T } = useT();
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: "22px 24px",
      flex: 1, minWidth: 150,
      display: "flex", flexDirection: "column", gap: 4,
      transition: "border-color 0.2s, box-shadow 0.2s",
    }}
      onMouseOver={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = color ? `${color}44` : T.borderHi;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 24px ${color ? color + "18" : "rgba(0,0,0,0.12)"}`;
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {color && (
        <div style={{
          width: 28, height: 3, borderRadius: 4,
          background: color, marginBottom: 8,
        }} />
      )}
      <div style={{
        fontSize: 30, fontWeight: 800,
        color: color ?? T.text,
        letterSpacing: "-0.03em",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}>
        {animated
          ? <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          : `${prefix ?? ""}${decimals ? value.toFixed(decimals) : value}${suffix ?? ""}`
        }
      </div>
      <div style={{ fontSize: 13, color: T.textMid, fontWeight: 500, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.textLow, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Card({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { T } = useT();
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.radius, overflow: "hidden", ...s,
    }}>
      {children}
    </div>
  );
}

function CardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  const { T } = useT();
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 20px", borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>{title}</span>
      {action}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  const { T } = useT();
  return (
    <th style={{
      padding: "9px 16px", textAlign: "left",
      fontSize: 10, fontWeight: 700, color: T.textLow,
      letterSpacing: "0.08em", textTransform: "uppercase",
      background: T.surfaceHi, borderBottom: `1px solid ${T.border}`,
      whiteSpace: "nowrap",
    }}>{children}</th>
  );
}

function Td({ children, muted, style: s }: { children?: React.ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  const { T } = useT();
  return (
    <td style={{
      padding: "11px 16px", fontSize: 13,
      color: muted ? T.textLow : T.textMid,
      borderBottom: `1px solid ${T.border}`,
      verticalAlign: "middle", ...s,
    }}>{children}</td>
  );
}

function EmptyState({ message }: { message: string }) {
  const { T } = useT();
  return (
    <div style={{ padding: "52px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>◉</div>
      <span style={{ fontSize: 13, color: T.textLow }}>{message}</span>
    </div>
  );
}

function Toast({ msg, type = "success", onClose }: { msg: string; type?: "success" | "error"; onClose: () => void }) {
  const { T } = useT();
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  const color = type === "success" ? "#34d399" : "#f87171";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: T.surface, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: T.radiusSm, padding: "12px 16px",
      fontSize: 13, color: T.text,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
      animation: "slideUp 0.25s ease",
      minWidth: 260,
    }}>
      <span style={{ color, fontSize: 15 }}>{type === "success" ? "✓" : "✕"}</span>
      {msg}
      <button onClick={onClose} style={{
        marginLeft: "auto", background: "none", border: "none",
        color: T.textLow, cursor: "pointer", fontSize: 14, padding: 2,
      }}>✕</button>
    </div>
  );
}

function Btn({ children, variant = "primary", style: s, size = "md", ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger" | "subtle";
    size?: "sm" | "md";
  }) {
  const { T } = useT();
  const vs: Record<string, React.CSSProperties> = {
    primary: { background: T.accent, color: "#fff", border: "none", boxShadow: `0 2px 12px ${T.accentGlow}` },
    ghost:   { background: "transparent", color: T.textMid, border: `1px solid ${T.border}` },
    danger:  { background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" },
    subtle:  { background: T.surfaceHi, color: T.textMid, border: `1px solid ${T.border}` },
  };
  const sz = size === "sm"
    ? { padding: "5px 12px", fontSize: 12 }
    : { padding: "8px 16px", fontSize: 13 };
  return (
    <button {...props} style={{
      ...vs[variant], ...sz,
      borderRadius: T.radiusSm,
      fontWeight: 600, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      transition: "opacity 0.15s, box-shadow 0.15s, transform 0.1s",
      opacity: props.disabled ? 0.38 : 1,
      pointerEvents: props.disabled ? "none" : "auto",
      ...s,
    }}
      onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

const inputStyle = (T: ThemeTokens, focused: boolean): React.CSSProperties => ({
  background: T.surfaceHi, border: `1px solid ${focused ? T.accent : T.borderHi}`,
  borderRadius: T.radiusSm, padding: "9px 12px",
  color: T.text, fontSize: 14, outline: "none",
  width: "100%", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxShadow: focused ? `0 0 0 3px ${T.accentGlow}` : "none",
});

function FInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { T } = useT();
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 11, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
        {label}
      </span>
      <input {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle(T, focused)}
      />
    </label>
  );
}

function FSelect({ label, options, valueLabels, ...props }:
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[]; valueLabels?: Record<string, string> }) {
  const { T } = useT();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 11, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
        {label}
      </span>
      <select {...props} style={{ ...inputStyle(T, false), cursor: "pointer" }}>
        {options.map(o => (
          <option key={o} value={o} style={{ background: T.surface }}>
            {valueLabels?.[o] ?? o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function ShortcutHint({ keys }: { keys: string }) {
  const { T } = useT();
  return (
    <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {keys.split(" ").map((k, i) => (
        <kbd key={i} style={{
          background: T.surfaceHi, border: `1px solid ${T.border}`,
          borderRadius: 4, padding: "1px 5px",
          fontSize: 9, color: T.textLow, fontFamily: "monospace",
          letterSpacing: "0.04em",
        }}>{k}</kbd>
      ))}
    </span>
  );
}

// ─── Decision Detail Drawer ───────────────────────────────────────────────────

function DetailDrawer({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  const { T } = useT();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Analysis>(`/api/decisions/${decision.id}/analysis`)
      .then(setAnalysis)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [decision.id]);

  const rec = analysis ? REC_META[analysis.recommendation] ?? REC_META.NO_DATA : null;
  const m = TYPE_META[decision.type];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 100, backdropFilter: "blur(2px)",
          animation: "fadeIn 0.2s ease",
        }}
      />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 420,
        background: T.surface, borderLeft: `1px solid ${T.borderHi}`,
        zIndex: 101, overflowY: "auto",
        animation: "slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.3)",
      }}>
        {/* Drawer header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          background: T.surfaceHi, flexShrink: 0,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: m.bg, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 16, border: `1px solid ${m.color}30`,
              }}>
                {m.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{decision.owner}</div>
                <div style={{ fontSize: 11, color: T.textLow, marginTop: 1 }}>
                  {new Date(decision.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: T.surfaceHov, border: `1px solid ${T.border}`,
            borderRadius: 8, width: 30, height: 30, cursor: "pointer",
            color: T.textMid, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Basic info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Type", value: <TypePill type={decision.type} /> },
              { label: "Cost", value: <span style={{ color: T.text, fontWeight: 600 }}>{fmt(decision.cost_amount)}</span> },
              { label: "Status", value: <span style={{ color: T.textMid, textTransform: "capitalize" }}>{decision.status}</span> },
              { label: "ID", value: <span style={{ color: T.textLow, fontSize: 10, fontFamily: "monospace" }}>{decision.id.slice(0, 8)}…</span> },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: T.surfaceHi, borderRadius: T.radiusSm,
                padding: "12px 14px", border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 10, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 6, textTransform: "uppercase" }}>
                  {label}
                </div>
                <div style={{ fontSize: 13 }}>{value}</div>
              </div>
            ))}
          </div>

          {decision.description && (
            <div style={{ background: T.surfaceHi, borderRadius: T.radiusSm, padding: "14px 16px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 6, textTransform: "uppercase" }}>Description</div>
              <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>{decision.description}</div>
            </div>
          )}

          {/* Analysis section */}
          <div>
            <div style={{ fontSize: 11, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
              ROI Analysis
            </div>
            {loading ? <Spinner /> : analysis && rec ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  background: rec.bg, border: `1px solid ${rec.color}30`,
                  borderRadius: T.radiusSm, padding: "16px 18px",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${rec.color}20`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 18, color: rec.color, flexShrink: 0,
                    border: `1px solid ${rec.color}30`,
                  }}>{rec.icon}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: rec.color }}>{rec.label}</div>
                    <div style={{ fontSize: 11, color: T.textMid, marginTop: 2 }}>{rec.desc}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "ROI", value: fmtROI(analysis.roi), color: "#818cf8" },
                    { label: "Confidence", value: `${(analysis.confidence * 100).toFixed(0)}%`, color: "#34d399" },
                    { label: "Outcomes", value: String(analysis.outcome_count), color: T.textMid },
                    { label: "Wtd. Revenue", value: analysis.weighted_revenue ? fmt(analysis.weighted_revenue) : "—", color: "#fbbf24" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: T.surfaceHi, borderRadius: T.radiusSm,
                      padding: "12px 14px", border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ fontSize: 10, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {analysis.explanation && (
                  <div style={{ background: T.surfaceHi, borderRadius: T.radiusSm, padding: "12px 14px", border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 10, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 6, textTransform: "uppercase" }}>Explanation</div>
                    <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7 }}>{analysis.explanation}</div>
                  </div>
                )}

                {analysis.from_cache && (
                  <div style={{ fontSize: 10, color: T.textLow, display: "flex", alignItems: "center", gap: 4 }}>
                    ⚡ Served from cache
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: T.textLow, padding: "12px 0" }}>No analysis available.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

function useKeyboardNav(setPage: (p: Page) => void, toggleSidebar: () => void, toggleTheme: () => void) {
  const gPressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;

      if (e.key === "[") { toggleSidebar(); return; }
      if (e.key === "t" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); toggleTheme(); return; }

      if (e.key === "g" || e.key === "G") {
        gPressed.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { gPressed.current = false; }, 1500);
        return;
      }
      if (gPressed.current) {
        gPressed.current = false;
        const map: Record<string, Page> = {
          d: "dashboard", l: "decisions", a: "analysis",
          n: "add-decision", o: "add-outcome", i: "csv",
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) setPage(dest);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setPage, toggleSidebar, toggleTheme]);
}

// ─── Shortcuts modal ──────────────────────────────────────────────────────────

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const { T } = useT();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const shortcuts = [
    { key: "G then D", label: "Go to Dashboard" },
    { key: "G then L", label: "Go to Decisions" },
    { key: "G then A", label: "Go to Analysis" },
    { key: "G then N", label: "New Decision" },
    { key: "G then O", label: "Add Outcome" },
    { key: "G then I", label: "Import CSV" },
    { key: "[", label: "Toggle sidebar" },
    { key: "Esc", label: "Close modal / drawer" },
    { key: "?", label: "Show shortcuts" },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, backdropFilter: "blur(2px)", animation: "fadeIn 0.15s ease" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        background: T.surface, border: `1px solid ${T.borderHi}`,
        borderRadius: T.radius, zIndex: 201,
        width: 380, padding: 0, overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        animation: "scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surfaceHi }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Keyboard shortcuts</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textLow, cursor: "pointer", fontSize: 15 }}>✕</button>
        </div>
        <div style={{ padding: 8 }}>
          {shortcuts.map(({ key, label }) => (
            <div key={key} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", borderRadius: T.radiusXs,
            }}>
              <span style={{ fontSize: 13, color: T.textMid }}>{label}</span>
              <ShortcutHint keys={key} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────

function DashboardPage({ goTo }: { goTo: (p: Page) => void }) {
  const { T } = useT();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bulk, setBulk] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Decision | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Summary>("/api/decisions/summary").catch(() => null),
      apiFetch<Analysis[]>("/api/decisions/bulk-analysis").catch(() => []),
    ]).then(([s, b]) => {
      if (s) setSummary(s);
      if (b) setBulk(Array.isArray(b) ? b : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;
  if (!summary) return <div style={{ color: "#f87171", padding: 24 }}>Could not load dashboard.</div>;

  const chartData = bulk.filter(a => a.roi > 0).slice(0, 8).map((a, i) => ({
    name: `D${i + 1}`, roi: parseFloat(a.roi.toFixed(2)), rec: a.recommendation,
  }));

  const recColors: Record<Recommendation, string> = {
    SCALE: "#34d399", MAINTAIN: "#818cf8", MONITOR: "#fbbf24", KILL: "#f87171", NO_DATA: "#4b5563",
  };

  const pieData = (["SCALE", "MAINTAIN", "MONITOR", "KILL", "NO_DATA"] as Recommendation[])
    .map(r => ({ name: r, value: bulk.filter(a => a.recommendation === r).length, color: recColors[r] }))
    .filter(d => d.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {detail && <DetailDrawer decision={detail} onClose={() => setDetail(null)} />}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard value={summary.total_decisions} label="Total decisions" sub="All time" animated />
        <KpiCard value={summary.scale_worthy} label="Scale worthy" sub="ROI › 3x + confidence" color="#34d399" animated />
        <KpiCard value={summary.need_action} label="Need action" sub="Low ROI confirmed" color="#f87171" animated />
        <KpiCard value={summary.avg_roi ?? 0} label="Avg weighted ROI" sub="Time-decay adjusted" color="#818cf8" animated suffix="x" decimals={2} />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        {/* Bar chart */}
        <Card>
          <CardHead title="ROI by decision" action={<span style={{ fontSize: 11, color: T.textLow }}>color = recommendation</span>} />
          {chartData.length > 0 ? (
            <div style={{ padding: "16px 8px 8px" }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barSize={32}>
                  <XAxis dataKey="name" tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip contentStyle={{ background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: T.textMid }} />
                  <Bar dataKey="roi" radius={[5, 5, 0, 0]} name="ROI">
                    {chartData.map((e, i) => <Cell key={i} fill={recColors[e.rec] ?? "#6d5bf7"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState message="Add outcomes to see ROI chart" />}
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHead title="Recommendations" />
          {pieData.length > 0 ? (
            <div style={{ padding: "12px 0 4px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", padding: "0 16px 12px", justifyContent: "center" }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.textMid }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: d.color }} />
                    {REC_META[d.name as Recommendation].label} ({d.value})
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyState message="Run analyses first" />}
        </Card>
      </div>

      {/* Recent decisions */}
      <Card>
        <CardHead
          title="Recent decisions"
          action={
            <button onClick={() => goTo("decisions")} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              View all →
            </button>
          }
        />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Type</Th><Th>Owner</Th><Th>Cost</Th><Th>ROI</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(summary.recent_decisions ?? []).map(d => (
              <tr key={d.id}
                onClick={() => setDetail(d as Decision)}
                style={{ cursor: "pointer", transition: "background 0.1s" }}
                onMouseOver={e => (e.currentTarget.style.background = T.surfaceHov)}
                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
              >
                <Td><TypePill type={d.type} /></Td>
                <Td style={{ color: T.text, fontWeight: 500 }}>{d.owner}</Td>
                <Td muted>{fmt(d.cost_amount)}</Td>
                <Td style={{ color: d.roi ? "#818cf8" : T.textLow, fontWeight: d.roi ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
                  {d.roi ? fmtROI(d.roi) : "—"}
                </Td>
                <Td><RecBadge rec={(d.recommendation as Recommendation) ?? "NO_DATA"} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!summary.recent_decisions || summary.recent_decisions.length === 0) && (
          <EmptyState message="No decisions yet — add your first one" />
        )}
      </Card>
    </div>
  );
}

function DecisionsPage({ goTo }: { goTo: (p: Page) => void }) {
  const { T } = useT();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<Decision | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), page_size: "15" });
      if (filterType) p.set("type", filterType);
      if (search) p.set("search", search);
      const data = await apiFetch<{ items: Decision[]; pagination: { total_pages: number; total_items: number } }>(`/api/decisions/?${p}`);
      setDecisions(data.items ?? []);
      setTotalPages(data.pagination?.total_pages ?? 1);
      setTotalItems(data.pagination?.total_items ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, filterType, search]);

  useEffect(() => { load(); }, [load]);

  const del = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
      {detail && <DetailDrawer decision={detail} onClose={() => setDetail(null)} />}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <FInput label="Search" placeholder="Owner or description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div style={{ minWidth: 140 }}>
          <FSelect label="Type" options={["", ...DECISION_TYPES]}
            valueLabels={{ "": "All types", hire: "Hire", ad_spend: "Ad Spend", vendor: "Vendor", tool: "Tool" }}
            value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} />
        </div>
        <Btn variant="subtle" onClick={() => goTo("add-decision")}>+ New</Btn>
      </div>

      {/* Count */}
      {!loading && (
        <div style={{ fontSize: 12, color: T.textLow }}>
          {totalItems} decision{totalItems !== 1 ? "s" : ""}
          {search || filterType ? " (filtered)" : ""}
          <span style={{ marginLeft: 8, fontSize: 11 }}>· click a row to view details</span>
        </div>
      )}

      <Card>
        {loading ? <Spinner /> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>Type</Th><Th>Owner</Th><Th>Cost</Th><Th>Date</Th><Th>Description</Th><Th></Th></tr></thead>
            <tbody>
              {decisions.map(d => (
                <tr key={d.id}
                  onClick={() => setDetail(d)}
                  style={{ cursor: "pointer", transition: "background 0.1s" }}
                  onMouseOver={e => (e.currentTarget.style.background = T.surfaceHov)}
                  onMouseOut={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Td><TypePill type={d.type} /></Td>
                  <Td style={{ color: T.text, fontWeight: 500 }}>{d.owner}</Td>
                  <Td muted>{fmt(d.cost_amount)}</Td>
                  <Td muted>{new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Td>
                  <Td muted style={{ maxWidth: 200 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.description || "—"}
                    </span>
                  </Td>
                  <Td>
                    <Btn variant="danger" size="sm" disabled={deleting === d.id}
                      onClick={e => del(d.id, e)}>
                      {deleting === d.id ? "…" : "Delete"}
                    </Btn>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && decisions.length === 0 && <EmptyState message="No decisions found" />}
      </Card>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <Btn variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Btn>
          <span style={{ fontSize: 12, color: T.textLow }}>Page {page} of {totalPages}</span>
          <Btn variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</Btn>
        </div>
      )}
    </div>
  );
}

function AnalysisPage() {
  const { T } = useT();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [outcomes, setOutcomes] = useState<{ metric_type: string; value: number; date: string }[]>([]);
  const [loading, setLoading] = useState(false);

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
    value: o.value, type: o.metric_type,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <FSelect label="Select decision"
            options={["", ...decisions.map(d => d.id)]}
            valueLabels={Object.fromEntries([
              ["", "Choose a decision…"],
              ...decisions.map(d => [d.id, `[${d.type.replace("_", " ")}] ${d.owner} — ${fmt(d.cost_amount)}`]),
            ])}
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setAnalysis(null); }}
          />
        </div>
        <Btn onClick={run} disabled={!selectedId || loading}>
          {loading ? "Running…" : "◉ Analyse"}
        </Btn>
      </div>

      {loading && <Spinner />}

      {analysis && rec && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Hero */}
          <div style={{
            background: `${rec.color}0c`, border: `1px solid ${rec.color}28`,
            borderRadius: T.radius, padding: "24px 28px",
            display: "flex", gap: 20, alignItems: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: rec.bg, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 24, color: rec.color, flexShrink: 0,
              border: `1px solid ${rec.color}30`,
            }}>{rec.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: rec.color, letterSpacing: "-0.02em" }}>{rec.label}</div>
              <div style={{ fontSize: 13, color: T.textMid, marginTop: 4 }}>{rec.desc}</div>
              {chosen && (
                <div style={{ fontSize: 11, color: T.textLow, marginTop: 6, display: "flex", gap: 12 }}>
                  <span>{chosen.owner}</span>
                  <span>·</span>
                  <span>{chosen.type.replace("_", " ")}</span>
                  <span>·</span>
                  <span>{fmt(chosen.cost_amount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <KpiCard value={analysis.roi} label="ROI" sub="Weighted by time decay" color="#818cf8" animated suffix="x" decimals={2} />
            <KpiCard value={analysis.confidence * 100} label="Confidence" sub="Outcome count + consistency" color="#34d399" animated suffix="%" />
            <KpiCard value={analysis.outcome_count} label="Linked outcomes" animated />
            {analysis.weighted_revenue !== undefined && (
              <KpiCard value={analysis.weighted_revenue} label="Weighted revenue" color="#fbbf24" prefix="$" />
            )}
          </div>

          {/* Timeline chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHead title="Outcome timeline" action={<span style={{ fontSize: 11, color: T.textLow }}>{outcomes.length} outcome{outcomes.length !== 1 ? "s" : ""}</span>} />
              <div style={{ padding: "16px 8px 8px" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="date" tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.textLow, fontSize: 11 }} axisLine={false} tickLine={false} width={64}
                      tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [fmt(v), "Value"]} />
                    <Line type="monotone" dataKey="value" stroke="#6d5bf7" strokeWidth={2.5}
                      dot={{ fill: "#6d5bf7", r: 5, strokeWidth: 2, stroke: T.surface }}
                      activeDot={{ r: 7, fill: "#8b7cf8" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {analysis.explanation && (
            <Card style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: T.textLow, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Explanation</div>
              <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.8 }}>{analysis.explanation}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function AddDecisionPage({ goTo }: { goTo: (p: Page) => void }) {
  const { T } = useT();
  const [form, setForm] = useState({
    type: "hire" as DecisionType, owner: "", cost_amount: "",
    date: new Date().toISOString().split("T")[0], description: "",
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.owner.trim() || !form.cost_amount) return alert("Owner and cost required.");
    setLoading(true);
    try {
      await apiFetch("/api/decisions/", {
        method: "POST",
        body: JSON.stringify({ ...form, cost_amount: parseFloat(form.cost_amount) }),
      });
      setToast("Decision created");
      setForm({ type: "hire", owner: "", cost_amount: "", date: new Date().toISOString().split("T")[0], description: "" });
      setTimeout(() => goTo("decisions"), 1400);
    } catch { alert("Failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 500 }}>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
      <Card style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Log a GTM spend</div>
          <div style={{ fontSize: 12, color: T.textLow, marginTop: 3 }}>Add a new decision to track its ROI over time</div>
        </div>
        <FSelect label="Type" options={DECISION_TYPES} value={form.type} onChange={e => set("type", e.target.value)} />
        <FInput label="Owner" placeholder="e.g. Sales Team" value={form.owner} onChange={e => set("owner", e.target.value)} />
        <FInput label="Cost (USD)" type="number" placeholder="50000" value={form.cost_amount} onChange={e => set("cost_amount", e.target.value)} />
        <FInput label="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        <FInput label="Description (optional)" placeholder="What was this spend for?" value={form.description} onChange={e => set("description", e.target.value)} />
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <Btn onClick={submit} disabled={loading}>{loading ? "Saving…" : "✓ Add Decision"}</Btn>
          <Btn variant="ghost" onClick={() => goTo("decisions")}>Cancel</Btn>
        </div>
      </Card>
    </div>
  );
}

function AddOutcomePage() {
  const { T } = useT();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [form, setForm] = useState({
    decision_id: "", metric_type: "revenue" as MetricType,
    value: "", date: new Date().toISOString().split("T")[0], source: "manual",
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    apiFetch<{ items: Decision[] }>("/api/decisions/?page_size=100")
      .then(d => setDecisions(d.items ?? []))
      .catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.decision_id || !form.value) return alert("Decision and value required.");
    setLoading(true);
    try {
      await apiFetch("/api/outcomes/", {
        method: "POST",
        body: JSON.stringify({ ...form, value: parseFloat(form.value) }),
      });
      setToast("Outcome linked successfully");
      setForm(f => ({ ...f, value: "" }));
    } catch { alert("Failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 500 }}>
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
      <Card style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Link a revenue outcome</div>
          <div style={{ fontSize: 12, color: T.textLow, marginTop: 3 }}>Attach revenue / pipeline / churn to an existing decision</div>
        </div>
        <FSelect label="Decision"
          options={["", ...decisions.map(d => d.id)]}
          valueLabels={Object.fromEntries([
            ["", "Select a decision…"],
            ...decisions.map(d => [d.id, `[${d.type.replace("_", " ")}] ${d.owner} — ${fmt(d.cost_amount)}`]),
          ])}
          value={form.decision_id} onChange={e => set("decision_id", e.target.value)} />
        <FSelect label="Metric type" options={METRIC_TYPES} value={form.metric_type} onChange={e => set("metric_type", e.target.value)} />
        <FInput label="Value (USD)" type="number" placeholder="120000" value={form.value} onChange={e => set("value", e.target.value)} />
        <FInput label="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        <Btn onClick={submit} disabled={loading} style={{ alignSelf: "flex-start" }}>
          {loading ? "Saving…" : "⊕ Link Outcome"}
        </Btn>
      </Card>
    </div>
  );
}

function CSVPage() {
  const { T } = useT();
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
    <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${file ? "#6d5bf7" : T.border}`,
          borderRadius: T.radius, padding: "44px 24px", textAlign: "center", cursor: "pointer",
          background: file ? "rgba(109,91,247,0.05)" : T.surface,
          transition: "all 0.2s",
        }}
        onMouseOver={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#6d5bf7"}
        onMouseOut={e => (e.currentTarget as HTMLDivElement).style.borderColor = file ? "#6d5bf7" : T.border}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>{file ? "📄" : "📂"}</div>
        <div style={{ fontSize: 14, color: file ? T.text : T.textMid, fontWeight: file ? 600 : 400 }}>
          {file ? file.name : "Click to select a CSV file"}
        </div>
        {!file && <div style={{ fontSize: 12, color: T.textLow, marginTop: 4 }}>Bulk import decisions</div>}
        <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 10, color: T.textLow, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Expected format</div>
          <code style={{ fontSize: 12, color: T.textMid, fontFamily: "monospace", lineHeight: 2, display: "block" }}>
            type,date,owner,cost_amount,description<br />
            hire,2024-01-10,Sales Team,75000,SDR hire<br />
            ad_spend,2024-01-15,Marketing,40000,LinkedIn Q1
          </code>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={upload} disabled={!file || loading}>
          {loading ? "Uploading…" : "↑ Upload"}
        </Btn>
        {file && <Btn variant="ghost" onClick={() => { setFile(null); setResult(null); }}>Clear</Btn>}
      </div>

      {result && (
        <div style={{
          background: result.failed === 0 ? "rgba(52,211,153,0.07)" : "rgba(251,191,36,0.07)",
          border: `1px solid ${result.failed === 0 ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
          borderRadius: T.radiusSm, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: result.failed === 0 ? "#34d399" : "#fbbf24" }}>
            {result.success} decisions imported{result.failed > 0 && `, ${result.failed} failed`}
          </div>
          {result.errors?.map((e, i) => <div key={i} style={{ fontSize: 11, color: "#f87171", marginTop: 5 }}>{e}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const T = dark ? DARK : LIGHT;

  const toggleSidebar = useCallback(() => setCollapsed(c => !c), []);
  const toggleTheme   = useCallback(() => setDark(d => !d), []);

  useKeyboardNav(setPage, toggleSidebar, toggleTheme);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "?" && !["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        setShowShortcuts(s => !s);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const PAGE_META: Record<Page, { title: string; sub: string }> = {
    dashboard:      { title: "Overview",     sub: "GTM performance at a glance" },
    decisions:      { title: "Decisions",    sub: "All logged GTM spends" },
    analysis:       { title: "Analysis",     sub: "ROI & recommendation per decision" },
    "add-decision": { title: "New Decision", sub: "Log a GTM spend" },
    "add-outcome":  { title: "New Outcome",  sub: "Link revenue to a decision" },
    csv:            { title: "Import CSV",   sub: "Bulk import decisions" },
  };

  const pm = PAGE_META[page];

  return (
    <ThemeCtx.Provider value={{ T, dark, toggle: toggleTheme }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${T.bg}; color: ${T.text}; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; height: 100%; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(30px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes scaleIn { from { transform: translate(-50%,-50%) scale(0.95); opacity: 0 } to { transform: translate(-50%,-50%) scale(1); opacity: 1 } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 8px; }
        input, select { color-scheme: ${dark ? "dark" : "light"}; }
        * { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.15s ease; }
      `}</style>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* ── Sidebar ── */}
        <aside style={{
          width: collapsed ? 56 : 210, flexShrink: 0,
          background: T.surface, borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column",
          transition: "width 0.22s cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}>
          {/* Logo */}
          <div style={{
            padding: collapsed ? "18px 13px" : "18px 16px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", gap: 10,
            justifyContent: collapsed ? "center" : "flex-start",
            flexShrink: 0,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: T.accent, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff",
              boxShadow: `0 2px 10px ${T.accentGlow}`,
            }}>G</div>
            {!collapsed && (
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap" }}>GTM Tracker</div>
                <div style={{ fontSize: 10, color: T.textLow, whiteSpace: "nowrap" }}>Attribution Engine</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 1, padding: "8px 6px", flex: 1, overflowY: "auto" }}>
            {NAV_ITEMS.map(n => {
              const active = page === n.id;
              return (
                <button key={n.id} onClick={() => setPage(n.id)}
                  title={collapsed ? `${n.label} (${n.shortcut})` : ""}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: collapsed ? 0 : 9,
                    padding: collapsed ? "9px 0" : "8px 10px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: T.radiusSm, border: "none",
                    background: active ? `${T.accent}18` : "transparent",
                    color: active ? T.accentHi : T.textLow,
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    cursor: "pointer", textAlign: "left",
                    transition: "background 0.12s, color 0.12s",
                    width: "100%", whiteSpace: "nowrap",
                    borderLeft: active && !collapsed ? `2px solid ${T.accent}` : "2px solid transparent",
                    paddingLeft: active && !collapsed ? 8 : undefined,
                  }}
                  onMouseOver={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = T.surfaceHov; (e.currentTarget as HTMLElement).style.color = T.textMid; }}}
                  onMouseOut={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.textLow; }}}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{n.icon}</span>
                  {!collapsed && n.label}
                </button>
              );
            })}
          </nav>

          {/* Bottom controls */}
          <div style={{
            padding: "8px 6px", borderTop: `1px solid ${T.border}`,
            display: "flex", flexDirection: "column", gap: 1,
          }}>
            {/* Theme toggle */}
            <button onClick={toggleTheme}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: collapsed ? "9px 0" : "8px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: T.radiusSm, border: "none",
                background: "transparent", color: T.textLow,
                fontSize: 13, cursor: "pointer", width: "100%",
                transition: "background 0.12s",
              }}
              title={`Switch to ${dark ? "light" : "dark"} mode`}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{dark ? "☀" : "◑"}</span>
              {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
            </button>

            {/* Collapse toggle */}
            <button onClick={toggleSidebar}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: collapsed ? "9px 0" : "8px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: T.radiusSm, border: "none",
                background: "transparent", color: T.textLow,
                fontSize: 13, cursor: "pointer", width: "100%",
              }}
              title="Toggle sidebar  [  ]"
            >
              <span style={{ fontSize: 13, width: 20, textAlign: "center" }}>{collapsed ? "▶" : "◀"}</span>
              {!collapsed && <span>Collapse</span>}
            </button>

            {/* Shortcuts hint */}
            {!collapsed && (
              <button onClick={() => setShowShortcuts(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px",
                  borderRadius: T.radiusSm, border: "none",
                  background: "transparent", color: T.textLow,
                  fontSize: 13, cursor: "pointer", width: "100%",
                }}
              >
                <span style={{ fontSize: 13, width: 20, textAlign: "center" }}>?</span>
                Shortcuts
              </button>
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
          {/* Header */}
          <header style={{
            padding: "13px 24px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: T.surface, flexShrink: 0,
          }}>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>{pm.title}</h1>
              <p style={{ fontSize: 11, color: T.textLow, marginTop: 1 }}>{pm.sub}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <ShortcutHint keys="G N" />
              <Btn size="sm" onClick={() => setPage("add-decision")}>+ New Decision</Btn>
            </div>
          </header>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
            {page === "dashboard"    && <DashboardPage goTo={setPage} />}
            {page === "decisions"    && <DecisionsPage goTo={setPage} />}
            {page === "analysis"     && <AnalysisPage />}
            {page === "add-decision" && <AddDecisionPage goTo={setPage} />}
            {page === "add-outcome"  && <AddOutcomePage />}
            {page === "csv"          && <CSVPage />}
          </div>
        </main>
      </div>
    </ThemeCtx.Provider>
  );
}