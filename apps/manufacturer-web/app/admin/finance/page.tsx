"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BadgeDollarSign, CirclePlus, RefreshCw, ShieldCheck } from "lucide-react";
import "../admin.css";
import "./finance.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
type CreditPackage = { id: string; name: string; credits: number; amountMinor: number; currency: string; active: boolean };
type Company = { id: string; legalName: string; status: string };

export default function FinanceOperationsPage() {
  const [token, setToken] = useState("");
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [packageForm, setPackageForm] = useState({ name: "", credits: "10000", amountMinor: "" });
  const [promotionAmount, setPromotionAmount] = useState("100000");
  const [promotionReason, setPromotionReason] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(API + path, { ...init, headers: { Authorization: "Bearer " + token, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Finance operation failed.");
    return data;
  }

  async function load(currentToken = token) {
    const headers = { Authorization: "Bearer " + currentToken };
    const [packageResponse, companyResponse] = await Promise.all([
      fetch(API + "/v1/super-admin/credit-packages", { headers }),
      fetch(API + "/v1/super-admin/companies?status=APPROVED", { headers })
    ]);
    const [packageData, companyData] = await Promise.all([packageResponse.json(), companyResponse.json()]);
    if (!packageResponse.ok || !companyResponse.ok) throw new Error(packageData.message || companyData.message || "Could not load finance settings.");
    setPackages(packageData);
    setCompanies(companyData);
    if (companyData.length && !companyId) setCompanyId(companyData[0].id);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("pan_super_admin_token") || "";
    setToken(saved);
    if (!saved) {
      setNotice("Sign in through Network Control before managing credits.");
      setLoading(false);
      return;
    }
    void load(saved).catch(error => setNotice(error instanceof Error ? error.message : "Could not load finance settings."))
      .finally(() => setLoading(false));
  }, []);

  async function createPackage(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await request("/v1/super-admin/credit-packages", { method: "POST", body: JSON.stringify({ ...packageForm, credits: Number(packageForm.credits), amountMinor: Number(packageForm.amountMinor), reason: "Credit package pricing configured by network finance." }) });
      setPackageForm({ name: "", credits: "10000", amountMinor: "" });
      await load();
      setNotice("Credit package added and audit entry recorded.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create package."); }
    finally { setBusy(false); }
  }

  async function togglePackage(pack: CreditPackage) {
    setBusy(true);
    setNotice("");
    try {
      await request("/v1/super-admin/credit-packages/" + pack.id, { method: "PUT", body: JSON.stringify({ active: !pack.active, reason: "Network finance changed package availability." }) });
      await load();
      setNotice("Package availability updated and audited.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update package."); }
    finally { setBusy(false); }
  }

  async function grantPromotion(event: FormEvent) {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await request("/v1/super-admin/companies/" + companyId + "/promotional-credit", { method: "POST", body: JSON.stringify({ amountCredits: Number(promotionAmount), reason: promotionReason }) });
      setPromotionReason("");
      setNotice(result.granted.toLocaleString() + " promotional credits allocated and audited.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not grant promotional credits."); }
    finally { setBusy(false); }
  }

  async function adjustWallet(event: FormEvent) {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await request("/v1/super-admin/companies/" + companyId + "/wallet-adjustments", { method: "POST", body: JSON.stringify({ amountCredits: Number(adjustmentAmount), idempotencyKey: "admin-" + crypto.randomUUID(), reason: adjustmentReason }) });
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setNotice((result.amountCredits > 0 ? "Credit added" : "Debit recorded") + " and audited.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not adjust wallet."); }
    finally { setBusy(false); }
  }

  return <main className="finance-shell">
    <header><span>Network Control / Credits &amp; pricing</span><button type="button" onClick={() => void load().catch(error => setNotice(error.message))}><RefreshCw size={14} /> Refresh</button></header>
    <section className="finance-content">
      <div className="finance-eyebrow">FINANCE OPERATIONS</div>
      <h1>Credit economy.</h1>
      <p>Packages, promotional allocation and manual adjustments are recorded to the company ledger.</p>
      {notice && <div className="finance-notice" role="status">{notice}</div>}
      {!token ? <p><a href="/admin">Return to Network Control sign in</a></p> : loading ? <p>Loading finance records…</p> : <>
        <section className="finance-section"><div className="finance-section-title"><h2>Credit packages</h2><BadgeDollarSign size={19} /></div>
          <form className="finance-form finance-package-form" onSubmit={createPackage}><label>Package name<input required maxLength={80} value={packageForm.name} onChange={event => setPackageForm({ ...packageForm, name: event.target.value })} /></label><label>Credits<input required type="number" min="1" max="10000000" value={packageForm.credits} onChange={event => setPackageForm({ ...packageForm, credits: event.target.value })} /></label><label>Price (kobo)<input required type="number" min="100" value={packageForm.amountMinor} onChange={event => setPackageForm({ ...packageForm, amountMinor: event.target.value })} /></label><button disabled={busy}><CirclePlus size={14} /> Add package</button></form>
          <div className="finance-package-list">{packages.map(pack => <article key={pack.id}><div><b>{pack.name}</b><span>{pack.credits.toLocaleString()} credits · {new Intl.NumberFormat("en-NG", { style: "currency", currency: pack.currency }).format(pack.amountMinor / 100)}</span></div><span className={pack.active ? "finance-active" : "finance-inactive"}>{pack.active ? "ACTIVE" : "PAUSED"}</span><button type="button" disabled={busy} onClick={() => void togglePackage(pack)}>{pack.active ? "Pause" : "Enable"}</button></article>)}</div>
        </section>
        <section className="finance-section"><div className="finance-section-title"><h2>Company wallet operations</h2><ShieldCheck size={18} /></div>
          <label className="finance-company">Approved manufacturer<select value={companyId} onChange={event => setCompanyId(event.target.value)}><option value="">Choose a company</option>{companies.map(company => <option key={company.id} value={company.id}>{company.legalName}</option>)}</select></label>
          <div className="finance-operation-grid">
            <form className="finance-form" onSubmit={grantPromotion}><h3>Promotional allocation</h3><label>Credits<input type="number" min="1" max="1000000" value={promotionAmount} onChange={event => setPromotionAmount(event.target.value)} /></label><label>Reason<textarea required minLength={10} maxLength={500} value={promotionReason} onChange={event => setPromotionReason(event.target.value)} /></label><button disabled={busy || !companyId}>Grant one-time promotion</button></form>
            <form className="finance-form" onSubmit={adjustWallet}><h3>Ledger adjustment</h3><label>Signed credits<input required type="number" min="-10000000" max="10000000" value={adjustmentAmount} onChange={event => setAdjustmentAmount(event.target.value)} placeholder="Positive credit / negative debit" /></label><label>Reason<textarea required minLength={10} maxLength={500} value={adjustmentReason} onChange={event => setAdjustmentReason(event.target.value)} /></label><button disabled={busy || !companyId}>Record adjustment</button></form>
          </div>
          <p className="finance-warning">Promotional allocations are single-use per company. Payment credits are never granted from browser callbacks; Paystack settlement must be verified by the API.</p>
        </section>
      </>}
    </section>
  </main>;
}
