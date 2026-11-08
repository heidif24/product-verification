"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCheck, ClipboardList, RefreshCw } from "lucide-react";
import "../ops.css";
import "./reports.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
const statuses = ["OPEN", "IN_REVIEW", "CONFIRMED_ISSUE", "RESOLVED", "FALSE_REPORT", "DISMISSED"];
type Report = {
  id: string;
  publicCode: string | null;
  reason: string;
  details: string;
  contactEmail: string | null;
  storeName: string | null;
  city: string | null;
  state: string | null;
  purchaseDate: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  identity: null | { verificationCount: number; batch: { batchCode: string; product: { name: string; brand: string | null } }; events: Array<{ outcome: string; createdAt: string; isIndependent: boolean }> };
};

export default function ManufacturerReportsPage() {
  const [token, setToken] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState("OPEN");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");

  async function load(currentToken = token, currentFilter = filter) {
    const query = currentFilter === "ALL" ? "" : "?status=" + encodeURIComponent(currentFilter);
    const response = await fetch(API + "/v1/manufacturer/reports" + query, { headers: { Authorization: "Bearer " + currentToken } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not load reports.");
    setReports(data);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("pan_access_token") || "";
    setToken(saved);
    if (!saved) {
      setNotice("Sign in to your manufacturer workspace to review reports.");
      setLoading(false);
      return;
    }
    void load(saved, filter).catch(error => setNotice(error instanceof Error ? error.message : "Could not load reports."))
      .finally(() => setLoading(false));
  }, []);

  async function changeFilter(value: string) {
    setFilter(value);
    setLoading(true);
    try { await load(token, value); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not load reports."); }
    finally { setLoading(false); }
  }

  async function update(report: Report) {
    const note = notes[report.id]?.trim() || "";
    if (note.length < 10) {
      setNotice("Add a review note of at least 10 characters.");
      return;
    }
    setSaving(report.id);
    setNotice("");
    try {
      const response = await fetch(API + "/v1/manufacturer/reports/" + encodeURIComponent(report.id) + "/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: report.status, note })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update report.");
      setNotice("Report review saved and audited.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update report.");
    } finally {
      setSaving("");
    }
  }

  return <main className="ops-shell reports-shell">
    <aside>
      <a className="ops-brand" href="/portal">✳ <b>pan.</b><small>MANUFACTURER</small></a>
      <p>WORKSPACE</p>
      <a href="/portal">Overview &amp; products</a>
      <a href="/portal/issuance">Code studio</a>
      <a href="/portal/wallet">Wallet &amp; credits</a>
      <a href="/portal/reports" aria-current="page">Consumer reports</a>
    </aside>
    <section>
      <header><span>Manufacturer workspace / Consumer reports</span><button type="button" className="report-refresh" onClick={() => void load().catch(error => setNotice(error.message))}><RefreshCw size={14} /> Refresh</button></header>
      <div className="ops-content reports-content">
        <div className="ops-eyebrow">FIELD SIGNALS</div>
        <h1>Consumer reports.</h1>
        <p className="ops-subtitle">Review reports linked to your identities alongside their verification timeline.</p>
        {notice && <p className="reports-notice" role="status">{notice}</p>}
        <div className="reports-toolbar"><label>Report status<select value={filter} onChange={event => void changeFilter(event.target.value)}>{["OPEN", "IN_REVIEW", "CONFIRMED_ISSUE", "RESOLVED", "FALSE_REPORT", "DISMISSED", "ALL"].map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><span>{reports.length} reports</span></div>
        {loading ? <p>Loading reports…</p> : reports.length ? <div className="reports-list">{reports.map(report => <article className="report-review" key={report.id}>
          <div className="report-review-head"><div><span className="report-status">{report.status.replaceAll("_", " ")}</span><h2>{report.reason.replaceAll("_", " ")}</h2><small>Received {new Date(report.createdAt).toLocaleString()}</small></div><AlertTriangle size={19} /></div>
          <p className="report-details">{report.details}</p>
          <div className="report-facts"><span><b>Identity</b>{report.publicCode || "Unknown"}</span><span><b>Product / batch</b>{report.identity ? report.identity.batch.product.name + " · " + report.identity.batch.batchCode : "Unmatched report"}</span><span><b>Purchase location</b>{[report.storeName, report.city, report.state].filter(Boolean).join(", ") || "Not provided"}</span><span><b>Purchase date</b>{report.purchaseDate ? new Date(report.purchaseDate).toLocaleDateString() : "Not provided"}</span>{report.contactEmail && <span><b>Contact</b>{report.contactEmail}</span>}</div>
          {report.identity?.events?.length ? <div className="report-timeline"><b>Recent checks · {report.identity.verificationCount} independent</b>{report.identity.events.map((event, index) => <span key={index}>{event.outcome.replaceAll("_", " ")} · {event.isIndependent ? "independent" : "same-session refresh"} · {new Date(event.createdAt).toLocaleString()}</span>)}</div> : null}
          <div className="report-review-actions"><label>Review state<select value={report.status} onChange={event => setReports(rows => rows.map(row => row.id === report.id ? { ...row, status: event.target.value } : row))}>{statuses.slice(1, 5).map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><label>Review note<textarea minLength={10} maxLength={1000} value={notes[report.id] ?? report.adminNote ?? ""} onChange={event => setNotes(values => ({ ...values, [report.id]: event.target.value }))} placeholder="Record findings and the decision." /></label><button type="button" disabled={saving === report.id} onClick={() => void update(report)}><CheckCheck size={15} /> {saving === report.id ? "Saving…" : "Save review"}</button></div>
        </article>)}</div> : <div className="reports-empty"><ClipboardList size={28} /><b>No reports in this view</b><span>New consumer reports linked to your identities will appear here.</span></div>}
      </div>
    </section>
  </main>;
}
