"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, RefreshCw, WalletCards } from "lucide-react";
import "../ops.css";
import "./wallet.css";
import "./wallet-payments.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
type Package = { id: string; name: string; credits: number; amountMinor: number; currency: string };
type Entry = { id: string; amountCredits: number; type: string; reason: string; createdAt: string };
type Wallet = { balance: number; entries: Entry[]; payments: Array<{ reference: string; status: string; credits: number; amountMinor: number; currency: string; createdAt: string; paidAt: string | null }>; packages: Package[] };

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amountMinor / 100);
}

export default function ManufacturerWalletPage() {
  const [token, setToken] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busyPackage, setBusyPackage] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(currentToken = token) {
    const response = await fetch(API + "/v1/manufacturer/wallet", { headers: { Authorization: "Bearer " + currentToken } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not load wallet.");
    setWallet(data);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("pan_access_token") || "";
    setToken(saved);
    if (!saved) {
      setNotice("Sign in to your manufacturer workspace to view its wallet.");
      setLoading(false);
      return;
    }
    const reference = new URLSearchParams(window.location.search).get("reference");
    void (async () => {
      try {
        if (reference) {
          const response = await fetch(API + "/v1/manufacturer/wallet/payments/" + encodeURIComponent(reference) + "/verify", { method: "POST", headers: { Authorization: "Bearer " + saved } });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.message || "Could not verify payment.");
          setNotice(result.status === "PAID" ? result.credits + " credits added to the wallet." : "Payment status: " + result.status + ".");
          window.history.replaceState({}, "", "/portal/wallet");
        }
        await load(saved);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not load wallet.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function purchase(pack: Package) {
    setBusyPackage(pack.id);
    setNotice("");
    try {
      const response = await fetch(API + "/v1/manufacturer/wallet/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ packageId: pack.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not start payment.");
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not start payment.");
      setBusyPackage("");
    }
  }

  async function verifyPayment(reference: string) {
    setNotice("");
    try {
      const response = await fetch(API + "/v1/manufacturer/wallet/payments/" + encodeURIComponent(reference) + "/verify", { method: "POST", headers: { Authorization: "Bearer " + token } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not verify payment.");
      setNotice(data.status === "PAID" ? data.credits + " credits added to the wallet." : "Payment status: " + data.status + ".");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not verify payment.");
    }
  }

  return <main className="ops-shell wallet-shell">
    <aside>
      <a className="ops-brand" href="/portal">✳ <b>pan.</b><small>MANUFACTURER</small></a>
      <p>WORKSPACE</p>
      <a href="/portal">Overview &amp; products</a>
      <a href="/portal/issuance">Code studio</a>
      <a href="/portal/wallet" aria-current="page">Wallet &amp; credits</a>
      <a href="/portal/reports">Consumer reports</a>
    </aside>
    <section>
      <header><span>Manufacturer workspace / Wallet</span><button type="button" className="wallet-refresh" onClick={() => void load().catch(error => setNotice(error.message))} disabled={loading}><RefreshCw size={14} /> Refresh</button></header>
      <div className="ops-content wallet-content">
        <div className="ops-eyebrow">FINANCE</div>
        <h1>Credits, accounted for.</h1>
        <p className="ops-subtitle">Every code issue is charged against your ledger; settled payments are verified by the PAN server.</p>
        {notice && <p className="wallet-notice" role="status">{notice}</p>}
        <section className="wallet-balance">
          <div><span>AVAILABLE CODE CREDITS</span><b>{loading ? "—" : (wallet?.balance ?? 0).toLocaleString()}</b><small>One credit per unit or carton identity</small></div>
          <WalletCards size={30} />
        </section>
        <section className="wallet-packages">
          <div className="wallet-section-heading"><div><div className="ops-eyebrow">TOP UP</div><h2>Credit packages</h2></div><CircleDollarSign size={20} /></div>
          {loading ? <p>Loading available packages…</p> : wallet?.packages.length ? <div className="wallet-package-grid">{wallet.packages.map(pack => <article key={pack.id}>
            <span>{pack.name}</span><b>{pack.credits.toLocaleString()} credits</b><strong>{money(pack.amountMinor, pack.currency)}</strong>
            <button type="button" disabled={!!busyPackage} onClick={() => void purchase(pack)}>{busyPackage === pack.id ? "Connecting…" : <>Continue to payment <ArrowUpRight size={14} /></>}</button>
          </article>)}</div> : <p>No credit packages are currently available.</p>}
        </section>
        <section className="wallet-ledger">
          <div className="wallet-section-heading"><div><div className="ops-eyebrow">ACCOUNT ACTIVITY</div><h2>Credit ledger</h2></div><span>{wallet?.entries.length ?? 0} entries</span></div>
          {!wallet?.entries.length ? <p>No ledger activity yet.</p> : wallet.entries.map(entry => <article key={entry.id}>
            <span className={entry.amountCredits > 0 ? "wallet-credit-icon" : "wallet-debit-icon"}>{entry.amountCredits > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
            <div><b>{entry.type.replaceAll("_", " ")}</b><small>{entry.reason} · {new Date(entry.createdAt).toLocaleString()}</small></div>
            <strong className={entry.amountCredits > 0 ? "positive" : "negative"}>{entry.amountCredits > 0 ? "+" : ""}{entry.amountCredits.toLocaleString()}</strong>
          </article>)}
        </section>
        <section className="wallet-ledger">
          <div className="wallet-section-heading"><div><div className="ops-eyebrow">SETTLEMENTS</div><h2>Payment history</h2></div></div>
          {!wallet?.payments.length ? <p>No payment attempts yet.</p> : wallet.payments.map(payment => <article key={payment.reference}>
            <span className={payment.status === "PAID" ? "wallet-credit-icon" : "wallet-debit-icon"}><CircleDollarSign size={16} /></span>
            <div><b>{payment.credits.toLocaleString()} credits · {money(payment.amountMinor, payment.currency)}</b><small>{payment.status} · {new Date(payment.createdAt).toLocaleString()} · {payment.reference}</small></div>
            {payment.status === "PENDING" && <button type="button" className="wallet-verify-payment" onClick={() => void verifyPayment(payment.reference)}>Verify settlement</button>}
          </article>)}
        </section>
        <p className="wallet-footnote">A payment adds credits only after Paystack confirms settlement directly with the PAN server.</p>
      </div>
    </section>
  </main>;
}
