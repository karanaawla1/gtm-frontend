'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://15.134.209.242:8000';

interface Decision {
  id: string; type: string; owner: string;
  cost_amount: number; description: string; status: string; date: string;
}
interface Analysis {
  decision_id: string; roi: number; confidence: number;
  recommendation: string; outcomes_count: number; from_cache: boolean;
}

async function getDecisions(): Promise<Decision[]> {
  const res = await fetch(`${API}/api/decisions/`); return res.json();
}
async function getSummary() {
  const res = await fetch(`${API}/api/decisions/summary`); return res.json();
}
async function getAnalysis(id: string): Promise<Analysis> {
  const res = await fetch(`${API}/api/decisions/${id}/analysis`); return res.json();
}
async function createDecision(data: any) {
  const res = await fetch(`${API}/api/decisions/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }); return res.json();
}
async function createOutcome(data: any) {
  const res = await fetch(`${API}/api/outcomes/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }); return res.json();
}
async function uploadCSV(file: File) {
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch(`${API}/api/decisions/upload-csv`, { method: 'POST', body: fd });
  return res.json();
}
async function deleteDecision(id: string) {
  await fetch(`${API}/api/decisions/${id}`, { method: 'DELETE' });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const REC_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  SCALE:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  KILL:     { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  MONITOR:  { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  MAINTAIN: { bg: 'bg-sky-500/10',     text: 'text-sky-400',     dot: 'bg-sky-400' },
  NO_DATA:  { bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400' },
};

const TYPE_CONFIG: Record<string, { bg: string; text: string; emoji: string }> = {
  hire:     { bg: 'bg-violet-500/10', text: 'text-violet-400', emoji: '👤' },
  ad_spend: { bg: 'bg-orange-500/10', text: 'text-orange-400', emoji: '📢' },
  vendor:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   emoji: '🤝' },
  tool:     { bg: 'bg-teal-500/10',   text: 'text-teal-400',   emoji: '🔧' },
};

function RecBadge({ rec }: { rec: string }) {
  const c = REC_CONFIG[rec] || REC_CONFIG.NO_DATA;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {rec}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_CONFIG[type] || { bg: 'bg-slate-500/10', text: 'text-slate-400', emoji: '📌' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.emoji} {type.replace('_', ' ')}
    </span>
  );
}

function Input({ label, ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input {...props} className="w-full bg-slate-900/50 border border-slate-700/50 text-slate-100 placeholder-slate-500 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all" />
    </div>
  );
}

function Select({ label, children, ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <select {...props} className="w-full bg-slate-900/50 border border-slate-700/50 text-slate-100 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all">
        {children}
      </select>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([getDecisions(), getSummary()]);
      setDecisions(d); setSummary(s);
      const map: Record<string, Analysis> = {};
      for (const dec of d) { try { map[dec.id] = await getAnalysis(dec.id); } catch {} }
      setAnalyses(map);
    } catch {}
    setLoading(false);
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }

  const nav = [
    { icon: '▣', label: 'Dashboard',    page: 'dashboard',    sub: 'Overview & stats' },
    { icon: '≡', label: 'Decisions',    page: 'decisions',    sub: 'All decisions' },
    { icon: '◎', label: 'Analysis',     page: 'analysis',     sub: 'ROI breakdown' },
    { icon: '+', label: 'Add Decision', page: 'add-decision', sub: 'New entry' },
    { icon: '↑', label: 'Add Outcome',  page: 'add-outcome',  sub: 'Link revenue' },
    { icon: '⇑', label: 'CSV Upload',   page: 'upload',       sub: 'Bulk import' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060912' }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static top-0 left-0 h-full z-50 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: '240px', background: '#0a0e1a', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        <div className="px-5 py-6">
          <div className="flex items-center gap-3 mb-8">
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '10px', width: '34px', height: '34px' }}
              className="flex items-center justify-center text-white text-sm font-bold flex-shrink-0">G</div>
            <div>
              <div className="text-sm font-semibold text-slate-100">GTM Tracker</div>
              <div className="text-xs text-slate-500">Attribution Engine</div>
            </div>
          </div>

          <div className="space-y-0.5">
            {nav.map(item => (
              <button key={item.page} onClick={() => { setPage(item.page); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                  page === item.page
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}>
                <span className={`text-xs w-4 text-center font-mono ${page === item.page ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                  {item.icon}
                </span>
                <div>
                  <div className="text-xs font-medium">{item.label}</div>
                </div>
                {page === item.page && <div className="ml-auto w-1 h-4 rounded-full bg-indigo-500" />}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors">
            <span>↗</span> API Documentation
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-8 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#060912' }}>
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-300">☰</button>
            <div>
              <h1 className="text-sm font-semibold text-slate-100">{nav.find(n => n.page === page)?.label}</h1>
              <p className="text-xs text-slate-500">{nav.find(n => n.page === page)?.sub}</p>
            </div>
          </div>
          <button onClick={() => setPage('add-decision')}
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            className="text-white px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity shadow-lg">
            + New Decision
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-xs text-slate-500">Loading data...</span>
              </div>
            </div>
          ) : (
            <>
              {page === 'dashboard'    && <Dashboard decisions={decisions} summary={summary} analyses={analyses} onNavigate={setPage} />}
              {page === 'decisions'    && <DecisionsList decisions={decisions} analyses={analyses} onNavigate={setPage} onDelete={async (id: string) => { await deleteDecision(id); showToast('Decision deleted', 'success'); loadData(); }} />}
              {page === 'analysis'     && <AnalysisPage decisions={decisions} />}
              {page === 'add-decision' && <AddDecisionForm onSuccess={() => { showToast('Decision created!', 'success'); loadData(); setPage('decisions'); }} />}
              {page === 'add-outcome'  && <AddOutcomeForm decisions={decisions} onSuccess={() => { showToast('Outcome added!', 'success'); loadData(); }} />}
              {page === 'upload'       && <UploadPage onSuccess={() => { showToast('CSV uploaded!', 'success'); loadData(); setPage('decisions'); }} />}
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl z-50 border
          ${toast.type === 'success' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-red-950 text-red-300 border-red-800'}`}>
          <span className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Dashboard({ decisions, summary, analyses, onNavigate }: any) {
  const stats = [
    { label: 'Total Decisions', value: summary?.total_decisions ?? 0, sub: 'All time', color: '#6366f1' },
    { label: 'Scale Worthy',    value: summary?.recommendations?.SCALE ?? 0, sub: 'High ROI', color: '#10b981' },
    { label: 'Need Action',     value: summary?.recommendations?.KILL ?? 0, sub: 'Low ROI', color: '#f43f5e' },
    { label: 'Avg ROI',         value: `${summary?.average_roi ?? 0}x`, sub: 'Weighted', color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)' }} className="rounded-2xl p-5">
            <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-medium text-slate-300">{s.label}</div>
            <div className="text-xs text-slate-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)' }} className="rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Recent Decisions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest activity</p>
          </div>
          <button onClick={() => onNavigate('decisions')} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
            View all →
          </button>
        </div>

        {decisions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#131929' }}>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-sm text-slate-400 mb-1">No decisions yet</p>
            <p className="text-xs text-slate-600 mb-5">Start tracking your GTM decisions</p>
            <button onClick={() => onNavigate('add-decision')}
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              className="text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">
              + Add First Decision
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Decision', 'Owner', 'Cost', 'ROI', 'Status'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.slice(-5).reverse().map((d: Decision) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5"><TypeBadge type={d.type} /></td>
                    <td className="px-6 py-3.5 text-xs text-slate-300">{d.owner}</td>
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-400">{formatCurrency(d.cost_amount)}</td>
                    <td className="px-6 py-3.5 text-xs font-bold" style={{ color: '#f59e0b' }}>{analyses[d.id] ? `${analyses[d.id].roi}x` : '—'}</td>
                    <td className="px-6 py-3.5">{analyses[d.id] ? <RecBadge rec={analyses[d.id].recommendation} /> : <span className="text-xs text-slate-600">No outcomes</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionsList({ decisions, analyses, onNavigate, onDelete }: any) {
  return (
    <div className="max-w-5xl" style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)' , borderRadius: '16px'}}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">All Decisions</h2>
          <p className="text-xs text-slate-500 mt-0.5">{decisions.length} total</p>
        </div>
        <button onClick={() => onNavigate('add-decision')}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          className="text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">
          + Add
        </button>
      </div>
      {decisions.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">No decisions yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Type', 'Owner', 'Cost', 'Date', 'ROI', 'Confidence', 'Rec', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decisions.map((d: Decision) => (
                <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-3.5"><TypeBadge type={d.type} /></td>
                  <td className="px-6 py-3.5 text-xs text-slate-300">{d.owner}</td>
                  <td className="px-6 py-3.5 text-xs font-mono text-slate-400">{formatCurrency(d.cost_amount)}</td>
                  <td className="px-6 py-3.5 text-xs text-slate-500">{formatDate(d.date)}</td>
                  <td className="px-6 py-3.5 text-xs font-bold" style={{ color: '#f59e0b' }}>{analyses[d.id] ? `${analyses[d.id].roi}x` : '—'}</td>
                  <td className="px-6 py-3.5">
                    {analyses[d.id] ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 w-16">
                          <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${analyses[d.id].confidence * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{(analyses[d.id].confidence * 100).toFixed(0)}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-3.5">{analyses[d.id] ? <RecBadge rec={analyses[d.id].recommendation} /> : <span className="text-xs text-slate-600">—</span>}</td>
                  <td className="px-6 py-3.5">
                    <button onClick={() => onDelete(d.id)} className="opacity-0 group-hover:opacity-100 text-xs text-slate-600 hover:text-red-400 transition-all">
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalysisPage({ decisions }: any) {
  const [selected, setSelected] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!selected) return;
    setLoading(true);
    try { setAnalysis(await getAnalysis(selected)); } catch {}
    setLoading(false);
  }

  return (
    <div className="max-w-lg space-y-4">
      <div style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px' }} className="p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">ROI Analysis</h2>
          <p className="text-xs text-slate-500 mt-1">Select a decision to see attribution breakdown</p>
        </div>
        <Select label="Decision" value={selected} onChange={(e: any) => setSelected(e.target.value)}>
          <option value="">Choose a decision...</option>
          {decisions.map((d: Decision) => (
            <option key={d.id} value={d.id}>{d.type.replace('_',' ')} — {d.owner} — {formatCurrency(d.cost_amount)}</option>
          ))}
        </Select>
        <button onClick={run} disabled={!selected || loading}
          style={{ background: selected ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : undefined }}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${selected ? 'text-white hover:opacity-90' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
          {loading ? 'Calculating...' : 'Run Analysis'}
        </button>
      </div>

      {analysis && (
        <div style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px' }} className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-100">Result</div>
            <RecBadge rec={analysis.recommendation} />
          </div>

          {[
            { label: 'ROI', value: `${analysis.roi}x`, pct: Math.min(analysis.roi / 5 * 100, 100), color: '#f59e0b' },
            { label: 'Confidence', value: `${(analysis.confidence * 100).toFixed(0)}%`, pct: analysis.confidence * 100, color: '#6366f1' },
          ].map(m => (
            <div key={m.label}>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">{m.label}</span>
                <span className="text-xs font-bold" style={{ color: m.color }}>{m.value}</span>
              </div>
              <div className="bg-slate-800/60 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, background: m.color }} />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Data Points', value: analysis.outcomes_count },
              { label: 'Source', value: analysis.from_cache ? '⚡ Redis Cache' : '🔄 Computed' },
            ].map(item => (
              <div key={item.label} style={{ background: '#0a0e1a', borderRadius: '10px' }} className="p-3">
                <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                <div className="text-xs font-semibold text-slate-200">{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#0a0e1a', borderRadius: '10px' }} className="p-4 text-xs text-slate-400 leading-relaxed">
            {analysis.recommendation === 'SCALE'    && '↑ Strong ROI with high confidence. Increase investment in this decision.'}
            {analysis.recommendation === 'KILL'     && '↓ Poor ROI confirmed. Reallocate budget to higher performing decisions.'}
            {analysis.recommendation === 'MONITOR'  && '◎ Insufficient data. Add more outcomes to improve confidence score.'}
            {analysis.recommendation === 'MAINTAIN' && '→ Performing as expected. No immediate action required.'}
          </div>
        </div>
      )}
    </div>
  );
}

function AddDecisionForm({ onSuccess }: any) {
  const [form, setForm] = useState({ type: 'hire', owner: '', cost_amount: '', description: '', date: '' });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.owner || !form.cost_amount || !form.date) return alert('Fill all required fields');
    setLoading(true);
    try { await createDecision({ ...form, cost_amount: parseFloat(form.cost_amount), date: form.date + 'T00:00:00' }); onSuccess(); }
    catch {} setLoading(false);
  }

  return (
    <div className="max-w-md">
      <div style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px' }} className="p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">New Decision</h2>
          <p className="text-xs text-slate-500 mt-1">Track a new GTM decision and its cost</p>
        </div>
        <Select label="Type" name="type" value={form.type} onChange={(e: any) => setForm(p => ({ ...p, type: e.target.value }))}>
          {[['hire','👤 Hire'],['ad_spend','📢 Ad Spend'],['vendor','🤝 Vendor'],['tool','🔧 Tool']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input label="Owner *" name="owner" value={form.owner} placeholder="e.g. Sales Team" onChange={(e: any) => setForm(p => ({ ...p, owner: e.target.value }))} />
        <Input label="Cost (USD) *" name="cost_amount" type="number" value={form.cost_amount} placeholder="8000" onChange={(e: any) => setForm(p => ({ ...p, cost_amount: e.target.value }))} />
        <Input label="Date *" name="date" type="date" value={form.date} onChange={(e: any) => setForm(p => ({ ...p, date: e.target.value }))} />
        <Input label="Description" name="description" value={form.description} placeholder="SDR hire for Q1 pipeline" onChange={(e: any) => setForm(p => ({ ...p, description: e.target.value }))} />
        <button onClick={submit} disabled={loading}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all">
          {loading ? 'Creating...' : 'Create Decision'}
        </button>
      </div>
    </div>
  );
}

function AddOutcomeForm({ decisions, onSuccess }: any) {
  const [form, setForm] = useState({ decision_id: '', metric_type: 'revenue', value: '', date: '', source: 'manual' });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.decision_id || !form.value || !form.date) return alert('Fill all required fields');
    setLoading(true);
    try { await createOutcome({ ...form, value: parseFloat(form.value), date: form.date + 'T00:00:00' }); onSuccess(); }
    catch {} setLoading(false);
  }

  return (
    <div className="max-w-md">
      <div style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px' }} className="p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Add Outcome</h2>
          <p className="text-xs text-slate-500 mt-1">Link revenue or pipeline back to a decision</p>
        </div>
        <Select label="Decision *" value={form.decision_id} onChange={(e: any) => setForm(p => ({ ...p, decision_id: e.target.value }))}>
          <option value="">Select decision...</option>
          {decisions.map((d: Decision) => <option key={d.id} value={d.id}>{d.type.replace('_',' ')} — {d.owner} — {formatCurrency(d.cost_amount)}</option>)}
        </Select>
        <Select label="Metric" value={form.metric_type} onChange={(e: any) => setForm(p => ({ ...p, metric_type: e.target.value }))}>
          {[['revenue','💰 Revenue'],['pipeline','📊 Pipeline'],['churn','📉 Churn']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input label="Value (USD) *" type="number" value={form.value} placeholder="25000" onChange={(e: any) => setForm(p => ({ ...p, value: e.target.value }))} />
        <Input label="Date *" type="date" value={form.date} onChange={(e: any) => setForm(p => ({ ...p, date: e.target.value }))} />
        <button onClick={submit} disabled={loading}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all">
          {loading ? 'Adding...' : 'Add Outcome'}
        </button>
      </div>
    </div>
  );
}

function UploadPage({ onSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) return alert('CSV files only');
    setLoading(true);
    try { const res = await uploadCSV(file); setResult(res.result); onSuccess(); } catch {}
    setLoading(false);
  }

  return (
    <div className="max-w-md space-y-4">
      <div style={{ background: '#0d1221', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px' }} className="p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Bulk Import</h2>
          <p className="text-xs text-slate-500 mt-1">Upload a CSV to import multiple decisions at once</p>
        </div>

        <div onClick={() => document.getElementById('csv')?.click()}
          style={{ border: '1.5px dashed rgba(99,102,241,0.3)', borderRadius: '12px', background: 'rgba(99,102,241,0.03)' }}
          className="p-10 text-center cursor-pointer hover:bg-indigo-500/5 transition-colors">
          <div className="text-3xl mb-3">{loading ? '⏳' : '☁️'}</div>
          <div className="text-xs font-medium text-slate-300 mb-1">{loading ? 'Uploading...' : 'Click to upload CSV'}</div>
          <div className="text-xs text-slate-600">type, date, owner, cost_amount, description</div>
          <input id="csv" type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {result && (
          <div className="grid grid-cols-2 gap-3">
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px' }} className="p-4 text-center">
              <div className="text-xl font-bold text-emerald-400">{result.success}</div>
              <div className="text-xs text-slate-500 mt-1">Imported</div>
            </div>
            <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '12px' }} className="p-4 text-center">
              <div className="text-xl font-bold text-red-400">{result.failed}</div>
              <div className="text-xs text-slate-500 mt-1">Failed</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}