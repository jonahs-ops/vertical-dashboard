import { useState, useEffect, useRef } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const API_URL =
  "/api/dashboard";

const STAGE_LABELS = {
  1: "Candidate",
  2: "Evaluation",
  3: "Launch",
  4: "Growth",
  5: "Core",
};

const STAGE_COLORS = {
  1: "#888780",
  2: "#378ADD",
  3: "#639922",
  4: "#BA7517",
  5: "#0F6E56",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3) + "K";
  return "$" + Math.round(n).toLocaleString();
}
function fmtN(n) {
  return n === null || isNaN(n) ? "—" : Math.round(n).toLocaleString();
}
function fmtPct(n) {
  return n === null || isNaN(n) ? "—" : Math.round(n) + "%";
}
function timeSince(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  return Math.round(mins / 60) + " hr ago";
}

function deriveMilestones(v) {
  const monthly = [
    v.gwp_m01, v.gwp_m02, v.gwp_m03, v.gwp_m04,
    v.gwp_m05, v.gwp_m06, v.gwp_m07, v.gwp_m08,
    v.gwp_m09, v.gwp_m10, v.gwp_m11, v.gwp_m12,
  ];
  const cumGWP = monthly.reduce((a, b) => a + b, 0);
  return [
    {
      label: "Vertical thesis approved",
      complete: v.lifecycle_index >= 1,
      note: "Vertical added to active pipeline",
    },
    {
      label: "First VP+ conversation",
      complete: v.meetings_l4w > 0 || v.deals_won_count > 0,
      note:
        v.meetings_l4w > 0
          ? `${v.meetings_l4w} meetings in last 4 weeks`
          : "No recent meetings logged",
    },
    {
      label: "First deal signed",
      complete: v.deals_won_count > 0,
      note:
        v.deals_won_count > 0
          ? `${v.deals_won_count} deals won to date`
          : "No closed won deals yet",
    },
    {
      label: "First policy bound",
      complete: v.gwp_ytd > 0,
      note: v.gwp_ytd > 0 ? `${fmt(v.gwp_ytd)} GWP YTD` : "No GWP recorded yet",
    },
    {
      label: "$100K GWP milestone",
      complete: cumGWP >= 100000,
      note:
        cumGWP >= 100000
          ? `${fmt(cumGWP)} trailing 12mo`
          : `${fmt(cumGWP)} of $100K`,
    },
    {
      label: "3+ active partners",
      complete: v.active_partners >= 3,
      note: `${v.active_partners} active partner${v.active_partners !== 1 ? "s" : ""} currently`,
    },
    {
      label: "Repeatable motion established",
      complete: v.lifecycle_index >= 4,
      note:
        v.lifecycle_index >= 4
          ? "Stage 4+ confirms repeatability"
          : "Reach Growth stage to confirm",
    },
    {
      label: "Scale / core stage",
      complete: v.lifecycle_index >= 5,
      note:
        v.lifecycle_index >= 5
          ? "Operating at Core stage"
          : "Target: Core lifecycle stage",
    },
  ];
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, valueColor }) {
  return (
    <div style={s.kpi}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color: valueColor || "#111827" }}>{value}</div>
      {sub && <div style={s.kpiSub}>{sub}</div>}
    </div>
  );
}

function ActivityRow({ label, value, valueColor }) {
  return (
    <div style={s.activityRow}>
      <span style={s.activityLabel}>{label}</span>
      <span style={{ ...s.activityVal, color: valueColor || "#111827" }}>
        {value}
      </span>
    </div>
  );
}

function Sparkline({ monthly }) {
  const labels = ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12"];
  return (
    <div style={{ position: "relative", height: 160 }}>
      <Bar
        data={{
          labels,
          datasets: [
            {
              data: monthly,
              backgroundColor: "#0F6E56",
              borderRadius: 3,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => fmt(c.raw) } },
          },
          scales: {
            x: {
              ticks: { font: { size: 9 }, color: "#aaa", autoSkip: false, maxRotation: 0 },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              ticks: {
                font: { size: 9 },
                color: "#aaa",
                callback: (v) =>
                  v >= 1e6
                    ? (v / 1e6).toFixed(0) + "M"
                    : v >= 1e3
                    ? (v / 1e3).toFixed(0) + "K"
                    : v,
              },
              grid: { color: "rgba(0,0,0,0.04)" },
              border: { display: false },
            },
          },
        }}
      />
    </div>
  );
}

function Milestones({ vertical }) {
  const milestones = deriveMilestones(vertical);
  const completed = milestones.filter((m) => m.complete).length;
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>
        Journey milestones · {completed}/{milestones.length} complete
      </div>
      {milestones.map((m) => (
        <div key={m.label} style={s.msRow}>
          <div
            style={{
              ...s.msDot,
              background: m.complete ? "#0F6E56" : "transparent",
              border: m.complete ? "none" : "1.5px solid #aaa",
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: m.complete ? "#111827" : "#9CA3AF",
              }}
            >
              {m.label}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              {m.note}
            </div>
          </div>
          <span
            style={{
              ...s.msBadge,
              background: m.complete ? "#E1F5EE" : "#F1EFE8",
              color: m.complete ? "#085041" : "#5F5E5A",
            }}
          >
            {m.complete ? "DONE" : "PENDING"}
          </span>
        </div>
      ))}
    </div>
  );
}

function VerticalView({ vertical, lastRefreshed }) {
  const v = vertical;
  const stageColor = STAGE_COLORS[v.lifecycle_index] || "#888";
  const monthly = [
    v.gwp_m01, v.gwp_m02, v.gwp_m03, v.gwp_m04,
    v.gwp_m05, v.gwp_m06, v.gwp_m07, v.gwp_m08,
    v.gwp_m09, v.gwp_m10, v.gwp_m11, v.gwp_m12,
  ];
  const realizationColor =
    v.realization_rate > 150
      ? "#E24B4A"
      : v.realization_rate > 80
      ? "#639922"
      : v.realization_rate > 40
      ? "#BA7517"
      : "#888780";
  const stalledColor =
    v.stalled_deals > 5 ? "#E24B4A" : v.stalled_deals > 2 ? "#BA7517" : "#639922";

  return (
    <>
      <div style={s.stageBadge(stageColor)}>
        STAGE {v.lifecycle_index} · {STAGE_LABELS[v.lifecycle_index] || "—"}
      </div>

      <div style={s.sectionLabel}>GWP performance</div>
      <div style={s.kpiGrid}>
        <KpiCard label="GWP MTD" value={fmt(v.gwp_mtd)} sub="month to date" />
        <KpiCard label="GWP QTD" value={fmt(v.gwp_qtd)} sub="quarter to date" />
        <KpiCard label="GWP YTD" value={fmt(v.gwp_ytd)} sub="year to date" />
        <KpiCard
          label="Active partners"
          value={fmtN(v.active_partners)}
          sub="last 90 days, GWP > 0"
          valueColor={v.active_partners >= 3 ? "#0F6E56" : "#BA7517"}
        />
      </div>

      <div style={s.sectionLabel}>GWP trend — trailing 12 months</div>
      <div style={s.card}>
        <Sparkline monthly={monthly} />
      </div>

      <div style={s.twoCol}>
        <div>
          <div style={s.sectionLabel}>Pipeline</div>
          <div style={s.card}>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 14, color: "#111827" }}>
              {fmt(v.pipeline_total)}
            </div>
            <ActivityRow label="OPEN DEALS" value={fmtN(v.pipeline_count)} />
            <ActivityRow label="DEALS WON YTD" value={fmtN(v.deals_won_count)} />
            <ActivityRow label="VALUE WON YTD" value={fmt(v.deals_won_value)} />
            <ActivityRow
              label="AVG CYCLE"
              value={v.avg_cycle_days ? Math.round(v.avg_cycle_days) + "d" : "—"}
            />
            <ActivityRow
              label="STALLED >30D"
              value={fmtN(v.stalled_deals)}
              valueColor={stalledColor}
            />
          </div>
        </div>

        <div>
          <div style={s.sectionLabel}>Activity — last 4 weeks</div>
          <div style={s.card}>
            <ActivityRow label="MEETINGS" value={fmtN(v.meetings_l4w)} />
            <ActivityRow label="CALLS" value={fmtN(v.calls_l4w)} />
            <ActivityRow label="EMAILS" value={fmtN(v.emails_l4w)} />
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #F3F4F6",
              }}
            >
              <div style={{ ...s.sectionLabel, marginTop: 0 }}>
                Realization rate
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: realizationColor,
                  letterSpacing: "-0.02em",
                }}
              >
                {fmtPct(v.realization_rate)}
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>
                GWP from won partners / closed won T12
              </div>
              {v.realization_rate > 150 && (
                <div style={{ fontSize: 10, color: "#E24B4A", marginTop: 6 }}>
                  ⚠ V1 approximation — review post-prototype
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={s.sectionLabel}>Journey milestones</div>
      <Milestones vertical={v} />

      <div style={{ fontSize: 10, color: "#9CA3AF", textAlign: "right", marginTop: 16 }}>
        Last synced {timeSince(lastRefreshed)}
      </div>
    </>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [verticals, setVerticals] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((json) => {
        setVerticals(json.verticals);
        setLastRefreshed(json.last_refreshed);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={s.app}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.logo}>VERTICAL INSURE</span>
          <div style={s.hdivider} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={s.viewingLabel}>VIEWING</span>
            <select
              style={s.select}
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(parseInt(e.target.value))}
              disabled={loading || !!error}
            >
              {verticals.map((v, i) => (
                <option key={v.vertical_name} value={i}>
                  {v.vertical_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={s.syncLabel}>⟳ SHEETS SYNC</div>
      </div>

      <div style={s.main}>
        {loading && (
          <div style={s.centered}>
            <div style={s.spinner} />
            <div style={{ fontSize: 11, color: "#9CA3AF", letterSpacing: "0.1em" }}>
              LOADING LIVE DATA
            </div>
          </div>
        )}
        {error && (
          <div style={s.centered}>
            <div style={{ color: "#E24B4A", fontSize: 13 }}>
              Could not load data: {error}
            </div>
          </div>
        )}
        {!loading && !error && verticals.length > 0 && (
          <VerticalView
            vertical={verticals[selectedIndex]}
            lastRefreshed={lastRefreshed}
          />
        )}
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const s = {
  app: {
  background: "#F8FAFC",
  minHeight: "100vh",
  fontFamily: "'Montserrat', sans-serif",
  fontSize: 14,
  color: "#111827",
  paddingBottom: 48,
},
  header: {
    background: "#FFFFFF",
    borderBottom: "1px solid #E5E7EB",
    padding: "16px 36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  logo: { fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", color: "#111827", fontFamily: "'Montserrat', sans-serif" },
  hdivider: { width: 1, height: 20, background: "#E5E7EB" },
  viewingLabel: { fontSize: 11, color: "#9CA3AF", letterSpacing: "0.08em" },
  select: {
    fontFamily: "'DM Mono', 'Courier New', monospace",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 12px",
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    background: "#F9FAFB",
    color: "#111827",
    cursor: "pointer",
    minWidth: 180,
  },
  syncLabel: { fontSize: 10, color: "#9CA3AF", letterSpacing: "0.08em" },
  main: { padding: "28px 36px", maxWidth: 1200, margin: "0 auto" },
  stageBadge: (color) => ({
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    padding: "4px 12px",
    borderRadius: 20,
    border: `1px solid ${color}33`,
    color: color,
    marginBottom: 4,
  }),
  sectionLabel: {
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "'Playfair Display', serif",
  letterSpacing: "0.04em",
  color: "#374151",
  marginBottom: 12,
  marginTop: 28,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  kpi: {
    background: "#F1F5F9",
    borderRadius: 8,
    padding: "14px 16px",
  },
  kpiLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    letterSpacing: "0.1em",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
  },
  kpiSub: { fontSize: 10, color: "#9CA3AF", marginTop: 5 },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: 10,
    padding: "18px 20px",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#374151",
    textTransform: "uppercase",
    marginBottom: 14,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  activityRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #F3F4F6",
    fontSize: 12,
  },
  activityLabel: { color: "#9CA3AF", letterSpacing: "0.06em", fontSize: 11 },
  activityVal: { fontWeight: 600, color: "#111827" },
  msRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #F9FAFB",
  },
  msDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 3,
  },
  msBadge: {
    fontSize: 9,
    letterSpacing: "0.1em",
    padding: "2px 7px",
    borderRadius: 20,
    marginLeft: "auto",
    flexShrink: 0,
    fontWeight: 600,
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 0",
    gap: 14,
  },
  spinner: {
    width: 24,
    height: 24,
    border: "2px solid #E5E7EB",
    borderTop: "2px solid #0F6E56",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

const styleEl = document.createElement("style");
styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } } @media (max-width: 600px) { .two-col { grid-template-columns: 1fr !important; } }`;
document.head.appendChild(styleEl);
