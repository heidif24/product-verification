import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Download, Smartphone } from "lucide-react";
import "./download.css";

function safeDownloadUrl(value?: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export default function DownloadPage() {
  const androidUrl = safeDownloadUrl(process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL);
  const iosUrl = safeDownloadUrl(process.env.NEXT_PUBLIC_IOS_DOWNLOAD_URL);
  return <main className="download-shell">
    <header className="download-header"><Link className="download-brand" href="/"><span className="download-mark">pan.</span><span>PRODUCT AUTHENTICATION NETWORK</span></Link><Link href="/" className="download-return"><ArrowLeft size={14} /> Verify on web</Link></header>
    <section className="download-content">
      <div className="download-eyebrow"><Smartphone size={15} /> PAN VERIFY</div>
      <h1>Verification, in your pocket.</h1>
      <p>Scan a product code, review its registered details and send a report without leaving the PAN app.</p>
      <div className="download-options">
        <article><span className="download-platform">ANDROID</span><h2>Google Play</h2><p>Scan, verify and report from your Android phone.</p>{androidUrl ? <a href={androidUrl} target="_blank" rel="noreferrer">Download for Android <Download size={15} /></a> : <span className="download-pending">Store listing not configured yet</span>}</article>
        <article><span className="download-platform">iPHONE &amp; iPAD</span><h2>App Store</h2><p>Keep the PAN verification tools close at hand.</p>{iosUrl ? <a href={iosUrl} target="_blank" rel="noreferrer">Download for iOS <Download size={15} /></a> : <span className="download-pending">Store listing not configured yet</span>}</article>
      </div>
      <div className="download-web-option"><span>Prefer not to install an app?</span><Link href="/">Continue verifying on PAN web <ArrowUpRight size={14} /></Link></div>
    </section>
    <footer className="download-footer"><span>© 2026 Product Authentication Network</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span></footer>
  </main>;
}
