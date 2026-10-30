"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ShieldCheck, ScanLine, ArrowUpRight, Info } from "lucide-react";

export default function VerifyHome() {
  const [code,setCode]=useState(""); const router=useRouter();
  return <main className="verify-shell">
    <header className="verify-header"><a className="verify-brand" href="/"><span className="verify-mark"><Fingerprint size={20}/></span><span><b>pan<span>.</span></b><small>PRODUCT AUTHENTICATION</small></span></a><span className="secure-label"><ShieldCheck size={14}/> TRUST, MADE VISIBLE</span></header>
    <section className="verify-content">
      <div className="verify-kicker"><span/> PRODUCT VERIFICATION</div>
      <h1>Know what<br/>you’re <em>holding.</em></h1>
      <p className="verify-intro">Every product deserves an identity. Scan the product’s PAN code with your phone camera to see its verification details.</p>
      <div className="scan-card"><div className="scan-illustration"><div className="scan-frame"><ScanLine size={45} strokeWidth={1.25}/><i className="scan-corner tl"/><i className="scan-corner tr"/><i className="scan-corner bl"/><i className="scan-corner br"/></div></div><div className="scan-copy"><b>Ready to verify?</b><span>Open your camera and point it at the product’s QR code. The result opens here automatically.</span><small>No account or app installation needed.</small></div></div>
      <div className="verify-divider"><span>OR</span></div>
      <form className="manual-entry" onSubmit={e=>{e.preventDefault();if(code.trim())router.push("/code/"+encodeURIComponent(code.trim().toUpperCase()))}}>
        <label htmlFor="identity">ENTER A PRODUCT ID</label><div><input id="identity" value={code} onChange={e=>setCode(e.target.value)} placeholder="e.g. PANU-0123456789ABCDEF0123" required/><button type="submit">Verify <ArrowUpRight size={15}/></button></div><small>Enter the PAN identity printed beside the QR code.</small>
      </form>
      <div className="verify-note"><Info size={16}/><span>A PAN identity helps you check a product record. It is not, by itself, a laboratory test or a guarantee of the physical contents.</span></div>
    </section>
    <footer className="verify-footer"><span>© 2026 Product Authentication Network</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · Built for trust.</span></footer>
  </main>;
}
