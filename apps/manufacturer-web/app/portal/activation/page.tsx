"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Fingerprint, PrinterCheck } from "lucide-react";
import "../ops.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";

type Batch = {
  id: string;
  batchCode: string;
  quantity: number;
  product: { name: string };
  _count: { identities: number };
};

export default function IdentityActivationPage() {
  const [token, setToken] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [qualityChecked, setQualityChecked] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activated, setActivated] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = sessionStorage.getItem("pan_access_token") || "";
    setToken(savedToken);
    if (!savedToken) {
      setNotice("Sign in to your manufacturer workspace to continue.");
      setLoading(false);
      return;
    }
    fetch(API + "/v1/manufacturer/batches", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data.message || "Could not load production batches.");
        setBatches(data);
        if (data.length) setBatchId(data[0].id);
      })
      .catch(error => setNotice(error instanceof Error ? error.message : "Could not load production batches."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !batchId || !qualityChecked || reason.trim().length < 10) return;
    setBusy(true);
    setNotice("");
    setActivated(null);
    try {
      const response = await fetch(API + "/v1/manufacturer/batches/" + encodeURIComponent(batchId) + "/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ qualityChecked: true, reason: reason.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Identity activation failed.");
      setActivated(data.activated);
      setNotice(data.activated + " identities activated.");
      setQualityChecked(false);
      setReason("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Identity activation failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="ops-shell">
    <aside>
      <a className="ops-brand" href="/portal">✳ <b>pan.</b><small>MANUFACTURER</small></a>
      <p>WORKSPACE</p>
      <a href="/portal">Overview &amp; products</a>
      <a href="/portal/company">Company profile</a>
      <a href="/portal/facilities">Facilities</a>
      <a href="/portal/documents">Documents</a>
      <a href="/portal/team">Team &amp; access</a>
      <a href="/portal/issuance">Code studio</a>
      <a href="/portal/activation" aria-current="page">Identity activation</a>
    </aside>
    <section>
      <header><span>Manufacturer workspace / Identity activation</span><a href="/portal/issuance">Return to Code Studio ↗</a></header>
      <div className="ops-content">
        <div className="ops-eyebrow">PRODUCTION CONTROL</div>
        <h1>Identity activation.</h1>
        <p className="ops-subtitle">Activate exported identities only after printed labels have passed your quality check.</p>
        <section className="ops-card">
          <h2><PrinterCheck size={18} /> Quality confirmation</h2>
          {loading ? <p>Loading production batches…</p> : <form className="ops-form" onSubmit={submit}>
            <label className="ops-span">Production batch
              <select required value={batchId} onChange={event => { setBatchId(event.target.value); setActivated(null); }} disabled={!batches.length || busy}>
                <option value="">Choose a batch</option>
                {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.product.name} · {batch.batchCode}</option>)}
              </select>
            </label>
            {batchId && <p className="ops-span ops-hint">Activation applies to exported identities in this batch. Unexported identities remain inactive.</p>}
            <label className="ops-span">
              <span><input type="checkbox" checked={qualityChecked} onChange={event => setQualityChecked(event.target.checked)} disabled={busy} /> I confirm the printed labels were inspected and passed the print-quality check.</span>
            </label>
            <label className="ops-span">Audit reason
              <textarea required minLength={10} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Record the quality check and release decision." disabled={busy} />
            </label>
            <button type="submit" disabled={busy || loading || !batchId || !qualityChecked || reason.trim().length < 10}>
              {busy ? "Activating…" : <><CheckCircle2 size={16} /> Activate exported identities</>}
            </button>
          </form>}
          {notice && <p role="status" className="ops-hint">{notice}</p>}
          {activated !== null && <p><Fingerprint size={16} /> {activated.toLocaleString()} identities are now active for public verification.</p>}
        </section>
      </div>
    </section>
  </main>;
}
