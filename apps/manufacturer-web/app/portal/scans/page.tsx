"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, RefreshCw, ShieldAlert } from "lucide-react";
import "../ops.css";
import "./scans.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
type RiskEvent = { id: string; outcome: string; riskLevel: string; createdAt: string; identity: null | { publicCode: string; verificationCount: number; batch: { batchCode: string; product: { name: string } } } };

export default function ManufacturerScanRiskPage() {
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function load(currentToken = token) {
    const response = await fetch(API + "/v1/manufacturer/scan-risk", { headers: { Authorization: "Bearer " + currentToken } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not load scan alerts.");
    setEvents(data);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("pan_access_token") || "";
    setToken(saved);
    if (!saved) {
      setNotice("Sign in to your manufacturer workspace to review scan activity.");
      setLoading(false);
      return;
    }
    void load(saved).catch(error => setNotice(error instanceof Error ? error.message : "Could not load scan alerts."))
      .finally(() => setLoading(false));
  }, []);

  return <main className="ops-shell scan-risk-shell">
    <aside><a className="ops-brand" href="/portal">✳ <b>pan.</b><small>MANUFACTURER</small></a><p>WORKSPACE</p><a href="/portal">Overview &amp; products</a><a href="/portal/issuance">Code studio</a><a href="/portal/wallet">Wallet &amp; credits</a><a href="/portal/reports">Consumer reports</a><a href="/portal/scans" aria-current="page">Scan intelligence</a></aside>
    <section>
      <header><span>Manufacturer workspace / Scan intelligence</span><button type="button" className="scan-refresh" onClick={() => void load().catch(error => setNotice(error.message))}><RefreshCw size={14} /> Refresh</button></header>
      <div className="ops-content scan-risk-content">
        <div className="ops-eyebrow">VERIFICATION PATTERNS</div>
        <h1>Scan intelligence.</h1>
        <p className="ops-subtitle">Distinct-session spikes are review signals, not proof of counterfeiting.</p>
        {notice && <p className="scan-risk-notice" role="status">{notice}</p>}
        <div className="scan-risk-summary"><ShieldAlert size={20} /><div><b>{events.length} flagged events</b><span>High activity threshold: 10 distinct sessions per identity per UTC day.</span></div></div>
        {loading ? <p>Loading scan activity…</p> : events.length ? <div className="scan-risk-list">{events.map(event => <article key={event.id}>
          <div className="scan-risk-icon"><Activity size={17} /></div>
          <div className="scan-risk-main"><b>{event.identity?.publicCode || "Unknown identity"}</b><span>{event.identity?.batch.product.name || "Product"} · Batch {event.identity?.batch.batchCode || "—"}</span><small>{new Date(event.createdAt).toLocaleString()} · {event.identity?.verificationCount ?? 0} independent checks</small></div>
          <span className="scan-risk-label">REVIEW</span>
          <Link href="/portal/reports">Open reports <ArrowUpRight size={13} /></Link>
        </article>)}</div> : <div className="scan-risk-empty"><Activity size={28} /><b>No high-risk scan patterns</b><span>High-risk events will appear here when an identity reaches the distinct-session threshold.</span></div>}
      </div>
    </section>
  </main>;
}
