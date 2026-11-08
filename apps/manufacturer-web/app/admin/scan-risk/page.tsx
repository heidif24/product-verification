"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, ShieldAlert } from "lucide-react";
import "../admin.css";
import "./scan-risk.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
type Event = { id: string; outcome: string; riskLevel: string; createdAt: string; identity: null | { publicCode: string; verificationCount: number; batch: { batchCode: string; product: { name: string; manufacturer: { legalName: string } } } } };

export default function GlobalScanRiskPage() {
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(currentToken = token) {
    const response = await fetch(API + "/v1/super-admin/scan-risk", { headers: { Authorization: "Bearer " + currentToken } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not load global risk events.");
    setEvents(data);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("pan_super_admin_token") || "";
    setToken(saved);
    if (!saved) {
      setNotice("Sign in through Network Control to review global scan risk.");
      setLoading(false);
      return;
    }
    void load(saved).catch(error => setNotice(error instanceof Error ? error.message : "Could not load global risk events."))
      .finally(() => setLoading(false));
  }, []);

  return <main className="global-risk-shell">
    <header><span>Network Control / Global scan risk</span><button type="button" onClick={() => void load().catch(error => setNotice(error.message))}><RefreshCw size={14} /> Refresh</button></header>
    <section className="global-risk-content"><div className="finance-eyebrow">GLOBAL FRAUD MONITORING</div><h1>Scan risk signals.</h1><p>High distinct-session activity is an investigation signal, not proof of counterfeiting.</p>{notice && <div className="finance-notice" role="status">{notice}</div>}
      <div className="global-risk-summary"><ShieldAlert size={20} /><b>{events.length} high-risk events</b><span>Threshold: 10 distinct sessions per identity per UTC day.</span></div>
      {loading ? <p>Loading events…</p> : events.length ? <div className="global-risk-list">{events.map(event => <article key={event.id}><Activity size={18} /><div><b>{event.identity?.publicCode || "Unknown identity"}</b><span>{event.identity?.batch.product.manufacturer.legalName} · {event.identity?.batch.product.name} · {event.identity?.batch.batchCode}</span><small>{new Date(event.createdAt).toLocaleString()} · {event.identity?.verificationCount ?? 0} independent checks</small></div><strong>{event.outcome.replaceAll("_", " ")}</strong></article>)}</div> : <div className="global-risk-empty"><Activity size={28} /><b>No high-risk events</b><span>Flagged multi-session patterns will appear here.</span></div>}
    </section>
  </main>;
}
